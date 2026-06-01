# UNTESTED

This project is not verified end-to-end. The build compiles, deploys to production, and the first three pipeline stages (Stage 0, 1, 2a) have been observed working live. Everything past that has never completed a successful run.

Live URL (deployed, partial verification only): https://aib-m8w1.onrender.com

## What's verified

| Stage / surface | Status |
|---|---|
| `tsc --noEmit` | Clean |
| `next build` | Clean, all 7 routes compile |
| Render deploy on Render free tier | Live, HTTP 200 on `/` |
| Stage 0 — spec ingestion + safety wrap (pure TS) | Verified |
| Stage 1 — spec → Blueprint IR | Verified live, 3 successful runs today |
| Stage 2a — generate clarifying questions | Verified live, 3 successful runs today |
| Provider abstraction (Anthropic + OpenAI + Gemini) | Compiles; only Gemini path exercised at runtime |

## What's NOT verified

| Stage / surface | Why untested |
|---|---|
| Stage 2b — fold answers into Blueprint IR | Truncation: model output exceeded `maxOutputTokens` even after doubling the budget. Likely needs prompt tightening (force terse re-emission). Has never completed a real run. |
| Stage 3 — reference architecture pattern match | Never reached. Pipeline aborted at Stage 2b before getting here. |
| Stage 4 — 6 parallel artifact generators (stack, BoM, diagram, datamodel, failures, estimate) | Never reached. Originally hit Gemini Flash's 5-rpm free-tier ceiling; serialized to 13s spacing per call but blocked behind Stage 2b. |
| Stage 5 — critique pass + conditional rewrite | Never reached. Same reason. |
| `/b/[id]` bundle view rendering | No bundle has ever been generated to render. |
| Mermaid client-side rendering | Compiles; never run with real diagram source. |
| ZIP export route (`/api/bundle/[id]/zip`) | Compiles; never invoked end-to-end with a real bundle payload. |
| Anthropic provider | Compiles; never instantiated. Asmit doesn't have an Anthropic key. |
| OpenAI provider | Compiles; never instantiated. Asmit doesn't have an OpenAI key. |

## Why it's left untested (today)

Two structural blockers compound:

1. **Gemini free tier is fundamentally insufficient for this pipeline.**
   - `gemini-2.5-pro` is `limit: 0` on the free tier — Pro is paid-only.
   - `gemini-2.5-flash` free tier caps at **20 requests/day** and **5 requests/minute**.
   - The AiB pipeline makes **~11 LLM calls per bundle**. One bundle eats half the daily budget.
   - 4 API keys across 2 Google accounts were exhausted in one debugging session today.

2. **Stage 2b has a not-yet-diagnosed truncation issue.** Even with `maxOutputTokens=8000` and `thinkingBudget=0`, the fold-answers stage emits an oversized response that fails to terminate cleanly. Until we get a successful Stage 2b run, the rest of the pipeline can't be verified.

The unblock paths are: (a) wait 24h for a Gemini quota reset and iterate, (b) attach billing to a Google Cloud project to unlock Pro-tier limits, or (c) supply an Anthropic or OpenAI API key and switch providers via `AIB_LLM_PROVIDER`.

