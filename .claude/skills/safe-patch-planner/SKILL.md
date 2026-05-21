---
name: safe-patch-planner
description: Plan the smallest safe Scenario Generator code patch before editing. Use before making frontend/backend changes, especially after an audit or bug report.
---

# Safe Patch Planner

Use before making changes.

## Goal

Prevent drift, over-refactoring, and accidental loss of educational depth.

## Required patch plan

Before patching, produce:

1. The exact problem being solved
2. The specific file or files to modify
3. The smallest safe change
4. What will remain unchanged
5. What educational content is protected
6. Expected behavior after the patch
7. How to test it
8. Rollback plan

## Patch boundaries

Do not include unrelated cleanup.
Do not rename files unless the task requires it.
Do not delete content unless explicitly approved.
Do not modify both frontend and backend unless the bug requires both.
Do not redesign UI while fixing a runtime error.
Do not change prompt logic while fixing a rendering issue unless the issue is a JSON-shape mismatch.

## When to refuse a broad patch

If a requested patch would touch too many files or risks losing depth, say so and split it into phases.

## Output format

Use:

- Patch name
- Why this patch matters
- Files touched
- Files not touched
- Exact change summary
- Test steps
- Risk check

Then ask for approval before coding unless the user already explicitly asked for the patch.
