// Reference Architecture Library — V1
// Frank's spec, materialized as a TS const so it bundles into the server build
// and can be embedded into Gemini cached-content prefixes per Luke §5.

export const REFERENCE_LIBRARY_SCHEMA_VERSION = 1 as const;
export const REFERENCE_LIBRARY_VERSION = "1.0";

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
  name: string;
  why: string;
  alternatives_rejected: Array<{ name: string; reason: string }>;
}

export type DefaultStack = Record<StackLayer, StackPick>;

export interface CanonicalEntity {
  name: string;
  purpose: string;
  typical_fields?: string[];
}

export interface CanonicalFlow {
  name: string;
  description: string;
  entities_touched: string[];
}

export interface FailureModeSeed {
  title: string;
  trigger: string;
  blast_radius: string;
  detection: string;
  mitigation: string;
}

export interface CostAnchor {
  tier_10_users: number;
  tier_1k_users: number;
  tier_100k_users: number;
  dominant_cost_at_scale: string;
}

export interface ReferencePattern {
  id: string;
  name: string;
  description: string;
  when_to_use: string[];
  when_not_to_use: string[];
  default_stack: DefaultStack;
  canonical_entities: CanonicalEntity[];
  canonical_flows: CanonicalFlow[];
  failure_modes_seed: FailureModeSeed[];
  cost_anchor: CostAnchor;
}

export interface ReferenceLibrary {
  schema_version: typeof REFERENCE_LIBRARY_SCHEMA_VERSION;
  library_version: string;
  updated_at: string;
  patterns: ReferencePattern[];
}

export const PATTERN_IDS = [
  "crud-saas",
  "ai-wrapper",
  "marketplace",
  "rag-app",
  "b2b-webhooks",
  "internal-tool",
  "realtime-collab",
  "data-pipeline",
  "mobile-first-api",
  "iot-telemetry",
] as const;

export type PatternId = (typeof PATTERN_IDS)[number];

const crudSaas: ReferencePattern = {
  id: "crud-saas",
  name: "CRUD SaaS",
  description:
    "A single- or lightly-multi-tenant web app where users sign up, create and edit records, view dashboards, and pay a subscription. The 80% case for B2B and prosumer ideas.",
  when_to_use: [
    "Spec mentions accounts, dashboards, and CRUD on user-owned records.",
    "Single user or single tenant per workspace; no two-sided marketplace dynamic.",
    "Subscription billing or freemium is the implied business model.",
    "No real-time multi-user collaboration on the same record.",
    "AI features, if present, are a sidecar (e.g. 'AI summary button'), not the product.",
  ],
  when_not_to_use: [
    "Two distinct user roles transact with each other on the platform — use marketplace.",
    "The core value is an LLM transforming user input — use ai-wrapper.",
    "Read-only over an existing dataset with no signup — use internal-tool.",
    "Multi-user simultaneous editing of the same document — use realtime-collab.",
    "Primary surface is event ingestion from third parties — use b2b-webhooks.",
  ],
  default_stack: {
    frontend: {
      name: "Next.js (App Router) + TypeScript + Tailwind + shadcn/ui",
      why: "Server components keep auth-gated dashboards cheap to render, server actions remove a REST layer, and shadcn gives a polished baseline without a design dependency.",
      alternatives_rejected: [
        { name: "Remix", reason: "Smaller ecosystem and weaker Vercel integration; no upside for this shape." },
        { name: "SvelteKit", reason: "Talent pool is thinner for handoff; component ecosystem behind shadcn." },
        { name: "Vite SPA + separate API", reason: "Two deploys, two auth surfaces, no SSR for SEO." },
      ],
    },
    backend: {
      name: "Next.js Server Actions + Route Handlers (Node runtime)",
      why: "Co-locating mutations with the UI removes API-contract drift. Route handlers cover the few cases (webhooks, file uploads) where actions are the wrong fit.",
      alternatives_rejected: [
        { name: "Separate Express/Fastify service", reason: "Doubles the ops surface for a solo founder with no scale justification." },
        { name: "tRPC", reason: "Server actions cover the same ergonomic win in App Router with one fewer dependency." },
      ],
    },
    db: {
      name: "Neon Postgres + Drizzle ORM",
      why: "Postgres is the right default for relational CRUD; Neon's branching makes preview environments trivial; Drizzle is type-safe SQL without Prisma's generation step.",
      alternatives_rejected: [
        { name: "Supabase", reason: "Coupling auth+db+storage is fine until you want to swap one." },
        { name: "PlanetScale", reason: "MySQL ecosystem is weaker for JSONB/array workloads typical in CRUD apps." },
        { name: "Prisma + Neon", reason: "Heavier client and migration ergonomics no better than Drizzle." },
      ],
    },
    queue: {
      name: "Inngest",
      why: "Durable background jobs without standing up Redis/BullMQ. Free tier covers solo-founder scale.",
      alternatives_rejected: [
        { name: "BullMQ + Redis", reason: "Redis to provision and pay for; queue UI to build; not worth it pre-PMF." },
        { name: "Vercel Cron", reason: "Schedules only, no event-driven jobs or retries with backoff." },
      ],
    },
    cache: {
      name: "Upstash Redis",
      why: "Per-request pricing with a generous free tier; works from Vercel functions without connection-pool drama.",
      alternatives_rejected: [
        { name: "Vercel KV", reason: "Same Upstash backend with Vercel markup and lock-in." },
        { name: "In-memory LRU", reason: "Doesn't survive across serverless invocations." },
      ],
    },
    auth: {
      name: "Clerk",
      why: "Email+OAuth+billing-customer-mapping in one drop-in. Solo founders should not be writing password-reset flows.",
      alternatives_rejected: [
        { name: "Auth.js (NextAuth)", reason: "Free but you own the UI, the email templates, and every edge case." },
        { name: "Supabase Auth", reason: "Pulls in a db dependency we already rejected." },
        { name: "WorkOS", reason: "Priced for B2B-with-SSO; overkill at zero customers." },
      ],
    },
    hosting: {
      name: "Vercel",
      why: "Zero-config Next.js deploys, preview URLs per PR, and the cron+edge config you actually use.",
      alternatives_rejected: [
        { name: "Fly.io", reason: "Better for stateful workloads; you give up the Vercel/Next.js integration polish." },
        { name: "Render", reason: "No preview environment story as clean as Vercel's." },
      ],
    },
    file_storage: {
      name: "Cloudflare R2",
      why: "S3-compatible API with no egress fees — the difference shows up the moment users start downloading their own uploads.",
      alternatives_rejected: [
        { name: "AWS S3", reason: "Egress fees punish exactly the workload SaaS apps generate." },
        { name: "Vercel Blob", reason: "Priced at a premium and locks storage to one host." },
      ],
    },
    observability: {
      name: "Sentry + Vercel Analytics",
      why: "Sentry catches the errors users won't email you about; Vercel Analytics gives you the funnel data.",
      alternatives_rejected: [
        { name: "Datadog", reason: "Priced per host/seat; absurd for a one-engineer app." },
        { name: "PostHog self-hosted", reason: "You're now running infra to watch your infra." },
      ],
    },
  },
  canonical_entities: [
    { name: "user", purpose: "Authenticated end-user; owns workspaces and records.", typical_fields: ["id", "email", "name", "created_at"] },
    { name: "workspace", purpose: "Tenancy boundary; container for records and members.", typical_fields: ["id", "owner_id", "name", "plan", "created_at"] },
    { name: "record", purpose: "The domain object the app is actually about — replaced by the spec's noun.", typical_fields: ["id", "workspace_id", "created_by", "data_jsonb", "updated_at"] },
    { name: "subscription", purpose: "Billing state per workspace, mirrored from Stripe.", typical_fields: ["workspace_id", "stripe_customer_id", "status", "current_period_end"] },
    { name: "audit_log", purpose: "Append-only record of meaningful state changes for support and debugging.", typical_fields: ["id", "workspace_id", "actor_id", "action", "target", "at"] },
  ],
  canonical_flows: [
    { name: "signup", description: "User signs up, lands in an empty workspace.", entities_touched: ["user", "workspace"] },
    { name: "create-record", description: "User in a workspace creates the primary domain record.", entities_touched: ["user", "workspace", "record", "audit_log"] },
    { name: "list-records", description: "Paginated, filterable view of records in the active workspace.", entities_touched: ["workspace", "record"] },
    { name: "subscribe", description: "User upgrades to a paid plan via Stripe Checkout, webhook updates subscription.", entities_touched: ["workspace", "subscription"] },
    { name: "invite-member", description: "Workspace owner invites a teammate by email.", entities_touched: ["user", "workspace"] },
  ],
  failure_modes_seed: [
    { title: "Stripe webhook lost or replayed", trigger: "Network blip or duplicate delivery from Stripe.", blast_radius: "Subscription state drifts from billing reality.", detection: "Nightly reconciliation job comparing subscription.status to Stripe API.", mitigation: "Idempotency key on webhook handler; reconciliation job auto-corrects." },
    { title: "Workspace data leak across tenants", trigger: "Missing workspace_id predicate in a query path.", blast_radius: "User sees another customer's data — existential trust failure.", detection: "Drizzle query helper enforces tenant predicate at the type level; e2e test asserts cross-tenant 404.", mitigation: "All record queries go through scopedQuery(workspaceId) helper; lint rule bans raw queries on tenant tables." },
    { title: "Long-running export blocks the request", trigger: "User clicks Export CSV on a workspace with 100k records.", blast_radius: "Vercel function times out at 60s; user gets nothing.", detection: "Sentry timeout errors clustered on export endpoint.", mitigation: "Move export to Inngest job, email a signed download link when ready." },
    { title: "Database connection exhaustion on cold burst", trigger: "Marketing campaign drives a spike of cold serverless invocations.", blast_radius: "5xx for new users during the moment they're most expensive to acquire.", detection: "Neon's connection metrics + Sentry 'too many connections' errors.", mitigation: "Use Neon's pooled connection string; cap max in the Drizzle client." },
  ],
  cost_anchor: { tier_10_users: 0, tier_1k_users: 60, tier_100k_users: 1200, dominant_cost_at_scale: "Database compute (Neon) and Vercel function-invocation overage." },
};

