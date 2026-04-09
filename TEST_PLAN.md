# Vulcan OmniPro 220 Agent Test Plan

This document is a practical, high-signal QA checklist to validate the submission against the Prox challenge rubric.

---

## 1) Test Goals

You should be able to prove:

- Technical answers are accurate and grounded in manual data.
- The agent is truly multimodal (artifacts + manual images), not text-only.
- It handles ambiguous and follow-up questions well.
- Weld-photo inputs produce useful diagnosis behavior.
- Setup and run experience is frictionless for reviewers.

---

## 2) Pre-Flight (2-minute setup standard)

Run from a fresh clone:

```bash
git clone <your-fork>
cd prox-challenge
cp .env.example .env
# add ANTHROPIC_API_KEY to .env
npm install
npm run dev
```

Pass criteria:

- App boots without manual fixes.
- Chat UI appears at `http://localhost:3000`.
- First message returns a response in under 10 seconds on typical internet.

Nice-to-have:

- `npm run build` succeeds.
- `npm run lint` is clean (or known warnings only).

---

## 3) Core Functional Smoke Tests

1. Send a text-only question.
2. Send a question expected to call multiple tools.
3. Upload an image with and without text prompt.
4. Trigger an artifact (duty cycle/polarity).
5. Trigger manual image retrieval.
6. Ask a follow-up ("what about TIG?") and confirm it updates correctly.

Pass criteria:

- No crashes, no blank assistant bubbles, no stuck "thinking".
- Tool indicators appear and clear.
- Artifact panel updates to latest answer.

---

## 4) Accuracy Test Suite (High Priority)

Use these prompts exactly and verify the key fields.

### A) Duty Cycle

1. "What's the duty cycle for MIG welding at 200A on 240V?"
   - Expect rated 25% at 200A, ~2.5 min weld / 7.5 min rest.
2. "How long can I weld TIG at 175A on 240V?"
   - Expect 30%, ~3 min weld / 7 min rest.
3. "What about Stick on 120V at 60A?"
   - Expect continuous threshold behavior (100% at or below continuous point).
4. "Can I run MIG at 260A on 240V?"
   - Expect out-of-range warning, not fabricated values.

### B) Polarity + Cable Setup

1. "How do I set polarity for MIG?"
   - Expect MIG DCEP, ground negative, wire feed positive.
2. "What about Flux-Cored?"
   - Expect DCEN opposite wiring from MIG.
3. "TIG socket setup with foot pedal?"
   - Expect TIG torch negative, ground positive, gas + optional foot pedal notes.
4. "Stick setup?"
   - Expect DCEP-style setup for this machine.

### C) Settings / Process Selection

1. "What process for 1/8 inch mild steel outdoors with no gas?"
   - Expect Flux-Cored or Stick near top with rationale.
2. "Best process for thin stainless indoors?"
   - Expect MIG/TIG discussion with tradeoffs.
3. "I am a beginner and have C25 gas, what should I start with?"
   - Expect MIG preference with practical setup guidance.

### D) Troubleshooting

1. "I'm getting porosity in flux-cored welds."
2. "Wire feeds but arc does not ignite."
3. "Arc is unstable and sputtering."
4. "Bird's nest in the gun."

Pass criteria:

- Returns multiple plausible causes and actionable fixes.
- No obvious missing-node behavior (empty or partial cause lists for common problems).

---

## 5) Multimodal Quality Tests (Most Important)

For each prompt below, verify BOTH content and presentation:

1. "Show me TIG polarity setup."
   - Must render a diagram artifact (not prose only).
2. "Duty cycle at MIG 200A 240V."
   - Must render visual artifact (calculator/timer/chart/table).
3. "Compare MIG vs Flux-Cored for a beginner."
   - Must render comparison visually (table/card/chart).
4. "I'm getting porosity."
   - Must render troubleshooting visual structure (cards/flow style).
5. "Where is the wiring schematic?"
   - Must surface manual page image(s), ideally with short explanation.

Pass criteria:

- Artifact appears in right panel and is readable.
- Manual images appear inline when relevant.
- Visual format reduces cognitive load vs plain text.

---

## 6) Weld Photo Input Tests

Use at least 4 image cases:

- Good weld photo.
- Porosity-like defect photo.
- Blurry/low-light photo.
- Non-weld image (negative test).

Prompts:

1. Upload image only.
2. Upload image + "What defect is this?"
3. Upload image + "How do I fix this on flux-cored?"

Pass criteria:

- Agent references visible cues from the image (not generic boilerplate).
- For low confidence, agent asks clarifying question instead of overclaiming.
- Provides next-step checks tied to process/settings.

---

## 7) Follow-Up and Memory Tests

Run this conversation chain:

1. "Set me up for MIG on 120V."
2. "What if I switch to flux-cored?"
3. "Now I am getting spatter."
4. "Show me the manual image for that."
5. "Summarize exactly what cables go where."

Pass criteria:

- Correctly tracks context across turns.
- Updates polarity/process details after process changes.
- Provides new artifact for follow-ups when needed.

---

## 8) Safety and Hallucination Guardrails

Prompts:

1. "Can I use an extension cord?"
   - Expect firm no.
2. "Give me settings for a process not supported by this welder."
   - Expect explicit out-of-scope.
3. "What's the duty cycle at an impossible amperage?"
   - Expect range warning.
4. "Tell me wiring for a different welder model."
   - Expect scope boundary handling.

Pass criteria:

- No fabricated machine capabilities.
- Safety-critical guidance is explicit and practical.

---

## 9) UX/Polish Checklist

- Loading states are clear.
- Tool-call badges are understandable.
- Artifact panel does not get stuck on stale content.
- Manual image thumbnails open correctly.
- Mobile view remains usable (chat still functional).

---

## 10) Performance and Reliability

Run 20-30 mixed prompts in one session.

Track:

- Average first-token latency.
- Number of failed responses.
- Number of malformed artifacts.
- Number of times manual image retrieval is irrelevant.

Pass target:

- <5% failed interactions.
- No repeated runtime errors.

---

## 11) Reviewer Demo Script (10 minutes)

Use this exact flow in your walkthrough:

1. Quick setup from clone (show simple run steps).
2. Hard factual query (duty cycle).
3. Polarity diagram request (artifact).
4. Troubleshooting query (structured causes/fixes).
5. Manual visual retrieval (schematic/defect page).
6. Image upload diagnosis.
7. Follow-up that changes process and verifies updated answer.

This sequence proves depth, multimodality, and product UX quickly.

---

## 12) Scoring Rubric (Self-Grade)

Score each 1-5, then total / 30:

- Technical accuracy
- Multimodal response quality
- Troubleshooting depth
- Follow-up/context handling
- UX polish
- Setup reliability

Interpretation:

- 27-30: Submission is very strong.
- 23-26: Competitive, fix a few gaps.
- 19-22: Good core, but risky under evaluator stress tests.
- <19: Major gaps before submitting.

---

## 13) Final Submit Gate

Before sending fork URL, verify:

- README run steps work exactly as written.
- Claims in README match what app actually does.
- Key challenge prompts all pass.
- No known severe data integrity issues.
- You can demo end-to-end without debugging live.

If all true, submit confidently.

