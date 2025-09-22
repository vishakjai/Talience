# Talience AI Interviewing Agent

Talience is an AI-driven video interviewing experience that combines **Twilio Programmable Video**, a **React + TypeScript** single-page application, and **OpenAI** models to deliver structured, skills-based conversations with candidates. The project demonstrates how to orchestrate live video, conversational intelligence, and recruiter-facing job context in a cohesive workflow.

## Key capabilities

- 🔐 Securely mint Twilio access tokens for each candidate and room.
- 🎥 Join real-time video interviews built with `twilio-video` and WebRTC.
- 🧠 Generate adaptive, role-aware interview questions and feedback by calling OpenAI's chat completions API.
- 📋 Pair every interview with rich job context so the AI can tailor its prompts to the competencies that matter most.
- 💬 Offer a structured chat panel that tracks the conversation, highlights AI feedback, and encourages thoughtful responses.

## Project structure

```text
client/   React + TypeScript front-end (Vite)
server/   Express API for Twilio tokens, OpenAI prompts, and job metadata
```

## Prerequisites

- Node.js 18+
- A Twilio account with Programmable Video enabled and API keys generated
- An OpenAI API key with access to the `gpt-4o` model family (the server defaults to `gpt-4o-mini`)

## Environment configuration

Duplicate the example environment file and fill in your credentials:

```bash
cp server/.env.example server/.env
```

| Variable | Description |
| --- | --- |
| `PORT` | Port for the Express server (defaults to `5001`). |
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID. |
| `TWILIO_API_KEY_SID` / `TWILIO_API_KEY_SECRET` | API key + secret pair with Programmable Video scope. |
| `OPENAI_API_KEY` | Secret key for the OpenAI API. |
| `OPENAI_MODEL` *(optional)* | Override the default `gpt-4o-mini` model. |

## Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

## Run the development environment

Start the Express API (defaults to `http://localhost:5001`):

```bash
cd server
npm run dev
```

Launch the Vite dev server for the React client (proxies `/api` requests to the Express server):

```bash
cd client
npm run dev
```

Open `http://localhost:5173` to access the Talience interviewer.

## How it works

### Server

- `/api/token` &mdash; Generates a Twilio Programmable Video token for the requested room/identity pair.
- `/api/interview/message` &mdash; Combines a curated interviewing system prompt, the candidate history, and job context before requesting the next AI response from OpenAI.
- `/api/jobs` &mdash; Returns sample job definitions that seed the front-end and contextualise the conversation.

The server is implemented with Express, `twilio` for JWT signing, and the official `openai` SDK. Linting is provided via ESLint (run `npm run lint`).

### Client

- React + TypeScript (Vite) single page interface.
- Uses `twilio-video` to create/join rooms, render local and remote video tracks, and manage participant lifecycles.
- A job summary sidebar helps the candidate understand the competencies being assessed.
- The chat panel collects AI questions, candidate replies, and system notices while preventing overlapping responses.

The client proxies API calls to the local Express server during development and exposes a configurable `VITE_API_BASE_URL` if you deploy the backend separately.

## Next steps & ideas

- Persist interview transcripts and metadata to a database for recruiter review.
- Add automated scoring and competency tagging for each answer.
- Expand the UI with interviewer controls (pause, skip, evaluate) and analytics dashboards.
- Integrate calendaring and candidate identity verification for production readiness.

---

Built with ❤️ to showcase the future of intelligent interviewing workflows.
