---
name: scenario-quality-review
description: Review a generated Scenario Generator output for Ontario PCP realism, clinical coherence, semester appropriateness, progression, teaching value, and GRS quality.
---

# Scenario Quality Review

Use this skill when the user provides a generated scenario and asks whether it is good, safe, realistic, or aligned with the project goals.

## Review categories

Assess:

1. Realism as a paramedic call
2. Ontario PCP scope/protocol alignment
3. Semester appropriateness
4. Clinical accuracy
5. Scene and patient presentation quality
6. OPQRST quality
7. SAMPLE quality
8. Physical assessment specificity
9. Vital sign realism and progression
10. ECG/rhythm appropriateness
11. Case progression
12. Appropriate vs delayed vs incorrect care pathways
13. Expected management
14. Reassessment moments
15. Clinical reasoning and differential diagnosis
16. Teaching Points usefulness
17. GRS specificity and scoring quality
18. Self-reflection question usefulness
19. Instructor usability
20. Student-facing learning flow

## Rating structure

Give:

- Overall verdict
- What is working
- What is weak
- What may be unsafe or protocol-questionable
- What should be changed first
- Whether this is usable now, usable with edits, or needs regeneration

## GRS review standard

GRS anchors must be scenario-specific.

Domains usually include:

1. Scene Management / Situational Awareness
2. Patient Assessment
3. History Gathering
4. Clinical Decision-Making
5. Procedural Skill / Treatment
6. Resource Utilization
7. Communication

Each domain should use anchors at 1, 3, 5, and 7.

Score 1 must represent genuinely unsafe or dangerous performance. Score 5 should represent competent expected semester-level performance.

Flag vague anchors such as “performs excellent assessment.” Replace with concrete scenario-specific behaviours.

## Output format

Use:

1. Verdict
2. Major strengths
3. Major weaknesses
4. Clinical/protocol concerns
5. GRS concerns
6. Specific recommended fixes
7. Best test prompt to regenerate or compare

Do not rewrite the whole scenario unless the user asks.
