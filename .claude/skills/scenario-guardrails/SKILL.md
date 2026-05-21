---
name: scenario-guardrails
description: Load the core Scenario Generator 1.0 project guardrails. Use before planning, reviewing, patching, or making architecture decisions for the Ontario paramedic scenario generator.
---

# Scenario Generator Guardrails

You are working on Scenario Generator 1.0, a React + Express app for Ontario Primary Care Paramedic simulation scenario generation.

## Non-negotiables

- Do not drift into a new product.
- Do not redesign broadly unless explicitly asked.
- Do not invent files, directives, standards, schemas, or app behavior.
- Do not remove working features casually.
- Do not simplify educational depth unless the user explicitly approves that exact reduction.
- Work step by step.
- Ask only for the current necessary file or output.
- Prefer small, safe, testable changes.

## Preserve educational depth

Protect:

- call information
- patient demographics
- patient presentation
- incident history
- OPQRST
- SAMPLE
- physical assessment
- vital signs
- ECG/rhythm findings
- case progression
- expected management
- clinical reasoning
- pathophysiology
- differential diagnosis
- teaching points
- Ontario directive/protocol logic
- self-reflective questions
- GRS anchors
- instructor/student learning supports

Improve organization and usability without flattening the learning value.

## Product identity

The app should generate realistic Ontario PCP paramedic calls, not generic medical case studies.

The generated scenarios should support:

- scenario-based learning
- OSCE preparation
- clinical reasoning
- communication
- reassessment
- decision-making under pressure
- PCP-scope treatment decisions
- Global Rating Scale feedback
- instructor-led or self-directed learning

## Student-facing default

The app should remain student-facing by default. It should carry the instructor voice when an instructor is not physically present.

The long-term guided flow is:

1. Run the Call
2. Pause & Decide Before Reading On
3. Case Learning Map
4. Compare Your Plan
5. Learn the Lesson
6. Evaluate Your Thinking

Do not implement this flow unless asked. Use it as the planning direction.

## Ontario standards caution

Align with Ontario BLS PCS, ALS PCS, PCP directives, oxygen standards, and safe PCP scope where relevant.

Do not hallucinate protocol details. If exact wording or thresholds are needed and not provided in the repo or prompt, ask for the relevant source.

## Semester expectations

Semester 2:
- BLS care, assessment, scene management, communication, safe transport decisions
- Do not expect ALS symptom relief medication decisions

Semester 3:
- PCP medication decisions when clinically appropriate
- stronger assessment and directive awareness
- ECG interpretation when clinically relevant and appropriate

Semester 4:
- integrated reasoning, reassessment, transport planning, nuanced treatment decisions
- challenge premature closure and prioritization

GRS score 5 means competent expected performance for that semester level.

## Tone

Use practical paramedic instructor language. Avoid generic textbook language, vague teaching language, motivational fluff, poetic metaphors, and generic “monitor and transport” conclusions.