const aiWrapper: ReferencePattern = {
  id: "ai-wrapper",
  name: "AI Wrapper",
  description:
    "A thin UI over a foundation-model API. The product's value is the prompt, the input plumbing, and the formatted output — not a database of user records.",
  when_to_use: [
    "Core flow is: user types/uploads input -> model call -> rendered output.",
    "Persistence, if any, is history of generations, not relational user data.",
    "The differentiator is the prompt, the few-shot examples, or the post-processing.",
    "Latency target is interactive (streamed) and cost-per-call is the binding constraint.",
    "No multi-user collaboration on the artifacts — each generation is single-shot.",
  ],
  when_not_to_use: [
    "Spec describes a corpus the user uploads and queries against — use rag-app.",
    "Generation is one feature in a broader CRUD app — use crud-saas and treat AI as a sidecar.",
    "Output must be grounded in user-private documents — use rag-app.",
    "Real-time multi-user editing of a shared AI canvas — use realtime-collab.",
  ],
  default_stack: {
    frontend: {
      name: "Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Vercel AI SDK",
      why: "AI SDK's useChat/useCompletion plus React Server Components handle streaming tokens to the UI without building a websocket layer.",
      alternatives_rejected: [
        { name: "LangChain.js UI components", reason: "Heavy abstraction for what is fundamentally a fetch + readable stream." },
        { name: "Custom EventSource wiring", reason: "Reinventing the AI SDK with no upside." },
      ],
    },
    backend: {
      name: "Next.js Route Handlers (Node runtime, streaming responses)",
      why: "Streaming responses from the model SDK back to the client is the entire backend in this pattern. Route handlers are the right primitive.",
      alternatives_rejected: [
        { name: "Edge runtime", reason: "Tempting for latency, kills compatibility with parts of model SDKs and many telemetry packages." },
        { name: "Separate Python FastAPI", reason: "Two deploys, two languages, for zero functional gain." },
      ],
    },
    db: {
      name: "Neon Postgres + Drizzle ORM",
      why: "Even an AI wrapper benefits from a generations table for history, sharing, and abuse forensics.",
      alternatives_rejected: [
        { name: "No DB / localStorage only", reason: "Defensible for week one; falls apart the moment you want sharing or rate limits." },
        { name: "DynamoDB", reason: "Worse ergonomics for the analytics queries you'll absolutely run on usage." },
      ],
    },
    queue: {
      name: "Inngest",
      why: "For long-running model calls (deep research, batch generation) that exceed Vercel's function timeout.",
      alternatives_rejected: [
        { name: "Provider batch API", reason: "Used in addition to Inngest, not instead — batches don't help the interactive path." },
        { name: "Self-hosted Celery", reason: "Wildly out of proportion for this product shape." },
      ],
    },
    cache: {
      name: "Upstash Redis",
      why: "Two jobs: per-user rate limits (so one tab can't bankrupt you) and idempotent caching of identical prompts.",
      alternatives_rejected: [
        { name: "Provider prompt caching alone", reason: "Different layer — cuts input tokens but doesn't dedupe identical end-to-end requests or enforce rate limits." },
      ],
    },
    auth: {
      name: "Clerk",
      why: "Identity is mainly there to attach a rate-limit and a paying customer to each request.",
      alternatives_rejected: [
        { name: "No auth (anonymous + IP rate limit)", reason: "Fine for a demo, ruinous as a product." },
        { name: "Auth.js", reason: "You become the email-template maintainer." },
      ],
    },
    hosting: {
      name: "Vercel",
      why: "Streaming responses and model SDKs both work cleanly on Node runtime; preview envs let you A/B prompt changes.",
      alternatives_rejected: [
        { name: "Cloudflare Workers", reason: "Streaming is great but the model SDK story and tracing tools are less battle-tested." },
      ],
    },
    file_storage: {
      name: "Cloudflare R2",
      why: "Stores user-uploaded inputs and durable copies of generated outputs without egress fees.",
      alternatives_rejected: [
        { name: "Vercel Blob", reason: "Premium pricing for the same S3-compatible API." },
      ],
    },
    observability: {
      name: "Sentry + Helicone (or Langfuse)",
      why: "Sentry catches code errors; Helicone captures every model call with cost, latency, and prompt — needed to answer 'why is this user costing me $40/month'.",
      alternatives_rejected: [
        { name: "Sentry alone", reason: "Blind to the dominant cost driver of this product shape." },
        { name: "Custom logging to Postgres", reason: "Yes, until you want a UI for it. Buy, don't build." },
      ],
    },
  },
  canonical_entities: [
    { name: "user", purpose: "Authenticated end-user; carries a rate limit and a billing identity.", typical_fields: ["id", "email", "plan", "monthly_token_budget"] },
    { name: "generation", purpose: "One model call: the input, the parameters, the output, the cost.", typical_fields: ["id", "user_id", "model_id", "input", "output", "input_tokens", "output_tokens", "cost_usd", "created_at"] },
    { name: "preset", purpose: "Saved prompt template a user can reuse.", typical_fields: ["id", "user_id", "name", "system_prompt", "params_jsonb"] },
    { name: "share", purpose: "Public read-only link to a generation.", typical_fields: ["id", "generation_id", "slug", "expires_at"] },
  ],
  canonical_flows: [
    { name: "generate", description: "User submits input, output streams back, generation row written on completion.", entities_touched: ["user", "generation"] },
    { name: "save-preset", description: "User saves the current prompt and parameters as a reusable preset.", entities_touched: ["user", "preset"] },
    { name: "share-generation", description: "User mints a public read-only URL for a generation.", entities_touched: ["generation", "share"] },
    { name: "view-history", description: "User browses their previous generations.", entities_touched: ["user", "generation"] },
  ],
  failure_modes_seed: [
    { title: "Runaway cost from a single user", trigger: "User scripts the endpoint or holds down enter.", blast_radius: "API bill spikes; product economics break.", detection: "Per-user token-spend metric in Helicone; alert on >N tokens/hour.", mitigation: "Upstash rate limit per user_id; hard cap monthly_token_budget enforced before each call." },
    { title: "Prompt injection from user input", trigger: "User pastes input that overrides the system prompt.", blast_radius: "Output behavior diverges from product; potential brand or safety incident.", detection: "Manual review of flagged generations; output classifier on a sample.", mitigation: "Wrap user input in delimited blocks; system prompt explicitly instructs the model to ignore instructions inside the block." },
    { title: "Provider API outage or rate-limit", trigger: "Provider-side incident or org-level quota exhaustion.", blast_radius: "Product is unusable until the provider recovers.", detection: "5xx and 429 rate from provider surfaces in Sentry within a minute.", mitigation: "Surface a clear 'service degraded' state to the user; retry with exponential backoff inside the Inngest path." },
    { title: "Stale or poisoned cache hit", trigger: "Prompt changes server-side but Redis still serves the old output for the same input hash.", blast_radius: "Users see outputs that don't reflect a fix or policy update.", detection: "Cache key includes a prompt-version hash; mismatch implies stale data.", mitigation: "Invalidate by bumping the prompt-version component of the cache key on every system-prompt change." },
  ],
  cost_anchor: { tier_10_users: 20, tier_1k_users: 400, tier_100k_users: 25000, dominant_cost_at_scale: "LLM API spend; everything else is a rounding error." },
};

