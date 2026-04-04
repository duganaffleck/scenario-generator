// server/data/ontarioDirectiveRules.js

export const ONTARIO_DIRECTIVE_RULES = {
  global: {
    tags: ["global", "governance"],
    appliesTo: {
      scenarioTypes: ["Medical", "Trauma", "Cardiac", "Respiratory", "Environmental"]
    },
    meta: {
      sourcePriority: ["companion", "als", "bls", "memo"],
      confidence: "high"
    },
    promptBlock: [
      "Scenarios must reflect current Ontario BLS PCS and ALS PCS expectations.",
      "When relevant, BLS and ALS care should be treated as simultaneous rather than separate layers.",
      "Do not let outdated few-shot habits override these rules.",
      "Expected treatment and protocol notes should reflect Ontario directive logic rather than generic EMS habits.",
      "Reference Ontario standards URLs in reasoning and briefs:",
      "- https://files.ontario.ca/moh_2/moh-standards-basic-life-support-patient-care-standards-v3-4-en-2023-03-10.pdf",
      "- https://www.ontario.ca/files/2025-04/moh-advanced-life-support-als-patient-care-standards-pcs-5.4-en-2025-04-23.pdf",
      "- https://ontariobasehospitalgroup.ca/wp-content/uploads/2023/03/2023-02-01_v5.1_Companion-Document.pdf"
    ],
    commonDriftErrors: [
      "Generic North American EMS advice replacing Ontario-specific logic.",
      "Older few-shot assumptions overriding current clarifications.",
      "Medication suggestions without enough clinical support."
    ],
    validationChecks: [
      {
        id: "global-required-ontario-logic",
        description: "Directive-sensitive scenarios should use Ontario-specific reasoning in expected treatment and protocol notes."
      }
    ]
  },

  oxygenTherapy: {
    tags: ["oxygen", "bls", "respiratory", "cardiac", "global"],
    appliesTo: {
      scenarioTypes: ["Medical", "Cardiac", "Respiratory", "Environmental"],
      likelyChiefComplaints: [
        "shortness of breath",
        "chest pain",
        "respiratory distress",
        "altered LOC",
        "toxic exposure"
      ]
    },
    meta: {
      source: ["bls"],
      confidence: "high"
    },
    promptBlock: [
      "Use Ontario BLS oxygen targets accurately.",
      "For most patients, oxygen should be titrated to SpO2 92-96% unless a more specific rule applies.",
      "For the COPD exception context, titrate oxygen to SpO2 88-92%.",
      "If SpO2 is unavailable or not interpretable, high-concentration oxygen should be tied to qualifying critical findings or a qualifying exposure context."
    ],
    treatmentRules: {
      generalTargetSpO2: "92-96%",
      copdTargetSpO2: "88-92%",
      highConcentrationOxygenAlwaysFor: [
        "confirmed or suspected carbon monoxide toxicity",
        "confirmed or suspected cyanide toxicity",
        "noxious gas exposure",
        "upper airway burns",
        "scuba-diving related disorders",
        "ongoing cardiopulmonary arrest",
        "complete airway obstruction",
        "sickle cell anemia with suspected vaso-occlusive crisis"
      ],
      ifNoReliableSpO2UseHighConcentrationForCriticalFindings: [
        "age-specific hypotension",
        "respiratory distress",
        "cyanosis",
        "ashen colour",
        "pallor",
        "altered level of consciousness",
        "abnormal pregnancy or labour"
      ]
    },
    commonDriftErrors: [
      "Using blanket high-flow oxygen wording.",
      "Missing the COPD exception context.",
      "Mentioning oxygen without a target or reassessment plan."
    ],
    validationChecks: [
      {
        id: "oxygen-target-general",
        ifTreatmentMentionsAny: ["oxygen", "o2"],
        shouldPreferOneOf: ["92-96%", "88-92%"],
        severity: "medium"
      },
      {
        id: "protocol-notes-explicit",
        ifField: "protocolNotes",
        shouldContainOneOf: ["O2 titrate 92–96%", "12-lead before nitro", "Right-sided ECG if inferior STEMI"],
        severity: "low"
      }
    ],
    semesterGuidance: {
      "2": {
        emphasize: [
          "recognizing oxygenation concerns",
          "titrated oxygen language",
          "reassessment"
        ]
      },
      "3": {
        emphasize: [
          "reasoned oxygen selection",
          "clearer use of patient context",
          "integration with overall treatment plan"
        ]
      },
      "4": {
        emphasize: [
          "precise oxygen strategy",
          "stronger explanation of exceptions and reassessment"
        ]
      }
    }
  },

  spinalMotionRestriction: {
    tags: ["trauma", "smr", "bls", "fall", "c-collar"],
    appliesTo: {
      scenarioTypes: ["Trauma"],
      likelyChiefComplaints: [
        "fall",
        "head injury",
        "neck pain",
        "back pain",
        "collision",
        "mvc",
        "blunt trauma"
      ]
    },
    meta: {
      source: ["bls"],
      confidence: "high"
    },
    promptBlock: [
      "Use Ontario BLS spinal motion restriction criteria accurately.",
      "For trauma calls, selective SMR must follow Ontario criteria rather than generic low-risk trauma habits.",
      "Age over 65 with a history of a fall is itself an Ontario SMR criterion and should not be dismissed because the mechanism seems minor.",
      "If Ontario SMR criteria are met, apply cervical collar and SMR with stretcher-based transport rather than arguing SMR is unnecessary.",
      "Do not use spinal boards for transport; use stretcher-based SMR and document the criteria met."
    ],
    treatmentRules: {
      ageOver65WithFallRequiresSMR: true,
      stretcherBasedTransport: true,
      avoidSpinalBoardTransport: true
    },
    commonDriftErrors: [
      "Treating geriatric falls as automatic no-SMR cases because the mechanism seems minor.",
      "Using generic selective SMR wording without the Ontario age-over-65 fall criterion.",
      "Implying a collar is unnecessary when Ontario SMR criteria are met."
    ],
    validationChecks: [
      {
        id: "smr-older-fall-criterion",
        description: "Older-adult fall trauma scenarios should reflect that age over 65 with a fall is an Ontario SMR criterion.",
        severity: "medium"
      }
    ]
  },

  cardiacIschemia: {
    tags: ["cardiac", "ischemia", "ecg", "asa", "nitro"],
    appliesTo: {
      scenarioTypes: ["Cardiac", "Medical"],
      likelyChiefComplaints: [
        "chest pain",
        "pressure",
        "epigastric discomfort",
        "shortness of breath",
        "weakness",
        "diaphoresis"
      ],
      excludeWhen: [
        "isolated minor trauma",
        "pure psychiatric presentation"
      ]
    },
    meta: {
      source: ["companion"],
      confidence: "high"
    },
    promptBlock: [
      "Cardiac ischemia scenarios must reflect current Ontario cardiac ischemia clarifications.",
      "12-lead acquisition and interpretation should precede nitroglycerin consideration.",
      "A 12-lead within the first 10 minutes is a goal, not an absolute requirement in every setting.",
      "If inferior STEMI is identified and nitroglycerin is being considered, a minimum V4R should be obtained to assess right ventricular involvement.",
      "If STEMI is identified, repeating the 12-lead is not necessary; if no STEMI is identified, serial 12-leads are recommended.",
      "Nitroglycerin conditions are a prior history OR an established IV for first-time suspected cardiac ischemia.",
      "Use caution with nitroglycerin in tachycardia or when SBP is near 100 mmHg.",
      "Do not give nitroglycerin in right ventricular STEMI.",
      "If the patient falls outside directive parameters, do not later resume the medication simply because vitals normalize."
    ],
    treatmentRules: {
      twelveLead: {
        precedesNitroConsideration: true,
        goalWithinFirst10Minutes: true,
        ifInferiorSTEMIConsiderV4R: true,
        ifNoSTEMIRecommendSerial12Lead: true,
        ifSTEMIIdentifiedNoRepeatRequired: true
      },
      nitroglycerin: {
        firstTimeSuspectedIschemiaRequires: "prior history OR established IV",
        cautionIf: ["tachycardia", "SBP near 100 mmHg"],
        contraindicationHighlights: ["right ventricular STEMI"],
        doNotResumeAfterOutOfRangeVitals: true
      },
      asa: {
        generallySafeBroadTherapeuticIndex: true
      }
    },
    contraindications: {
      avoidNitroIn: ["right ventricular STEMI"],
      cautionNitroIn: ["tachycardia", "SBP near 100 mmHg"]
    },
    commonDriftErrors: [
      "Treating all chest pain as automatic nitro candidate.",
      "Skipping 12-lead reasoning before nitro language.",
      "Using an ECG rhythm that does not support the scenario framing.",
      "Forgetting right-sided lead logic in inferior STEMI."
    ],
    validationChecks: [
      {
        id: "ischemia-nitro-needs-support",
        ifTreatmentMentionsAny: ["nitro", "nitroglycerin"],
        shouldAlsoMentionOneOf: ["12-lead", "ECG", "prior history", "IV", "V4R", "right-sided"],
        severity: "high"
      },
      {
        id: "inferior-stemi-v4r",
        ifScenarioMentionsAny: ["inferior STEMI"],
        shouldAlsoMentionOneOf: ["V4R", "right-sided"],
        severity: "high"
      },
      {
        id: "protocol-notes-ischemia",
        ifField: "protocolNotes",
        shouldContainOneOf: ["12-lead before nitro", "Right-sided ECG if inferior STEMI"],
        severity: "medium"
      }
    ],
    semesterGuidance: {
      "2": {
        emphasize: [
          "recognition of concerning ischemic features",
          "ASA use when supported",
          "early transport priority",
          "basic 12-lead awareness if program expectations allow"
        ],
        avoidCenteringScenarioOn: [
          "nuanced nitro sequencing as the sole teaching hinge"
        ]
      },
      "3": {
        emphasize: [
          "12-lead-informed decision-making",
          "appropriate nitro logic",
          "reassessment",
          "atypical ischemia recognition"
        ]
      },
      "4": {
        emphasize: [
          "greater ambiguity",
          "subtle presentations",
          "operational delays",
          "more realistic ECG-driven reasoning"
        ]
      }
    }
  },

  acuteCardiogenicPulmonaryEdema: {
    tags: ["cardiac", "respiratory", "cpap", "nitro", "ecg"],
    appliesTo: {
      scenarioTypes: ["Cardiac", "Respiratory", "Medical"],
      likelyChiefComplaints: ["shortness of breath", "orthopnea", "pink frothy sputum"]
    },
    meta: {
      source: ["companion"],
      confidence: "high"
    },
    promptBlock: [
      "If acute cardiogenic pulmonary edema is present, acquire and interpret a 12- or 15-lead ECG as soon as possible.",
      "If STEMI is identified, follow cardiac ischemia nitroglycerin logic and dose scheduling.",
      "Do not imply the patient receives nitroglycerin from both the pulmonary edema and cardiac ischemia directives.",
      "If nitroglycerin causes hypotension, further doses should be withheld.",
      "A fluid bolus may still be appropriate in hypotension after nitroglycerin even if crackles are present."
    ],
    treatmentRules: {
      ecgAsSoonAsPossible: true,
      doNotDoubleCountNitroAcrossDirectives: true,
      holdFurtherNitroIfHypotensionOccurs: true,
      fluidBolusMayStillBeAppropriateAfterNitroHypotension: true
    },
    commonDriftErrors: [
      "Double-dipping nitroglycerin logic across directives.",
      "Treating crackles as an absolute barrier to all fluids.",
      "Ignoring ECG implications in pulmonary edema."
    ],
    validationChecks: [
      {
        id: "acpe-no-double-nitro-logic",
        ifScenarioMentionsAny: ["pulmonary edema", "acute cardiogenic pulmonary edema"],
        shouldAvoidImplication: "receives nitroglycerin from multiple directives as separate entitlement",
        severity: "medium"
      }
    ]
  },

  bronchoconstriction: {
    tags: ["respiratory", "asthma", "copd", "epinephrine", "salbutamol", "cpap", "dexamethasone"],
    appliesTo: {
      scenarioTypes: ["Respiratory", "Medical"],
      likelyChiefComplaints: [
        "shortness of breath",
        "wheeze",
        "chest tightness",
        "asthma attack",
        "copd flare"
      ]
    },
    meta: {
      source: ["companion"],
      confidence: "high"
    },
    promptBlock: [
      "Bronchoconstriction scenarios must distinguish asthma from COPD accurately.",
      "Initial treatment depends on the underlying cause and severity.",
      "Epinephrine is for asthmatics only.",
      "CPAP is COPD only in this clarification set.",
      "Salbutamol should be considered immediately after epinephrine administration for asthmatics.",
      "Dexamethasone may be administered with other treatments but should not be framed as immediately life-saving.",
      "Avoid careless ventilation language in severe asthma; account for air trapping and the need for an adequate expiratory phase."
    ],
    treatmentRules: {
      epinephrineForAsthmaOnly: true,
      cpapForCopdOnly: true,
      salbutamolAfterEpinephrineForAsthmatics: true,
      dexamethasone: {
        immediateLifeSaving: false,
        morbidityReducing: true
      }
    },
    contraindications: {
      avoidFramingAsGeneric: [
        "CPAP for asthma as default wording",
        "dexamethasone as immediate rescue effect"
      ]
    },
    commonDriftErrors: [
      "Using CPAP language too broadly.",
      "Failing to separate asthma from COPD logic.",
      "Making dexamethasone the star of immediate rescue.",
      "Underselling worsening air trapping and fatigue."
    ],
    validationChecks: [
      {
        id: "asthma-cpap-drift",
        ifScenarioMentionsAny: ["asthma"],
        shouldAvoidAny: ["CPAP"],
        severity: "high"
      },
      {
        id: "asthma-epi-support",
        ifTreatmentMentionsAny: ["epinephrine", "epinephrine IM"],
        scenarioShouldSupportOneOf: ["asthma", "severe bronchoconstriction"],
        severity: "high"
      }
    ],
    semesterGuidance: {
      "2": {
        emphasize: [
          "recognition of respiratory distress",
          "basic oxygenation support",
          "focused respiratory assessment",
          "communication with patient/family"
        ]
      },
      "3": {
        emphasize: [
          "clearer distinction between asthma and COPD",
          "appropriate symptom-relief selection",
          "reassessment after bronchodilator therapy"
        ]
      },
      "4": {
        emphasize: [
          "greater ambiguity in presentation",
          "fatigue versus agitation interpretation",
          "more nuanced progression and transport urgency"
        ]
      }
    }
  },

  analgesia: {
    tags: ["pain", "analgesia", "trauma", "renal colic", "musculoskeletal"],
    appliesTo: {
      scenarioTypes: ["Medical", "Trauma", "Environmental"],
      likelyChiefComplaints: [
        "pain",
        "abdominal pain",
        "flank pain",
        "fracture pain",
        "musculoskeletal pain"
      ]
    },
    meta: {
      source: ["companion", "memo"],
      confidence: "high"
    },
    promptBlock: [
      "Use current Ontario analgesia priorities.",
      "If oral medication is tolerated, acetaminophen and ibuprofen should be considered first-line analgesia.",
      "For suspected renal colic, routinely consider an NSAID such as ibuprofen or ketorolac when clinically appropriate.",
      "Do not co-administer ketorolac and ibuprofen."
    ],
    treatmentRules: {
      oralFirstLineIfTolerated: ["acetaminophen", "ibuprofen"],
      renalColicConsiderNSAID: ["ibuprofen", "ketorolac"],
      doNotCombine: [["ketorolac", "ibuprofen"]]
    },
    commonDriftErrors: [
      "Skipping oral first-line options when appropriate.",
      "Treating renal colic without NSAID consideration.",
      "Combining ketorolac and ibuprofen."
    ],
    validationChecks: [
      {
        id: "ketorolac-ibuprofen-combo",
        forbiddenCombination: ["ketorolac", "ibuprofen"],
        severity: "high"
      }
    ]
  },

  nauseaVomiting: {
    tags: ["nausea", "vomiting", "antiemetic"],
    appliesTo: {
      scenarioTypes: ["Medical", "Environmental"],
      likelyChiefComplaints: [
        "nausea",
        "vomiting",
        "emesis",
        "motion-related nausea"
      ]
    },
    meta: {
      source: ["companion", "memo"],
      confidence: "high"
    },
    promptBlock: [
      "Not every patient with nausea or vomiting requires medication treatment.",
      "If dimenhydrinate is given and there is no relief after 30 minutes, ondansetron may be considered if the patient still meets conditions and has no contraindications.",
      "Avoid generating dimenhydrinate with diphenhydramine co-administration.",
      "Avoid generating ondansetron with apomorphine.",
      "Be cautious about dimenhydrinate in elderly patients because of somnolence and confusion concerns."
    ],
    treatmentRules: {
      ondansetronAfterNoReliefFromDimenhydrinateAt30Min: true,
      doNotCombine: [
        ["dimenhydrinate", "diphenhydramine"],
        ["ondansetron", "apomorphine"]
      ],
      elderlyCautionWithDimenhydrinate: true
    },
    commonDriftErrors: [
      "Automatically medicating any nausea complaint.",
      "Ignoring medication sequencing.",
      "Unsafe co-administration wording."
    ],
    validationChecks: [
      {
        id: "gravol-benadryl-combo",
        forbiddenCombination: ["dimenhydrinate", "diphenhydramine"],
        severity: "high"
      },
      {
        id: "ondansetron-apomorphine-combo",
        forbiddenCombination: ["ondansetron", "apomorphine"],
        severity: "high"
      }
    ]
  },

  cardiacArrest: {
    tags: ["arrest", "vsa", "resuscitation"],
    appliesTo: {
      scenarioTypes: ["Cardiac", "Medical"],
      likelyChiefComplaints: ["cardiac arrest", "collapse", "VSA", "pulseless"]
    },
    meta: {
      source: ["companion", "memo"],
      confidence: "medium"
    },
    promptBlock: [
      "Cardiac arrest scenarios should not imply naloxone has a routine role in confirmed cardiac arrest.",
      "CPR expectations should align with Ontario standards.",
      "Advanced arrest features such as VCD or DSED should only appear if they fit the intended learner level, setting, and available resources."
    ],
    treatmentRules: {
      noRoutineNaloxoneInConfirmedCardiacArrest: true
    },
    commonDriftErrors: [
      "Treating confirmed arrest like opioid toxicity with routine naloxone.",
      "Adding advanced arrest options without scenario support."
    ],
    validationChecks: [
      {
        id: "arrest-no-routine-naloxone",
        ifScenarioMentionsAny: ["cardiac arrest", "VSA", "pulseless"],
        shouldAvoidAny: ["naloxone"],
        severity: "medium"
      }
    ]
  },

  futureScaffold: {
    tags: ["scaffold"],
    directivesPlanned: [
      "hypoglycemia",
      "moderateToSevereAllergicReaction",
      "minorAllergicReaction",
      "seizure",
      "suspectedAdrenalCrisis",
      "tachydysrhythmia",
      "symptomaticBradycardia",
      "traumaticHemorrhage",
      "headache",
      "hyperkalemia",
      "opioidToxicityAndWithdrawal",
      "emergencyChildbirth",
      "treatAndDischarge",
      "delegatedActs"
    ]
  }
};

