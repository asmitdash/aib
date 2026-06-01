# AiB V1 — UI Design Document

**Designer:** Paige (Senior Product Designer)
**Audience:** Matt (FE), Luke (streaming/server), Jessica (routing), Asmit (founder)
**Scope:** Three pages + shared shell. Conforms to V1 18-feature lock.

---

## 1. ASCII Wireframes

### 1.1 Shared Shell (all pages)

```
+----------------------------------------------------------------------+
|  AiB  Architecture-in-a-Box                          GitHub  Docs    |  <- 56px topbar, sticky, border-b
+----------------------------------------------------------------------+
|                                                                      |
|                          [page content]                              |
|                                                                      |
+----------------------------------------------------------------------+
|  v0.1 - paste-only - 60s bundles - $0-$5/run            theme toggle |  <- 40px footer, muted
+----------------------------------------------------------------------+
```

- Topbar left: wordmark "AiB" (mono, semibold) + tagline (muted).
- Topbar right: GitHub icon link, Docs link (placeholder, points to `/docs` 404 stub for V1).
- Footer: tiny system-status line + theme toggle (light/dark).
- Max content width: 960px on `/`, 1200px on `/b/[id]`.

---

### 1.2 `/` — Home / Spec Input (empty state)

```
+----------------------------------------------------------------------+
|  AiB  Architecture-in-a-Box                          GitHub  Docs    |
+----------------------------------------------------------------------+
|                                                                      |
|         Paste a spec. Get an architecture.                           |  <- H1, 40px, balanced
|         Diagram, stack, data model, failure modes, estimate.         |  <- subhead, muted, 18px
|         60 seconds. No login.                                        |
|                                                                      |
|   +--------------------------------------------------------------+   |
|   |  Describe what you want to build.                            |   |
|   |                                                              |   |
|   |  e.g. "A B2B invoicing tool. Stripe Connect for payouts.     |   |
|   |  Multi-tenant. Webhooks from QuickBooks. ~500 paying         |   |
|   |  customers in year one. Solo founder, six-month runway."     |   |
|   |                                                              |   |
|   |                                                              |   |
|   |                                                              |   |  <- min-height 240px, autosize to 480px
|   |                                                              |   |
|   |  0 / 5,000 tokens                                            |   |  <- bottom-left of textarea, muted
|   +--------------------------------------------------------------+   |
|                                                                      |
|   [ Try a sample spec ]                          [ Generate -> ]     |  <- ghost btn left, primary right
|                                                                      |
|   --------------------------------------------------------------     |
|                                                                      |
|   What you'll get                                                    |  <- H3, 14px, uppercase tracking
|                                                                      |
|   +----------------+ +----------------+ +----------------+           |
|   | System diagram | | Stack pick     | | Data model     |           |
|   | Mermaid, with  | | One per layer, | | Postgres DDL + |           |
|   | hover rationale| | defended       | | ERD            |           |
|   +----------------+ +----------------+ +----------------+           |
|   +----------------+ +----------------+ +----------------+           |
|   | Failure modes  | | Cost & effort  | | Build plan     |           |
|   | 5-10 cards     | | $/mo + weeks   | | M0..M3 weekly  |           |
|   +----------------+ +----------------+ +----------------+           |
|                                                                      |
+----------------------------------------------------------------------+
```

- Textarea: shadcn `Textarea`, autosize, monospaced placeholder.
- Token counter live-updates client-side (rough char/4 estimate).
- "Try a sample spec" inserts a canned 400-word B2B SaaS spec into the textarea (does NOT auto-generate).
- "Generate" disabled until ≥40 chars typed; tooltip on disabled state.
- Six "what you'll get" cards are static, non-interactive teasers.

---

### 1.3 `/` — Generate clicked: Phase A (Spec parsing, ~5–8s)

The textarea region collapses into a status panel **in place** (no route change yet — we stay on `/` until questions arrive, then route push to `/?stage=questions` for back-button safety). The bottom "what you'll get" grid stays.

```
+----------------------------------------------------------------------+
|  AiB                                                  GitHub  Docs   |
+----------------------------------------------------------------------+
|                                                                      |
|   +--------------------------------------------------------------+   |
|   |                                                              |   |
|   |   ( spinner )   Reading your spec...                         |   |  <- 64px row, centered
|   |                                                              |   |
|   |   Pulling out entities, actors, flows, and constraints.      |   |  <- muted
|   |                                                              |   |
|   |   [====================---------]  ~6s                       |   |  <- indeterminate Progress
|   |                                                              |   |
|   +--------------------------------------------------------------+   |
|                                                                      |
|   Cancel                                                             |  <- ghost text-button, bottom-right
|                                                                      |
+----------------------------------------------------------------------+
```