const marketplace: ReferencePattern = {
  id: "marketplace",
  name: "Marketplace",
  description:
    "A two-sided platform where supply-side users list things and demand-side users discover and transact. The platform mediates trust, payment, and messaging.",
  when_to_use: [
    "Spec describes two distinct user roles transacting with each other.",
    "Money or a binding commitment changes hands through the platform.",
    "Discovery (search, filters, ranking) is a first-class surface.",
    "The platform takes a cut, escrows funds, or handles disputes.",
    "Trust signals (reviews, verification) are part of the value proposition.",
  ],
  when_not_to_use: [
    "All users have the same role — that's social-feed or crud-saas.",
    "There is no transaction, just content and discovery.",
    "Single-vendor catalog selling to many buyers — closer to crud-saas.",
    "B2B integration product — use b2b-webhooks.",
  ],
  default_stack: {
    frontend: {
      name: "Next.js (App Router) + TypeScript + Tailwind + shadcn/ui",
      why: "Marketplaces live or die on SEO for supply-side listing pages; SSR-by-default plus image optimization out of the box are exactly what you need.",
      alternatives_rejected: [
        { name: "Remix", reason: "Comparable on SSR, weaker on the image/SEO toolchain you'll lean on." },
        { name: "SPA + headless CMS", reason: "SEO becomes a project of its own — wrong battle for a solo founder." },
      ],
    },
    backend: {
      name: "Next.js Server Actions + Route Handlers (Node runtime)",
      why: "Search, listing CRUD, and message send are all natural server actions. Route handlers cover Stripe Connect webhooks and image-upload presign endpoints.",
      alternatives_rejected: [
        { name: "Separate API service", reason: "Two deploys for one product; nothing in this shape requires it pre-traction." },
      ],
    },
    db: {
      name: "Neon Postgres + Drizzle ORM (with pg_trgm for search)",
      why: "Marketplaces are heavily relational; Postgres' trigram + full-text search is good enough for V1, removing a search-service dependency.",
      alternatives_rejected: [
        { name: "Postgres + Algolia/Meilisearch", reason: "Worth it after PMF, not before." },
        { name: "MongoDB", reason: "Documents fight you the moment you want complex relational queries." },
      ],
    },
    queue: {
      name: "Inngest",
      why: "Notification fan-out and post-transaction workflows (review request after N days) are the textbook Inngest use case.",
      alternatives_rejected: [
        { name: "Vercel Cron", reason: "Schedules without event-driven branching." },
        { name: "BullMQ + Redis", reason: "Self-managed Redis is not how a solo founder should spend time." },
      ],
    },
    cache: {
      name: "Upstash Redis",
      why: "Hot listing pages and search-result pages are perfect cache fodder; rate-limits on listing creation prevent spam.",
      alternatives_rejected: [
        { name: "Next.js fetch cache only", reason: "Fine for static-ish reads, doesn't help with rate limiting or message dedupe." },
      ],
    },
    auth: {
      name: "Clerk",
      why: "Two roles (buyer/seller) modeled as Clerk metadata; Stripe Connect customer ID stored against the user.",
      alternatives_rejected: [
        { name: "Auth.js", reason: "You'd be writing the verification, the magic-link, and the OAuth wiring yourself." },
        { name: "Supabase Auth", reason: "Pulls in a db dependency we already rejected." },
      ],
    },
    hosting: {
      name: "Vercel",
      why: "ISR for listing pages, edge image optimization, preview deploys per PR — all the things a marketplace front-end actually uses.",
      alternatives_rejected: [
        { name: "Fly.io", reason: "You give up Vercel's image and ISR primitives without a meaningful win." },
      ],
    },
    file_storage: {
      name: "Cloudflare R2 + Cloudflare Images",
      why: "Listings are image-heavy; R2 + Images gives transformations and free egress.",
      alternatives_rejected: [
        { name: "S3 + CloudFront", reason: "More moving parts and egress is no longer free." },
      ],
    },
    observability: {
      name: "Sentry + Vercel Analytics + Stripe Sigma",
      why: "Sentry for code errors, Vercel Analytics for funnel, Stripe Sigma for the GMV/take-rate metrics that are the business.",
      alternatives_rejected: [
        { name: "Datadog", reason: "Per-host pricing makes no sense at this stage." },
        { name: "Custom GMV dashboard", reason: "Buy with Stripe Sigma; build only after you've grown out of it." },
      ],
    },
  },
  canonical_entities: [
    { name: "user", purpose: "Account; has a role flag and optional Stripe Connect account.", typical_fields: ["id", "email", "role", "stripe_account_id", "kyc_status"] },
    { name: "listing", purpose: "Supply-side artifact: the thing being offered.", typical_fields: ["id", "seller_id", "title", "description", "price_cents", "currency", "status", "search_vector"] },
    { name: "transaction", purpose: "A buyer's commitment against a listing; ledger of money movement.", typical_fields: ["id", "buyer_id", "listing_id", "amount_cents", "platform_fee_cents", "status", "stripe_payment_intent_id"] },
    { name: "message", purpose: "Buyer-seller communication scoped to a listing or transaction.", typical_fields: ["id", "thread_id", "sender_id", "body", "created_at"] },
    { name: "review", purpose: "Post-transaction rating; trust signal on the listing or seller.", typical_fields: ["id", "transaction_id", "rating", "body", "created_at"] },
  ],
  canonical_flows: [
    { name: "seller-onboard", description: "Seller signs up and connects a Stripe Connect account before they can list.", entities_touched: ["user"] },
    { name: "list-item", description: "Seller creates a listing with images and price.", entities_touched: ["user", "listing"] },
    { name: "search", description: "Buyer searches and filters listings.", entities_touched: ["listing"] },
    { name: "purchase", description: "Buyer pays via Stripe; transaction is created and held until fulfillment.", entities_touched: ["user", "listing", "transaction"] },
    { name: "message", description: "Buyer and seller exchange messages scoped to a listing.", entities_touched: ["user", "message"] },
    { name: "review", description: "After a transaction completes, buyer leaves a review.", entities_touched: ["transaction", "review"] },
  ],
  failure_modes_seed: [
    { title: "Off-platform leakage", trigger: "Buyer and seller exchange contact info in messages and transact outside the platform.", blast_radius: "Take rate evaporates; can't be detected via Stripe.", detection: "Regex/classifier scan of message bodies for email/phone patterns; track 'message -> transaction' conversion per seller.", mitigation: "Mask contact info pre-transaction; gate full contact on payment; suspend repeat-offender sellers." },
    { title: "Chargeback fraud", trigger: "Buyer files a chargeback after receiving the item or service.", blast_radius: "Platform eats the loss if it has guaranteed payout to the seller.", detection: "Stripe Radar signals; chargeback rate per seller and per buyer.", mitigation: "Hold seller payouts until a dispute window passes; require photo evidence on shipped goods." },
    { title: "Listing spam / SEO abuse", trigger: "Bots create thousands of listings to pump backlinks or scam buyers.", blast_radius: "Site quality collapses, Google delists, real sellers leave.", detection: "Listings-per-seller-per-hour metric; sudden burst in new accounts.", mitigation: "Rate limit listing creation; require seller verification before listings index; use noindex until verified." },
    { title: "Race condition on inventory", trigger: "Two buyers click 'buy' simultaneously on a one-of-a-kind listing.", blast_radius: "Both buyers charged; only one fulfilled.", detection: "Reports of double-bookings; transaction count > listing inventory.", mitigation: "Wrap reservation + payment-intent creation in a Postgres advisory lock keyed by listing_id." },
    { title: "Stripe Connect onboarding drop-off", trigger: "Sellers bounce during the KYC flow.", blast_radius: "Supply-side starves; the marketplace is dead without supply.", detection: "Funnel drop between signup and first published listing.", mitigation: "Defer KYC until the first sale; pre-fill what you can; handhold the first 50 sellers manually." },
  ],
  cost_anchor: { tier_10_users: 20, tier_1k_users: 150, tier_100k_users: 4500, dominant_cost_at_scale: "Image storage/CDN bandwidth and Stripe per-transaction fees." },
};

// Same shape, written to match Frank's three. Kept terser but with all required
// fields populated and consistent "why" / "rejected" prose. These are V1
// substrate — the LLM stack pick can override per spec.

