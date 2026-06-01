# Reference Architecture Library — V1 Design

**Owner:** Frank (Applied ML)
**Audience:** Matt (full-stack engineer, implementing)
**Status:** Locked design for V1. Library content is data, not code — see Section 5 for evolution.

The Reference Architecture Library is a small handcrafted JSON file containing 10 canonical architecture patterns. The Spec Parser produces a Blueprint IR; a classifier picks the closest pattern; the matched pattern then biases stack picks, data model entities, failure modes, and effort estimates downstream. It is also part of the cached prompt prefix so we get prompt-caching savings on every bundle.

This is **not** a vector index, **not** a recommender system, **not** a fuzzy-match heuristic. It is a tiny labeled enum with rich opinions attached. That's the whole point — opinions are the moat.

---

## 1. Library schema

Two files. Types live in TypeScript. Data lives in JSON, with the type imported via a `satisfies` check at build time so a malformed JSON fails CI, not production.

**File:** `src/lib/aib/reference/types.ts`

```ts
// Reference Architecture Library — V1
// Schema version is bumped only on breaking shape changes.
export const REFERENCE_LIBRARY_SCHEMA_VERSION = 1 as const;

export type StackLayer =
  | "frontend"
  | "backend"
  | "db"
  | "queue"
  | "cache"
  | "auth"
  | "hosting"
  | "file_storage"
  | "observability";

export interface StackPick {
  /** Display name, e.g. "Next.js (App Router)". */
  name: string;
  /** One-paragraph defense, <= 350 chars. Plain prose, no bullet lists. */
  why: string;
  /** 2–3 alternatives we explicitly rejected. */
  alternatives_rejected: Array<{
    name: string;
    /** One line, <= 140 chars. "Heavier ops surface, no upside for solo founder." */
    reason: string;
  }>;
}

export type DefaultStack = Record<StackLayer, StackPick>;

export interface CanonicalEntity {
  /** snake_case, e.g. "listing". */
  name: string;
  /** One line on what it represents in this pattern. */
  purpose: string;
  /** Hint fields the data-model generator should consider; not authoritative. */
  typical_fields?: string[];
}

export interface CanonicalFlow {
  /** kebab-case, e.g. "list-item". */
  name: string;
  /** One sentence describing the user-visible flow. */
  description: string;
  /** Entities touched, by entity.name. */
  entities_touched: string[];
}

export interface FailureModeSeed {
  title: string;
  /** What kicks it off. */
  trigger: string;
  /** Who/what is affected. */
  blast_radius: string;
  /** How you'd notice. */
  detection: string;
  /** First-line fix, not "monitor everything". */
  mitigation: string;
}

export interface CostAnchor {
  /** USD/month, rough. Used to anchor the estimator, not as a quote. */
  tier_10_users: number;
  tier_1k_users: number;
  tier_100k_users: number;
  /** One-line note on what dominates the bill at scale. */
  dominant_cost_at_scale: string;
}

export interface ReferencePattern {
  /** kebab-case slug, stable across versions. Acts as the classifier label. */
  id: string;
  /** Display name shown in UI rationale. */
  name: string;
  /** 1–2 sentence elevator description. */
  description: string;
  /** 3–5 prose bullets — when this pattern fits. */
  when_to_use: string[];
  /** 3–5 prose bullets — when this is the wrong pattern. */
  when_not_to_use: string[];
  default_stack: DefaultStack;
  canonical_entities: CanonicalEntity[];
  canonical_flows: CanonicalFlow[];
  failure_modes_seed: FailureModeSeed[];
  cost_anchor: CostAnchor;
}

export interface ReferenceLibrary {
  schema_version: typeof REFERENCE_LIBRARY_SCHEMA_VERSION;
  /** Library version — bump on any content change. Semver-ish: MAJOR.MINOR. */
  library_version: string;
  /** ISO 8601 generated_at, hand-edited or set by a tiny build script. */
  updated_at: string;
  patterns: ReferencePattern[];
}
```

**File:** `src/lib/aib/reference/library.json` — see Section 2 for content.

The JSON is loaded via:

```ts
import libraryData from "./library.json";
import type { ReferenceLibrary } from "./types";

export const referenceLibrary = libraryData as ReferenceLibrary;
// CI guard: a Vitest unit test asserts `libraryData satisfies ReferenceLibrary`.
```

Because it's a static JSON import, Next.js inlines it into the server bundle at build time. Zero runtime fetch. It also means we can include the **entire library** verbatim in the cached system prompt prefix (Feature 18) without paying for it on every request after the first.

---

## 2. The 10 V1 patterns

Coverage target: ≥80% of solo-founder ideas. The 10 are picked to be *mutually distinguishable by an LLM from a Blueprint IR* — that is the design constraint. Patterns that overlap heavily (e.g. "marketplace" vs "two-sided platform") are merged.

