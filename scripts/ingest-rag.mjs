/**
 * RAG ingestion script for NomadLiving Stays.
 *
 * What it does (plain English):
 * 1. Connects to MongoDB Atlas (the same HOMEAWAY database the app uses).
 * 2. Reads up to LIMIT properties and their reviews.
 * 3. Builds ONE readable text chunk per stay (property details + reviews).
 * 4. Sends that text to AWS Bedrock Titan Text Embeddings V2 -> a 1024-number vector.
 * 5. Upserts the chunk + vector into the `rag_chunks` collection (idempotent:
 *    re-running updates the same document instead of creating duplicates).
 *
 * Run it with:
 *   npm run seed:rag
 * (which is: node --env-file=.env.local scripts/ingest-rag.mjs)
 *
 * This script does NOT touch Property/Review data — it only reads them and
 * writes into the separate rag_chunks collection.
 */

import { MongoClient } from 'mongodb';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

// ---- Config from env (.env.local) -----------------------------------------
const {
  MONGODB_URI,
  MONGODB_DB,
  RAG_COLLECTION = 'rag_chunks',
  AWS_REGION,
  BEDROCK_EMBED_MODEL_ID = 'amazon.titan-embed-text-v2:0',
} = process.env;

// How many properties to ingest on the first run (keeps AWS cost tiny).
const LIMIT = 20;
// Titan V2 must match the Atlas index dimensions (1024).
const EMBED_DIMENSIONS = 1024;

function assertEnv() {
  const missing = [];
  if (!MONGODB_URI) missing.push('MONGODB_URI');
  if (!MONGODB_DB) missing.push('MONGODB_DB');
  if (!AWS_REGION) missing.push('AWS_REGION');
  if (missing.length) {
    console.error(`\n❌ Missing env vars: ${missing.join(', ')}`);
    console.error('   Make sure they exist in .env.local and run via "npm run seed:rag".\n');
    process.exit(1);
  }
}

// ---- Bedrock: turn text into a 1024-dim embedding --------------------------
const bedrock = new BedrockRuntimeClient({ region: AWS_REGION });

async function embedText(text) {
  const command = new InvokeModelCommand({
    modelId: BEDROCK_EMBED_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: text,
      dimensions: EMBED_DIMENSIONS,
      normalize: true,
    }),
  });

  const response = await bedrock.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  if (!Array.isArray(body.embedding) || body.embedding.length !== EMBED_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding from Titan (got length ${body.embedding?.length}, expected ${EMBED_DIMENSIONS})`
    );
  }
  return body.embedding;
}

// ---- Helpers: build a clean, readable chunk per stay -----------------------
function readableAmenities(raw) {
  if (!raw) return '';
  // `amenities` is stored as a String in Prisma; often JSON. Handle both.
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const names = parsed
        .map((a) => (typeof a === 'string' ? a : a?.name))
        .filter(Boolean);
      return names.join(', ');
    }
  } catch {
    // not JSON — fall through and use the raw string
  }
  return String(raw);
}

function buildChunkText(property, reviews) {
  const amenities = readableAmenities(property.amenities);
  const reviewLines = reviews
    .map((r) => `- ${r.rating}/5: ${r.comment}`)
    .join('\n');

  return [
    `Stay name: ${property.name}`,
    property.tagline ? `Tagline: ${property.tagline}` : '',
    `Category: ${property.category}`,
    `Location/Country: ${property.country}`,
    `Price per night: ${property.price} AUD`,
    `Capacity: ${property.guests} guests, ${property.bedrooms} bedrooms, ${property.beds} beds, ${property.baths} baths`,
    amenities ? `Amenities: ${amenities}` : '',
    property.description ? `Description: ${property.description}` : '',
    reviews.length ? `Guest reviews:\n${reviewLines}` : 'Guest reviews: none yet.',
  ]
    .filter(Boolean)
    .join('\n');
}

// ---- Main ------------------------------------------------------------------
async function main() {
  assertEnv();

  const client = new MongoClient(MONGODB_URI);
  const startedAt = Date.now();

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const properties = db.collection('Property');
    const reviews = db.collection('Review');
    const ragChunks = db.collection(RAG_COLLECTION);

    console.log(`\n🔌 Connected to MongoDB db="${MONGODB_DB}"`);

    const propertyDocs = await properties.find({}).limit(LIMIT).toArray();
    console.log(`📦 Found ${propertyDocs.length} properties to ingest (limit ${LIMIT}).\n`);

    let success = 0;
    let failed = 0;

    for (const [i, property] of propertyDocs.entries()) {
      const stayId = String(property._id);
      const label = `[${i + 1}/${propertyDocs.length}] "${property.name}" (${stayId})`;

      try {
        const relatedReviews = await reviews
          .find({ propertyId: stayId })
          .project({ rating: 1, comment: 1 })
          .toArray();

        const text = buildChunkText(property, relatedReviews);

        console.log(`${label} → embedding (${relatedReviews.length} reviews)...`);
        const embedding = await embedText(text);

        const now = new Date();
        await ragChunks.updateOne(
          { _id: `property:${stayId}` }, // deterministic id => idempotent upsert
          {
            $set: {
              sourceType: 'property',
              sourceId: stayId,
              stayId,
              title: property.name,
              text,
              embedding,
              metadata: {
                category: property.category,
                country: property.country,
                price: property.price,
                guests: property.guests,
                bedrooms: property.bedrooms,
                beds: property.beds,
                baths: property.baths,
                reviewCount: relatedReviews.length,
              },
              updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
          },
          { upsert: true }
        );

        success += 1;
        console.log(`${label} ✅ upserted`);
      } catch (err) {
        failed += 1;
        console.error(`${label} ❌ failed: ${err.message}`);
      }
    }

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\n🎉 Done in ${seconds}s — ${success} upserted, ${failed} failed.`);
    console.log(`   Collection: ${MONGODB_DB}.${RAG_COLLECTION}\n`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('\n💥 Ingestion crashed:', err);
  process.exit(1);
});