const ragApp: ReferencePattern = {
  id: "rag-app",
  name: "RAG App",
  description:
    "Document Q&A or semantic search over a user-supplied corpus. Embeddings, chunking, retrieval, grounded generation.",
  when_to_use: [
    "User uploads documents (PDFs, text, web pages) and asks questions over them.",
    "Output must cite or quote the source corpus, not the model's general knowledge.",
    "Per-user or per-workspace corpus, not a global pre-trained index.",
    "Latency target tolerates a vector lookup before model call (~100-300ms extra).",
    "Scale is bounded — 10k-1M docs per tenant, not Google-scale.",
  ],
  when_not_to_use: [
    "Output isn't grounded in user docs — use ai-wrapper.",
    "Real-time event stream, not document corpus — use data-pipeline.",
    "Single global index for everyone, billion-scale — out of V1 scope.",
  ],
  default_stack: {
    frontend: {
      name: "Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Vercel AI SDK",
      why: "Chat-shaped UI with streamed responses and inline citations is exactly the AI SDK's sweet spot.",
      alternatives_rejected: [
        { name: "Streamlit / Gradio", reason: "Fine for demos, not for a product with auth and styling." },
      ],
    },
    backend: {
      name: "Next.js Route Handlers (Node runtime) + LlamaIndex.ts or hand-rolled retrieval",
      why: "Streaming retrieval+generation in one handler. LlamaIndex.ts saves you 80% of the boilerplate without locking you in.",
      alternatives_rejected: [
        { name: "LangChain.js", reason: "Larger surface area, less stable APIs; LlamaIndex is more focused on retrieval." },
        { name: "Python FastAPI + LlamaIndex (py)", reason: "Two languages, two deploys, no functional gain over the TS port." },
      ],
    },
    db: {
      name: "Neon Postgres + pgvector + Drizzle ORM",
      why: "Vectors and relational metadata in one DB; pgvector is fast enough up to ~1M vectors per tenant.",
      alternatives_rejected: [
        { name: "Pinecone", reason: "Separate billing, separate auth, separate sync pipeline — earn it after PMF." },
        { name: "Weaviate / Qdrant self-hosted", reason: "More infra to run; pgvector is good enough at this scale." },
      ],
    },
    queue: {
      name: "Inngest",
      why: "Document ingestion (chunking + embedding) is async and bursty; Inngest handles retries and rate-limiting against the embedding API.",
      alternatives_rejected: [
        { name: "Cron + Postgres job table", reason: "Reinvents Inngest with worse DX." },
      ],
    },
    cache: {
      name: "Upstash Redis",
      why: "Cache top retrieval results per query hash; cap embedding-API spend per user.",
      alternatives_rejected: [
        { name: "Postgres-only caching", reason: "Hot reads on Postgres are wasted DB cycles when Redis is $0 at low scale." },
      ],
    },
    auth: {
      name: "Clerk",
      why: "Per-user corpus isolation is the security model; Clerk provides the user_id that scopes every retrieval.",
      alternatives_rejected: [
        { name: "Auth.js", reason: "Same trade as crud-saas." },
      ],
    },
    hosting: {
      name: "Vercel",
      why: "Streaming generation + Node runtime + cron for re-embedding all fit. Heavy ingestion runs in Inngest, not on Vercel functions.",
      alternatives_rejected: [
        { name: "Fly.io", reason: "Better only if you outgrow Inngest and want a worker fleet." },
      ],
    },
    file_storage: {
      name: "Cloudflare R2",
      why: "Stores the original uploaded documents; chunks and embeddings live in Postgres.",
      alternatives_rejected: [
        { name: "S3", reason: "Egress fees on document re-downloads add up." },
      ],
    },
    observability: {
      name: "Sentry + Helicone + Postgres slow-query log",
      why: "Sentry for code, Helicone for embedding+generation cost, slow-query log for the pgvector index choices that always need tuning.",
      alternatives_rejected: [
        { name: "Datadog APM", reason: "Overkill at this scale." },
      ],
    },
  },
  canonical_entities: [
    { name: "user", purpose: "Authenticated end-user; owns documents and queries.", typical_fields: ["id", "email", "plan"] },
    { name: "document", purpose: "User-uploaded source artifact.", typical_fields: ["id", "user_id", "title", "source_url", "byte_size", "ingested_at"] },
    { name: "chunk", purpose: "A retrievable slice of a document with an embedding.", typical_fields: ["id", "document_id", "text", "embedding", "token_count", "ord"] },
    { name: "query", purpose: "A user's question and the grounded answer.", typical_fields: ["id", "user_id", "question", "answer", "cited_chunk_ids", "cost_usd", "created_at"] },
  ],
  canonical_flows: [
    { name: "upload-document", description: "User uploads a file; it's chunked, embedded, and indexed asynchronously.", entities_touched: ["user", "document", "chunk"] },
    { name: "ask-question", description: "User asks a question; top-k chunks retrieved, model generates a grounded answer with citations.", entities_touched: ["user", "query", "chunk"] },
    { name: "view-citations", description: "User clicks a citation and sees the source chunk in context.", entities_touched: ["query", "chunk", "document"] },
  ],
  failure_modes_seed: [
    { title: "Hallucinated citations", trigger: "Model invents a source ID that doesn't match any retrieved chunk.", blast_radius: "User trusts a fabricated quote.", detection: "Post-generation validator: every citation ID must be in the retrieved set.", mitigation: "Hard-fail responses with bad citations; retry with stricter system prompt." },
    { title: "Stale embeddings after re-chunking", trigger: "Chunking strategy changes; old embeddings remain.", blast_radius: "Retrieval quality silently degrades.", detection: "Per-document embedding_version tag; mismatch triggers re-ingestion.", mitigation: "Inngest backfill job on chunking-strategy change." },
    { title: "Context window overflow", trigger: "Retrieved chunks + question exceed model context.", blast_radius: "API error, user sees a generic failure.", detection: "Pre-call token count; alert if truncation happens.", mitigation: "Fallback re-rank to fewer chunks; surface a 'corpus too dense' UX hint." },
    { title: "Cross-tenant chunk leak", trigger: "Missing user_id filter in pgvector ANN query.", blast_radius: "User sees another customer's documents — privacy breach.", detection: "All retrieval goes through scopedRetrieve(userId); contract test asserts cross-tenant 0-results." , mitigation: "Tenant predicate baked into a query helper; lint rule blocks raw vector ops." },
  ],
  cost_anchor: { tier_10_users: 30, tier_1k_users: 350, tier_100k_users: 12000, dominant_cost_at_scale: "Embedding API spend on ingestion + LLM generation cost on retrieval." },
};

const b2bWebhooks: ReferencePattern = {
  id: "b2b-webhooks",
  name: "B2B Webhooks",
  description:
    "Backend integration product: ingests events from third-party systems via webhooks, transforms, fans out to other systems.",
  when_to_use: [
    "Spec describes connecting two SaaS systems (Stripe -> Slack, Shopify -> QuickBooks, etc.).",
    "Event ingestion is the primary surface, not user-facing UI.",
    "Customers expect retries, dead-letter queues, and replay.",
    "Reliability and observability are the product.",
    "Volumes are bursty: 100 events/sec sustained, 10k/sec spikes.",
  ],
  when_not_to_use: [
    "User-facing app that happens to use webhooks for billing — that's crud-saas with a webhook handler.",
    "Real-time human collaboration — use realtime-collab.",
    "Streaming analytics — use data-pipeline.",
  ],
  default_stack: {
    frontend: {
      name: "Next.js (App Router) + TypeScript + Tailwind + shadcn/ui",
      why: "The UI is a configuration dashboard + run history viewer. Standard SaaS shell.",
      alternatives_rejected: [
        { name: "Retool", reason: "Fine for internal-only; you ship to customers and want full control over the feel." },
      ],
    },
    backend: {
      name: "Next.js Route Handlers + Inngest workers (Node runtime)",
      why: "Route handler ingests + ACKs in <1s, hands off to Inngest for transformation and fan-out with retries.",
      alternatives_rejected: [
        { name: "Cloudflare Workers + Queues", reason: "Lower latency but worse debugging story for complex transformations." },
        { name: "Self-hosted RabbitMQ", reason: "Reliability you'd build is what Inngest already gives you." },
      ],
    },
    db: {
      name: "Neon Postgres + Drizzle ORM",
      why: "Event log + connector configs + audit trail are all relational; Postgres also works as the dead-letter queue.",
      alternatives_rejected: [
        { name: "DynamoDB", reason: "Worse for ad-hoc replay queries customers will ask for." },
        { name: "Kafka", reason: "Operational tax not justified at V1 scale; revisit when sustained > 1k events/sec." },
      ],
    },
    queue: {
      name: "Inngest",
      why: "Durable steps, automatic retries, idempotency keys, and a UI to inspect failures — exactly the product's reliability story.",
      alternatives_rejected: [
        { name: "BullMQ + Redis", reason: "You'd be reinventing Inngest's UI and replay tooling." },
        { name: "AWS SQS + Lambda", reason: "More wiring; worse local DX." },
      ],
    },
    cache: {
      name: "Upstash Redis",
      why: "Idempotency key store for inbound webhooks; per-tenant rate limits.",
      alternatives_rejected: [
        { name: "Postgres-only", reason: "Idempotency lookups on every webhook hammer the DB." },
      ],
    },
    auth: {
      name: "Clerk (with Organizations)",
      why: "B2B means customers have orgs and members; Clerk Orgs maps directly.",
      alternatives_rejected: [
        { name: "WorkOS", reason: "Save it for SSO/SCIM later; Clerk Orgs cover V1." },
      ],
    },
    hosting: {
      name: "Vercel",
      why: "Inbound webhooks land on route handlers; Inngest handles the heavy work outside the function timeout.",
      alternatives_rejected: [
        { name: "Fly.io", reason: "Better for sustained throughput, but Inngest already moves heavy work off Vercel." },
      ],
    },
    file_storage: {
      name: "Cloudflare R2",
      why: "Webhook payload archival for replay; cheap, no egress fees on customer-initiated re-pulls.",
      alternatives_rejected: [
        { name: "Postgres BYTEA", reason: "Bloats the DB; payloads belong in object storage." },
      ],
    },
    observability: {
      name: "Sentry + Inngest Cloud dashboard + Vercel Logs",
      why: "Inngest's dashboard IS the run-history view; Sentry for code errors; Vercel Logs for ingest-side debugging.",
      alternatives_rejected: [
        { name: "Datadog", reason: "Inngest already shows you 80% of what Datadog would, for free at this scale." },
      ],
    },
  },
  canonical_entities: [
    { name: "tenant", purpose: "Customer organization.", typical_fields: ["id", "name", "plan", "created_at"] },
    { name: "connector", purpose: "Configuration of one source<->destination mapping.", typical_fields: ["id", "tenant_id", "source_kind", "destination_kind", "config_jsonb", "enabled"] },
    { name: "event", purpose: "Inbound webhook payload after dedup.", typical_fields: ["id", "connector_id", "source_event_id", "payload_jsonb", "received_at", "status"] },
    { name: "delivery", purpose: "Outbound attempt to the destination.", typical_fields: ["id", "event_id", "attempt", "status", "response_code", "latency_ms", "delivered_at"] },
    { name: "audit_log", purpose: "Append-only log of config changes.", typical_fields: ["id", "tenant_id", "actor_id", "action", "target", "at"] },
  ],
  canonical_flows: [
    { name: "configure-connector", description: "Tenant admin sets up a source-to-destination mapping.", entities_touched: ["tenant", "connector"] },
    { name: "ingest-webhook", description: "Inbound HTTP POST is verified, deduped, persisted, queued.", entities_touched: ["connector", "event"] },
    { name: "deliver-event", description: "Worker transforms and POSTs to destination, records the attempt.", entities_touched: ["event", "delivery"] },
    { name: "replay-failed", description: "Admin replays a dead-lettered event from the dashboard.", entities_touched: ["event", "delivery"] },
  ],
  failure_modes_seed: [
    { title: "Webhook signature spoofing", trigger: "Attacker POSTs a forged payload claiming to be from a known source.", blast_radius: "Bogus events pollute downstream systems.", detection: "All inbound POSTs verified against source HMAC; reject + alert on signature failures.", mitigation: "Per-source signing key store; rotate on suspected leak." },
    { title: "Duplicate delivery", trigger: "Source retries an already-acked event.", blast_radius: "Downstream side effects fire twice.", detection: "Idempotency key on (connector_id, source_event_id); duplicate metric.", mitigation: "Redis idempotency cache + Postgres unique constraint as backstop." },
    { title: "Destination outage backs up the queue", trigger: "Customer's destination API is down for hours.", blast_radius: "Inngest queue grows; eventually OOM at the destination side.", detection: "Per-connector lag metric; alert on > N pending.", mitigation: "Circuit breaker per destination; pause connector and notify tenant after threshold." },
    { title: "Payload schema drift on the source", trigger: "Source SaaS ships a breaking change to their webhook schema.", blast_radius: "Transformations silently produce wrong output downstream.", detection: "Per-connector validation pass on every inbound payload; alert on validation-fail rate spike.", mitigation: "Versioned transformer; admin notified to update mapping." },
  ],
  cost_anchor: { tier_10_users: 25, tier_1k_users: 200, tier_100k_users: 6000, dominant_cost_at_scale: "Inngest step executions and Postgres compute on event-log queries." },
};

