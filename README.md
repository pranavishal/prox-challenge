# Vulcan OmniPro 220 — Multimodal Welder Assistant
TRY IT OUT YOURSELF - IT'S HOSTED: https://prox-challenge-three.vercel.app/

VIEW A VIDEO DEMO: https://www.youtube.com/watch?v=k7Mwph8ckFI

<img src="product.webp" alt="Vulcan OmniPro 220" width="380" />

A multimodal AI agent for the Vulcan OmniPro 220 multiprocess welder. Ask questions in natural language or upload a weld photo for visual diagnosis. The agent answers with text, interactive diagrams, calculators, and flowcharts — not just prose.



---

## Quick Start

```bash
git clone <your-fork>
cd prox-challenge
cp .env.example .env        # add your Anthropic API key
npm install
npm run dev                 # open http://localhost:3000
```

That's it. No Python, no Docker, no extra setup.

---

## What It Does

### Deep Technical Accuracy
The agent has structured knowledge of every technical spec in the manual — duty cycle matrices, polarity setups, wire sizes, gas flow rates, troubleshooting tables. When you ask a precise question, it looks up the exact answer instead of retrieving text chunks and guessing.

**Questions it handles well:**
- "What's the duty cycle for MIG welding at 200A on 240V?" → exact numbers, interactive calculator
- "How do I set up polarity for TIG welding?" → wiring diagram showing which socket each cable uses
- "I'm getting porosity in my flux-cored welds" → structured troubleshooting with all causes and fixes
- "What process should I use for 1/8 inch aluminum?" → process comparison with recommendations

### Multimodal Responses
The agent generates **interactive artifacts** — not just text. When an answer involves visual information, it produces a live React component that renders in a side panel:

- **Wiring diagrams** — SVG showing the front panel with cables color-coded by socket
- **Duty cycle calculators** — interactive gauge showing weld/rest times at any amperage
- **Troubleshooting cards** — structured cause/solution layout for any defect
- **Process comparison tables** — side-by-side process selection with recommendations

### Weld Photo Diagnosis
Upload a photo of a bad weld and the agent cross-references the manual's weld diagnosis guide to identify the problem and recommend fixes.

### Manual Page Images
When a question involves something visual — polarity cable setup, front panel controls, weld defect examples — the agent retrieves the actual manual page image and displays it inline. 51 pages were extracted from the PDFs; 21 key pages are keyword-indexed for retrieval.

---

## Architecture

```
prox-challenge/
├── data/                        # Pre-extracted knowledge base (committed to repo)
│   ├── duty-cycle.json          # Exact duty cycle tables for all processes/voltages
│   ├── polarity.json            # Cable setup instructions per process
│   ├── settings.json            # Process selection, wire tension, gas flow rates
│   ├── troubleshooting.json     # Graph-structured: problems → causes → solutions
│   ├── specs.json               # Machine specifications by category
│   └── manual-images.json       # Image catalog: keywords → manual page PNGs
├── src/
│   ├── agent/
│   │   ├── tools/               # One file per tool — add new tools here
│   │   │   ├── duty-cycle.ts    # Lookup duty cycle at any amperage/voltage
│   │   │   ├── polarity.ts      # Cable setup for MIG/Flux-Cored/TIG/Stick
│   │   │   ├── settings.ts      # Process recommendation scored by material/thickness
│   │   │   ├── troubleshooting.ts # Symptom → causes → solutions traversal
│   │   │   ├── specs.ts         # Machine specs by category
│   │   │   ├── manual-images.ts # Keyword-scored image retrieval
│   │   │   └── index.ts         # Central tool registry
│   │   ├── system-prompt.ts     # Agent persona and artifact trigger rules
│   │   └── stream-parser.ts     # Extracts artifact XML from Claude's streaming output
│   ├── app/
│   │   ├── api/chat/route.ts    # Streaming API with agentic tool-use loop
│   │   └── page.tsx
│   └── components/
│       ├── chat/                # Message rendering, input bar, chat interface
│       └── artifacts/           # Sandboxed iframe renderer
└── public/
    ├── artifact-runtime.html    # Pre-bundled React + Tailwind + Recharts runtime
    └── manual-images/           # 51 PNG pages extracted from the manual PDFs
```

---

## The Six Tools

| Tool | When Claude calls it | Backed by |
|------|----------------------|-----------|
| `lookup_duty_cycle` | "how long can I weld", duty cycle questions | `data/duty-cycle.json` |
| `lookup_polarity` | cable setup, which socket, polarity | `data/polarity.json` |
| `recommend_settings` | process selection, material/thickness settings | `data/settings.json` |
| `get_troubleshooting` | any problem symptom ("porosity", "spatter", "arc cuts out") | `data/troubleshooting.json` |
| `lookup_specs` | max amperage, wire sizes, power requirements | `data/specs.json` |
| `get_manual_images` | any visual question — surfaced alongside text answers | `data/manual-images.json` |

---

## Key Design Decisions

**Structured JSON over RAG**

For a 48-page manual with precise technical tables, structured JSON lookups are more reliable than vector search. The duty cycle at 200A 240V MIG is a fact, not a retrieval problem. Tools return exact data; Claude decides how to present it.

**Tool Use as the Agent Core**

Claude calls six tools backed by structured data. This is a genuine agentic architecture: Claude reasons about which tools to call, calls them in sequence if needed, and uses the results to generate a grounded response. Specs can't be hallucinated — if the tool doesn't have it, Claude says so.

**Troubleshooting as a Knowledge Graph**

Troubleshooting data is modeled as nodes (problems) → edges (causes) → solutions, mirroring a knowledge graph structure. A "porosity" question traverses to all connected causes and their specific fixes. The structure mirrors how Prox models product knowledge and is designed to be extended without touching agent code.

**Artifact Protocol**

Claude generates interactive artifacts using XML tags embedded in its streaming output:
```
<artifact type="react" title="Duty Cycle Calculator">
export default function DutyCycleCalc() { ... }
</artifact>
```
The `StreamParser` class detects these tags and extracts the code while text continues streaming. The artifact renders in a sandboxed iframe with React, Tailwind, and Recharts pre-loaded — Babel transpiles JSX at runtime. Text and artifact stream simultaneously to their respective panels.

**No Runtime Dependencies Beyond Node**

All knowledge was extracted from the PDFs during development and committed to `data/`. No Python scripts, no Docker, no vector database. `npm install && npm run dev` is the entire setup. For a multi-product system, this data layer would be replaced by a structured extraction pipeline feeding the same tool interfaces — the agent layer is product-agnostic.

---

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **@anthropic-ai/sdk** — Claude Sonnet 4.6 with streaming and tool use
- **Tailwind CSS + shadcn/ui**
- **React 19 + Recharts** (in artifact iframe)
- **Babel standalone** (in artifact iframe — JSX transpilation at runtime)

---

## Extending the Agent

**Add a new tool:**
1. Create `src/agent/tools/my-tool.ts` with a handler function and Anthropic tool definition
2. Add source data to `data/my-data.json`
3. Export from `src/agent/tools/index.ts`
4. Add the handler to `toolHandlers` in `src/app/api/chat/route.ts`

**Update knowledge:**
Edit the JSON files in `data/` — no agent code changes needed.

**Change agent behavior:**
Edit `src/agent/system-prompt.ts` — controls persona, when to generate artifacts, tone.