export function selectDirectiveRuleSets({
  semester,
  type,
  customPrompt = "",
  title = ""
} = {}) {
  const text = `${type || ""} ${title} ${customPrompt}`.toLowerCase();
  const selected = ["global", "oxygenTherapy"];

  const maybeAdd = (key, conditions = []) => {
    if (conditions.some(Boolean) && !selected.includes(key)) selected.push(key);
  };

  maybeAdd("cardiacIschemia", [
    type === "Cardiac",
    text.includes("ischemia"),
    text.includes("stemi"),
    text.includes("chest pain"),
    text.includes("acs"),
    text.includes("epigastric"),
    text.includes("diaphoresis")
  ]);

  maybeAdd("acuteCardiogenicPulmonaryEdema", [
    text.includes("pulmonary edema"),
    text.includes("acpe"),
    text.includes("pink frothy"),
    text.includes("orthopnea")
  ]);

  maybeAdd("bronchoconstriction", [
    type === "Respiratory",
    text.includes("asthma"),
    text.includes("copd"),
    text.includes("wheeze"),
    text.includes("bronchoconstriction"),
    text.includes("tight chest"),
    text.includes("tightness")
  ]);

  maybeAdd("spinalMotionRestriction", [
    type === "Trauma",
    text.includes("fall"),
    text.includes("head injury"),
    text.includes("neck pain"),
    text.includes("back pain"),
    text.includes("collision"),
    text.includes("mvc"),
    text.includes("blunt trauma")
  ]);

  maybeAdd("analgesia", [
    text.includes("pain"),
    text.includes("fracture"),
    text.includes("renal colic"),
    text.includes("flank pain"),
    text.includes("musculoskeletal")
  ]);

  maybeAdd("nauseaVomiting", [
    text.includes("nausea"),
    text.includes("vomit"),
    text.includes("emesis")
  ]);

  maybeAdd("cardiacArrest", [
    text.includes("arrest"),
    text.includes("vsa"),
    text.includes("pulseless"),
    text.includes("vf"),
    text.includes("vt")
  ]);

  return selected.map((key) => ({
    key,
    semester,
    ruleSet: ONTARIO_DIRECTIVE_RULES[key]
  }));
}

export function buildDirectivePromptAddendum({
  semester,
  type,
  customPrompt = "",
  title = ""
} = {}) {
  const selected = selectDirectiveRuleSets({ semester, type, customPrompt, title });

  const blocks = selected.flatMap(({ ruleSet }) => [
    ...(ruleSet.promptBlock || []),
    ...((ruleSet.semesterGuidance && ruleSet.semesterGuidance[String(semester)]?.emphasize) || []).map(
      (item) => `Semester ${semester} emphasis: ${item}.`
    ),
    ...((ruleSet.contraindications?.avoidFramingAsGeneric || []).map(
      (item) => `Avoid this drift: ${item}.`
    ))
  ]);

  return [...new Set(blocks)];
}

export function getDirectiveValidationRules({
  semester,
  type,
  customPrompt = "",
  title = ""
} = {}) {
  const selected = selectDirectiveRuleSets({ semester, type, customPrompt, title });
  return selected.flatMap(({ ruleSet }) => ruleSet.validationChecks || []);
}