const internalTool: ReferencePattern = {
  id: "internal-tool",
  name: "Internal Tool",
  description:
    "Admin or ops dashboard over an existing database or API. Read-heavy, role-gated, no public signup.",
  when_to_use: [
    "Audience is internal staff, not customers.",
    "Read-heavy with a few mutating actions (refund, suspend user, etc.).",
    "Role-gated; everyone is on a known SSO.",
    "Low scale (< 100 concurrent users) and low SLA.",
    "Speed-to-build matters more than performance tuning.",
  ],
  when_not_to_use: [
    "Public signup or marketing surface — use crud-saas.",
    "High-stakes audit-trail product — use crud-saas with explicit audit wiring.",
  ],
  default_stack: {
    frontend: {
      name: "Next.js (App Router) + TypeScript + Tailwind + shadcn/ui",
      why: "Same shell as crud-saas; the speed advantage of Retool isn't worth the lock-in once you have engineers who can ship Next.js.",
      alternatives_rejected: [
        { name: "Retool", reason: "Faster v0, but you fight the platform for anything custom and pay per-seat forever." },
        { name: "Streamlit", reason: "Fine for data-team tools, awkward for action workflows." },
      ],
    },
    backend: {
      name: "Next.js Server Actions + Route Handlers (Node runtime)",
      why: "Mutations colocated with UI; route handlers proxy to upstream systems where needed.",
      alternatives_rejected: [
        { name: "Hasura / PostgREST", reason: "Removes the type-safety and auth-context wins of server actions." },
      ],
    },
    db: {
      name: "Existing source-of-truth DB (read-only) + Neon for app state",
      why: "Don't duplicate the prod DB; query it read-only and keep a small app-state DB for tool-specific data (saved views, audit log).",
      alternatives_rejected: [
        { name: "ETL into a new warehouse", reason: "Premature; rebuild only when query load on prod is a problem." },
      ],
    },
    queue: {
      name: "Vercel Cron",
      why: "Internal tools rarely need event-driven async; periodic refreshes and cleanups are enough.",
      alternatives_rejected: [
        { name: "Inngest", reason: "Heavier than this pattern needs." },
      ],
    },
    cache: {
      name: "Next.js fetch cache + Upstash Redis (only if hot views slow down)",
      why: "Most internal tools are slow enough for raw queries; reach for Redis only when a specific view exceeds 500ms.",
      alternatives_rejected: [
        { name: "Always-on Redis", reason: "Premature for this audience size." },
      ],
    },
    auth: {
      name: "Clerk with Organizations + Google SSO",
      why: "Internal staff are already on Google Workspace; SSO is the only auth that should exist for an internal tool.",
      alternatives_rejected: [
        { name: "Auth.js", reason: "You'd build SSO + role gating yourself." },
        { name: "WorkOS", reason: "Overkill until you sell this externally." },
      ],
    },
    hosting: {
      name: "Vercel",
      why: "Preview URLs per PR are gold for internal-tool review cycles.",
      alternatives_rejected: [
        { name: "Self-host on EC2", reason: "Time tax with no benefit." },
      ],
    },
    file_storage: {
      name: "Cloudflare R2 (only if needed)",
      why: "Most internal tools don't need user uploads; if export-to-file matters, R2 is the cheap default.",
      alternatives_rejected: [
        { name: "S3", reason: "Egress fees aren't worth it for this audience size." },
      ],
    },
    observability: {
      name: "Sentry + Vercel Logs",
      why: "Internal tools fail loud and fast; Sentry is plenty.",
      alternatives_rejected: [
        { name: "Datadog", reason: "Per-host pricing for an internal tool is absurd." },
      ],
    },
  },
  canonical_entities: [
    { name: "user", purpose: "Internal staff member with a role.", typical_fields: ["id", "email", "role", "team"] },
    { name: "saved_view", purpose: "User-pinned filter/sort over a tool page.", typical_fields: ["id", "user_id", "page", "filter_jsonb", "name"] },
    { name: "action_log", purpose: "Append-only record of mutating actions performed via the tool.", typical_fields: ["id", "user_id", "action", "target", "before_jsonb", "after_jsonb", "at"] },
  ],
  canonical_flows: [
    { name: "lookup-customer", description: "Staff searches for a customer record across upstream systems.", entities_touched: ["user", "saved_view"] },
    { name: "perform-action", description: "Staff performs a mutating action (refund, suspend, etc.); logged.", entities_touched: ["user", "action_log"] },
    { name: "save-view", description: "Staff pins a filter as a named view.", entities_touched: ["user", "saved_view"] },
  ],
  failure_modes_seed: [
    { title: "Privilege escalation via stale role cache", trigger: "User's role changed but JWT still says admin.", blast_radius: "Ex-admin still performs admin actions until token expiry.", detection: "Role check on every mutating action against live source-of-truth.", mitigation: "Short JWT TTL (5min); revocation list checked on mutating actions." },
    { title: "Read-only credential leaks via screenshots", trigger: "Staff screenshots a customer record into a Slack channel.", blast_radius: "PII in unauditable Slack history.", detection: "Quarterly audit of Slack/email PII patterns; staff training.", mitigation: "Mask PII by default; reveal only via 'show full' click logged to action_log." },
    { title: "Long-running query locks prod read replica", trigger: "Staff runs an unbounded analytics query.", blast_radius: "Slowdown on the prod app for real customers.", detection: "Postgres pg_stat_activity alerts on > 10s queries from the tool's role.", mitigation: "statement_timeout = 5s on the tool's DB role; expensive queries go through a queued export." },
  ],
  cost_anchor: { tier_10_users: 0, tier_1k_users: 30, tier_100k_users: 200, dominant_cost_at_scale: "Clerk seats and Vercel function invocations." },
};

