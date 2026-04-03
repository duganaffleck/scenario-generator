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
      "Ignoring right-sided lead implications in inferior STEMI logic."
    ]
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
      "Underestimating fatigue and worsening air entry."
    ]
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
      "Ignoring sedation/confusion concerns in older adults."
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
  } else {
    // Medical / Trauma / Environmental all benefit from analgesia and nausea guidance
    keys.push('analgesia', 'nauseaVomiting');
  }

  return keys;
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
export function buildScenarioHookAddendum(callType) {
  const hooks = getScenarioHook(callType);
  if (!hooks.length) return [];

  const lines = [];

  // -- Teaching error avoidance (highest value: directly steers model output) --
  const allTeachingErrors = hooks.flatMap(({ hook }) => hook.commonTeachingErrors || []);
  if (allTeachingErrors.length) {
    lines.push(
      'Avoid these known Ontario EMS teaching errors in teachersPoints, protocolNotes, caseProgression, and grsAnchors:'
    );
    for (const error of allTeachingErrors) {
      lines.push(`- ${error}`);
    }
  }

  // -- Protocol note hooks (supplement the directive addendum) --
  const allProtocolHooks = hooks.flatMap(({ hook }) => hook.protocolNoteHooks || []);
  if (allProtocolHooks.length) {
    lines.push('Protocol note guidance:');
    for (const note of allProtocolHooks) {
      lines.push(`- ${note}`);
    }
  }

  // -- GRS hooks (steer per-domain anchor quality for this call family) --
  const allGrsAssessment = hooks.flatMap(({ hook }) => hook.grsHooks?.assessment || []);
  const allGrsDecision = hooks.flatMap(({ hook }) => hook.grsHooks?.decisionMaking || []);
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
  for (const { hook } of clinicalHooks) {
    const withTx = hook.progressionPatterns?.withProperTreatment || [];
    const withoutTx = hook.progressionPatterns?.withoutProperTreatment || [];

    if (withTx.length) {
      lines.push('caseProgression.withProperTreatment should reflect:');
      for (const item of withTx) lines.push(`- ${item}`);
    }
    if (withoutTx.length) {
      lines.push('caseProgression.withoutProperTreatment should reflect:');
      for (const item of withoutTx) lines.push(`- ${item}`);
    }

    // Patient / bystander language suggestions (advisory, not prescriptive)
    const quotes = hook.patientQuotes || [];
    const bystanderQuotes = hook.bystanderQuotes || [];
    if (quotes.length) {
      lines.push('Consider realistic patient language for this call type:');
      for (const q of quotes) lines.push(`- "${q}"`);
    }
    if (bystanderQuotes.length) {
      lines.push('Consider realistic bystander language:');
      for (const q of bystanderQuotes) lines.push(`- "${q}"`);
    }
  }

  return lines;
}
