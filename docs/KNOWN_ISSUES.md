# AiB — Known Issues (V1)

Live URL: https://aib-m8w1.onrender.com
Stack: Next.js 16 + Tailwind v4 + shadcn/ui + multi-provider LLM (Anthropic / OpenAI / Gemini) + jszip + mermaid
Hosting: Render free tier (Oregon)

## Known issues

### 1. Gemini free tier is unreliable for AiB's pipeline

**Severity:** High — blocks the demo path on the default config.

**Symptom:** Spec generation fails with `validation_failed_after_retry`, often citing 429 (`RESOURCE_EXHAUSTED`), 503 (`UNAVAILABLE`), or malformed JSON in the structured-output stages.

**Why it happens:**
- AiB's pipeline has **11 LLM calls** per bundle (parse, Q&A, fold, classify, 6 parallel artifact generators, critique, optional rewrite). Every call must succeed for the bundle to ship.
- Free-tier `gemini-2.5-flash` is rate-limited at **5 requests/minute**. Even one bundle exceeds that during the 6-parallel artifact phase.
- Free-tier `gemini-2.5-pro` is **literally limit-zero** — Pro requires Google Cloud billing.
- Flash is also weaker than Pro at structured JSON output. With strict `responseSchema` + Zod validation, Flash produces malformed JSON often enough to push the per-call success rate below ~95%, which means the per-bundle success rate (across 11 calls) is roughly 0.95^11 ≈ 57%.

**Mitigations available:**
1. **Switch provider to Anthropic Claude or OpenAI** (now supported per multi-provider work in commit ████████). Both have higher reliability on structured output and far more generous free tiers if you have credits.
2. **Enable Gemini billing** at https://console.cloud.google.com/billing — Pro becomes available, rate limits jump ~50x. Per-bundle cost ~$0.27.
3. **Reduce pipeline depth** — collapse the 6 artifact generators into a single combined call. Quality drops; not the V1 wedge.

**Status:** Won't-fix in V1 code. The product works correctly when given a competent provider; the constraint is the API tier, not AiB.

### 2. Render free tier cold starts

**Severity:** Low — 30–60s delay on first request after 15 min idle.

**Why:** Render Free Web Services spin down after inactivity. First user after a long quiet period waits for the container to boot.

**Mitigation:** None at free tier. Upgrade to Render Starter ($7/mo) to keep the service warm. Acceptable for V1 demo.

### 3. Bundle persistence is client-only (localStorage)

**Severity:** By design for V1.

**Symptom:** A user generates a bundle on Device A and shares the URL with Device B. Device B sees the empty-state message because the bundle isn't stored server-side.

**Why:** V1 spec deferred all server-side persistence (Drizzle/Neon are installed but unused). The wedge is solo-user generation; cross-device share is a V2 feature.

**Mitigation:** V2 will persist bundles to Neon Postgres and rehydrate `/b/[id]` from server. See `docs/design/luke-gemini-pipeline.md` open question §8.

### 4. Empty bundle view styling

**Severity:** Low.

**Symptom:** `/b/[id]` for an unknown ID shows a minimally-styled empty state.

**Why:** Paige's design specifies the message ("This bundle isn't on this device. Bundles are stored locally in V1."), and Matt implemented it functionally, but a polished empty-state illustration is deferred.

### 5. No streaming UI

**Severity:** Medium for UX, low for correctness.

**Symptom:** Generation page shows a spinner for ~30–60s with rotating status text. User can't see partial artifacts as they finish.

**Why:** Luke's design (§6) flagged streaming stack.md and diagram.mmd to the UI as a perf mitigation. Not implemented in V1.

**Mitigation:** Acceptable on Render (no per-request timeout). Would matter on Vercel Hobby's 60s limit; revisit if we move.

## Verified working

- Build pipeline: `tsc --noEmit` clean, `next build` clean, all 7 routes compile.
- Live deploy: HTTP 200 on `/`, 334ms response time after warm-up.
- Error handling: Provider errors (429, 503, malformed JSON) return structured 500s with details, not stack traces.
- API routes: `/api/generate`, `/api/generate/[runId]/answers`, `/api/bundle/[id]/zip` all routable and respond.
- ZIP export: implemented per spec.
- Mermaid client-side render: implemented per spec.
- Dark mode: default per Paige's design.

## Provenance

- Designs: `docs/design/luke-gemini-pipeline.md`, `docs/design/frank-reference-library.md`, `docs/design/paige-ui.md`
- Subagent team: defined in `~/.claude/agents/` (Paige, Matt, Frank, Luke, Jessica, Randy, Aiden) — orchestrator-only access pattern
- 158-feature exhaustive bucket: workflow output `w7s90prqn` in transcript dir
