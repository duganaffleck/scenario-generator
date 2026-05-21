---
name: backend-generation-review
description: Review Scenario Generator backend generation logic, prompt construction, JSON repair, normalization, few-shot usage, semester/type modifiers, ECG labels, and frontend compatibility.
---

# Backend Generation Review

Use this when reviewing `server/routes/generateScenario.js`, prompt files, schema files, directive rules, few-shot examples, or backend generation errors.

## First principle

The backend must produce clinically coherent, complete, frontend-compatible JSON without flattening scenario depth.

## Check these areas

1. Imports and active files
2. Route setup and request body parsing
3. Prompt construction
4. Instructor profile loading
5. Few-shot loading and whether examples are actually used
6. Scenario schema loading
7. Ontario directive hooks/rules loading
8. Semester/type/environment/complexity/focus modifier handling
9. JSON completion requirements
10. JSON parsing and repair
11. Normalization of missing fields
12. Required field preservation
13. OPQRST and SAMPLE shape
14. Physical assessment shape
15. Vital sign shape
16. ECG/rhythm field compatibility
17. Teaching Points generation and naming
18. GRS generation and anchor shape
19. Frontend compatibility with `ScenarioForm.js`
20. API parameter compatibility with current model
21. Error messages and fallback behavior

## Common risks

- Duplicate helper declarations
- Undefined variables
- Backend returns a field that frontend never renders
- Frontend expects arrays while backend returns objects
- Backend expects schema names that no longer match frontend labels
- ECG label does not match image map
- Prompt asks for incomplete JSON or too much output
- Medication/protocol logic drifts outside Ontario PCP scope
- Semester 2 receives ALS-level expectations

## Output format

Return:

1. What file/function is being reviewed
2. What the backend currently appears to do
3. Compatibility risks
4. Clinical/scenario quality risks
5. Smallest safe fix
6. Files to modify
7. Files not to modify
8. Test steps after patch

Do not make broad rewrites unless explicitly requested.
