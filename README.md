# 🏕️ NomadLiving Stays

> SSR booking platform for curated glamping sites — part of the NomadLiving full-stack ecosystem.

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

```bash
git clone https://github.com/Tracy1112/NomadLiving-Stays.git
cd NomadLiving-Stays
npm install
cp .env.example .env.local   # fill in your credentials
npx prisma generate && npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure
