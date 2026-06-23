# 🏕️ NomadLiving Stays

> Next.js SSR booking platform for curated glamping sites — part of the NomadLiving ecosystem.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Site-00C7B7?style=for-the-badge&logo=vercel&logoColor=white)](https://nomadliving-stays.vercel.app)
[![CI](https://img.shields.io/badge/CI-Passing-success?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/Tracy1112/NomadLiving-Stays/actions)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

## Overview

NomadLiving Stays is the booking engine of a three-part integrated platform. It connects to [NomadLiving Boutique](https://nomadliving-boutique.vercel.app) (e-commerce) and [NomadLiving Ops](https://nomadliving-ops.vercel.app) (internal dashboard) through a shared Express/Node.js API and MongoDB database.

## Features

- **Booking system** — date selection, availability filtering, conflict detection
- **Stripe payments** — checkout, webhooks, idempotency checks
- **Clerk authentication** — JWT, RBAC, route protection via middleware
- **Property management** — CRUD, image upload via Supabase, search & filter
- **Admin dashboard** — analytics, revenue tracking, user management
- **Server-side rendering** — Next.js App Router with caching for SEO and performance
- **229 passing tests** — Jest + React Testing Library, 36% coverage

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Zustand |
| Backend | Next.js Server Actions, Prisma ORM, MongoDB |
| Auth & Payments | Clerk, Stripe |
| Storage | Supabase |
| DevOps | GitHub Actions CI/CD, Vercel, Docker |
| Testing | Jest, React Testing Library |

## Getting Started

    git clone https://github.com/Tracy1112/NomadLiving-Stays.git
    cd NomadLiving-Stays
    npm install
    cp .env.example .env.local
    npx prisma generate && npx prisma db push
    npm run dev

Open http://localhost:3000

## Project Structure

    app/            Next.js App Router (pages, API routes)
    components/     React components (booking, property, admin, UI)
    utils/actions/  29 Server Actions across 8 modules
    prisma/         MongoDB schema (5 models)
    __tests__/      19 test suites, 229 test cases

## Ecosystem

| App | Description | Link |
|-----|-------------|------|
| **Stays** (this repo) | SSR booking platform | [nomadliving-stays.vercel.app](https://nomadliving-stays.vercel.app) |
| **Boutique** | React/Redux e-commerce store | [nomadliving-boutique.vercel.app](https://nomadliving-boutique.vercel.app) |
| **Ops** | MERN internal dashboard | [nomadliving-ops.vercel.app](https://nomadliving-ops.vercel.app) |

## AI Stays Assistant (RAG)

A retrieval-augmented assistant that answers questions about our stays using **only**
real Property + Review data, with the source stays shown. Built with **AWS Bedrock**
(Amazon Titan embeddings + Amazon Nova Lite) and **MongoDB Atlas Vector Search**.

### How it works

**RAG = Retrieval-Augmented Generation.** Instead of relying on the language model's
memory, we first *retrieve* relevant facts from our own database, then ask the model to
answer using only those facts. This keeps answers grounded and prevents hallucination.

### Data flow

```
User question
   │
   ▼
POST /api/ai-assistant            (server-side only — AWS keys never reach the browser)
   │
   ├─ 1. Embed question        → Titan Text Embeddings V2 (1024-dim vector)
   ├─ 2. Retrieve              → Atlas $vectorSearch on `rag_chunks`
   │                             (index: property_review_index, cosine, top 5 of 50 candidates)
   ├─ 3. Build grounded prompt → inject the 5 chunks as "Context"
   ├─ 4. Generate              → Amazon Nova Lite, "answer ONLY from context"
   ▼
{ answer, sources }            → UI shows answer + source stay cards (with match score)
```

Offline, a one-time ingestion script turns each stay (property details + its reviews)
into one text chunk, embeds it with Titan, and stores chunk + vector in `rag_chunks`.

### Key files

| File | Role |
|------|------|
| `scripts/ingest-rag.mjs` | One-time ingestion: build chunks, embed, upsert into `rag_chunks` |
| `app/api/ai-assistant/route.ts` | Server route: embed → vector search → Nova Lite → `{ answer, sources }` |
| `app/assistant/page.tsx` | Minimal UI: question box, answer, source stay cards |

### Setup & run

Requires these vars in `.env.local` (already configured in this project):
`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BEDROCK_EMBED_MODEL_ID`,
`BEDROCK_CHAT_MODEL_ID`, `MONGODB_URI`, `MONGODB_DB`, `RAG_COLLECTION`, `ATLAS_VECTOR_INDEX`.

```bash
# 1. Install (one time)
npm install

# 2. Populate the vector store (~20 stays, idempotent, run once)
npm run seed:rag

# 3. Start the app
npm run dev
```

### Test the assistant

1. Sign in, then open **http://localhost:3000/assistant** (or click **"ask ai"** in the nav).
2. Ask a question, e.g. *"Which stays are near Sydney or in New South Wales?"*
3. You'll get a grounded answer plus source stay cards. Weak matches are labelled
   **"related"** instead of **"strong match"** for transparency.

> The route is protected by Clerk middleware, so test it while signed in (through the UI),
> not via an unauthenticated `curl`.

### Design choices & trade-offs

- **Vector search in a separate `rag_chunks` collection**, not inside `Property` — the AI
  feature can't corrupt real booking/listing data; clean separation.
- **Prisma for the app, native `mongodb` driver for RAG** — Prisma doesn't support
  `$vectorSearch`, so retrieval uses the driver directly.
- **Idempotent ingestion** (deterministic `_id` = `property:<stayId>`) — re-running updates
  in place instead of creating duplicates, and avoids re-paying for embeddings.
- **Grounded prompt + explicit fallback** — the model must answer from context or say it
  doesn't have the info; this is the anti-hallucination guarantee.
- **Label, don't hide, weak sources** — top-K always returns 5 results; rather than a hidden
  score threshold (which could hide a real source in a demo), weak matches are shown but
  labelled "related".
- **Cost control** — embeddings precomputed and capped at 20 stays; only the live question is
  embedded at query time; the LLM call is skipped entirely when nothing relevant is found.
- **Non-streaming v1** — simpler to reason about and demo; streaming can be added later.


## Developer

**Tracy Kong** — Full-Stack Software Engineer, Sydney 🇦🇺

[Portfolio](https://tracy-portfolio-nine.vercel.app) · [LinkedIn](https://www.linkedin.com/in/tracykong1212/)

## License

MIT
