# VitalNotes Scenario Generator Server

Build realistic, protocol-aligned Ontario PCP simulation scenarios.

## Documentation

- See [API_DOCS.md](API_DOCS.md) for API and data schema documentation.
- Scenario data schema: [data/scenarioSchema.json](data/scenarioSchema.json)

## Optional switches

- `TEACHING_CUES=on`: turns inline teaching cues back on. They are parked by default: the cue
  instructions live in `data/teaching-cues.txt` and are only added to the prompt when this is set,
  and any cue the model writes anyway is stripped. The site currently hides cues on screen and in the
  PDF, so decide how they should be shown before switching this on.

## Runtime Safety Note

The few-shot audit tooling is optional and does not run during normal scenario generation.

- Normal backend runtime uses only `npm start`.
- Audit commands are manual/CI-only quality checks.
- No audit script is imported by runtime route handling.

## Audit Commands

From the `server` folder:

- `npm run audit:few-shots`  
  Generates a coverage/skew report without failing by default.

- `npm run audit:few-shots:strict`  
  Fails if matrix cells are missing, high-priority deficits exist, or call-type skew is above threshold.

- `npm run audit:few-shots:ci`  
  Same as strict mode, plus fails on metadata coverage gaps.

## Start Server

- `npm start`