| # | id | One-line |
|---|---|---|
| 1 | `crud-saas` | Single-tenant or lightly multi-tenant CRUD app: users sign up, create/edit records, dashboard, billing. The default if nothing fancier matches. |
| 2 | `ai-wrapper` | Thin UI over an LLM (or vision/audio) API: input box → model call → formatted output. Stateless or thinly stateful. |
| 3 | `marketplace` | Two-sided: supply-side users list things, demand-side users find/transact, platform mediates trust + payment. |
| 4 | `rag-app` | Document Q&A or semantic search over a user-provided corpus. Embeddings, chunking, retrieval, grounded generation. |
| 5 | `b2b-webhooks` | Backend integration product: ingests events from third-party systems via webhooks, transforms, fans out to other systems. |
| 6 | `internal-tool` | Admin/ops dashboard over an existing database or API. Read-heavy, role-gated, no public signup. |
| 7 | `social-feed` | User-generated content with a feed, follows, reactions, notifications. Read-heavy with fan-out write patterns. |
| 8 | `scheduled-jobs` | Cron-like product whose value is reliably running things on a schedule (scrapers, reports, syncs, reminders). |
| 9 | `realtime-collab` | Multi-user simultaneous editing or presence (docs, whiteboards, chat rooms). CRDTs or OT, presence channels. |
| 10 | `static-content` | Mostly-read content site with light dynamic features: directory, comparison site, blog-with-tools, calculators. SEO is the product. |

Three fully-specced entries follow. The other seven would be filled in by the same author (me) in a single 4-hour pass before V1 ship. Cost anchors are USD/month; numbers come from public list pricing (Vercel Hobby/Pro, Neon, Anthropic) at time of writing — they are anchors, not quotes.

### 2.1 Pattern: `crud-saas`

