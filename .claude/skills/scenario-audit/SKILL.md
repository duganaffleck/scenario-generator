---
name: scenario-audit
description: Audit the Scenario Generator repo before coding. Use when starting work, after a reset, or when checking active files, duplicate files, stale files, broken imports, or project structure.
---

# Scenario Generator Audit

Audit only unless the user explicitly asks for patches.

## Purpose

Confirm what the app is actually using before modifying anything.

## Audit checklist

1. Identify the active frontend entry path.
2. Confirm which ScenarioForm component is imported and rendered.
3. Check whether duplicate or stale files exist, especially:
   - `client/src/components/forms/ScenarioForm.js`
   - `client/src/components/ScenarioForm.js`
4. Identify the backend route that generates scenarios.
5. Identify where prompts are built.
6. Identify where JSON is parsed, repaired, and normalized.
7. Identify which few-shot files are actually imported.
8. Identify which instructor/profile/schema/directive files are actually imported.
9. Check for undefined variables such as `hasContent`.
10. Check whether Teaching Points exist in backend output and whether the frontend renders them.
11. Check whether Night Shift mode exists and what UI it actually changes.
12. Check whether ECG/rhythm fields depend on a whitelist or image map.
13. Check whether frontend and backend JSON shapes agree.
14. Check for obvious build risks without applying broad fixes.

## Output format

Return:

1. Active files confirmed
2. Possibly stale/duplicate files
3. Backend generation path
4. Frontend rendering path
5. Missing or broken educational content
6. Runtime/build risks
7. Recommended first safe patch
8. Files that would be touched
9. Files not to touch yet

## Rules

- Do not patch during audit.
- Do not rename files during audit.
- Do not delete stale files during audit.
- Do not assume a file is active based on filename alone.
- Confirm imports first.