- Progress bar is **indeterminate** (we don't know exact time). Don't fake percentages.
- Single status line; updates from server stream:
  - "Reading your spec..."
  - "Spotting the tricky parts..."
  - "Drafting clarifying questions..."

---

### 1.4 `/` — Phase B (Clarifying Q&A)

```
+----------------------------------------------------------------------+
|  AiB                                                  GitHub  Docs   |
+----------------------------------------------------------------------+
|                                                                      |
|   A few quick questions                                              |  <- H2, 28px
|   These most change the architecture. ~60 seconds.                   |  <- muted
|                                                                      |
|   +--------------------------------------------------------------+   |
|   |  1 of 7                                                      |   |
|   |  Expected scale at month 12?                                 |   |  <- question, 18px
|   |                                                              |   |
|   |  ( ) <100 users     ( ) 100-1k     (o) 1k-10k                |   |  <- RadioGroup
|   |  ( ) 10k-100k       ( ) 100k+                                |   |
|   |                                                              |   |
|   |  Why we ask: Picks single-region vs multi-region, and        |   |  <- helper, muted, italic
|   |  whether we lean on a queue.                                 |   |
|   +--------------------------------------------------------------+   |
|                                                                      |
|   +--------------------------------------------------------------+   |
|   |  2 of 7                                                      |   |
|   |  Will users upload files?                                    |   |
|   |                                                              |   |
|   |  ( ) No   (o) Yes, small (<10MB)   ( ) Yes, large            |   |
|   |                                                              |   |
|   |  Why we ask: Decides object storage vs base64 in DB.         |   |
|   +--------------------------------------------------------------+   |
|                                                                      |
|   +--------------------------------------------------------------+   |
|   |  3 of 7                                                      |   |
|   |  Any compliance constraints? (HIPAA, SOC2, GDPR, none)       |   |
|   |                                                              |   |
|   |  [ none, but EU customers in y2                          ]   |   |  <- Input
|   |                                                              |   |
|   |  Why we ask: Region pinning, audit logging, encryption.      |   |
|   +--------------------------------------------------------------+   |
|                                                                      |
|   ... (questions 4-7, same shape) ...                                |
|                                                                      |
|   [ Skip and generate ]                       [ Continue -> ]        |  <- skip = ghost, continue = primary
|   3 unanswered                                                       |  <- muted, only if some skipped
|                                                                      |
+----------------------------------------------------------------------+
```

- Questions render as a vertical stack of `Card`s — all visible at once, no pagination. Technical founders skim faster than they click "next."
- Input types from server payload: `radio | text | textarea | multi-select`. Map each to shadcn primitive. (See flags for Luke.)
- "Skip and generate" sends nulls for unanswered → server proceeds with assumptions noted in the bundle.
- "Continue" disabled until ≥1 answer touched (can't be a no-op).
- "Why we ask" is always visible (not behind a hover) — answers a real anxiety: "is this question worth my time?"

---

### 1.5 `/` — Phase C (Generation, ~30–50s)

```
+----------------------------------------------------------------------+
|  AiB                                                  GitHub  Docs   |
+----------------------------------------------------------------------+
|                                                                      |
|   Building your architecture                                         |  <- H2
|   This usually takes 30-50 seconds. You can leave this tab.          |  <- muted
|                                                                      |
|   +--------------------------------------------------------------+   |
|   |  v   Parsed spec                            6.2s             |   |  <- check icon, time
|   |  v   Picked stack                           4.8s             |   |
|   |  v   Drafted data model                     7.1s             |   |
|   |  >   Writing failure modes...               (spinner)        |   |  <- current step, blue
|   |  -   Estimating cost & effort                                |   |  <- pending, muted
|   |  -   Running critique pass                                   |   |
|   |  -   Rendering diagram                                       |   |
|   +--------------------------------------------------------------+   |
|                                                                      |
|   [====================----------------]                             |  <- determinate, by step count
|                                                                      |
|   Cancel                                                             |
|                                                                      |
+----------------------------------------------------------------------+
```

- Seven steps map to the 18 features: parse → stack → datamodel → failures → estimate → critique → diagram.
- Steps stream in via SSE. Each step's elapsed time freezes when complete.
- Determinate progress = `(completed_steps / 7) * 100`. Honest enough.
- Cancel posts to `/api/generate/cancel?bundleId=...`; on success route back to `/`.

---

### 1.6 `/b/[id]` — Bundle View (above the fold)

```
+----------------------------------------------------------------------+
|  AiB                                                  GitHub  Docs   |
+----------------------------------------------------------------------+
|                                                                      |
|   B2B invoicing tool with Stripe Connect             [ ZIP ] [ Share]|  <- H1 from spec summary, 28px; actions right
|   Generated 2 min ago - claude-opus-4.7 - $0.31      Regenerate?     |  <- meta line, muted; regenerate = ghost link
|                                                                      |
|   +--------------------------------------------------------------+   |
|   |                                                              |   |
|   |                                                              |   |
|   |                                                              |   |
|   |              [ Mermaid diagram, rendered SVG ]               |   |  <- 16:9, max-h 480px
|   |                                                              |   |
|   |                                                              |   |
|   |                                                              |   |
|   |                                                              |   |
|   |  [ Fit ] [ 1:1 ] [ + ] [ - ]            [ View source .mmd ] |   |  <- bottom toolbar
|   +--------------------------------------------------------------+   |
|                                                                      |
+----------------------------------------------------------------------+
        |        |        |        |        |        |
     #stack  #bom   #data  #fail  #cost  #plan       <- sticky in-page nav (see 1.7)
```

Above the fold (1440x900): page title + meta + actions + full diagram + sticky-nav strip just peeking.

---

### 1.7 `/b/[id]` — Below the fold (collapsible sections + sticky nav)

```
+----------------------------------------------------------------------+
|  [ Stack ] [ BoM ] [ Data model ] [ Failures ] [ Cost ] [ Plan ]     |  <- sticky pill nav, 48px, scroll-spy active
+----------------------------------------------------------------------+
|                                                                      |
|   ## Stack                                                  [ - ]    |  <- section header, collapse toggle
|                                                                      |
|   Frontend         Next.js 15 (App Router)               [ why? ]    |  <- row layout: layer | pick | hover-trigger
|   Backend          Next.js server actions                [ why? ]    |
|   Database         Postgres on Neon                      [ why? ]    |
|   Queue            Inngest                               [ why? ]    |
|   Auth             Clerk                                 [ why? ]    |
|   Hosting          Vercel                                [ why? ]    |
|   Payments         Stripe Connect                        [ why? ]    |
|                                                                      |
|   > Rejected alternatives (3)                                        |  <- collapsible, default closed
|                                                                      |
|   ## Bill of Materials                                      [ - ]    |
|                                                                      |
|   +--------+--------------+----------+--------+------------------+   |
|   | Tier   | Name         | Type     | Cost   | Why this one     |   |  <- shadcn Table
|   +--------+--------------+----------+--------+------------------+   |
|   | infra  | Neon Postgres| db       | $19/mo | scale-to-zero    |   |
|   | infra  | Vercel Pro   | hosting  | $20/mo | zero-config      |   |
|   | saas   | Clerk        | auth     | $25/mo | B2B orgs OOB     |   |
|   | saas   | Stripe       | payments | 2.9%+30c| Connect required|   |
|   | npm    | drizzle-orm  | lib      | free   | type-safe SQL    |   |
|   | ...    | ...          | ...      | ...    | ...              |   |
|   +--------+--------------+----------+--------+------------------+   |
|                                                                      |
|   ## Data model                                             [ - ]    |
|                                                                      |
|   [ ERD ]  [ DDL ]                                                   |  <- shadcn Tabs
|                                                                      |
|   +--------------------------------------------------------------+   |
|   |  ( ERD: Mermaid erDiagram, rendered SVG )                    |   |
|   +--------------------------------------------------------------+   |
|                                                                      |
|   ## Failure modes                                          [ - ]    |
|                                                                      |
|   +-------------------------+  +-------------------------+           |
|   | Stripe webhook replay   |  | Tenant data leak via... |           |  <- 2-up Cards
|   | Trigger:  ...           |  | Trigger:  ...           |           |
|   | Blast:    ...           |  | Blast:    ...           |           |
|   | Detect:   ...           |  | Detect:   ...           |           |
|   | Mitigate: ...           |  | Mitigate: ...           |           |
|   +-------------------------+  +-------------------------+           |
|   ... (3-5 more rows of cards) ...                                   |
|                                                                      |
|   ## Cost & effort                                          [ - ]    |
|                                                                      |
|   Monthly infra        Low $64    Expected $180    High $420         |  <- 3-pill row
|   Build effort         M0: 1 wk   M1: 3 wk         M2: 4 wk          |
|   Total to v1                                       8 engineer-weeks |
|                                                                      |
|   ## Build plan                                             [ - ]    |
|                                                                      |
|   M0 - Week 1: Foundation                                   [ v ]    |  <- nested collapsible
|     - Repo, deploy pipeline, auth shell                              |
|     - Stripe Connect onboarding stub                                 |
|   M1 - Weeks 2-4: Invoicing core                            [ v ]    |
|     - ...                                                            |
|                                                                      |
|   --------------------------------------------------------------     |
|                                                                      |
|   What the critique pass caught                                      |  <- collapsed by default; this is the F15 surfacer
|   > 4 issues, fixed before showing you                               |
|                                                                      |
+----------------------------------------------------------------------+
```

---

### 1.8 "Explain this choice" — Hover popover (the chosen pattern)

```
        Backend       Next.js server actions        [ why? ]
                                                    +--------------------------------+
                                                    | Why Next.js server actions     |  <- 320px popover
                                                    |                                |
                                                    | Spec is single-app, low-RPS,   |
                                                    | typed end-to-end. Server       |
                                                    | actions remove a network hop   |
                                                    | and an auth surface vs a       |
                                                    | separate API service.          |
                                                    |                                |
                                                    | > Why not a separate API?      |  <- nested expand
                                                    | > Why not tRPC?                |
                                                    +--------------------------------+
```

- Trigger: click the `[ why? ]` chip (also keyboard accessible). Hover-only would lose mobile + keyboard users; we use **click-to-open Popover**, dismiss on outside click or Esc.
- Inside the popover: 1-paragraph rationale + 2-3 expandable "why not X" rows (covers F13).
- Same component used everywhere: stack rows, BoM rows, schema fields, diagram nodes, failure mode cards.

### 1.9 ZIP download confirmation (Toast)

```
                                  +-------------------------------------+
                                  | v  Bundle ready                     |  <- bottom-right, auto-dismiss 4s
                                  | aib-b2b-invoicing-a1b2c3.zip - 84KB |
                                  | [ Open folder ]            [ x ]    |
                                  +-------------------------------------+
```

### 1.10 Share link copied (Toast)

```
                                  +-------------------------------------+
                                  | v  Link copied                      |
                                  | aib.dev/b/a1b2c3d4e5f6 - read-only  |
                                  | [ Open ]                   [ x ]    |
                                  +-------------------------------------+
```

### 1.11 Error states

**Generation failure (server abort, e.g. budget breach):**

```
   +--------------------------------------------------------------+
   |  We couldn't finish this one                                 |
   |                                                              |
   |  The model burned through our token budget on your spec      |
   |  before completing. This usually means the spec is too       |
   |  broad — try narrowing to one product, one user type.        |
   |                                                              |
   |  [ Edit spec ]                       [ Try again ]           |
   |                                                              |
   |  Reference: gen_a1b2c3 - no charge                           |
   +--------------------------------------------------------------+
```

**Bundle not found on `/b/[id]` (V1: localStorage miss):**

```
   This bundle isn't on this device.
   In V1, bundles live in your browser's local storage.
   The person who generated it can re-share, or you can paste
   the spec at /  to regenerate.

   [ Go to home ]
```

---

## 2. Component Tree

Leaves are shadcn primitives unless noted. Indentation = nesting.

### 2.1 Shared shell (`app/layout.tsx`)
```
RootLayout
+- ThemeProvider (next-themes)
+- TopBar
|  +- Wordmark (custom)
|  +- NavLinks
|  +- Button (icon, GitHub link)
+- {children}
+- Footer
|  +- StatusLine (custom)
|  +- ThemeToggle (Button + Sun/Moon icons)
+- Toaster (shadcn Sonner)
```

### 2.2 `/` Home + all three pipeline phases (`app/page.tsx`)

State machine: `idle | parsing | questions | generating | error`. One component, switches its main panel.

```
HomePage (client component, holds state)
+- Hero
|  +- Heading (custom h1)
|  +- Subhead (custom p)
+- StateSwitch
|  +- IdleState (when state = idle)
|  |  +- SpecEditor
|  |  |  +- Textarea (shadcn)
|  |  |  +- TokenCounter (custom, reads textarea length)
|  |  +- ActionRow
|  |     +- Button (variant=ghost, "Try a sample spec")
|  |     +- Button (variant=default, "Generate")
|  |        +- Tooltip (shadcn) wraps disabled state
|  |  +- WhatYouGetGrid
|  |     +- Card x6 (shadcn Card + CardHeader + CardContent)
|  +- ParsingState (when state = parsing)
|  |  +- Card
|  |     +- Spinner (Loader2 from lucide)
|  |     +- StatusLine (text, updates from SSE)
|  |     +- Progress (shadcn, indeterminate)
|  |  +- Button (ghost, "Cancel")
|  +- QuestionsState (when state = questions)
|  |  +- Heading
|  |  +- QuestionCard x N
|  |  |  +- Card
|  |  |     +- CardHeader (counter "1 of 7" + question text)
|  |  |     +- CardContent
|  |  |     |  +- {RadioGroup | Input | Textarea | CheckboxGroup}  <- discriminated union
|  |  |     +- CardFooter (helper "Why we ask:" line)
|  |  +- ActionRow
|  |     +- Button (ghost, "Skip and generate")
|  |     +- Button (default, "Continue")
|  |     +- UnansweredHint (custom)
|  +- GeneratingState (when state = generating)
|  |  +- Heading
|  |  +- StepList
|  |  |  +- StepRow x 7  (icon + label + elapsed)
|  |  +- Progress (determinate, by step count)
|  |  +- Button (ghost, "Cancel")
|  +- ErrorState (when state = error)
|     +- Card (destructive variant)
|        +- Heading + body + ButtonRow + ref code
```

### 2.3 `/b/[id]` Bundle view (`app/b/[id]/page.tsx`)

```
BundlePage (client; reads bundle from localStorage on mount)
+- BundleHeader
|  +- Title (from blueprint summary)
|  +- MetaLine (generated_at, model_id, cost)
|  +- ActionGroup
|     +- Button (icon=Download, "ZIP")
|     +- Button (icon=Share2, "Share")
|     +- Button (variant=ghost, "Regenerate")
+- DiagramPanel
|  +- Card
|     +- MermaidRender (custom; renders to SVG client-side)
|     +- DiagramToolbar
|        +- Button (Fit, 1:1, +, -)
|        +- Button (variant=ghost, "View source .mmd")
|           +- Sheet (shadcn) on click
|              +- pre/code with .mmd source + Copy button
+- StickyNav
|  +- NavPill x 6 (Stack, BoM, Data model, Failures, Cost, Plan)
|     -- IntersectionObserver-driven active state
+- SectionStack
|  +- Section "Stack"
|  |  +- Collapsible (shadcn)
|  |     +- StackTable
|  |     |  +- StackRow x N (layer, pick, WhyChip)
|  |     +- RejectedAlts (Collapsible nested)
|  +- Section "BoM"
|  |  +- Table (shadcn)
|  |     +- BomRow x N (each cell may host a WhyChip)
|  +- Section "Data model"
|  |  +- Tabs (shadcn): "ERD" | "DDL"
|  |     +- TabsContent[ERD] -> MermaidRender (erDiagram)
|  |     +- TabsContent[DDL] -> CodeBlock (custom; copyable Postgres DDL)
|  +- Section "Failure modes"
|  |  +- FailureGrid
|  |     +- FailureCard x 5-10
|  |        +- Card -> 5 labeled rows (Title/Trigger/Blast/Detect/Mitigate) + WhyChip
|  +- Section "Cost & effort"
|  |  +- CostBand (3 Badge pills)
|  |  +- EffortRow (Milestone Badge x N)
|  +- Section "Build plan"
|     +- MilestoneList
|        +- Milestone x N
|           +- Collapsible (week label + tasks)
+- CritiqueCallout (Collapsible, "What the critique pass caught")
+- WhyChip (shared)
   +- Popover (shadcn)
      +- PopoverTrigger -> Badge variant=outline "why?"
      +- PopoverContent -> rationale + nested Accordion (Why not X)
```

### 2.4 Modals/drawers
- `Sheet` (right-side drawer) for "View source .mmd".
- `Dialog` for share-link confirm (alternative to toast — we use **toast**, not dialog, to stay out of the way).
- `Tooltip` for disabled buttons + small hints.
- `Popover` for every WhyChip.

---

## 3. Copy Deck

| Location | State | Copy | Rationale |
|---|---|---|---|
| `/` H1 | empty | "Paste a spec. Get an architecture." | Verb-first. Tells the whole story. No "AI-powered." |
| `/` subhead | empty | "Diagram, stack, data model, failure modes, estimate. 60 seconds. No login." | Lists the deliverables (sets expectation), then the two trust signals founders care about. |
| Textarea placeholder | empty | "e.g. \"A B2B invoicing tool. Stripe Connect for payouts. Multi-tenant. Webhooks from QuickBooks. ~500 paying customers in year one. Solo founder, six-month runway.\"" | Models the *kind* of detail that produces a good bundle: domain, integrations, scale, constraints. |
| Token counter | <80% | "1,247 / 5,000 tokens" | Plain. |
| Token counter | 80-100% | "4,210 / 5,000 tokens — getting tight" | Soft warn. |
| Token counter | >100% | "5,142 / 5,000 — trim to continue" | Hard block, blocks Generate. |
| "Try sample" button | default | "Try a sample spec" | Verb-first. Not "Load example" (vague). |
| Generate button | default | "Generate →" | Arrow signals forward motion. |
| Generate button | disabled, empty | "Paste a spec to start" (Tooltip) | Tells them what's missing. |
| Generate button | disabled, too short | "A bit more detail — at least a paragraph" (Tooltip) | Specific threshold guidance. |
| What you'll get | static | "Diagram, stack pick, data model, failure modes, cost & effort, build plan" (six cards) | Each card matches a downstream section. Pre-sells the bundle. |
| Phase A status | step 1 | "Reading your spec..." | Plain. |
| Phase A status | step 2 | "Spotting the tricky parts..." | Hints at what makes the tool valuable. |
| Phase A status | step 3 | "Drafting clarifying questions..." | Sets up Phase B. |
| Phase B header | default | "A few quick questions" | "Quick" is the trust signal. |
| Phase B subhead | default | "These most change the architecture. ~60 seconds." | Justifies the friction. |
| Phase B "why we ask" | per-q | e.g. "Picks single-region vs multi-region, and whether we lean on a queue." | Earns the question. Founders bounce if questions feel arbitrary. |
| Phase B Skip button | default | "Skip and generate" | Honest. Not "I'll do this later." |
| Phase B Continue | default | "Continue →" | |
| Phase B unanswered | conditional | "3 unanswered — we'll guess" | Honest about cost of skipping. |
| Phase C header | default | "Building your architecture" | "Building" not "Generating" — feels like craft, not slot machine. |
| Phase C subhead | default | "This usually takes 30–50 seconds. You can leave this tab." | Sets expectation + permission to multitask. |
| Phase C step 1 | running | "Parsing spec" → done: "Parsed spec" | Active vs past tense flips on completion. |
| Phase C step 2 | running | "Picking stack" → "Picked stack" | |
| Phase C step 3 | running | "Drafting data model" → "Drafted data model" | |
| Phase C step 4 | running | "Writing failure modes" → "Wrote failure modes" | |
| Phase C step 5 | running | "Estimating cost & effort" → "Estimated cost & effort" | |
| Phase C step 6 | running | "Running critique pass" → "Critique pass complete" | Names F15 directly — this is a feature, not internal. |
| Phase C step 7 | running | "Rendering diagram" → "Rendered diagram" | |
| Phase C cancel | default | "Cancel" | One word. |
| Cancel confirm | dialog | "Stop this run? Partial work won't be saved." [Keep going / Stop] | Defaults to keep-going on Esc. |
| `/b/[id]` regen link | default | "Regenerate?" | Question form invites the click; doesn't push it. |
| `/b/[id]` ZIP button | default | "ZIP" with download icon | Bare label — tech audience reads icons fast. |
| `/b/[id]` Share button | default | "Share" with link icon | |
| Diagram toolbar | default | "Fit" / "1:1" / "+" / "-" / "View source .mmd" | Mirrors any diagramming tool the user has touched. |
| Stack section header | default | "Stack" | One word. Section nav sets context. |
| Stack "why?" chip | default | "why?" (lowercase) | Lowercase = casual, low-stakes click. |
| Stack popover header | default | e.g. "Why Next.js server actions" | Mirrors the pick literally. |
| Rejected alts | collapsed | "Rejected alternatives (3)" | Count tells you it's worth opening. |
| BoM table | empty cell | "—" | Em-dash, never blank. |
| BoM "Why this one" | per-row | One sentence, lowercase, no period. e.g. "scale-to-zero, fits a $0 idle budget" | Reads like an engineer's note, not marketing. |
| Data model tabs | default | "ERD" / "DDL" | Initialisms are fine for this audience. |
| Failure mode card | default | Five labels: "Trigger" / "Blast radius" / "Detection" / "Mitigation" + Title | Locked shape from F10 spec. |
| Cost section | default | "Monthly infra" / "Build effort" / "Total to v1" | "to v1" not "MVP" — matches the language Asmit's audience uses. |
| Cost band | default | "Low $64 / Expected $180 / High $420" | Three values, not a range — easier to anchor. |
| Build plan milestone | default | "M0 — Week 1: Foundation" | Milestone code + week + theme. |
| Critique callout | collapsed | "What the critique pass caught — 4 issues, fixed before showing you" | Brags about F15 without bragging. The number is the proof. |
| Critique callout | expanded | "We caught these in the draft and rewrote them." (then list of issue + fix) | Honest; reinforces that the bundle was reviewed. |
| Empty bundle (404) | default | "This bundle isn't on this device." | True statement (V1 is localStorage). Not "Bundle not found" (lies). |
| Empty bundle subline | default | "In V1, bundles live in your browser's local storage. The person who generated it can re-share, or you can paste the spec at / to regenerate." | Explains the constraint honestly + gives both ways out. |
| Generation error (budget) | default | "We couldn't finish this one. The model burned through our token budget on your spec before completing. This usually means the spec is too broad — try narrowing to one product, one user type." | Names the cause + gives a fix. No "oops!" or "something went wrong." |
| Generation error ref | default | "Reference: gen_a1b2c3 — no charge" | Trust signal: explicit no-charge on failure. |
| ZIP toast | default | "Bundle ready" + filename + size + "Open folder" | Confirms it landed. Filename = scannable receipt. |
| Share toast | default | "Link copied" + URL + "read-only" tag + "Open" | "read-only" disclaims expectations preemptively. |
| Theme toggle | default | (icon only) | No label needed. |
| Footer | default | "v0.1 — paste-only — 60s bundles — $0–$5/run" | Status-line vibe; tells you what V1 is and isn't. |

---

## 4. Information Architecture Decisions

**Bundle layout: single long page with collapsible sections + sticky in-page pill nav.**

Why this and not tabs:
- The bundle's value is *coherence* — diagram, stack, data model, failures all reinforce each other. Tabs hide that. A long page with the diagram pinned visually at the top primes every section that follows.
- ZIP export ships everything. The on-screen experience should mirror "everything in one place."
- Sticky pill nav (not a sidebar — sidebars compete with the diagram for horizontal real estate) gives jump-to and current-section feedback.
- Sections collapse to deal with length: stack and BoM are open by default (most-asked); failures, cost, build plan are open by default; rejected alts and critique callout are collapsed by default.

**"Explain this choice" lives in a click-to-open Popover.** Not hover (loses keyboard + mobile, fires accidentally on scroll), not inline accordion (visually shreds a clean table), not sidebar drawer (overweights a small explanation). The Popover scales: same component for stack rows, BoM cells, schema fields, diagram nodes, failure cards. It nests "why not X" as expandable rows (F13).

**Diagram rendering: client-side Mermaid → SVG.** Static SVG output (not the live Mermaid widget — too heavy, plus theming is fragile). Render once on mount with `mermaid.render()`, inject SVG into the DOM, allow pan/zoom via `panzoom` lib (or hand-rolled — it's 30 lines). "View source .mmd" opens a right Sheet with the raw `.mmd` and a Copy button. If parse fails, show a placeholder card with "Diagram couldn't render — see source" and a copy button (matches the bundle contract: never ship a broken diagram inline).

**Above the fold on `/b/[id]` (1440x900):** title + meta + ZIP/Share/Regenerate actions + full diagram + first row of the sticky nav peeking. The diagram is the hero — it's the artifact founders screenshot and paste in Slack. Stack/BoM are below the fold by design; you scroll into them, you don't land on them.

**Why the in-page state machine on `/` instead of routing through `/parsing` → `/questions` → `/generating`:** a single `/` route holds state, with `?stage=questions` written to the URL once questions arrive (so back-button is safe). Routing through four pages would force four full hydrations and four loading flickers for what is one continuous flow. URL params give the back-button its semantics back without the route churn.

**Sticky nav uses scroll-spy via IntersectionObserver**, threshold 0.4. Active pill = section whose header most recently crossed the threshold. No JS frameworks needed.

---

## 5. Visual Direction

Linear/Vercel-leaning. **Dark mode first** (founders read this at night), light mode equally polished — both ship day one via `next-themes` + shadcn's `dark:` variants.

**Color tokens (shadcn HSL conventions, custom-tuned):**
- `--background`: `0 0% 4%` dark / `0 0% 100%` light. Near-black, not pure black — pure black flashes harsher on OLED scrolls.
- `--foreground`: `0 0% 96%` dark / `0 0% 9%` light.
- `--muted-foreground`: `0 0% 64%` dark / `0 0% 45%` light. Used for meta lines, "why we ask," helper text.
- `--border`: `0 0% 14%` dark / `0 0% 91%` light. Hairline, never heavy.
- `--primary`: a single saturated accent. **Indigo** at `239 84% 67%`. Used for primary buttons, active nav pill, "in progress" step icon, focus ring. Nothing else gets accent — discipline matters.
- `--destructive`: `0 72% 51%`. Used only on error cards and the cancel-confirm dialog's stop button.
- Semantic statuses inside Phase C steps: completed = `--foreground` with a checkmark, running = `--primary` with a spinner, pending = `--muted-foreground` with a dash. No greens, no yellows. Restraint reads competent.

**Typography:**
- Sans: **Inter** (variable). Default for everything.
- Mono: **JetBrains Mono** (variable). Code blocks, DDL, `.mmd` source, the wordmark "AiB", token counter.
- Type scale: `12 / 14 / 16 / 18 / 24 / 28 / 40`. 14 is the base UI size; 16 is body inside cards; 18 is subheads; 28 is page H1 on `/b/[id]`; 40 is the home hero. No more than two weights live on a page (regular 400, semibold 600).

**Spacing:** Tailwind's default 4px scale. Section vertical rhythm: 64px between major sections, 24px between rows inside a section, 12px inside a row. Card padding: 24px.

**Radius:** `--radius: 8px`. Buttons 6px, cards 8px, popovers 8px. No fully-rounded pills except the sticky nav pills (16px, deliberately distinct so they don't feel like buttons).

**Elevation:** flat. One subtle shadow exists, used only on Popover and Toast: `0 4px 12px rgba(0,0,0,0.4)` dark / `0 4px 12px rgba(0,0,0,0.08)` light. Cards use border, not shadow. Linear/Vercel rule.

**Motion:** 150ms ease-out for hover/focus, 200ms for collapsibles, 250ms for popovers. Phase B → Phase C transition is a soft cross-fade (180ms) — not a slide; slides feel slot-machine.

**Iconography:** lucide-react only. 16px in buttons, 14px in inline contexts, 20px in section headers if any.

**Tables:** zebra-free. Hairline row borders. Numeric columns right-aligned (cost). Monospaced for prices.

---

## 6. The Bet

The single design call: **lead with the artifact, not the chrome.** The home page is one textarea and one button — no nav menu, no left rail, no marketing tiles above the input, no auth wall. The bundle page opens with the rendered diagram filling the upper viewport, *not* a hero card or a "Bundle generated successfully!" banner. Technical founders and PMs don't want to be welcomed; they want to see the work. Every UI decision downstream — the click-to-open Popover instead of an "Explain" sidebar, the long-scroll bundle instead of tabs, the in-page state machine on `/` instead of three loading screens, the lowercase "why?" chip instead of an "i" icon — descends from this one bet. The product is the bundle. The UI's job is to get out of its way and make the bundle feel inevitable.

---

## 7. Flags

**For Matt (frontend feasibility):**
1. **Mermaid client-side render.** Need to confirm `mermaid` package size on the bundle route is acceptable — propose dynamic-import with `next/dynamic` + Suspense fallback (Skeleton). Same for `panzoom` on the SVG.
2. **`next-themes` + shadcn `dark:` variants** must be wired in `app/layout.tsx` before any page work — flag if you'd rather start with dark-only and add light mode in a follow-up PR.
3. **Scroll-spy via IntersectionObserver** is hand-rolled; ~40 lines. Confirm you're OK not pulling in `react-intersection-observer` as a dep.
4. **Code highlighting for the DDL tab** — propose Shiki via `bright` or `rehype-shiki`, server-rendered. Flag if you prefer no syntax highlight in V1 (acceptable tradeoff).
5. **Token counter** is a rough `chars/4` heuristic, not real tokenization. Confirm that's good enough for V1, or pull in `@anthropic-ai/tokenizer` (adds ~80KB).

**For Luke (server / streaming format):**
1. **SSE event shape for Phase A status line.** I'm assuming three discrete `status` events: `parsing`, `analyzing`, `drafting_questions`. If you stream a free-form string, I'll bind it directly; if discrete events, I'll map to the three copy strings in the deck.
2. **Question payload shape for Phase B.** I need a discriminated union per question: `{ id, type: 'radio' | 'text' | 'textarea' | 'multi-select', prompt, options?, why_we_ask }`. Confirm this is what the parser will return, or push back.
3. **Phase C step events.** I'm rendering 7 fixed steps (parse / stack / datamodel / failures / estimate / critique / diagram). Need SSE events `{ step: 'datamodel', status: 'running' | 'done' | 'failed', elapsed_ms }`. If your pipeline emits different step names, I'll align — but the seven fixed steps map directly to features 2/6/8/10/11/15/9 from the V1 list.
4. **Cancel endpoint.** I need `POST /api/generate/cancel?bundleId=...` that aborts the in-flight stream. Confirm this is in scope or I'll degrade Cancel to "navigate away, server completes silently."
5. **Error envelope.** On budget breach (per Section 7 of context doc), I want `{ status: 'error', code: 'budget_exceeded' | 'parse_failed' | 'mermaid_failed', ref: 'gen_xxxx', message: string }` so I can render the error card with a useful copy variant per `code`.

**For Jessica (URL routing for share links):**
1. **`/b/[id]` is V1 client-rendered from `localStorage`** (per context doc Section 5). Confirm we are NOT setting up a server route handler that 404s on cold devices — the page must render its own "not found on this device" state, not Next's default 404.
2. **`?stage=questions` and `?stage=generating` query params on `/`.** Need these to be shallow-routing-friendly so back/forward navigates between phases without re-mounting the whole page state. Confirm `router.replace(url, { scroll: false })` is the agreed pattern.
3. **Share link format.** Per context doc: `/b/{first 12 hex of sha256(spec)}`. I'm copying `${origin}/b/${id}` to clipboard. Confirm origin handling for Vercel preview URLs vs production (do we hardcode `aib.dev` or use `window.location.origin`? I'd default to `window.location.origin` so previews share correctly).
4. **`/docs` link in topbar.** Currently a placeholder. Either route to a stub page or remove from V1 — I default to **remove** if you don't have a docs target by Friday.

**For Asmit (founder calls I'm flagging up, not deciding):**
1. **Regenerate flow on `/b/[id]`.** "Regenerate?" link pre-fills the original spec on `/`. Should we *also* offer "regenerate with these answers tweaked" (re-enter Phase B with prior answers)? I'd ship V1 without it — single regen path keeps state simple. Flag if you disagree.
2. **No accounts in V1 means no "my bundles" list.** A user who closes the tab without copying the share link loses the bundle. The empty-bundle copy on `/b/[id]` admits this. Confirm we accept this tradeoff for V1 (it's in the context doc, but worth surfacing once at design time).