```json
{
  "id": "crud-saas",
  "name": "CRUD SaaS",
  "description": "A single- or lightly-multi-tenant web app where users sign up, create and edit records, view dashboards, and pay a subscription. The 80% case for B2B and prosumer ideas.",
  "when_to_use": [
    "Spec mentions accounts, dashboards, and CRUD on user-owned records.",
    "Single user or single tenant per workspace; no two-sided marketplace dynamic.",
    "Subscription billing or freemium is the implied business model.",
    "No real-time multi-user collaboration on the same record.",
    "AI features, if present, are a sidecar (e.g. 'AI summary button'), not the product."
  ],
  "when_not_to_use": [
    "Two distinct user roles transact with each other on the platform — use `marketplace`.",
    "The core value is an LLM transforming user input — use `ai-wrapper`.",
    "Read-only over an existing dataset with no signup — use `internal-tool` or `static-content`.",
    "Multi-user simultaneous editing of the same document — use `realtime-collab`.",
    "Primary surface is event ingestion from third parties — use `b2b-webhooks`."
  ],
  "default_stack": {
    "frontend": {
      "name": "Next.js (App Router) + TypeScript + Tailwind + shadcn/ui",
      "why": "Server components keep the auth-gated dashboard cheap to render, server actions remove a REST layer, and shadcn gives a polished baseline without a design dependency. One framework, one deploy target, one mental model.",
      "alternatives_rejected": [
        { "name": "Remix", "reason": "Smaller ecosystem and weaker Vercel integration; no real upside for this shape." },
        { "name": "SvelteKit", "reason": "Talent pool is thinner for handoff; component ecosystem behind shadcn." },
        { "name": "Vite SPA + separate API", "reason": "Two deploys, two auth surfaces, no SSR for SEO landing pages." }
      ]
    },
    "backend": {
      "name": "Next.js Server Actions + Route Handlers (Node runtime)",
      "why": "Co-locating mutations with the UI removes a whole class of API-contract drift. Route handlers cover the few cases (webhooks, file uploads) where actions are the wrong fit.",
      "alternatives_rejected": [
        { "name": "Separate Express/Fastify service", "reason": "Doubles the ops surface for a solo founder with no scale justification yet." },
        { "name": "tRPC", "reason": "Server actions cover the same ergonomic win in App Router with one fewer dependency." }
      ]
    },
    "db": {
      "name": "Neon Postgres + Drizzle ORM",
      "why": "Postgres is the right default for relational CRUD; Neon's branching makes preview environments trivial; Drizzle is type-safe SQL without Prisma's generation step or runtime overhead.",
      "alternatives_rejected": [
        { "name": "Supabase", "reason": "Coupling auth + db + storage is fine until you want to swap one — and we already have Clerk." },
        { "name": "PlanetScale", "reason": "MySQL ecosystem is weaker for JSONB/array workloads typical in CRUD apps." },
        { "name": "Prisma + Neon", "reason": "Heavier client, generation step, and migration ergonomics no better than Drizzle." }
      ]
    },
    "queue": {
      "name": "Inngest",
      "why": "Durable background jobs without standing up Redis/BullMQ. Fits the 'no separate API service' constraint. Free tier covers solo-founder scale.",
      "alternatives_rejected": [
        { "name": "BullMQ + Redis", "reason": "Redis to provision and pay for; queue UI to build; not worth it pre-product-market-fit." },
        { "name": "Vercel Cron", "reason": "Schedules only, no event-driven jobs or retries with backoff." }
      ]
    },
    "cache": {
      "name": "Upstash Redis",
      "why": "Per-request pricing with a generous free tier; works from Vercel functions without connection-pool drama.",
      "alternatives_rejected": [
        { "name": "Vercel KV", "reason": "Same Upstash backend with Vercel markup and lock-in." },
        { "name": "In-memory LRU", "reason": "Doesn't survive across serverless invocations." }
      ]
    },
    "auth": {
      "name": "Clerk",
      "why": "Email+OAuth+billing-customer-mapping in one drop-in. Solo founders should not be writing password-reset flows.",
      "alternatives_rejected": [
        { "name": "Auth.js (NextAuth)", "reason": "Free but you own the UI, the email templates, and every edge case." },
        { "name": "Supabase Auth", "reason": "Pulls in a db dependency we already rejected." },
        { "name": "WorkOS", "reason": "Priced for B2B-with-SSO; overkill at zero customers." }
      ]
    },
    "hosting": {
      "name": "Vercel",
      "why": "Zero-config Next.js deploys, preview URLs per PR, and the cron + edge config you actually use. Costs scale with traffic, not with team size.",
      "alternatives_rejected": [
        { "name": "Fly.io", "reason": "Better for stateful workloads; you give up the Vercel/Next.js integration polish." },
        { "name": "Render", "reason": "No preview environment story as clean as Vercel's." }
      ]
    },
    "file_storage": {
      "name": "Cloudflare R2",
      "why": "S3-compatible API with no egress fees — the difference shows up immediately the moment users start downloading their own uploads.",
      "alternatives_rejected": [
        { "name": "AWS S3", "reason": "Egress fees punish exactly the workload SaaS apps generate." },
        { "name": "Vercel Blob", "reason": "Priced at a premium and locks storage to one host." }
      ]
    },
    "observability": {
      "name": "Sentry + Vercel Analytics",
      "why": "Sentry catches the errors users won't email you about; Vercel Analytics gives you the funnel data without a Segment-shaped invoice.",
      "alternatives_rejected": [
        { "name": "Datadog", "reason": "Priced per host/seat; absurd for a one-engineer app." },
        { "name": "PostHog self-hosted", "reason": "You're now running infra to watch your infra." }
      ]
    }
  },
  "canonical_entities": [
    { "name": "user", "purpose": "Authenticated end-user; owns workspaces and records.", "typical_fields": ["id", "email", "name", "created_at"] },
    { "name": "workspace", "purpose": "Tenancy boundary; container for records and members.", "typical_fields": ["id", "owner_id", "name", "plan", "created_at"] },
    { "name": "record", "purpose": "The domain object the app is actually about — replaced by the spec's noun.", "typical_fields": ["id", "workspace_id", "created_by", "data_jsonb", "updated_at"] },
    { "name": "subscription", "purpose": "Billing state per workspace, mirrored from Stripe.", "typical_fields": ["workspace_id", "stripe_customer_id", "status", "current_period_end"] },
    { "name": "audit_log", "purpose": "Append-only record of meaningful state changes for support and debugging.", "typical_fields": ["id", "workspace_id", "actor_id", "action", "target", "at"] }
  ],
  "canonical_flows": [
    { "name": "signup", "description": "User signs up, lands in an empty workspace.", "entities_touched": ["user", "workspace"] },
    { "name": "create-record", "description": "User in a workspace creates the primary domain record.", "entities_touched": ["user", "workspace", "record", "audit_log"] },
    { "name": "list-records", "description": "Paginated, filterable view of records in the active workspace.", "entities_touched": ["workspace", "record"] },
    { "name": "subscribe", "description": "User upgrades to a paid plan via Stripe Checkout, webhook updates subscription.", "entities_touched": ["workspace", "subscription"] },
    { "name": "invite-member", "description": "Workspace owner invites a teammate by email.", "entities_touched": ["user", "workspace"] }
  ],
  "failure_modes_seed": [
    {
      "title": "Stripe webhook lost or replayed",
      "trigger": "Network blip or duplicate delivery from Stripe.",
      "blast_radius": "Subscription state drifts from billing reality; user is over- or under-entitled.",
      "detection": "Nightly reconciliation job comparing `subscription.status` to Stripe API; alert on mismatch.",
      "mitigation": "Idempotency key on webhook handler; reconciliation job auto-corrects."
    },
    {
      "title": "Workspace data leak across tenants",
      "trigger": "Missing `workspace_id` predicate in a query path.",
      "blast_radius": "User sees another customer's data — existential trust failure.",
      "detection": "Drizzle query helper enforces tenant predicate at the type level; e2e test asserts cross-tenant 404.",
      "mitigation": "All record queries go through `scopedQuery(workspaceId)` helper; lint rule bans raw queries on tenant tables."
    },
    {
      "title": "Long-running export blocks the request",
      "trigger": "User clicks 'Export CSV' on a workspace with 100k records.",
      "blast_radius": "Vercel function times out at 60s; user gets nothing.",
      "detection": "Sentry timeout errors clustered on export endpoint.",
      "mitigation": "Move export to Inngest job, email a signed download link when ready."
    },
    {
      "title": "Database connection exhaustion on cold burst",
      "trigger": "Marketing campaign drives a spike of cold serverless invocations.",
      "blast_radius": "5xx for new users during the moment they're most expensive to acquire.",
      "detection": "Neon's connection metrics + Sentry 'too many connections' errors.",
      "mitigation": "Use Neon's pooled connection string; cap `max` in the Drizzle client."
    }
  ],
  "cost_anchor": {
    "tier_10_users": 0,
    "tier_1k_users": 60,
    "tier_100k_users": 1200,
    "dominant_cost_at_scale": "Database compute (Neon) and Vercel function-invocation overage."
  }
}
```

### 2.2 Pattern: `ai-wrapper`