const realtimeCollab: ReferencePattern = {
  id: "realtime-collab",
  name: "Realtime Collab",
  description:
    "Multi-user simultaneous editing or presence (docs, whiteboards, chat rooms). CRDTs or OT, presence channels.",
  when_to_use: [
    "Two or more users edit the same artifact at the same time and see each other's changes live.",
    "Presence (cursors, avatars) is part of the experience.",
    "Conflict resolution is automatic, not 'last write wins'.",
    "Offline-edit-then-sync is acceptable.",
    "Latency target is < 100ms for local echo, < 500ms for remote sync.",
  ],
  when_not_to_use: [
    "Multi-user but turn-based (e.g. comments) — that's crud-saas.",
    "Single-user with optimistic UI — also crud-saas.",
    "Realtime market data — use data-pipeline.",
  ],
  default_stack: {
    frontend: {
      name: "Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Yjs",
      why: "Yjs is the most production-tested CRDT for collaborative editors; works with TipTap, ProseMirror, custom canvases.",
      alternatives_rejected: [
        { name: "Automerge", reason: "Smaller ecosystem and slower in browser benchmarks for the doc-editor case." },
        { name: "Hand-rolled OT", reason: "A multi-quarter project to get right; Yjs is months ahead." },
      ],
    },
    backend: {
      name: "y-websocket server on Fly.io (or Liveblocks managed)",
      why: "Stateful WebSocket connection per doc; Vercel functions can't host this. Liveblocks is the buy-vs-build escape hatch.",
      alternatives_rejected: [
        { name: "Vercel functions", reason: "Stateless serverless can't hold WebSocket connections." },
        { name: "PartyKit (Cloudflare)", reason: "Strong contender; pick over Fly only if you're already on Cloudflare." },
      ],
    },
    db: {
      name: "Neon Postgres + Drizzle ORM (for metadata) + Yjs doc snapshots in R2",
      why: "Postgres for users/rooms/permissions; Yjs binary updates archived to R2 every N seconds.",
      alternatives_rejected: [
        { name: "Mongo for everything", reason: "Loses the relational guarantees the membership/permissions side needs." },
      ],
    },
    queue: {
      name: "Inngest",
      why: "Periodic snapshot compaction and notification fan-out (presence, mention).",
      alternatives_rejected: [
        { name: "Internal cron", reason: "Inngest's retry semantics are worth more than $0 saved." },
      ],
    },
    cache: {
      name: "Upstash Redis",
      why: "Pub/sub for cross-region presence broadcasts; rate-limit on doc creates.",
      alternatives_rejected: [
        { name: "In-memory only", reason: "Doesn't scale to >1 worker." },
      ],
    },
    auth: {
      name: "Clerk",
      why: "Auth tokens passed into the WebSocket handshake; per-room permissions enforced server-side.",
      alternatives_rejected: [
        { name: "Auth.js", reason: "Token-passing into a non-Next backend is a chore." },
      ],
    },
    hosting: {
      name: "Vercel (UI) + Fly.io (y-websocket)",
      why: "Two deploys is the price of stateful collab; keep the marketing/auth/billing on Vercel and the WS on Fly.",
      alternatives_rejected: [
        { name: "All on Fly", reason: "You give up Vercel's preview/SSR perks for the marketing surface." },
      ],
    },
    file_storage: {
      name: "Cloudflare R2",
      why: "Doc snapshots, user-uploaded media, exported PDFs.",
      alternatives_rejected: [
        { name: "S3", reason: "Egress fees on snapshot reads." },
      ],
    },
    observability: {
      name: "Sentry + Fly metrics + Vercel Analytics",
      why: "Three surfaces for three concerns; merge later if you outgrow them.",
      alternatives_rejected: [
        { name: "Datadog", reason: "Premature." },
      ],
    },
  },
  canonical_entities: [
    { name: "user", purpose: "Account.", typical_fields: ["id", "email", "name", "avatar_url"] },
    { name: "room", purpose: "Collaborative artifact (doc, board, channel).", typical_fields: ["id", "owner_id", "kind", "title", "created_at"] },
    { name: "membership", purpose: "Per-room permission for a user.", typical_fields: ["room_id", "user_id", "role"] },
    { name: "snapshot", purpose: "Periodic Yjs binary snapshot of a room.", typical_fields: ["id", "room_id", "version", "r2_key", "created_at"] },
    { name: "presence", purpose: "Ephemeral live-state per user-in-room (cursor, selection).", typical_fields: ["room_id", "user_id", "cursor_jsonb", "ts"] },
  ],
  canonical_flows: [
    { name: "create-room", description: "User creates a new collaborative artifact.", entities_touched: ["user", "room", "membership"] },
    { name: "join-room", description: "User opens a room; WebSocket handshake with auth + permissions check.", entities_touched: ["user", "room", "membership", "presence"] },
    { name: "edit", description: "Local CRDT mutation broadcasts to peers and persists in the live Yjs doc.", entities_touched: ["room", "presence"] },
    { name: "snapshot", description: "Background job persists a binary snapshot to R2.", entities_touched: ["room", "snapshot"] },
  ],
  failure_modes_seed: [
    { title: "Snapshot corruption", trigger: "WS server crashes mid-snapshot.", blast_radius: "Room loads to a stale state; recent edits lost.", detection: "Snapshot version monotonicity check on load.", mitigation: "Persist Yjs updates incrementally to Postgres in addition to R2 snapshots; replay on load." },
    { title: "Permission bypass via stale token", trigger: "User's room access revoked but their WS connection is still open.", blast_radius: "Ex-collaborator continues to read/edit.", detection: "Periodic re-auth on the WS connection; force-disconnect on revoke.", mitigation: "Short token TTL on WS handshake; per-message permission re-check for mutations." },
    { title: "Region partition splits a room", trigger: "Network partition between two y-websocket regions.", blast_radius: "Two halves of the room diverge; CRDT merges look weird on heal.", detection: "Region-pair health check; split-detection metric.", mitigation: "Single-region per room (sticky routing) until you can afford a cross-region CRDT broker." },
    { title: "Hot room overwhelms one node", trigger: "1000-user company-wide doc on one Fly machine.", blast_radius: "Latency spikes for everyone in that room.", detection: "Per-room connection count metric; alert > 200." , mitigation: "Per-room sharding; for ultra-hot rooms, bump to a larger machine class." },
  ],
  cost_anchor: { tier_10_users: 25, tier_1k_users: 250, tier_100k_users: 8000, dominant_cost_at_scale: "Fly compute for WebSocket connections + R2 snapshot bandwidth." },
};

const dataPipeline: ReferencePattern = {
  id: "data-pipeline",
  name: "Data Pipeline",
  description:
    "Ingest -> transform -> load. Batch or streaming, analytics-flavored. The product's value is the cleaned/enriched output.",
  when_to_use: [
    "Spec describes pulling data from one or more sources, processing it, and exposing it as a derived view or feed.",
    "Workloads are scheduled or event-driven, not user-interactive.",
    "Volumes are 10k-100M rows/day, not Google-scale.",
    "Output consumed via API, dashboard, or warehouse — not direct UI.",
    "Data quality (schema validation, dedup, lineage) is a first-class concern.",
  ],
  when_not_to_use: [
    "Real-time human collaboration — use realtime-collab.",
    "User-facing CRUD with pipeline as a sidecar — use crud-saas.",
    "Webhook ingestion fanning back to other SaaS — use b2b-webhooks.",
  ],
  default_stack: {
    frontend: {
      name: "Next.js (App Router) + TypeScript + Tailwind + shadcn/ui",
      why: "The UI is a config + monitoring dashboard. Standard SaaS shell suffices.",
      alternatives_rejected: [
        { name: "Streamlit", reason: "Fine for internal data-team UIs, awkward for customer-facing." },
      ],
    },
    backend: {
      name: "Next.js Route Handlers (control plane) + Inngest workers (data plane) + dlt or Mage for the actual extract/transform",
      why: "Vercel runs the UI/API; Inngest orchestrates the steps; dlt is a Python-friendly TS-callable extractor that handles the gnarly source SDKs.",
      alternatives_rejected: [
        { name: "Airflow / Dagster", reason: "Operational tax; pick when you have 50+ DAGs, not 5." },
        { name: "Self-hosted Prefect", reason: "Same as Airflow without the community size." },
      ],
    },
    db: {
      name: "Neon Postgres + Drizzle ORM (for metadata) + ClickHouse Cloud or Snowflake (for warehouse)",
      why: "Postgres for run-state and config; ClickHouse for analytical queries that would crush Postgres above 100M rows.",
      alternatives_rejected: [
        { name: "Postgres-only", reason: "Fine until ~10M rows; warehouse separation is the natural V1.5 step." },
        { name: "BigQuery", reason: "Strong contender; pick over ClickHouse only if customers already live in GCP." },
      ],
    },
    queue: {
      name: "Inngest",
      why: "Step functions, retries, scheduling, and a UI to debug pipeline runs.",
      alternatives_rejected: [
        { name: "Temporal Cloud", reason: "More powerful, more complex; switch only when steps are minutes-long human-in-the-loop." },
      ],
    },
    cache: {
      name: "Upstash Redis",
      why: "Idempotency keys for inbound events, dedup of source pulls.",
      alternatives_rejected: [
        { name: "In-memory only", reason: "Doesn't survive worker restarts." },
      ],
    },
    auth: {
      name: "Clerk with Organizations",
      why: "Customers are tenants; Clerk Orgs maps directly.",
      alternatives_rejected: [
        { name: "Auth.js", reason: "Same trade as crud-saas." },
      ],
    },
    hosting: {
      name: "Vercel (control plane) + Inngest Cloud (data plane)",
      why: "Heavy data work runs in Inngest's environment, not on Vercel functions.",
      alternatives_rejected: [
        { name: "Self-host workers on Fly", reason: "More ops; only worth it if Inngest pricing breaks at scale." },
      ],
    },
    file_storage: {
      name: "Cloudflare R2",
      why: "Raw extracts, intermediate parquet files, archival.",
      alternatives_rejected: [
        { name: "S3", reason: "Egress fees on warehouse loads add up." },
      ],
    },
    observability: {
      name: "Sentry + Inngest dashboard + per-run lineage table",
      why: "Inngest UI shows step status; a custom lineage table answers 'where did this row come from'.",
      alternatives_rejected: [
        { name: "Datadog", reason: "Premature." },
      ],
    },
  },
  canonical_entities: [
    { name: "tenant", purpose: "Customer organization.", typical_fields: ["id", "name", "plan"] },
    { name: "source", purpose: "External data origin (API, DB, file drop).", typical_fields: ["id", "tenant_id", "kind", "config_jsonb", "schedule"] },
    { name: "pipeline", purpose: "A named extract -> transform -> load definition.", typical_fields: ["id", "tenant_id", "name", "graph_jsonb", "enabled"] },
    { name: "run", purpose: "One execution of a pipeline.", typical_fields: ["id", "pipeline_id", "started_at", "finished_at", "status", "rows_processed"] },
    { name: "lineage", purpose: "Row-level provenance across stages.", typical_fields: ["run_id", "stage", "input_row_id", "output_row_id"] },
  ],
  canonical_flows: [
    { name: "configure-source", description: "Tenant connects a source with credentials.", entities_touched: ["tenant", "source"] },
    { name: "define-pipeline", description: "Tenant authors a pipeline graph.", entities_touched: ["tenant", "pipeline"] },
    { name: "run-pipeline", description: "Scheduled or manual run; rows flow through stages.", entities_touched: ["pipeline", "run", "lineage"] },
    { name: "inspect-run", description: "Tenant views run status, logs, sample rows.", entities_touched: ["run", "lineage"] },
  ],
  failure_modes_seed: [
    { title: "Source schema drift", trigger: "Upstream API changes a field type.", blast_radius: "All downstream rows for that source are wrong until detected.", detection: "Per-stage schema validator; alert on validation-fail rate.", mitigation: "Quarantine on validation fail; admin notified to update mapping." },
    { title: "Duplicate rows on pipeline retry", trigger: "Inngest retries a step that already loaded rows.", blast_radius: "Warehouse double-counts.", detection: "Idempotency key per row; duplicate-load metric.", mitigation: "MERGE on natural key in load step; UPSERT semantics from day one." },
    { title: "Warehouse cost spike from a runaway pipeline", trigger: "Bug in a transform stage produces 1000x the expected rows.", blast_radius: "Customer's warehouse bill jumps.", detection: "Per-run rows_processed alert vs 7-day baseline.", mitigation: "Hard cap on rows_processed per run; pause + notify when exceeded." },
    { title: "Source credential expiry silently breaks a pipeline", trigger: "OAuth token expires; refresh fails.", blast_radius: "Customer's data goes stale without warning.", detection: "Per-source last-success timestamp; alert > 24h stale.", mitigation: "Proactive refresh; clear UI banner when a connector needs reauth." },
  ],
  cost_anchor: { tier_10_users: 50, tier_1k_users: 600, tier_100k_users: 18000, dominant_cost_at_scale: "Warehouse compute (ClickHouse/Snowflake) + Inngest step executions." },
};