Tracked in [issue #1](https://github.com/asmitdash/aib/issues/1) and [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md).

---

# AiB — Architecture-in-a-Box

## What this is

A web app where a solo founder or PM pastes a plain-English product spec and receives an opinionated, defensible architecture bundle: system diagram (Mermaid), recommended stack with rationale and rejected alternatives, Bill of Materials with pricing, Postgres data model with DDL, 5–10 failure mode cards, monthly cost estimate, and a milestone-by-milestone build plan.

One sentence: paste what you want to build, get back the architecture a senior engineer would have whiteboarded — in roughly 60 seconds.

## Why it exists

Early-stage technical founders typically can spec the *what* but not the *how*. They can describe the product but get stuck choosing a stack, modeling data, predicting where it'll break, and estimating cost. Hiring a senior engineer for an architecture pass costs $150–$500/hour. Asking ChatGPT gives you a generic, hedge-everything answer that lists 4 options for every decision and commits to none.

AiB makes the opposite trade. **It is opinionated and committed.** It picks one stack per layer, defends each pick with a paragraph, and explicitly lists the alternatives it rejected and why. The user gets one answer they can argue with, not five they have to choose between.

## What it does (the pipeline)

11 LLM calls organized into 6 stages:

| Stage | What happens |
|---|---|
| **0. Ingest** | Wraps the spec in `<user_spec>` tags so the model treats it as data, not instructions (prompt-injection guard). Computes `spec_hash = sha256(spec)[:12]` for the share URL. |
| **1. Parse** | Spec → **Blueprint IR**: structured JSON with `entities`, `flows`, `external_services`, `constraints`, `nonfunctional`. Validated by Zod. |
| **2a. Question** | Generates 5–10 clarifying questions whose answers most change the architecture (scale, compliance, sync vs async, auth model, budget). |
| **2b. Fold** | After the user answers, folds answers back into the Blueprint IR. |
| **3. Match** | Classifies the IR against a 10-pattern Reference Architecture Library (CRUD SaaS, marketplace, AI-wrapper, B2B-webhooks, RAG, realtime-collab, data-pipeline, mobile-first-api, internal-tool, IoT-telemetry). |
| **4. Generate** | Six artifact generators run from the matched pattern: stack rec, BoM, Mermaid diagram, data model + DDL, failure modes, cost + build plan. Run in parallel for Anthropic/OpenAI; serialized with 13s spacing for Gemini (free-tier rpm constraint). |
| **5. Critique** | Senior-staff-engineer reviewer scores each artifact, flags the weakest 30%, then conditionally rewrites them. |

Output is a six-file bundle: `diagram.mmd`, `stack.md`, `bom.md`, `datamodel.md`, `failures.md`, `estimate.md`, plus a `manifest.json`. Persisted to `localStorage` keyed by `aib:bundle:{spec_hash}` for V1's no-auth share-link flow.

## How it works (architecture)

- **Frontend**: Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, shadcn/ui (new-york style), dark-mode default, sonner for toasts.
- **LLM layer**: provider-agnostic interface (`src/lib/genai/providers/types.ts`). Three implementations: Gemini (`@google/genai`), Anthropic (`@anthropic-ai/sdk` via tool-use for structured output), OpenAI (`openai` via `response_format: json_schema`). Pick one with `AIB_LLM_PROVIDER`.
- **Schemas**: every structured stage has a Zod schema (canonical) and a Gemini Schema (when the Gemini path is hot). Anthropic and OpenAI consume `zod-to-json-schema` output.
- **Caching**: Gemini explicit context caching for the system prompt + reference library when the prefix exceeds the per-model minimum (Pro 4096 tok / Flash 1024 tok). Other providers no-op the cache layer.
- **Pipeline orchestrator**: `src/lib/genai/pipeline.ts`. Two-phase: `runBundle()` returns `{status: "needs_answers", ...}` after Stage 2a, then resumes through Stages 2b–5 once answers arrive at `/api/generate/[runId]/answers`.
- **Hosting**: Render free tier (Oregon). 60s+ request timeouts (no Vercel-style hard ceiling), 15-min idle spin-down. Configured via `render.yaml` Blueprint.
- **Persistence**: none in V1. Drizzle + Neon are installed but unused. Bundles live in `localStorage` on the originating device until V2 adds server-side storage.

## How to use it (when it works)

1. Open the deployed app at https://aib-m8w1.onrender.com (or run `pnpm dev` locally).
2. Paste a product spec into the textarea (≤5,000 tokens of prose).
3. Click **Generate Architecture**.
4. Wait ~10s. Answer the 5–10 clarifying questions that appear.
5. Wait ~80–120s. Get back the bundle at `/b/[id]` with the diagram, stack, BoM, data model, failure modes, cost estimate, and build plan.
6. Optionally download the ZIP or copy the share link.

## How to run locally

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local — fill in AIB_LLM_PROVIDER plus the corresponding API key
pnpm dev
```

Open http://localhost:3000.

## Configuration

```env
# Pick exactly ONE provider:
AIB_LLM_PROVIDER=gemini           # or "anthropic" or "openai"

# Provider-specific keys (only set the one for your provider):
GOOGLE_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Model IDs per provider:
AIB_MODEL_GENERATION=gemini-2.5-pro       # claude-sonnet-4-6 | gpt-4.1
AIB_MODEL_CLASSIFICATION=gemini-2.5-flash # claude-haiku-4-5  | gpt-4.1-mini

# Per-bundle hard caps:
AIB_BUDGET_USD=0.50
AIB_BUDGET_OUTPUT_TOKENS=50000
```

**Recommended providers in order:** Anthropic Claude (best structured output reliability) > OpenAI GPT-4.1 > Gemini Pro (paid) > Gemini Flash (paid) > Gemini Flash (free, will exhaust quota fast and is what AiB has been tested on).

## Project structure

```
src/
  app/
    page.tsx                      # / — spec input
    generate/[runId]/page.tsx     # Q&A
    b/[id]/page.tsx               # bundle view
    api/
      generate/route.ts           # Stages 0–2a
      generate/[runId]/answers/   # Stages 2b–5
      bundle/[id]/zip/            # ZIP export
  components/
    ui/                           # shadcn primitives
    spec-input.tsx
    clarifying-form.tsx
    bundle-view.tsx
    mermaid-diagram.tsx
    explain-tooltip.tsx
    zip-download.tsx
    share-button.tsx
  lib/
    genai/
      providers/                  # types | gemini | anthropic | openai | factory
      schemas/                    # one Zod + Schema pair per stage
      prompts/                    # one prompt builder per stage
      pipeline.ts                 # orchestrator
      stages.ts                   # per-stage callJSON wrappers
      reference-library.ts        # 10 architecture patterns
      cache.ts | budget.ts | pricing.ts | safety.ts | client.ts | errors.ts | mermaid-validate.ts
docs/
  design/                         # original design specs from Luke / Frank / Paige
  KNOWN_ISSUES.md
render.yaml                       # Render Blueprint
```

## Provenance

This was built by orchestrating a team of named Claude Code subagents:

- **Paige** — UI/UX design (wireframes, microcopy, design system)
- **Matt** — full-stack implementation (Next.js, schemas, pipeline)
- **Frank** — Reference Architecture Library (10 patterns)
- **Luke** — LLM systems engineering (prompts, evals, cost envelope)
- **Jessica** — cloud / SRE (deploy, env, observability — partial scope here, mostly Render Blueprint)
- **Randy** — QA (planned, not run end-to-end yet because the pipeline never completed)
- **Aiden** — opportunity scout (out of scope for this build)

Asmit (the human) interacted only with an orchestrator that routed to the named agents. Designs in [`docs/design/`](docs/design/).

## License

No license file shipped. All rights reserved by default. Add a license before public distribution.