```json
{
  "id": "ai-wrapper",
  "name": "AI Wrapper",
  "description": "A thin UI over a foundation-model API. The product's value is the prompt, the input plumbing, and the formatted output — not a database of user records.",
  "when_to_use": [
    "Core flow is: user types/uploads input → model call → rendered output.",
    "Persistence, if any, is history of generations, not relational user data.",
    "The differentiator is the prompt, the few-shot examples, or the post-processing.",
    "Latency target is interactive (streamed) and cost-per-call is the binding constraint.",
    "No multi-user collaboration on the artifacts — each generation is single-shot."
  ],
  "when_not_to_use": [
    "Spec describes a corpus the user uploads and queries against — use `rag-app`.",
    "Generation is one feature in a broader CRUD app — use `crud-saas` and treat AI as a sidecar.",
    "Output must be grounded in user-private documents — use `rag-app`.",
    "Real-time multi-user editing of a shared AI canvas — use `realtime-collab`."
  ],
  "default_stack": {
    "frontend": {
      "name": "Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Vercel AI SDK",
      "why": "AI SDK's `useChat`/`useCompletion` plus React Server Components handle streaming tokens to the UI without building a websocket layer. shadcn keeps the chat-shaped UI on rails.",
      "alternatives_rejected": [
        { "name": "LangChain.js UI components", "reason": "Heavy abstraction for what is fundamentally a fetch + readable stream." },
        { "name": "Custom EventSource wiring", "reason": "Reinventing the AI SDK with no upside." }
      ]
    },
    "backend": {
      "name": "Next.js Route Handlers (Node runtime, streaming responses)",
      "why": "Streaming responses from the Anthropic SDK back to the client is the entire backend in this pattern. Route handlers are the right primitive — server actions don't stream cleanly today.",
      "alternatives_rejected": [
        { "name": "Edge runtime", "reason": "Tempting for latency, but kills compatibility with parts of the Anthropic SDK and many telemetry packages." },
        { "name": "Separate Python FastAPI", "reason": "Two deploys, two languages, for zero functional gain over `@anthropic-ai/sdk`." }
      ]
    },
    "db": {
      "name": "Neon Postgres + Drizzle ORM",
      "why": "Even an AI wrapper benefits from a generations table for history, sharing, and abuse forensics. Postgres is overkill until you want full-text search or cost analytics, at which point it isn't.",
      "alternatives_rejected": [
        { "name": "No DB / localStorage only", "reason": "Defensible for week one; falls apart the moment you want sharing or rate limits." },
        { "name": "DynamoDB", "reason": "Worse ergonomics for the analytics queries you'll absolutely run on usage." }
      ]
    },
    "queue": {
      "name": "Inngest",
      "why": "For long-running model calls (deep research, batch generation) that exceed Vercel's function timeout, Inngest gives durable retry/backoff without a Redis box.",
      "alternatives_rejected": [
        { "name": "Anthropic batch API", "reason": "Used in addition to Inngest, not instead — batches don't help the interactive path." },
        { "name": "Self-hosted Celery", "reason": "Wildly out of proportion for this product shape." }
      ]
    },
    "cache": {
      "name": "Upstash Redis",
      "why": "Two jobs: per-user rate limits (so one tab can't bankrupt you) and idempotent caching of identical prompts. Both are textbook Redis.",
      "alternatives_rejected": [
        { "name": "Anthropic prompt caching alone", "reason": "Different layer — cuts input tokens but doesn't dedupe identical end-to-end requests or enforce rate limits." }
      ]
    },
    "auth": {
      "name": "Clerk",
      "why": "Identity is mainly there to attach a rate-limit and a paying customer to each request. Clerk's drop-in covers it.",
      "alternatives_rejected": [
        { "name": "No auth (anonymous + IP rate limit)", "reason": "Fine for a demo, ruinous as a product — you can't ban an abuser or charge anyone." },
        { "name": "Auth.js", "reason": "Same trade as in CRUD SaaS — you become the email-template maintainer." }
      ]
    },
    "hosting": {
      "name": "Vercel",
      "why": "Streaming responses and Anthropic SDK both work cleanly on Node runtime; preview envs let you A/B prompt changes.",
      "alternatives_rejected": [
        { "name": "Cloudflare Workers", "reason": "Streaming is great but the Anthropic SDK story and tracing tools are less battle-tested." }
      ]
    },
    "file_storage": {
      "name": "Cloudflare R2",
      "why": "Stores user-uploaded inputs (images, PDFs) and durable copies of generated outputs without egress fees.",
      "alternatives_rejected": [
        { "name": "Vercel Blob", "reason": "Premium pricing for the same S3-compatible API." }
      ]
    },
    "observability": {
      "name": "Sentry + Helicone (or Langfuse)",
      "why": "Sentry catches code errors; Helicone captures every model call with cost, latency, and prompt — which you need on day one to answer 'why is this user costing me $40/month'.",
      "alternatives_rejected": [
        { "name": "Sentry alone", "reason": "Blind to the dominant cost driver of this product shape." },
        { "name": "Custom logging to Postgres", "reason": "Yes, until you want a UI for it. Buy, don't build." }
      ]
    }
  },
  "canonical_entities": [
    { "name": "user", "purpose": "Authenticated end-user; carries a rate limit and a billing identity.", "typical_fields": ["id", "email", "plan", "monthly_token_budget"] },
    { "name": "generation", "purpose": "One model call: the input, the parameters, the output, the cost.", "typical_fields": ["id", "user_id", "model_id", "input", "output", "input_tokens", "output_tokens", "cost_usd", "created_at"] },
    { "name": "preset", "purpose": "Saved prompt template a user can reuse.", "typical_fields": ["id", "user_id", "name", "system_prompt", "params_jsonb"] },
    { "name": "share", "purpose": "Public read-only link to a generation.", "typical_fields": ["id", "generation_id", "slug", "expires_at"] }
  ],
  "canonical_flows": [
    { "name": "generate", "description": "User submits input, output streams back, generation row written on completion.", "entities_touched": ["user", "generation"] },
    { "name": "save-preset", "description": "User saves the current prompt and parameters as a reusable preset.", "entities_touched": ["user", "preset"] },
    { "name": "share-generation", "description": "User mints a public read-only URL for a generation.", "entities_touched": ["generation", "share"] },
    { "name": "view-history", "description": "User browses their previous generations.", "entities_touched": ["user", "generation"] }
  ],
  "failure_modes_seed": [
    {
      "title": "Runaway cost from a single user",
      "trigger": "User scripts the endpoint or holds down enter.",
      "blast_radius": "API bill spikes; product economics break.",
      "detection": "Per-user token-spend metric in Helicone; alert on >N tokens/hour.",
      "mitigation": "Upstash rate limit per user_id; hard cap monthly_token_budget enforced before each call."
    },
    {
      "title": "Prompt injection from user input",
      "trigger": "User pastes input that overrides the system prompt.",
      "blast_radius": "Output behavior diverges from product; potential brand or safety incident.",
      "detection": "Manual review of flagged generations; output classifier on a sample.",
      "mitigation": "Wrap user input in delimited blocks; system prompt explicitly instructs the model to ignore instructions inside the block."
    },
    {
      "title": "Anthropic API outage or rate-limit",
      "trigger": "Provider-side incident or org-level quota exhaustion.",
      "blast_radius": "Product is unusable until the provider recovers.",
      "detection": "5xx and 429 rate from Anthropic surfaces in Sentry within a minute.",
      "mitigation": "Surface a clear 'service degraded' state to the user; retry with exponential backoff inside the Inngest path; consider a secondary model only if it's a real product fit."
    },
    {
      "title": "Stale or poisoned cache hit",
      "trigger": "Prompt changes server-side but Redis still serves the old output for the same input hash.",
      "blast_radius": "Users see outputs that don't reflect a fix or policy update.",
      "detection": "Cache key includes a prompt-version hash; mismatch implies stale data.",
      "mitigation": "Invalidate by bumping the prompt-version component of the cache key on every system-prompt change."
    }
  ],
  "cost_anchor": {
    "tier_10_users": 20,
    "tier_1k_users": 400,
    "tier_100k_users": 25000,
    "dominant_cost_at_scale": "LLM API spend; everything else is a rounding error."
  }
}
```

