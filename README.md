# 🎛️ NomadLiving Ops Console

> MERN-stack internal operations dashboard — part of the NomadLiving full-stack ecosystem.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Site-00C7B7?style=for-the-badge&logo=vercel&logoColor=white)](https://nomadliving-ops.vercel.app)
[![MERN Stack](https://img.shields.io/badge/Stack-MERN-green?style=for-the-badge)](https://nomadliving-ops.vercel.app)
[![Node](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)

## Overview

NomadLiving Ops is the internal operations backbone of the NomadLiving ecosystem. Built for staff and property managers, it centralises maintenance tickets and order tracking across glamping properties. It connects to [NomadLiving Stays](https://nomadliving-stays.vercel.app) (booking platform) and [NomadLiving Boutique](https://nomadliving-boutique.vercel.app) (e-commerce).

## Features

- **Unified ticket system** — maintenance tasks and order fulfilment in one platform
- **Dynamic forms** — fields adapt based on ticket category (maintenance vs. order)
- **Workflow management** — Open → In Progress → Closed with priority levels
- **Advanced filtering** — by category, status, priority, search terms, pagination
- **Analytics dashboard** — Recharts area/bar charts, monthly trends, category breakdown
- **JWT authentication** — HTTP-only cookies, bcrypt password hashing
- **RBAC** — Admin and Staff roles with granular permissions
- **Security** — Helmet, Express Rate Limit, CORS, input validation, Mongo sanitise

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, Redux Toolkit, React Query, Styled Components, Recharts, Vite |
| Backend | Node.js, Express.js, MongoDB, Mongoose |
| Auth | JWT (HTTP-only cookies), bcryptjs |
| Storage | Cloudinary (avatar uploads) |
| DevOps | GitHub Actions CI/CD, Vercel (frontend), Render (backend) |

## Getting Started

    git clone https://github.com/Tracy1112/NomadLiving-Ops.git
    cd NomadLiving-Ops
    cd server && npm install
    cd ../client && npm install
    cp env.example server/.env
    cd server && npm run dev

Open http://localhost:5173

## Project Structure

    client/     React frontend (components, pages, Redux slices)
    server/     Express backend (controllers, models, routes, middleware)

## Ecosystem

| App | Description | Link |
|-----|-------------|------|
| **Stays** | Next.js SSR booking platform | [nomadliving-stays.vercel.app](https://nomadliving-stays.vercel.app) |
| **Boutique** | React/Redux e-commerce store | [nomadliving-boutique.vercel.app](https://nomadliving-boutique.vercel.app) |
| **Ops** (this repo) | MERN internal dashboard | [nomadliving-ops.vercel.app](https://nomadliving-ops.vercel.app) |

## Developer

**Tracy Kong** — Full-Stack Software Engineer, Sydney 🇦🇺

[Portfolio](https://tracy-portfolio-nine.vercel.app) · [LinkedIn](https://www.linkedin.com/in/tracykong1212/)

## License

MIT
