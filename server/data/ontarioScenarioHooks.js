// server/data/ontarioScenarioHooks.js

export const ONTARIO_SCENARIO_HOOKS = {
  oxygenTherapy: {
    commonTeachingErrors: [
      "Using blanket high-flow oxygen wording instead of titrated oxygen language.",
      "Failing to distinguish general oxygen targets from the COPD exception context.",
      "Treating oxygen as decoration rather than a monitored intervention."
    ],
    protocolNoteHooks: [
      "Tie oxygen wording to Ontario target saturation language when relevant.",
      "If SpO2 cannot be reliably interpreted, justify high-concentration oxygen with critical findings or qualifying exposure."
    ],
    grsHooks: {
      assessment: [
        "Recognizes hypoxia or oxygenation concerns early.",
        "Uses titrated oxygen rather than reflexive high-flow language when appropriate.",
        "Reassesses saturation response after intervention."
      ],
      decisionMaking: [
        "Chooses oxygen strategy appropriate to the patient context.",
        "Does not over-treat or under-treat oxygenation problems.",
        "Explains oxygen decisions clearly."
      ]
    }
  },

  cardiacIschemia: {
    patientQuotes: [
      "It feels like pressure, not really pain.",
      "I thought it was just indigestion.",
      "It goes into my jaw a bit.",
      "I just feel off and sweaty."
    ],
    bystanderQuotes: [
      "He says it's not that bad, but he looks terrible.",
      "She's had chest discomfort since dinner and now she's pale.",
      "He took one of his own nitro earlier."
    ],
    sceneContexts: [
      "private residence after exertion",
      "restaurant after a meal",
      "public setting with delayed 12-lead access",
      "workplace with subtle but escalating symptoms"
    ],
    physicalFindings: [
      "pale and diaphoretic",
      "mild tachycardia",
      "guarded posture",
      "subtle dyspnea",
      "anxious but alert"
    ],
    progressionPatterns: {
      withProperTreatment: [
        "Symptoms remain concerning but become more stable with monitoring and appropriate treatment.",
        "The patient tolerates packaging and transport with repeat reassessment.",
        "12-lead strategy and transport priority stay central."
      ],
      withoutProperTreatment: [
        "Pain or pressure worsens, diaphoresis increases, and perfusion may decline.",
        "The patient becomes less stable during movement or transport.",
        "Missed ECG or inappropriate nitro logic increases risk."
      ]
    },
    commonTeachingErrors: [
      "Treating any chest pain as automatic nitro candidate.",
      "Skipping the 12-lead thought process.",
      "Failing to appreciate atypical ischemia presentations.",
      "Ignoring right-sided lead implications in inferior STEMI logic.",
      "Writing generic transport plans that do not reflect changing ischemia risk or reassessment findings."
    ],
    grsHooks: {
      assessment: [
        "Recognizes ischemic red flags even when symptoms are subtle or atypical.",
        "Obtains serial vitals and ECG-oriented reassessment that meaningfully affect care.",
        "Tracks perfusion, diaphoresis, dyspnea, and symptom radiation rather than documenting chest pain in isolation."
      ],
      decisionMaking: [
        "Uses a 12-lead-first ischemia workflow and explains when nitro should be withheld.",
        "Adjusts transport priority based on evolving ischemia risk, not just initial pain severity.",
        "Synthesizes ECG, hemodynamics, and symptom trend into a defensible treatment plan."
      ]
    }
  },

  bronchoconstriction: {
    patientQuotes: [
      "I can't catch my breath.",
      "My puffer isn't doing much.",
      "My chest feels really tight.",
      "I can only say a few words."
    ],
    bystanderQuotes: [
      "He's used his inhaler a bunch already.",
      "She gets asthma attacks, but this one is worse.",
      "He has COPD and has been getting worse all day."
    ],
    sceneContexts: [
      "home with inhalers on the table",
      "workplace exposure setting",
      "outdoor cold-weather trigger",
      "public venue with delayed history gathering"
    ],
    physicalFindings: [
      "increased work of breathing",
      "accessory muscle use",
      "tripod positioning",
      "audible wheeze or poor air entry",
      "limited speech"
    ],
    progressionPatterns: {
      withProperTreatment: [
        "Work of breathing decreases gradually with appropriate therapy and reassessment.",
        "Speech improves before the patient looks fully comfortable.",
        "The patient may still require urgent transport despite partial improvement."
      ],
      withoutProperTreatment: [
        "Fatigue, poor air entry, and worsening respiratory distress develop.",
        "The patient may become less communicative and more exhausted.",
        "Ventilatory failure risk becomes more prominent."
      ]
    },
    commonTeachingErrors: [
      "Using CPAP language too broadly for asthma.",
      "Centering dexamethasone as the immediate rescue intervention.",
      "Failing to distinguish asthma from COPD in the treatment plan.",
      "Underestimating fatigue and worsening air entry.",
      "Using flat progression branches that do not show respiratory response or decline over time."
    ],
    grsHooks: {
      assessment: [
        "Recognizes worsening work of breathing, fatigue, and reduced air entry early.",
        "Differentiates severity using speech, posture, accessory muscle use, and breath sounds.",
        "Uses serial reassessment to show whether bronchodilator therapy is working or failing."
      ],
      decisionMaking: [
        "Chooses bronchodilator, oxygen, and ventilatory support strategy that matches the likely pathology.",
        "Avoids inappropriate CPAP or delayed escalation when respiratory fatigue is emerging.",
        "Builds transport urgency around response to treatment and exhaustion risk."
      ]
    }
  },

  traumaPatterns: {
    patientQuotes: [
      "I don't want to move it.",
      "It hurts more when I try to stand.",
      "I hit my head, but I didn't pass out.",
      "My leg feels numb now."
    ],
    bystanderQuotes: [
      "He fell from the second rung of the ladder.",
      "She was wearing a helmet, but she landed hard.",
      "He got pinned for a few seconds before we moved the object."
    ],
    sceneContexts: [
      "residential fall with tight stair access",
      "workplace blunt-force mechanism with noisy bystander scene",
      "roadside collision with weather and visibility limitations",
      "sports field with delayed collateral history"
    ],
    physicalFindings: [
      "localized tenderness with guarded movement",
      "visible deformity or swelling",
      "possible distracting injuries",
      "neurovascular concern distal to injury",
      "pain-limited exam findings"
    ],
    progressionPatterns: {
      withProperTreatment: [
        "Pain remains significant but movement-related worsening is reduced with appropriate stabilization and handling.",
        "Serial reassessment clarifies whether neurovascular findings are stable or changing.",
        "Transport plan reflects mechanism risk and evolving exam findings."
      ],
      withoutProperTreatment: [
        "Unnecessary movement increases pain, anxiety, and risk of secondary worsening.",
        "Missed reassessment can delay recognition of neurovascular decline.",
        "Transport and handoff become vague when mechanism and trend data are not synthesized."
      ]
    },
    commonTeachingErrors: [
      "Fixating on pain score while under-weighting mechanism and trend findings.",
      "Using generic immobilization language without tying it to exam findings.",
      "Missing repeated distal neurovascular reassessment after movement or splinting.",
      "Writing transport plans that ignore access, extraction, or scene constraints."
    ],
    protocolNoteHooks: [
      "Tie movement minimization and stabilization choices to mechanism and exam findings.",
      "Document pre- and post-intervention neurovascular status when relevant."
    ],
    grsHooks: {
      assessment: [
        "Links mechanism, anatomy, and serial neurovascular findings instead of documenting pain alone.",
        "Detects red flags that would change packaging, transport priority, or spinal precautions.",
        "Reassesses after movement or splinting to identify improvement or deterioration."
      ],
      decisionMaking: [
        "Chooses stabilization and movement strategy that reflects mechanism, access limits, and evolving exam findings.",
        "Avoids generic immobilization language by naming what is being protected and why.",
        "Uses scene constraints and reassessment trend to justify transport planning."
      ]
    }
  },

  environmentalExposure: {
    patientQuotes: [
      "I was in the heat all day and then got dizzy.",
      "We were using a heater in the garage.",
      "I can't get warm even with blankets.",
      "My headache started after being near the generator."
    ],
    bystanderQuotes: [
      "A few people in the room felt sick at the same time.",
      "He was outside in the cold for a long time before we found him.",
      "She seemed fine earlier, then suddenly got confused."
    ],
    sceneContexts: [
      "enclosed space with possible combustion source",
      "outdoor prolonged exposure with limited shelter",
      "multi-patient scene with shared environmental trigger",
      "remote setting with delayed definitive care"
    ],
    physicalFindings: [
      "headache and nausea with nonspecific malaise",
      "confusion or slowed responses",
      "temperature-related skin signs",
      "fatigue with exertional intolerance",
      "vital sign pattern suggesting systemic stress"
    ],
    progressionPatterns: {
      withProperTreatment: [
        "Clinical trend stabilizes with source control, supportive care, and focused reassessment.",
        "Symptom trajectory and environment history remain central to transport urgency.",
        "Handoff clearly links scene exposure clues to observed response."
      ],
      withoutProperTreatment: [
        "Failure to identify the exposure context leads to delayed targeted management.",
        "Symptoms may broaden from nonspecific complaints to worsening mental status or perfusion concerns.",
        "Incomplete scene-risk communication undermines receiving-team anticipation."
      ]
    },
    commonTeachingErrors: [
      "Treating environmental complaints as isolated symptoms without scene synthesis.",
      "Underemphasizing source control and responder safety actions.",
      "Using vague exposure language instead of naming likely mechanism and timeline.",
      "Neglecting multi-patient or shared-exposure implications when present."
    ],
    protocolNoteHooks: [
      "Tie oxygen and supportive care choices to suspected exposure mechanism and objective findings.",
      "Include scene-source control and risk communication actions when relevant."
    ],
    grsHooks: {
      assessment: [
        "Identifies the likely exposure source, timeline, and shared-scene clues early.",
        "Recognizes when nonspecific symptoms still imply a hazardous environmental process.",
        "Uses repeated mental status, perfusion, and respiratory reassessment to track exposure impact."
      ],
      decisionMaking: [
        "Prioritizes responder safety and source control alongside patient care.",
        "Explains transport urgency using exposure risk, scene persistence, and symptom trend.",
        "Communicates environmental risk clearly to receiving staff and partner agencies."
      ]
    }
  },

  analgesia: {
    commonTeachingErrors: [
      "Skipping oral first-line options when tolerated.",
      "Using pain medication language without enough clinical support.",
      "Missing NSAID consideration in suspected renal colic.",
      "Combining ketorolac and ibuprofen."
    ],
    protocolNoteHooks: [
      "Reflect oral first-line analgesia where the patient can tolerate PO and the case supports it.",
      "If renal colic is suspected, include NSAID consideration where appropriate."
    ]
  },

  nauseaVomiting: {
    commonTeachingErrors: [
      "Treating every nauseated patient automatically.",
      "Ignoring dimenhydrinate-to-ondansetron sequencing logic.",
      "Pairing dimenhydrinate with diphenhydramine.",
      "Ignoring sedation/confusion concerns in older adults.",
      "Providing vague handoff language instead of naming reassessment trends and transport-risk changes."
    ],
    protocolNoteHooks: [
      "If medication is used, ensure the scenario supports it and sequencing is coherent.",
      "Avoid casual antiemetic stacking."
    ]
  }
};