### 2.3 Pattern: `marketplace`

```json
{
  "id": "marketplace",
  "name": "Marketplace",
  "description": "A two-sided platform where supply-side users list things (services, items, time slots) and demand-side users discover and transact. The platform mediates trust, payment, and messaging.",
  "when_to_use": [
    "Spec describes two distinct user roles transacting with each other.",
    "Money or a binding commitment changes hands through the platform.",
    "Discovery (search, filters, ranking) is a first-class surface.",
    "The platform takes a cut, escrows funds, or handles disputes.",
    "Trust signals (reviews, verification) are part of the value proposition."
  ],
  "when_not_to_use": [
    "All users have the same role — that's a `social-feed` or `crud-saas`.",
    "There is no transaction, just content and discovery — `static-content`.",
    "Single-vendor catalog selling to many buyers — that's e-commerce, not a marketplace; closer to `crud-saas`.",
    "B2B integration product — use `b2b-webhooks`."
  ],
  "default_stack": {
    "frontend": {
      "name": "Next.js (App Router) + TypeScript + Tailwind + shadcn/ui",
      "why": "Marketplaces live or die on SEO for the supply-side listing pages; SSR-by-default plus image optimization out of the box are exactly what you need.",
      "alternatives_rejected": [
        { "name": "Remix", "reason": "Comparable on SSR, weaker on the image/SEO toolchain you'll lean on." },
        { "name": "SPA + headless CMS", "reason": "SEO becomes a project of its own — wrong battle for a solo founder." }
      ]
    },
    "backend": {
      "name": "Next.js Server Actions + Route Handlers (Node runtime)",
      "why": "Search, listing CRUD, and message send are all natural server actions. Route handlers cover Stripe Connect webhooks and image-upload presign endpoints.",
      "alternatives_rejected": [
        { "name": "Separate API service", "reason": "Two deploys for one product; nothing in this shape requires it pre-traction." }
      ]
    },
    "db": {
      "name": "Neon Postgres + Drizzle ORM (with pg_trgm for search)",
      "why": "Marketplaces are heavily relational (user → listing → transaction → review) and Postgres' trigram + full-text search is good enough for V1, removing a whole search-service dependency.",
      "alternatives_rejected": [
        { "name": "Postgres + Algolia/Meilisearch", "reason": "Worth it after PMF, not before. Adds a sync pipeline you have to debug at 2am." },
        { "name": "MongoDB", "reason": "Documents fight you the moment you want 'all unfilled bookings for listings owned by this seller in this date range'." }
      ]
    },
    "queue": {
      "name": "Inngest",
      "why": "Notification fan-out (new message, booking confirmed, payout sent) and post-transaction workflows (review request after N days) are the textbook Inngest use case.",
      "alternatives_rejected": [
        { "name": "Vercel Cron", "reason": "Schedules without event-driven branching; fine for the cron, not the fan-out." },
        { "name": "BullMQ + Redis", "reason": "Self-managed Redis is not how a solo founder should spend time." }
      ]
    },
    "cache": {
      "name": "Upstash Redis",
      "why": "Hot listing pages and search-result pages are perfect cache fodder; rate-limits on listing creation prevent spam.",
      "alternatives_rejected": [
        { "name": "Next.js fetch cache only", "reason": "Fine for static-ish reads, doesn't help with rate limiting or message dedupe." }
      ]
    },
    "auth": {
      "name": "Clerk",
      "why": "Two roles (buyer/seller) modeled as Clerk metadata; Stripe Connect customer ID stored against the user. Email + Google + Apple covers the demand side, which is the side you need to be frictionless.",
      "alternatives_rejected": [
        { "name": "Auth.js", "reason": "You'd be writing the verification, the magic-link, and the OAuth wiring yourself." },
        { "name": "Supabase Auth", "reason": "Pulls in a db dependency we already rejected." }
      ]
    },
    "hosting": {
      "name": "Vercel",
      "why": "ISR for listing pages, edge image optimization, preview deploys per PR — all the things a marketplace front-end actually uses." ,
      "alternatives_rejected": [
        { "name": "Fly.io", "reason": "You give up Vercel's image and ISR primitives without a meaningful win." }
      ]
    },
    "file_storage": {
      "name": "Cloudflare R2 + Cloudflare Images",
      "why": "Listings are image-heavy; R2 + Images gives transformations and free egress, both of which dominate the file-storage budget at scale.",
      "alternatives_rejected": [
        { "name": "S3 + CloudFront", "reason": "More moving parts and egress is no longer free." }
      ]
    },
    "observability": {
      "name": "Sentry + Vercel Analytics + Stripe Sigma",
      "why": "Sentry for code errors, Vercel Analytics for funnel, Stripe Sigma (or the dashboard) for the GMV/take-rate metrics that *are* the business.",
      "alternatives_rejected": [
        { "name": "Datadog", "reason": "Per-host pricing makes no sense at this stage." },
        { "name": "Custom GMV dashboard", "reason": "Buy with Stripe Sigma; build only after you've grown out of it." }
      ]
    }
  },
  "canonical_entities": [
    { "name": "user", "purpose": "Account; has a role flag and optional Stripe Connect account.", "typical_fields": ["id", "email", "role", "stripe_account_id", "kyc_status"] },
    { "name": "listing", "purpose": "Supply-side artifact: the thing being offered.", "typical_fields": ["id", "seller_id", "title", "description", "price_cents", "currency", "status", "search_vector"] },
    { "name": "transaction", "purpose": "A buyer's commitment against a listing; ledger of money movement.", "typical_fields": ["id", "buyer_id", "listing_id", "amount_cents", "platform_fee_cents", "status", "stripe_payment_intent_id"] },
    { "name": "message", "purpose": "Buyer–seller communication scoped to a listing or transaction.", "typical_fields": ["id", "thread_id", "sender_id", "body", "created_at"] },
    { "name": "review", "purpose": "Post-transaction rating; trust signal on the listing or seller.", "typical_fields": ["id", "transaction_id", "rating", "body", "created_at"] }
  ],
  "canonical_flows": [
    { "name": "seller-onboard", "description": "Seller signs up and connects a Stripe Connect account before they can list.", "entities_touched": ["user"] },
    { "name": "list-item", "description": "Seller creates a listing with images and price.", "entities_touched": ["user", "listing"] },
    { "name": "search", "description": "Buyer searches and filters listings.", "entities_touched": ["listing"] },
    { "name": "purchase", "description": "Buyer pays via Stripe; transaction is created and held until fulfillment.", "entities_touched": ["user", "listing", "transaction"] },
    { "name": "message", "description": "Buyer and seller exchange messages scoped to a listing.", "entities_touched": ["user", "message"] },
    { "name": "review", "description": "After a transaction completes, buyer leaves a review.", "entities_touched": ["transaction", "review"] }
  ],
  "failure_modes_seed": [
    {
      "title": "Off-platform leakage",
      "trigger": "Buyer and seller exchange contact info in messages and transact outside the platform.",
      "blast_radius": "Take rate evaporates; can't be detected via Stripe.",
      "detection": "Regex/classifier scan of message bodies for email/phone patterns; track 'message → transaction' conversion per seller.",
      "mitigation": "Mask contact info pre-transaction; gate full contact on payment; suspend repeat-offender sellers."
    },
    {
      "title": "Chargeback fraud",
      "trigger": "Buyer files a chargeback after receiving the item or service.",
      "blast_radius": "Platform eats the loss if it has guaranteed payout to the seller; seller relationship sours either way.",
      "detection": "Stripe Radar signals; chargeback rate per seller and per buyer.",
      "mitigation": "Hold seller payouts until a dispute window passes; require photo evidence on shipped goods; ban repeat-chargeback buyers."
    },
    {
      "title": "Listing spam / SEO abuse",
      "trigger": "Bots create thousands of listings to pump backlinks or scam buyers.",
      "blast_radius": "Site quality collapses, Google delists, real sellers leave.",
      "detection": "Listings-per-seller-per-hour metric; sudden burst in new accounts.",
      "mitigation": "Rate limit listing creation; require seller verification before listings index; use `noindex` until verified."
    },
    {
      "title": "Race condition on inventory",
      "trigger": "Two buyers click 'buy' simultaneously on a one-of-a-kind listing.",
      "blast_radius": "Both buyers charged; only one fulfilled; one refund + angry email.",
      "detection": "Reports of double-bookings; transaction count > listing inventory.",
      "mitigation": "Wrap reservation + payment-intent creation in a Postgres advisory lock keyed by listing_id; mark listing `sold` atomically with the successful payment intent."
    },
    {
      "title": "Stripe Connect onboarding drop-off",
      "trigger": "Sellers bounce during the KYC flow.",
      "blast_radius": "Supply-side starves; the marketplace is dead without supply.",
      "detection": "Funnel drop between signup and first published listing.",
      "mitigation": "Defer KYC until the first sale; pre-fill what you can; show progress; handhold the first 50 sellers manually."
    }
  ],
  "cost_anchor": {
    "tier_10_users": 20,
    "tier_1k_users": 150,
    "tier_100k_users": 4500,
    "dominant_cost_at_scale": "Image storage/CDN bandwidth and Stripe per-transaction fees (the latter passes through to take-rate maths)."
  }
}
```

