---
name: commit-readiness-review
description: Review current Scenario Generator changes before commit/push. Use after a patch to summarize changes, identify risks, create a commit message, and list test commands.
---

# Commit Readiness Review

Use after patches and before git commit/push.

## Review checklist

1. Summarize changed files.
2. Identify whether changes match the requested scope.
3. Identify accidental broad refactors.
4. Confirm no educational depth was removed without approval.
5. Confirm no `.env` or secrets are being committed.
6. Check likely frontend build issues.
7. Check likely backend startup issues.
8. Check scenario quality implications.
9. Recommend test commands.
10. Provide a clean commit message.

## Suggested commands for the user

Use Windows PowerShell-friendly commands when possible.

Common commands:

```powershell
git status -sb
git diff --stat
git diff -- .
```

Frontend:

```powershell
cd "C:\Users\Asus\Desktop\Scenario Generator\scenario-generator-main\client"
npm start
```

Backend:

```powershell
cd "C:\Users\Asus\Desktop\Scenario Generator\scenario-generator-main\server"
npm start
```

Commit:

```powershell
cd "C:\Users\Asus\Desktop\Scenario Generator\scenario-generator-main"
git status -sb
git add .
git commit -m "Commit message here"
git push origin main
```

## Output format

Return:

1. Commit readiness verdict
2. Scope check
3. Risk check
4. Test checklist
5. Suggested commit message
6. Push commands if ready
