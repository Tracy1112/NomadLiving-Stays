/**
 * RAG assistant route — POST /api/ai-assistant
 *
 * Flow (all server-side, AWS keys never reach the browser):
 *   1. Embed the user's question with Titan Text Embeddings V2 (1024-dim).
 *   2. Atlas $vectorSearch against HOMEAWAY.rag_chunks (index property_review_index).
 *   3. Build a grounded prompt from the retrieved chunks.
 *   4. Ask Amazon Nova Lite to answer ONLY from that context.
 *   5. Return { answer, sources }.
 *
 * v1 is non-streaming on purpose — streaming can be layered on later.
 */

import { type NextRequest } from 'next/server';
import { MongoClient } from 'mongodb';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

// Bedrock SDK needs the Node.js runtime (not Edge), and this route is dynamic.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMBED_DIMENSIONS = 1024;
const NUM_CANDIDATES = 50;
const TOP_K = 5;

const NO_INFO_ANSWER =
  "I don't have that information in the current NomadLiving property and review data.";

// ---- Cached MongoDB client (reused across requests in a warm server) -------
let mongoClientPromise: Promise<MongoClient> | null = null;
function getMongoClient(uri: string) {
  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(uri).connect();
  }
  return mongoClientPromise;
}

// ---- Bedrock client --------------------------------------------------------
function getBedrock() {
  return new BedrockRuntimeClient({ region: process.env.AWS_REGION });
}

async function embedQuestion(bedrock: BedrockRuntimeClient, text: string) {
  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_EMBED_MODEL_ID || 'amazon.titan-embed-text-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: text,
      dimensions: EMBED_DIMENSIONS,
      normalize: true,
    }),
  });
  const res = await bedrock.send(command);
  const body = JSON.parse(new TextDecoder().decode(res.body));
  return body.embedding as number[];
}

type Chunk = {
  title: string;
  sourceId: string;
  stayId: string;
  text: string;
  metadata?: Record<string, unknown>;
  score: number;
};

async function vectorSearch(uri: string, queryVector: number[]): Promise<Chunk[]> {
  const client = await getMongoClient(uri);
  const db = client.db(process.env.MONGODB_DB);
  const collection = db.collection(process.env.RAG_COLLECTION || 'rag_chunks');

  const pipeline = [
    {
      $vectorSearch: {
        index: process.env.ATLAS_VECTOR_INDEX || 'property_review_index',
        path: 'embedding',
        queryVector,
        numCandidates: NUM_CANDIDATES,
        limit: TOP_K,
        filter: { sourceType: 'property' },
      },
    },
    {
      $project: {
        _id: 0,
        title: 1,
        sourceId: 1,
        stayId: 1,
        text: 1,
        metadata: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ];

  return collection.aggregate<Chunk>(pipeline).toArray();
}

function buildPrompt(question: string, chunks: Chunk[]) {
  const context = chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] ${c.title}\n${c.text}`
    )
    .join('\n\n---\n\n');

  const system = [
    'You are NomadLiving Stays\' helpful assistant.',
    'Answer the user\'s question using ONLY the information in the provided context.',
    'Do not use outside knowledge and do not make up details.',
    `If the answer is not in the context, reply EXACTLY with: "${NO_INFO_ANSWER}"`,
    'Be concise and mention the relevant stay names when helpful.',
  ].join(' ');

  const userMessage = `Context:\n${context}\n\nQuestion: ${question}`;

  return { system, userMessage };
}

async function callNovaLite(
  bedrock: BedrockRuntimeClient,
  system: string,
  userMessage: string
) {
  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_CHAT_MODEL_ID || 'amazon.nova-lite-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      system: [{ text: system }],
      messages: [{ role: 'user', content: [{ text: userMessage }] }],
      inferenceConfig: { maxTokens: 512, temperature: 0.2, topP: 0.9 },
    }),
  });
  const res = await bedrock.send(command);
  const body = JSON.parse(new TextDecoder().decode(res.body));
  return body?.output?.message?.content?.[0]?.text?.trim() ?? NO_INFO_ANSWER;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri || !process.env.MONGODB_DB || !process.env.AWS_REGION) {
      return Response.json(
        { error: 'Server is not configured for the AI assistant.' },
        { status: 500 }
      );
    }

    const { message } = await req.json().catch(() => ({ message: undefined }));
    if (!message || typeof message !== 'string' || !message.trim()) {
      return Response.json(
        { error: 'A non-empty "message" string is required.' },
        { status: 400 }
      );
    }

    const bedrock = getBedrock();

    // 1) Embed the question
    const queryVector = await embedQuestion(bedrock, message.trim());

    // 2) Retrieve the most relevant chunks
    const chunks = await vectorSearch(uri, queryVector);

    // No relevant context -> grounded fallback, skip the LLM call (saves cost)
    if (chunks.length === 0) {
      console.log(
        `[ai-assistant] no matches | ${Date.now() - startedAt}ms | q="${message.slice(0, 60)}"`
      );
      return Response.json({ answer: NO_INFO_ANSWER, sources: [] });
    }

    // 3) + 4) Build grounded prompt and generate the answer
    const { system, userMessage } = buildPrompt(message.trim(), chunks);
    const answer = await callNovaLite(bedrock, system, userMessage);

    const sources = chunks.map((c) => ({
      title: c.title,
      sourceId: c.sourceId,
      stayId: c.stayId,
      score: c.score,
      metadata: c.metadata ?? {},
    }));

    const latencyMs = Date.now() - startedAt;
    console.log(
      `[ai-assistant] ok | ${latencyMs}ms | ${chunks.length} sources | q="${message.slice(0, 60)}"`
    );

    return Response.json({ answer, sources, latencyMs });
  } catch (error) {
    console.error('[ai-assistant] error:', error);
    return Response.json(
      { error: 'The assistant failed to respond. Please try again.' },
      { status: 500 }
    );
  }
}
