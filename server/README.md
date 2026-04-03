# VitalNotes Scenario Generator Server

Build realistic, protocol-aligned simulation scenarios with instructor-grade teaching cues in minutes.

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
