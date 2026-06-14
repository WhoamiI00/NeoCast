# NeoCast

A screen recording & video sharing platform built on a fully free stack.

## Stack

- **Next.js 15** (App Router, Server Actions)
- **Neon** — serverless Postgres (free 0.5 GB)
- **Drizzle ORM**
- **Cloudflare R2** — S3-compatible object storage (free 10 GB, zero egress)
- **Groq Whisper** — AI transcription (free tier, VTT output)
- **Better Auth** — Google OAuth
- **Arcjet** — rate limiting & bot protection (free tier)
- **Tailwind CSS v4**

## Features

- Screen recording (capped at **2 minutes**, **720p**, ~1.2 Mbps) — keeps R2 usage low
- Direct browser → R2 upload via presigned URLs (server never touches the video bytes)
- Native `<video>` playback (no third-party iframe)
- AI transcripts via Groq `whisper-large-v3`, stored as VTT in Postgres
- Public/private visibility, view counts, search, sort

## Setup

1. Copy `.env.example` to `.env` and fill in credentials.
2. Create the resources:
   - **Neon**: create a project, copy the connection string into `DATABASE_URL`.
   - **Cloudflare R2**: create a bucket, create an API token with R2 read/write, enable public access on the bucket (or attach a custom domain). Copy the `r2.dev` URL into `R2_PUBLIC_BASE_URL`.
   - **Groq**: create an API key at https://console.groq.com.
   - **Google OAuth**: create credentials at https://console.cloud.google.com.
3. Install + push schema:
   ```bash
   npm install
   npm run db:push
   npm run dev
   ```

## Deploy

- **Frontend**: Cloudflare Pages via `@opennextjs/cloudflare` (or Vercel Hobby).
- **R2 CORS**: in your R2 bucket settings, allow `PUT` from your deployed origin so the direct browser upload works.

## Free-tier capacity (rough)

| Resource | Free limit | At 720p ~15MB/clip |
|---|---|---|
| R2 storage | 10 GB | ~650 clips |
| Neon Postgres | 0.5 GB | tens of thousands of rows |
| Groq transcription | generous req/day | hundreds of clips/day |