// ---------------------------------------------------------------------------
// Hook selection helpers
// ---------------------------------------------------------------------------

function getRelevantHookKeys(callType) {
  const normalized = String(callType || '').trim().toLowerCase();
  const keys = ['oxygenTherapy']; // always relevant regardless of call type

  if (normalized === 'cardiac') {
    keys.push('cardiacIschemia');
  } else if (normalized === 'respiratory') {
    keys.push('bronchoconstriction');
  } else if (normalized === 'trauma') {
    keys.push('traumaPatterns', 'analgesia', 'nauseaVomiting');
  } else if (normalized === 'environmental') {
    keys.push('environmentalExposure', 'nauseaVomiting');
  } else {
    // Medical calls benefit from symptom-control hooks by default
    keys.push('analgesia', 'nauseaVomiting');
  }

  return keys;
}

function stableHash(value) {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const text = String(item || '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function pickRotating(items, maxItems, seed, bucket) {
  const pool = dedupe(items);
  if (!pool.length || maxItems <= 0) return [];
  if (pool.length <= maxItems) return pool;

  const start = stableHash(`${bucket}|${seed}`) % pool.length;
  const picked = [];
  for (let i = 0; i < pool.length && picked.length < maxItems; i += 1) {
    picked.push(pool[(start + i) % pool.length]);
  }
  return picked;
}

/**
 * Returns an array of { key, hook } pairs for hooks relevant to the given call type.
 * Used inside buildContextualCueBank to access hook-sourced pitfall text.
 */
export function getScenarioHook(callType) {
  return getRelevantHookKeys(callType)
    .filter((key) => Boolean(ONTARIO_SCENARIO_HOOKS[key]))
    .map((key) => ({ key, hook: ONTARIO_SCENARIO_HOOKS[key] }));
}

/**
 * Builds a flat array of prompt-ready lines that guide the model away from known
 * Ontario EMS teaching errors and toward realistic, protocol-anchored content.
 * Mirrors the shape of buildDirectivePromptAddendum() from ontarioDirectiveRules.js.
 */
export function buildScenarioHookAddendum(callType, variationSeed = 0) {
  const hooks = getScenarioHook(callType);
  if (!hooks.length) return [];

  const lines = [];
  const rotationSeed = `${String(callType || '').toLowerCase()}|${variationSeed}`;

  // -- Teaching error avoidance (highest value: directly steers model output) --
  const allTeachingErrors = pickRotating(
    hooks.flatMap(({ hook }) => hook.commonTeachingErrors || []),
    6,
    rotationSeed,
    'teaching-errors'
  );
  if (allTeachingErrors.length) {
    lines.push(
      'Avoid these known Ontario EMS teaching errors in teachersPoints, protocolNotes, caseProgression, and grsAnchors:'
    );
    for (const error of allTeachingErrors) {
      lines.push(`- ${error}`);
    }
  }

  // -- Protocol note hooks (supplement the directive addendum) --
  const allProtocolHooks = pickRotating(
    hooks.flatMap(({ hook }) => hook.protocolNoteHooks || []),
    4,
    rotationSeed,
    'protocol-hooks'
  );
  if (allProtocolHooks.length) {
    lines.push('Protocol note guidance:');
    for (const note of allProtocolHooks) {
      lines.push(`- ${note}`);
    }
  }

  // -- GRS hooks (steer per-domain anchor quality for this call family) --
  const allGrsAssessment = pickRotating(
    hooks.flatMap(({ hook }) => hook.grsHooks?.assessment || []),
    4,
    rotationSeed,
    'grs-assessment'
  );
  const allGrsDecision = pickRotating(
    hooks.flatMap(({ hook }) => hook.grsHooks?.decisionMaking || []),
    4,
    rotationSeed,
    'grs-decision'
  );
  if (allGrsAssessment.length || allGrsDecision.length) {
    lines.push('GRS patientAssessment anchors for this call family should reflect:');
    for (const item of allGrsAssessment) {
      lines.push(`- ${item}`);
    }
    if (allGrsDecision.length) {
      lines.push('GRS decisionMaking anchors for this call family should reflect:');
      for (const item of allGrsDecision) {
        lines.push(`- ${item}`);
      }
    }
  }

  // -- Clinical progression patterns (non-oxygen hooks only to avoid noise) --
  const clinicalHooks = hooks.filter(({ key }) => key !== 'oxygenTherapy');
  const withTx = pickRotating(
    clinicalHooks.flatMap(({ hook }) => hook.progressionPatterns?.withProperTreatment || []),
    4,
    rotationSeed,
    'with-treatment'
  );
  const withoutTx = pickRotating(
    clinicalHooks.flatMap(({ hook }) => hook.progressionPatterns?.withoutProperTreatment || []),
    4,
    rotationSeed,
    'without-treatment'
  );

  if (withTx.length) {
    lines.push('caseProgression.withProperTreatment should reflect:');
    for (const item of withTx) lines.push(`- ${item}`);
  }
  if (withoutTx.length) {
    lines.push('caseProgression.withoutProperTreatment should reflect:');
    for (const item of withoutTx) lines.push(`- ${item}`);
  }

  const sceneContexts = pickRotating(
    clinicalHooks.flatMap(({ hook }) => hook.sceneContexts || []),
    4,
    rotationSeed,
    'scene-contexts'
  );
  if (sceneContexts.length) {
    lines.push('Consider varied scene contexts for this call type:');
    for (const scene of sceneContexts) lines.push(`- ${scene}`);
  }

  const physicalFindings = pickRotating(
    clinicalHooks.flatMap(({ hook }) => hook.physicalFindings || []),
    5,
    rotationSeed,
    'physical-findings'
  );
  if (physicalFindings.length) {
    lines.push('Consider plausible physical exam and first-impression findings:');
    for (const finding of physicalFindings) lines.push(`- ${finding}`);
  }

  // Patient / bystander language suggestions (advisory, not prescriptive)
  const quotes = pickRotating(
    clinicalHooks.flatMap(({ hook }) => hook.patientQuotes || []),
    4,
    rotationSeed,
    'patient-quotes'
  );
  const bystanderQuotes = pickRotating(
    clinicalHooks.flatMap(({ hook }) => hook.bystanderQuotes || []),
    3,
    rotationSeed,
    'bystander-quotes'
  );
  if (quotes.length) {
    lines.push('Consider realistic patient language for this call type:');
    for (const q of quotes) lines.push(`- "${q}"`);
  }
  if (bystanderQuotes.length) {
    lines.push('Consider realistic bystander language:');
    for (const q of bystanderQuotes) lines.push(`- "${q}"`);
  }

  return lines;
}
