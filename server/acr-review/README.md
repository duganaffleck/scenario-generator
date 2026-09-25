# ACR Review

Students upload a practice ACR (the Practice ACR v3.3 PDF) from a lab scenario and get feedback the way their instructor would give it after the scenario: what to fix first, what to keep doing, where the chart and the scenario don't line up, one question to think about, and a rubric score.

Part of the Scenario Generator backend. A generated scenario can hand students a pre-filled ACR, and their upload finds its own scenario.

## How a review works

1. **Read the form.** The PDF's fields are read by name (`lib/extractAcr.js`). Anything that isn't the Practice ACR v3 is rejected.
2. **Practice-only guard.** A real-looking health number, a service name that isn't a practice service, a phone number, or a full address with a real postal code stops the upload before anything else happens (`lib/phiGuard.js`). The student also has to tick a box confirming it's a lab chart.
3. **Rule-based checks.** The same checker that runs inside the PDF runs here (`vendor/acrChecker.js`), including the Documentation Standards and ACR Manual rules. One source of truth.
4. **Scenario comparison.** The chart is compared with the scenario it was made for: expected treatments by procedure code, allergies, home medications, first vitals (`lib/scenarioCompare.js`). Mismatches become questions. Live runs drift, so nothing here is treated as an error.
5. **Review.** The AI gets the chart, the checker's results, the scenario and the rubric, with your instructor voice and a set of rules (`prompts/`). It returns structured feedback (`lib/feedbackSchema.js`).
6. **Check the review.** Every quote the AI uses as evidence is looked up on the chart. Anything it can't find is marked on screen and flagged for the instructor (`postProcess` in `lib/reviewAcr.js`). Limits are enforced: two strengths, three fixes, four scenario questions.
7. **Revise and resubmit.** The page sends the previous feedback with the revised chart, and the review reports what was fixed and what is still open. It only offers an example sentence after the student has revised once.

Nothing is stored. The PDF is read in memory and discarded.

## Where it lives

`server/acr-review/`, mounted in `server/index.js` at `/api/acr-review`. ES modules, like the rest of the backend, with no `package.json` of its own. **Don't add one**: a nested `package.json` without `"type": "module"` switches this folder back to CommonJS and the imports break. It uses `express`, `express-rate-limit`, `multer`, `pdf-lib` and `openai` from the backend's dependencies.

The student page is `client/src/components/acr/AcrReview.js`, reached at `/#acr-review` on the site. The "Practice ACR" button on a generated scenario calls `/acr-for-scenario`.

| Route | What it does |
|---|---|
| `GET /config` | Mode, whether a class access code is needed, and the sample scenarios |
| `POST /acr-for-scenario` | JSON `{ scenario }` (the object `/api/generate-scenario` returns). Returns the Practice ACR pre-filled with dispatch details, with the scenario sealed inside it |
| `POST /` | Multipart: `acr` (PDF), `practiceConfirm=yes`, optional `scenarioId`, `previousFeedback`, `accessCode`. Returns the review |

## How a pre-filled ACR finds its scenario

The pre-filled ACR carries the scenario in a hidden field, `Scenario Link`, encrypted with AES-256-GCM (`lib/scenarioToken.js`). Students can't read the expected treatment out of the PDF, and an edited link is rejected. When a student uploads the chart, the review opens the link and compares against that scenario. There's no database and nothing to look up. If the link can't be read, the chart is still reviewed, and the page says so.

The key is `ACR_SCENARIO_KEY` if set, otherwise derived from `OPENAI_API_KEY`, so it works on Render with no new setup. If you rotate the OpenAI key without setting `ACR_SCENARIO_KEY`, ACRs downloaded before the change are still reviewed, just without their scenario.

What gets pre-filled: service name, call number, date, pick-up location and code, DPCI priority, call received time. Nothing about the patient. The student charts that.

## Run and test it

From `server/`:

```bash
npm run test:acr                                     # end-to-end checks in mock mode
ACR_REVIEW_MODE=mock node acr-review/server.js       # standalone dev page on http://localhost:3100
```

PowerShell: `$env:ACR_REVIEW_MODE="mock"`, then `node acr-review/server.js`.

`test/fixtures/generated-scenario.json` is in the generator's current output format. The PDFs in `test/` are practice charts with invented patients.

| Variable | Default | What it does |
|---|---|---|
| `ACR_REVIEW_MODE` | `mock` | `openai` for the AI reviewer, `mock` for rule-based feedback only |
| `ACR_REVIEW_MODEL` | `OPENAI_MODEL_DETAILED`, then `gpt-5.5` | Model for reviews. Needs structured outputs (strict JSON schema) |
| `ACR_REVIEW_MAX_TOKENS` | `16000` | Completion budget. Reasoning models spend some of it thinking |
| `ACR_REVIEW_TEMPERATURE` | not sent | Only set this for models that accept a temperature |
| `ACR_REVIEW_ACCESS_CODE` | none | If set, students need this class code to get a review (not case-sensitive) |
| `ACR_REVIEW_RATE_MAX` / `ACR_REVIEW_RATE_WINDOW_MS` | `10` per 10 min | Reviews per person per window. Each AI review costs money |
| `ACR_SCENARIO_KEY` | derived | Key for sealed scenarios. Any long random string |
| `ACR_SERVICE_NAME` | `Lab Practice EMS` | Service name on pre-filled ACRs. Must be one `ACR_ALLOWED_SERVICES` accepts |
| `ACR_ALLOWED_SERVICES` | `Lab Practice EMS,Practice EMS,Lab,Simulation` | Service names the practice-only guard accepts |
| `ACR_TIMEZONE` | `America/Toronto` | For the call date on pre-filled ACRs |

If the AI call fails in `openai` mode, the student gets the rule-based review instead of an error, marked as such, and the server log says why.

## The scenario comparison

`lib/scenarioAdapter.js` is the only file that knows the generator's field names. `lib/scenarioCompare.js` stays conservative, because live runs drift from the script:

- expected treatments with a confident ACR code (ASA 504, nitro 615, salbutamol 650, epinephrine 540/541, 12-lead 313, and so on), skipping "consider", "do not" and "withhold" items
- allergies and home medications
- the first set of vitals

In `openai` mode the reviewer also reads the whole scenario, including case progression, so it can ask about subtler differences. Mismatches are always questions.

## Worth doing

- **`prompts/instructor_voice.md`**. The voice is my reading of yours. Edit it. Two or three pieces of real feedback you've written would help more than anything else.
- **`samples/target_feedback_find_the_errors.json`**. What good AI feedback on the flawed chart should look like, written by hand. Run the flawed chart in `openai` mode and compare. If the live model is vaguer, more generic, or quotes things that aren't there, tighten the prompt.

## Design rules (kept in the prompt and the code)

- Evidence has to be a quote from the chart. Unverifiable quotes are flagged.
- At most two strengths and three fixes. Patient-safety problems first.
- Scenario mismatches are questions, never accusations.
- No directive doses or thresholds from the model's memory. It asks, or flags the instructor.
- It doesn't rewrite the student's narrative. One example sentence, only after a revision.
- Formative by default. For anything graded, the instructor reviews the output.

## Limits

- I couldn't reach the OpenAI API from where this was built, so `openai` mode is written but untested against a live model. Mock mode and everything around the model call is tested.
- The checker updates when the PDF does. After rebuilding the Practice ACR, copy its document script over `vendor/acrChecker.js`.
- Scanned or handwritten ACRs aren't supported. Fillable v3 PDFs only.