The remaining seven (`rag-app`, `b2b-webhooks`, `internal-tool`, `social-feed`, `scheduled-jobs`, `realtime-collab`, `static-content`) follow the same shape and are filled in by me before V1 ship. The schema constrains them to be consistent.

---

## 3. Matching strategy

**Recommendation: LLM classification, not embedding similarity.**

Reasoning:

- **N is 10.** Embedding-based retrieval is overkill; a single classification call beats it on accuracy and is trivial to debug.
- **The signal is structural, not lexical.** A spec for a "two-sided dog-walking app" and a "freelance graphics marketplace" share almost no surface tokens, but both are clearly `marketplace`. An LLM with the `when_to_use`/`when_not_to_use` bullets visible reasons about this directly. Embeddings would conflate "dog-walking" with pet apps.
- **We already have the Blueprint IR.** The classifier takes the structured IR (entities, actors, flows, constraints) — not raw spec prose — which strips the noise embeddings would have to fight through.
- **Cheap.** One classification call, ~1.5k input tokens (system prompt + library summaries + blueprint), ~50 output tokens. Use `AIB_MODEL_CLASSIFICATION` (smaller/faster model). With the library in the cached prefix, marginal cost is negligible.

**Pipeline:**

1. Spec Parser produces Blueprint IR (Zod-validated).
2. Classifier prompt: system prompt + a compressed view of the library (id, name, description, when_to_use, when_not_to_use only — *not* the full default_stack, that bloats input for no signal) + the Blueprint IR + instruction to return JSON `{ pattern_id, confidence: "high"|"medium"|"low", second_choice_id, reasoning_one_line }`.
3. Output validated by Zod against `pattern_id ∈ knownPatternIds`. On failure: retry once with the validation error fed back, per the Blueprint IR pattern in Section 6 of the context doc.
4. If `confidence === "low"`, the orchestrator surfaces both first and second choice in the rationale (Feature 13 — "why not X" justifications) but proceeds with the first.

