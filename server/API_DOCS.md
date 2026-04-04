# Scenario Generator API Documentation

## Overview
This backend provides scenario generation for educational use. The main endpoint is `/api/generate-scenario`.

---

## Endpoints

### POST `/api/generate-scenario`
- **Description:** Generates a scenario based on provided parameters.
- **Request Body:**
  - `semester` (string, required): e.g., "2", "3", "4"
  - `complexity` (string, required): "Simple", "Moderate", "Complex"
  - `environment` (string, required): e.g., "Urban", "Home", etc.
  - `shift` (string, required): "Day Shift", "Night Shift"
  - `modifiers` (array of strings, optional)
- **Response:**
  - Scenario object (see schema below)
- **Errors:**
  - 400: Missing or invalid parameters
  - 500: Internal error

---

## Scenario Data Schema

Scenario objects (as in `few-shot-scenarios.json`) follow this structure:

```
{
  "id": string,
  "title": string,
  "semester": string,
  "complexity": string,
  "environment": string,
  "shift": string,
  "modifiers": [string],
  "teachingCues": [string],
  "vitals": object
  // ...other fields
}
```

See `server/data/scenarioSchema.json` for full schema.

---

## Data Validation
- All scenario data is validated against the JSON schema in `server/data/scenarioSchema.json`.
- Run `npm run validate:scenarios` in the server directory to check data integrity.

---

## Developer Notes
- See `server/README.md` for setup instructions.
- Test backend with `npm test` (Jest).
- Data files are in `server/data/`.
