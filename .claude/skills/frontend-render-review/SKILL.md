---
name: frontend-render-review
description: Review Scenario Generator frontend rendering, especially ScenarioForm.js, generated output sections, Teaching Points, Night Shift mode, collapsibles, PDF export, ECG modal support, and JSON fallbacks.
---

# Frontend Render Review

Use this when reviewing `ScenarioForm.js`, frontend rendering bugs, blank sections, Teaching Points, Night Shift mode, collapsibles, PDF export, or ECG/rhythm display.

## First principle

Preserve existing working behavior. Do not refactor broadly unless asked.

## Check these areas

1. Confirm the active component path before patching.
2. Confirm imports from `App.js`, routes, or parent components.
3. Check whether duplicate `ScenarioForm.js` files exist.
4. Check generated scenario state shape.
5. Check field rendering helpers.
6. Check fallback handling for missing fields.
7. Check collapsible section behavior.
8. Check Teaching Points rendering.
9. Check Night Shift mode state, classes, and style coverage.
10. Check ECG modal/image rendering and label matching.
11. Check PDF export includes all protected sections.
12. Check whether hidden sections are accidentally excluded.
13. Check whether strings/arrays/objects are rendered safely.
14. Check for undefined variables like `hasContent`.
15. Check for ESLint/build risks.

## Teaching Points rule

Teaching Points must be visible and protected. They should not be collapsed into Expected Management or Instructor Overview unless the user explicitly approves.

## Night Shift rule

Night Shift mode should affect the generated output, cards, controls, GRS, ECG/rhythm, and teaching sections. It should not be purely cosmetic.

## ECG/rhythm rule

Do not separate ECG/rhythm into a new card unless asked. For now, identify the current rendering and compatibility risks.

## Output format

Return:

1. Active frontend file confirmed
2. Rendering issue found
3. Cause in plain language
4. Smallest safe fix
5. Exact file and function/section to modify
6. Test steps
7. Risks to avoid

If asked for code, provide copy/paste-ready code with no placeholders.