**Why not similarity:**

- Computing embeddings adds an SDK dependency, a vector index (even in-memory), and a calibration question (which encoder? cosine threshold?) — none of which earn their keep at N=10.
- An embedding match has no native "confidence" or "second choice" signal that's useful to surface to the user; an LLM's structured output does.

If we ever scale to N>50 patterns post-V1, revisit this and probably move to embeddings for a first-pass narrowing followed by LLM confirmation.

---

## 4. How patterns bias generation

The matched pattern is appended to the Blueprint IR before any downstream generator runs:

```ts
type EnrichedBlueprint = Blueprint & {
  matched_pattern: {
    id: string;            // e.g. "marketplace"
    confidence: "high" | "medium" | "low";
    second_choice_id: string | null;
  };
};
```

Each downstream generator references the matched pattern via `getPattern(blueprint.matched_pattern.id)` (Section 6) and uses it as follows:

**Stack Recommender (Feature 6):**
- Starts from `pattern.default_stack`. Each layer's pick becomes the candidate.
- For each pick, Claude is given the Blueprint IR and asked: "Does the spec contain a constraint that should override this default? If yes, name it and pick a different option from `alternatives_rejected` or beyond."
- Default override triggers: explicit "must be on AWS" → swaps `hosting`. Explicit "no third-party auth" → swaps `auth` to Auth.js. Explicit scale (>>100k users in spec) → may swap `db` to a sharded option.
- "Why this one" copy in the BoM (Feature 7) inherits `default_stack[layer].why` and `alternatives_rejected`, lightly customized to the spec.

**Data Model Synthesis (Feature 8):**
- Initial entity list = `pattern.canonical_entities` ∪ entities the parser found in the spec.
- Pattern entities supply field hints (`typical_fields`); spec-discovered entities are pure additions.
- Renaming is allowed: if the spec is a marketplace for "tutoring sessions", the `listing` canonical entity is renamed to `session` while keeping the relationships from `canonical_flows`.
- DDL generator gets both the merged entity list and `canonical_flows` to make sure FK relationships match real flows (e.g. `transaction.listing_id` exists because `purchase` flow touches both).

**System Diagram Generator (Feature 9):**
- Pattern's `default_stack` provides the labeled boxes (Frontend / Backend / DB / Queue / Auth / Hosting / Storage).
- Pattern's `canonical_flows` provide the arrow set; renamed entities preserve the topology.
- Mermaid output is then validated; on parse failure, retry once per Section 6 of the context doc.

**Failure Modes Catalog (Feature 10):**
- Seeded with `pattern.failure_modes_seed`.
- Claude is then asked: "Given this spec's specific entities, flows, and external services, add up to 5 more failure modes that are NOT in the seed list and ARE specific to this spec." Cap total at 10 (per the spec).
- This guarantees a non-empty, pattern-correct catalog even if Claude hallucinates poorly on a given spec.