const mobileFirstApi: ReferencePattern = {
  id: "mobile-first-api",
  name: "Mobile-First API",
  description:
    "Backend exists primarily to serve a mobile client; offline-sync matters; web app is secondary or absent.",
  when_to_use: [
    "Spec mentions iOS/Android first; web is a marketing site or absent.",
    "Offline-first or eventual consistency is a product requirement.",
    "Push notifications are a primary engagement loop.",
    "Mobile-specific concerns (battery, bandwidth, app review) drive architecture.",
    "Users authenticate once and stay logged in for months.",
  ],
  when_not_to_use: [
    "Web is the primary surface, mobile a secondary nice-to-have — use crud-saas.",
    "Real-time multi-user — use realtime-collab.",
    "Mostly-static content — use static-content (out of V1).",
  ],
  default_stack: {
    frontend: {
      name: "React Native (Expo) + TypeScript + WatermelonDB",
      why: "Expo handles app-store submission; WatermelonDB handles offline-first sync without a multi-month sync engine project.",
      alternatives_rejected: [
        { name: "Flutter", reason: "Strong, but moves the team off TypeScript and the Vercel/Next ecosystem." },
        { name: "Native iOS + Android", reason: "Two codebases for a solo or small team is a non-starter." },
      ],
    },
    backend: {
      name: "Next.js Route Handlers (Node runtime) + sync endpoint contract",
      why: "REST or JSON-API endpoints exposed to the mobile client; the Next.js app also serves the marketing site.",
      alternatives_rejected: [
        { name: "Hasura / Postgraphile", reason: "GraphQL is a tax for mobile-first apps with bandwidth concerns." },
        { name: "Separate Express service", reason: "Two deploys without a reason." },
      ],
    },
    db: {
      name: "Neon Postgres + Drizzle ORM",
      why: "Server-of-record; mobile devices have their own local store synced via the sync endpoint.",
      alternatives_rejected: [
        { name: "Firebase Firestore", reason: "Locks you in; query model fights you above 1k users." },
      ],
    },
    queue: {
      name: "Inngest",
      why: "Push notification fan-out, periodic data refresh, async report generation.",
      alternatives_rejected: [
        { name: "Vercel Cron", reason: "Schedules only; no event-driven fan-out." },
      ],
    },
    cache: {
      name: "Upstash Redis",
      why: "Push-notification dedup, rate-limit on sync endpoints, hot-read cache.",
      alternatives_rejected: [
        { name: "Postgres-only", reason: "Mobile clients hammer sync; Redis offloads cheap reads." },
      ],
    },
    auth: {
      name: "Clerk (mobile-aware) or Auth0",
      why: "Long-lived refresh tokens, biometric on top of Clerk's RN SDK; password-reset flows you don't have to design.",
      alternatives_rejected: [
        { name: "Firebase Auth", reason: "Pulls in Firebase as a second backend you don't want." },
        { name: "Auth.js", reason: "Awkward for mobile clients." },
      ],
    },
    hosting: {
      name: "Vercel (API + marketing) + Expo EAS (build/submit)",
      why: "EAS handles app-store submission; Vercel hosts the API and marketing site.",
      alternatives_rejected: [
        { name: "Self-host via Capacitor on Render", reason: "Worse mobile DX." },
      ],
    },
    file_storage: {
      name: "Cloudflare R2 + signed upload URLs",
      why: "Mobile clients upload directly to R2 with short-lived signed URLs to avoid burning Vercel egress.",
      alternatives_rejected: [
        { name: "Upload via your API", reason: "Doubles bandwidth and burns function time." },
      ],
    },
    observability: {
      name: "Sentry (RN + Node) + Expo build/runtime logs",
      why: "Sentry's RN SDK is the standard for mobile crash + perf reporting.",
      alternatives_rejected: [
        { name: "Firebase Crashlytics", reason: "Same lock-in argument as Firestore." },
      ],
    },
  },
  canonical_entities: [
    { name: "user", purpose: "Authenticated end-user; carries device tokens.", typical_fields: ["id", "email", "device_token", "last_synced_at"] },
    { name: "device", purpose: "Registered mobile device for push.", typical_fields: ["id", "user_id", "platform", "push_token", "app_version"] },
    { name: "record", purpose: "Domain object the user creates and edits offline.", typical_fields: ["id", "user_id", "data_jsonb", "created_at", "updated_at", "deleted_at", "version"] },
    { name: "sync_cursor", purpose: "Per-device watermark of last-synced server state.", typical_fields: ["device_id", "cursor", "synced_at"] },
  ],
  canonical_flows: [
    { name: "register-device", description: "App registers for push; server stores push token.", entities_touched: ["user", "device"] },
    { name: "sync-pull", description: "App requests changes since cursor; server returns delta + new cursor.", entities_touched: ["user", "record", "sync_cursor"] },
    { name: "sync-push", description: "App posts local changes; server merges with last-write-wins per version.", entities_touched: ["user", "record"] },
    { name: "send-push", description: "Server fans out a notification to a user's devices.", entities_touched: ["user", "device"] },
  ],
  failure_modes_seed: [
    { title: "Sync conflict from clock skew", trigger: "Two devices edit the same record offline; server can't tell which is newer.", blast_radius: "User loses an edit silently.", detection: "Per-record version vector; conflict count metric.", mitigation: "Monotonic version per record; last-write-wins by server-side timestamp + audit conflict for review." },
    { title: "Push token expiry not handled", trigger: "User reinstalls; old token rejected by APNs/FCM.", blast_radius: "User stops getting notifications.", detection: "Per-token failed-delivery count; auto-prune > N failures.", mitigation: "Re-register on app launch; remove dead tokens from rotation." },
    { title: "Out-of-date app forces server to keep old API", trigger: "Users on iOS app review delays; v1 client stuck for weeks.", blast_radius: "API can't evolve without breaking real users.", detection: "Per-version request metric; alert when laggard tail > 5%.", mitigation: "Versioned endpoints; force-upgrade prompt on shipped breaking change." },
    { title: "Sync endpoint thundering herd at app launch", trigger: "1000 users open the app at 9am.", blast_radius: "Function cold starts cascade; sync slow or 5xx.", detection: "Per-minute sync-endpoint latency p95.", mitigation: "Edge cache on the sync delta where possible; jittered client retry; pooled DB connections." },
  ],
  cost_anchor: { tier_10_users: 10, tier_1k_users: 80, tier_100k_users: 2000, dominant_cost_at_scale: "Push provider fees (APNs is free, FCM scales) + Vercel function invocations on sync." },
};

