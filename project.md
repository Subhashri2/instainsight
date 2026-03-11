# 📸 InstaInsight: Strategic Intelligence for Social Growth

**InstaInsight** is a premium strategic intelligence platform designed for creators and businesses to transform raw Instagram data into high-performance growth strategies. By combining real-time scraping with state-of-the-art Generative AI (Algorithm v4), it provides actionable insights that move the needle.

---

## 🚀 Core Value Proposition
**DATA → RAW SIGNALS → STRATEGIC INSIGHT → EXECUTABLE ACTION**

InstaInsight goes beyond vanity metrics. It uses a **Lean Signal-Dense Architecture** to identify exactly *what* is working, *why* it's working, and how to replicate that success today.

---

## 🛠️ Key Features

### 1. Strategic AI Engine (Algorithm v4)
Our proprietary analysis framework implements:
- **Niche-Specific Playbooks:** Dynamically detects the account archetype (e.g., Bridal Store, SaaS, Educator) and applies specialized strategic filters.
- **Account Scoring (0-100):** A weighted metric assessing Engagement, Viral Potential, and Buyer Intent.
- **Buyer Intent Detection:** High-speed scanning of comment sentiment to identify "hot" leads and purchase-ready followers.
- **Lean Prompting:** Optimized token efficiency that delivers 4x better results while reducing AI costs by 60%.

### 2. Actionable Dashboard
- **Action Cards:** Priority-ordered strategic shifts with "Ready-to-Copy" hooks, captions, and CTAs.
- **Viral Signal Analysis:** Identifies outliers that performed 150%+ above average to extract the "Viral Blueprint".
- **Specific Product Post Plan:** High-conversion content planning for specific items, complete with AI-generated thumbnail prompts.

### 3. Persistent Business Logic
- **PocketBase Integration:** Secure user authentication and persistent history of all analyses.
- **Multi-Engine AI:** Primary execution on **Gemini 2.0 Flash** with fail-safe routing.
- **Hybrid Scraper:** Powered by **Scrapling (Local Engine)** with an automated **Apify Cloud** fallback.

---

## 🏗️ Technical Architecture

- **Frontend:** React 19 + Vite + Tailwind CSS v4 + Framer Motion.
- **Backend:** Node.js (TypeScript) + Express.
- **Database:** PocketBase (Portable, single-binary database).
- **Scraper:** Python-based Scrapling engine + Playwright/Patchright.
- **AI Stack:** Google Gemini 2.0, Groq (Llama 3.3), and Hugging Face.

---

## 📂 Project Structure (Cleaned for Demo)

- `backend/server.ts`: Express + Vite middleware gateway that handles scraping, AI orchestration, PocketBase APIs, and shared instructions.
- `backend/lib/*.ts`: PocketBase helpers (`db.ts`, `pocketbase.ts`) plus `backend/utils/buyerIntentScanner.ts`.
- `backend/scraper.ts` + `backend/instagram_scrapling.py`: Scrapling + Apify hybrid scraping stack.
- `backend/pb_setup.ts`: PocketBase collection bootstrapper.
- `backend/pb_data/` + `backend/pb_migrations/`: Persistent PocketBase storage (ignored from git).
- `src/App.tsx`, `src/components`, `src/hooks`: Vite/React premium dashboard UI accessed via the `npm run dev` workflow.
- `.devcontainer/`: Codespaces setup that wires up PocketBase, the scraper, and Vite for instant onboarding.

---

## 🛠️ Getting Started (Codespaces / Local)

1. **Backend environment:** Copy `backend/.env.example` to `backend/.env` and fill in the keys (`GEMINI_API_KEY`, `POCKETBASE_URL`, `PB_ADMIN_*`, `APIFY_API_TOKEN`, scraper toggles, etc.). This keeps the server-side secrets next to the backend code and is automatically loaded before the Express routes spin up.
2. **Frontend environment:** Copy `.env.example` to `.env` (or set the Vercel project variables) and make sure `VITE_API_BASE_URL` points to your Codespace-forwarded backend URL when the UI is hosted on Vercel. Leave it blank during local `npm run dev` so the UI just proxies to the same origin. `VITE_GEMINI_API_KEY` remains optional—most core operations still go through the backend.
3. **Instagram Cookies:** Drop `instagram_cookies.json` in the repo root so the local Scrapling engine can bypass login walls when scraping.
4. **Start PocketBase:** Run `npm run pb` (this runs `pocketbase serve --dir ./backend/pb_data` or the bundled binary depending on your platform).
5. **Start the stack:** Run `npm run dev` (concurrently starts PocketBase and the backend server with Vite middleware; the UI is available on 5173 in Codespaces).
6. **Access:** Visit the forwarded dev port (e.g., `https://<codespace>.preview/...`) or, when deploying the frontend to Vercel, the published Vercel URL will consume the backend through `VITE_API_BASE_URL`.

---
*Locked & Ready for Deployment*
*© 2026 InstaInsight Strategic Team*