**Cost & Effort Estimate (Feature 11):**
- `pattern.cost_anchor` provides the low/expected/high band per scale tier.
- Claude adjusts based on spec specifics (e.g. heavy media → push storage component up; heavy AI usage → push API spend up).
- Anchors prevent Claude from confidently inventing "$3/month at 100k users".

**Critique Pass (Feature 15):**
- The critic is told the matched pattern, so its hole-poking is calibrated. A critic told this is `marketplace` will reliably ask "where's the off-platform leakage mitigation?" It would not ask that for `crud-saas`.

---

## 5. Update protocol

**The library is data, not code.** Treat it the way you'd treat a content file.

- **Versioning.** `library.json` carries `library_version: "1.0"` and `updated_at`. Any content change bumps `library_version`. Schema-shape changes bump `REFERENCE_LIBRARY_SCHEMA_VERSION` in `types.ts` and *also* bump `library_version` to a new MAJOR.
- **What goes in the manifest.** Every generated bundle's `manifest.json` includes `reference_library_version`. This makes "we re-ran this spec and got a different stack" answerable — was it the model, the prompt, or the library?
- **Edits are PRs against `library.json` only.** No code change should be needed to update a pattern's default stack, costs, or failure modes. If a content edit forces a code edit, the schema is wrong; fix it.
- **Cadence.** Plan for a quarterly review post-V1 (prices drift, defaults age). Out-of-band edits when a default is materially wrong (e.g. a vendor's pricing changes, an alternative becomes obviously better). No "live update from a feature flag" — a content change should be a deploy you can roll back.
- **No user-uploaded patterns in V1.** Out of scope per the context doc. A "custom organization library" is a clear V2 conversation, not now.
- **Validation in CI.** A Vitest unit test asserts (a) `libraryData satisfies ReferenceLibrary`, (b) every pattern has all nine stack layers, (c) `id` is unique and kebab-case, (d) `canonical_flows[*].entities_touched` references only entities in `canonical_entities`. This catches the most common edit mistakes before they ship.
- **Cache invalidation.** Because the library is part of the cached Anthropic prompt prefix, a content change invalidates the cache for the next request. That's correct behavior — we *want* the new library to take effect — and the input-token cost on the cache miss is a one-time hit.

---

## 6. Handoff to Matt

**File locations:**
- `src/lib/aib/reference/types.ts` — exactly the type definitions in Section 1.
- `src/lib/aib/reference/library.json` — the 10 patterns. I will hand you the full JSON in a single PR; the three patterns above are final, the other seven follow the same shape.
- `src/lib/aib/reference/index.ts` — re-exports + the matching function below.

**Loading:**

```ts
// src/lib/aib/reference/index.ts
import libraryData from "./library.json";
import type { ReferenceLibrary, ReferencePattern } from "./types";

export const referenceLibrary = libraryData as ReferenceLibrary;

const patternsById = new Map<string, ReferencePattern>(
  referenceLibrary.patterns.map((p) => [p.id, p])
);

export function getPattern(id: string): ReferencePattern {
  const p = patternsById.get(id);
  if (!p) throw new Error(`Unknown reference pattern: ${id}`);
  return p;
}

export function listPatternSummaries() {
  // Used in the classifier prompt. Strips heavy fields to keep token count tight.
  return referenceLibrary.patterns.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    when_to_use: p.when_to_use,
    when_not_to_use: p.when_not_to_use,
  }));
}
```

Static JSON import means the library is bundled at build time (no runtime fetch, no env coupling). It is also stitched into the cached system-prompt prefix used by every Anthropic call (Feature 18) — a single source of truth, cached once, reused on every request.

**Matching function signature:**

```ts
// src/lib/aib/pipeline/match-pattern.ts
import type { Blueprint } from "@/lib/aib/blueprint/types";
import type { ReferencePattern } from "@/lib/aib/reference/types";

export interface PatternMatch {
  pattern_id: ReferencePattern["id"];
  confidence: "high" | "medium" | "low";
  second_choice_id: ReferencePattern["id"] | null;
  reasoning_one_line: string;
}

/**
 * Classifies a Blueprint IR into one of the V1 reference patterns.
 *
 * - Uses AIB_MODEL_CLASSIFICATION (fail loud if unset, per context doc Section 4).
 * - Calls Claude with the cached system prompt + listPatternSummaries() + blueprint.
 * - On malformed JSON: retry once with the parse error fed back (context doc Section 6 contract).
 * - On second failure: throw a typed error; orchestrator returns `{ status: "blocked" }`.
 */
export async function matchPattern(blueprint: Blueprint): Promise<PatternMatch>;
```

**Implementation notes for Matt:**

1. The classifier's system prompt should include the **exact** strings from `listPatternSummaries()` — do not paraphrase them. The `when_to_use`/`when_not_to_use` bullets are the contract.
2. Use Anthropic structured output (JSON mode) and parse with a Zod schema mirroring `PatternMatch`. `pattern_id` and `second_choice_id` are validated against `referenceLibrary.patterns.map(p => p.id)`.
3. Token budget for this call should be tracked against the per-bundle 50k/$0.50 cap (context doc Section 7) like every other LLM call. It's small but it counts.
4. Add a Vitest unit test with at least one fixture spec per pattern asserting the classifier picks the right `pattern_id` with `confidence === "high"`. This is the regression test for both the library and the prompt.
5. Don't add a CLI tool, don't add an admin UI, don't add a "preview classification" route in V1. The library is edited by a human (me) opening a PR; that's the entire workflow.

If anything in the Blueprint IR shape changes after this is built, ping me — `canonical_flows[*].entities_touched` depends on the IR using the same entity-name convention.