const iotTelemetry: ReferencePattern = {
  id: "iot-telemetry",
  name: "IoT Telemetry",
  description:
    "Device fleet sends telemetry upward; server may issue commands downward. High-volume, low-latency-tolerant ingest.",
  when_to_use: [
    "Spec mentions a fleet of physical devices, sensors, or embedded systems.",
    "Telemetry volume is 100/sec to 1M/sec, sustained.",
    "Devices have intermittent connectivity; server must tolerate gaps.",
    "Commands must reach devices reliably (firmware update, config change).",
    "Time-series queries are a primary read pattern.",
  ],
  when_not_to_use: [
    "Mobile-app telemetry — use mobile-first-api.",
    "Webhook ingestion of events from SaaS — use b2b-webhooks.",
    "Analytics over historical data — use data-pipeline.",
  ],
  default_stack: {
    frontend: {
      name: "Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Recharts",
      why: "Operator dashboard for fleet monitoring; charts are the dominant UI.",
      alternatives_rejected: [
        { name: "Grafana", reason: "Great for ops, awkward as a customer-facing surface." },
      ],
    },
    backend: {
      name: "MQTT broker (HiveMQ Cloud or EMQX) + Next.js API + Inngest workers",
      why: "MQTT is the standard for constrained-device telemetry; HiveMQ runs the broker so you don't.",
      alternatives_rejected: [
        { name: "HTTP-only ingest", reason: "Devices on flaky networks need pub/sub semantics; HTTP polling is a battery killer." },
        { name: "Self-hosted MQTT (Mosquitto)", reason: "Operating a broker is its own product; buy at this stage." },
      ],
    },
    db: {
      name: "Neon Postgres + Drizzle ORM (metadata) + TimescaleDB on Postgres (time-series)",
      why: "Postgres for fleet/devices/users; Timescale extension for compressed time-series telemetry without a second DB.",
      alternatives_rejected: [
        { name: "InfluxDB", reason: "Strong for time-series alone, but two databases is two databases." },
        { name: "Postgres without Timescale", reason: "Falls over on aggregates above ~100M rows; Timescale buys you 10x." },
      ],
    },
    queue: {
      name: "Inngest",
      why: "Anomaly detection runs, command dispatch with retries, alert fan-out.",
      alternatives_rejected: [
        { name: "Kafka", reason: "Operationally heavier than V1 needs; revisit at sustained > 100k msgs/sec." },
      ],
    },
    cache: {
      name: "Upstash Redis",
      why: "Latest-known-state per device cache; per-device rate limits.",
      alternatives_rejected: [
        { name: "Postgres-only", reason: "Hot reads of device state would hammer the DB." },
      ],
    },
    auth: {
      name: "Clerk (operator auth) + per-device certs (mTLS)",
      why: "Operators auth via Clerk; devices auth via mTLS certs minted at provisioning.",
      alternatives_rejected: [
        { name: "Shared API key per device", reason: "One leak compromises the fleet." },
      ],
    },
    hosting: {
      name: "Vercel (UI + API) + HiveMQ Cloud (broker) + Inngest Cloud",
      why: "Three managed surfaces, zero infra to operate.",
      alternatives_rejected: [
        { name: "Self-host on EKS", reason: "Operational tax not justified at V1." },
      ],
    },
    file_storage: {
      name: "Cloudflare R2",
      why: "Firmware images, exported telemetry, archived raw streams.",
      alternatives_rejected: [
        { name: "S3", reason: "Egress fees on firmware downloads add up." },
      ],
    },
    observability: {
      name: "Sentry (code) + HiveMQ dashboard (broker) + Postgres slow-query log",
      why: "Three surfaces for three concerns; merge to Datadog only when fleet > 100k devices.",
      alternatives_rejected: [
        { name: "Datadog", reason: "Premature." },
      ],
    },
  },
  canonical_entities: [
    { name: "operator", purpose: "Human user managing the fleet.", typical_fields: ["id", "email", "role"] },
    { name: "device", purpose: "Physical device in the fleet.", typical_fields: ["id", "serial", "fleet_id", "firmware_version", "last_seen_at", "cert_fingerprint"] },
    { name: "fleet", purpose: "Logical grouping of devices.", typical_fields: ["id", "owner_id", "name", "deployed_at"] },
    { name: "telemetry", purpose: "One time-stamped reading from a device.", typical_fields: ["device_id", "ts", "metric", "value", "tags_jsonb"] },
    { name: "command", purpose: "A command issued to a device with delivery state.", typical_fields: ["id", "device_id", "kind", "payload_jsonb", "issued_at", "delivered_at", "status"] },
  ],
  canonical_flows: [
    { name: "provision-device", description: "Device gets a cert and registers with broker.", entities_touched: ["device", "fleet"] },
    { name: "publish-telemetry", description: "Device publishes readings; backend persists to time-series store.", entities_touched: ["device", "telemetry"] },
    { name: "issue-command", description: "Operator issues a command; broker delivers when device is online.", entities_touched: ["operator", "device", "command"] },
    { name: "monitor-fleet", description: "Operator views aggregated state across the fleet.", entities_touched: ["operator", "fleet", "device", "telemetry"] },
  ],
  failure_modes_seed: [
    { title: "Device clock drift breaks ingest dedup", trigger: "Device clock is years off; telemetry timestamps look bogus.", blast_radius: "Charts show data in the wrong time bucket; dedup keys collide.", detection: "Per-device clock-skew metric (server-time vs reported-time).", mitigation: "Server-side timestamp authoritative; reported-time as a separate column." },
    { title: "Mass firmware-update failure", trigger: "Bad firmware image rolled out to all devices simultaneously.", blast_radius: "Entire fleet bricked.", detection: "Health check after update; canary rollout cohort.", mitigation: "Staged rollout (1% -> 10% -> 100%) with auto-pause on health-check fail." },
    { title: "Broker outage stalls the fleet", trigger: "HiveMQ regional incident.", blast_radius: "All devices can't publish; downstream charts go silent.", detection: "Per-region broker connection count drop.", mitigation: "Multi-region broker tier; devices buffer locally and retry on reconnect." },
    { title: "Cert exfiltration from a single device", trigger: "Attacker extracts mTLS cert from a deployed unit.", blast_radius: "Attacker can publish bogus telemetry as that device.", detection: "Per-device anomaly detector on telemetry shape; rate-limit per cert.", mitigation: "Cert rotation policy; revoke on suspected compromise; per-device rate limits." },
  ],
  cost_anchor: { tier_10_users: 30, tier_1k_users: 250, tier_100k_users: 9000, dominant_cost_at_scale: "MQTT broker connection-hours and Timescale compute." },
};

export const REFERENCE_LIBRARY: ReferenceLibrary = {
  schema_version: REFERENCE_LIBRARY_SCHEMA_VERSION,
  library_version: REFERENCE_LIBRARY_VERSION,
  updated_at: "2026-06-01T00:00:00Z",
  patterns: [
    crudSaas,
    aiWrapper,
    marketplace,
    ragApp,
    b2bWebhooks,
    internalTool,
    realtimeCollab,
    dataPipeline,
    mobileFirstApi,
    iotTelemetry,
  ],
};

const _patternsById = new Map<string, ReferencePattern>(
  REFERENCE_LIBRARY.patterns.map((p) => [p.id, p]),
);

export function getPattern(id: string): ReferencePattern {
  const p = _patternsById.get(id);
  if (!p) throw new Error(`[aib] unknown reference pattern: ${id}`);
  return p;
}

export function listPatternSummaries(): Array<{
  id: string;
  name: string;
  description: string;
  when_to_use: string[];
  when_not_to_use: string[];
}> {
  return REFERENCE_LIBRARY.patterns.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    when_to_use: p.when_to_use,
    when_not_to_use: p.when_not_to_use,
  }));
}

/**
 * Compact per-pattern doc string used as the substrate for Stage 4 generators.
 * Carries default_stack + canonical_entities + canonical_flows + failure_modes_seed
 * + cost_anchor in a token-efficient form. Skips when_to_use/when_not_to_use
 * since those only matter at the classification stage.
 */
export function patternDocFor(id: string): string {
  const p = getPattern(id);
  const stack = (Object.keys(p.default_stack) as StackLayer[])
    .map((layer) => {
      const pick = p.default_stack[layer];
      return `- ${layer}: ${pick.name} -- ${pick.why}`;
    })
    .join("\n");
  const entities = p.canonical_entities
    .map(
      (e) =>
        `- ${e.name}: ${e.purpose}${e.typical_fields ? ` [fields: ${e.typical_fields.join(", ")}]` : ""}`,
    )
    .join("\n");
  const flows = p.canonical_flows
    .map(
      (f) =>
        `- ${f.name}: ${f.description} (entities: ${f.entities_touched.join(", ")})`,
    )
    .join("\n");
  const failures = p.failure_modes_seed
    .map(
      (f) =>
        `- ${f.title} | trigger: ${f.trigger} | blast: ${f.blast_radius} | detection: ${f.detection} | mitigation: ${f.mitigation}`,
    )
    .join("\n");
  const cost = `${p.cost_anchor.tier_10_users} (10u) / ${p.cost_anchor.tier_1k_users} (1k u) / ${p.cost_anchor.tier_100k_users} (100k u) USD/mo. Dominant at scale: ${p.cost_anchor.dominant_cost_at_scale}.`;
  return `# Pattern: ${p.name} (${p.id})\n${p.description}\n\n## Default stack\n${stack}\n\n## Canonical entities\n${entities}\n\n## Canonical flows\n${flows}\n\n## Failure modes (seed)\n${failures}\n\n## Cost anchor\n${cost}`;
}

/** Compact JSON of all patterns for cached prompt prefixes. */
export function referenceLibraryJson(): string {
  return JSON.stringify(REFERENCE_LIBRARY, null, 0);
}
