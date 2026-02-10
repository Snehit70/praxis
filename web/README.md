# Quiz App - IIT Madras BS

A responsive web-first quiz application for IIT Madras BS students to practice with previous exam questions.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: Clerk
- **Styling**: Tailwind CSS v4 + Shadcn UI
- **Language**: TypeScript
- **Runtime**: Bun

## Getting Started

### 1. Install Dependencies

```bash
cd web
bun install
```

### 2. Setup Clerk Authentication

You have two options:

#### Option A: Use Clerk CLI (Recommended for local dev)

```bash
npx @clerk/cli@latest
```

This will provide you with test keys automatically.

#### Option B: Manual Setup

1. Create a free account at [clerk.com](https://clerk.com)
2. Create a new application
3. Copy your API keys from the dashboard
4. Create `.env.local` from the template:

```bash
cp .env.local.example .env.local
```

5. Add your keys to `.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
```

### 3. Run Development Server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Build for Production

```bash
bun run build
bun start
```

## Project Structure

```
web/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── sign-in/      # Clerk sign-in page
│   │   ├── sign-up/      # Clerk sign-up page
│   │   ├── layout.tsx    # Root layout with ClerkProvider
│   │   └── page.tsx      # Home page
│   └── lib/
│       └── utils.ts      # Utility functions (cn helper)
├── components.json       # Shadcn UI configuration
├── tailwind.config.ts    # Tailwind configuration
└── middleware.ts         # Clerk auth middleware
```

## Features (Planned)

- [ ] User authentication (Clerk)
- [ ] Quiz browsing by course/exam type
- [ ] Three quiz modes:
  - Standard Exam (60min hard limit)
  - Practice (stopwatch, self-paced)
  - Learning (per-question feedback)
- [ ] Progress tracking
- [ ] Analytics dashboard
- [ ] Admin panel for question management

## Data Source

Quiz questions are sourced from scraped IIT Madras BS exam papers (stored separately, not in this repo).

## License

Private project for educational use.
