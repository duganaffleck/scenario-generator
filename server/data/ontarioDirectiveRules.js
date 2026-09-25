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
      "Do not include URLs, web links, or external references in any generated field. Ontario standards should inform the content but never appear as printed links in scenario output.",
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
        shouldContainOneOf: ["O2 titrate 92-96%", "12-lead before nitro", "Right-sided ECG if inferior STEMI"],
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
      "12-lead acquisition and interpretation should precede nitroglycerin consideration. The phrase '12-lead' must appear in expectedTreatment for any cardiac ischemia scenario: do not omit it.",
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
      "When antiemetic treatment is indicated, name dimenhydrinate explicitly in expectedTreatment: do not use generic terms like 'antiemetic' without naming the medication.",
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
      "Advanced arrest features such as VCD or DSED should only appear if they fit the intended learner level, setting, and available resources.",
      "The only PCP medication in medical cardiac arrest is epinephrine 1 mg/mL IM 0.01 mg/kg, max 0.5 mg, one dose, and only if anaphylaxis is suspected as the cause. It does not alter the CPR and defibrillation sequence.",
      "PCP cardiac arrest management is: high quality CPR, early defibrillation for shockable rhythms, supraglottic airway when indicated, rhythm analysis every 2 minutes, reversible cause identification, and transport or patch.",
      "Medical TOR applies when the arrest was not witnessed by paramedics AND there is no ROSC after 20 minutes of resuscitation AND no defibrillation was delivered.",
      "Post-ROSC oxygen target is SpO2 94-98%: do not target 100%. ETCO2 target is 30-40 mmHg. Avoid hyperventilation. Fluid bolus 10ml/kg to max 1000ml if SBP below 90 and lungs clear."
    ],
    treatmentRules: {
      noRoutineNaloxoneInConfirmedCardiacArrest: true,
      epinephrineInArrestACPOnly: true,
      exceptionEpinephrineIMForAnaphylaxisArrest: true,
      atropineACPOnly: true,
      amiodaroneACPOnly: true,
      dopamineACPOnly: true,
      pcpArrestManagement: ["CPR", "defibrillation", "supraglottic airway", "rhythm analysis", "reversible causes", "transport"]
    },
    commonDriftErrors: [
      "Treating confirmed arrest like opioid toxicity with routine naloxone.",
      "Adding advanced arrest options without scenario support.",
      "Including epinephrine as a PCP cardiac arrest treatment when anaphylaxis did not cause the arrest.",
      "Targeting SpO2 100% post-ROSC instead of 94-98%."
    ],
    validationChecks: [
      {
        id: "arrest-no-routine-naloxone",
        ifScenarioMentionsAny: ["cardiac arrest", "VSA", "pulseless"],
        shouldAvoidAny: ["naloxone"],
        severity: "medium"
      },
      {
        id: "arrest-no-pcp-epi-iv",
        ifScenarioMentionsAny: ["cardiac arrest", "VSA", "pulseless", "VF", "asystole", "PEA"],
        shouldAvoidAny: ["epinephrine IV", "epinephrine 1mg IV", "epinephrine intravenous"],
        severity: "high"
      }
    ]
  },

  hypoglycemia: {
    tags: ["hypoglycemia", "diabetic", "bgl", "glucose"],
    appliesTo: {
      scenarioTypes: ["Medical"],
      likelyChiefComplaints: ["altered level of consciousness", "weakness", "shakiness", "diabetic emergency", "low blood sugar"]
    },
    meta: { source: ["als", "companion"], confidence: "high" },
    promptBlock: [
      "Hypoglycemia treatment follows a tiered approach based on level of consciousness and swallowing safety.",
      "Oral glucose is appropriate when the patient is alert enough to safely swallow: use 15g simple carbohydrates and reassess using the 15-15 rule.",
      "Glucagon is appropriate when the patient cannot safely swallow: 0.5 mg IM under 25 kg, 1 mg IM at 25 kg or more, or 3 mg IN at age 4 or older; every 20 minutes, max 2 doses.",
      "Dextrose IV (PCP with IV access) when the patient cannot take oral glucose or glucagon has failed: D10W 0.2 g/kg (2 mL/kg) or D50W 0.5 g/kg (1 mL/kg), max 25 g per dose, every 10 minutes, max 2 doses. Stop if the patient can safely take carbohydrates.",
      "If glucagon was given with no improvement and IV is subsequently established, administer dextrose regardless of elapsed time since glucagon.",
      "Do not administer multiple doses of the same medication: transport if two doses of glucagon or dextrose are required.",
      "Reassess BGL after treatment before determining transport or treat-and-discharge eligibility.",
      "Treat and discharge requires confirmed improvement, ability to self-care, responsible adult present, follow-up plan, and base hospital patch."
    ],
    treatmentRules: {
      oralGlucoseRequiresSafeSwallowing: true,
      glucagonWhenCannotSwallow: true,
      dextroseWithIV: true,
      dextroseIfGlucagonFailedAndIVEstablished: true,
      doNotRepeatSameMedication: true,
      reassessBGLAfterTreatment: true
    },
    commonDriftErrors: [
      "Giving oral glucose to a patient who cannot safely swallow.",
      "Skipping glucagon and going directly to dextrose without IV established.",
      "Failing to reassess BGL after treatment.",
      "Treating hypoglycemia without considering transport even after improvement."
    ],
    validationChecks: [
      {
        id: "hypoglycemia-swallowing-check",
        description: "Oral glucose should only be given when swallowing is confirmed safe.",
        severity: "high"
      }
    ]
  },

  moderateToSevereAllergicReaction: {
    tags: ["anaphylaxis", "allergic reaction", "epinephrine", "diphenhydramine"],
    appliesTo: {
      scenarioTypes: ["Medical", "Respiratory", "Environmental"],
      likelyChiefComplaints: ["allergic reaction", "anaphylaxis", "hives", "swelling", "shortness of breath after exposure"]
    },
    meta: { source: ["als", "companion"], confidence: "high" },
    promptBlock: [
      "Epinephrine 1:1000 IM is the primary treatment for anaphylaxis: administer as soon as anaphylaxis is recognized.",
      "The anterolateral mid-thigh is the preferred IM site for epinephrine due to improved absorption.",
      "Diphenhydramine is a secondary treatment: it does not prevent or relieve upper airway edema, hypotension, or shock. It must not replace or delay epinephrine.",
      "Salbutamol is adjunctive treatment for bronchospasm not responsive to epinephrine: it does not address upper airway edema.",
      "Dexamethasone must NOT appear in expectedTreatment or protocolNotes for anaphylaxis scenarios: it is not part of prehospital anaphylaxis management and must be explicitly excluded.",
      "Biphasic reactions can occur 1 to 48 hours after initial symptom resolution without re-exposure: transport is mandatory even after apparent recovery.",
      "Patients with diaphoresis, flushing, or dyspnea are more likely to require multiple epinephrine doses.",
      "If hypotension persists after epinephrine, treat with IV fluid bolus per the IV and Fluid Therapy directive."
    ],
    treatmentRules: {
      epinephrineFirst: true,
      diphenhydramineSecondaryOnly: true,
      dexamethasoneNotIndicated: true,
      salbutamolAdjunctiveOnly: true,
      transportMandatoryDueToBiphasicRisk: true
    },
    contraindications: {
      avoidFramingAsGeneric: [
        "diphenhydramine as primary treatment for anaphylaxis",
        "dexamethasone as part of anaphylaxis management",
        "salbutamol as substitute for epinephrine"
      ]
    },
    commonDriftErrors: [
      "Delaying epinephrine to give diphenhydramine first.",
      "Including dexamethasone in prehospital anaphylaxis management.",
      "Framing salbutamol as the primary airway treatment.",
      "Not warning about biphasic reaction risk."
    ],
    validationChecks: [
      {
        id: "anaphylaxis-epi-first",
        ifScenarioMentionsAny: ["anaphylaxis", "allergic reaction"],
        shouldAlsoMentionOneOf: ["epinephrine", "epipen"],
        severity: "high"
      }
    ]
  },

  seizure: {
    tags: ["seizure", "epilepsy", "convulsion", "postictal"],
    appliesTo: {
      scenarioTypes: ["Medical", "OB/Peds"],
      likelyChiefComplaints: ["seizure", "convulsion", "epilepsy", "shaking", "unresponsive after seizure"]
    },
    meta: { source: ["als", "companion"], confidence: "high" },
    promptBlock: [
      "PCP core seizure management involves protecting the patient from injury, safe positioning, airway management, oxygen if hypoxic, and BGL check.",
      "There is no PCP seizure medication. The PCP seizure directive covers treat and discharge only.",
      "Always check BGL in any patient with altered consciousness or post-ictal state: hypoglycemia must be ruled out.",
      "The seizure treat-and-discharge auxiliary directive requires: confirmed epilepsy diagnosed by a physician, single seizure episode, full recovery to baseline, no new medications or dosage changes in the past 30 days, meets all eligibility criteria, and a base hospital patch is mandatory.",
      "A seizure cluster is multiple seizures within 24 hours: these patients do not qualify for treat and discharge.",
      "A new medication or recent dosage change in the past 30 days can lower seizure threshold and affects treat-and-discharge eligibility.",
      "Post-ictal confusion is expected: reassess level of consciousness serially before disposition decision."
    ],
    treatmentRules: {
      midazolamIsACPOnly: true,
      bglCheckMandatory: true,
      treatAndDischargeRequiresBHPPatch: true,
      treatAndDischargeRequiresConfirmedEpilepsy: true,
      seizureClusterExcludesFromTreatAndDischarge: true
    },
    commonDriftErrors: [
      "Adding a seizure medication to PCP care.",
      "Skipping BGL check in post-ictal patients.",
      "Applying treat and discharge without confirmed epilepsy diagnosis.",
      "Applying treat and discharge without base hospital patch."
    ],
    validationChecks: [
      {
        id: "seizure-no-pcp-midazolam",
        ifScenarioMentionsAny: ["seizure", "convulsion"],
        shouldAvoidAny: ["midazolam"],
        severity: "high"
      },
      {
        id: "seizure-bgl-check",
        ifScenarioMentionsAny: ["seizure", "postictal", "post-ictal"],
        shouldAlsoMentionOneOf: ["glucose", "BGL", "blood sugar"],
        severity: "medium"
      }
    ]
  },

  tachydysrhythmia: {
    tags: ["tachydysrhythmia", "svt", "tachycardia", "palpitations", "rapid heart rate"],
    appliesTo: {
      scenarioTypes: ["Cardiac", "Medical"],
      likelyChiefComplaints: ["palpitations", "rapid heart rate", "SVT", "tachycardia", "chest pain with rapid rate"]
    },
    meta: { source: ["als", "companion"], confidence: "high" },
    promptBlock: [
      "Tachycardia may be a physiologic compensatory response to pain, hypovolemia, fever, or hypoxia: treat the underlying cause and do not initiate tachydysrhythmia directive interventions for compensatory tachycardia.",
      "A 12-lead ECG is strongly recommended to accurately identify narrow versus wide complex tachycardia before any intervention.",
      "Modified Valsalva is a PCP auxiliary intervention for symptomatic tachydysrhythmia: age 18 or older, unaltered LOA, HR 150 or higher, normotensive, narrow complex and regular. Contraindicated in sinus tachycardia, atrial fibrillation or atrial flutter.",
      "The modified Valsalva procedure: patient performs forced expiration into a 10ml syringe for 15 seconds, then is immediately laid supine with legs elevated to 45 degrees for 15 seconds, then returned to semi-recumbent for 45 seconds.",
      "Maximum 2 Valsalva attempts per episode: if the patient converts and then reverts, this is a new episode and additional attempts may be made, but the patient no longer qualifies for treat and discharge.",
      "Wide complex, irregular or unstable tachycardia: PCP care is monitoring, serial 12-lead, ALS intercept and rapid transport.",
      "Chest pain associated with tachydysrhythmia is not a contraindication to treatment: after treating the dysrhythmia, assess whether chest pain is ongoing and ischemic.",
      "Pregnant patients are excluded from the tachydysrhythmia treat-and-discharge portion of the directive."
    ],
    treatmentRules: {
      modifiedValsalvaForSVTPCPAuxiliary: true,
      adenosineACPOnly: true,
      cardioversionACPOnly: true,
      amiodaroneACPOnly: true,
      doNotTreatCompensatoryTachycardia: true,
      twelveleadBeforeIntervention: true,
      pregnantExcludedFromTreatAndDischarge: true
    },
    contraindications: {
      avoidFramingAsGeneric: [
        "treating compensatory tachycardia as dysrhythmia"
      ]
    },
    commonDriftErrors: [
      "Adding a rate-control medication or electrical therapy to PCP care.",
      "Treating physiologic compensatory tachycardia as a dysrhythmia.",
      "Not obtaining 12-lead before intervention.",
      "Applying Valsalva to atrial fibrillation, flutter or sinus tachycardia."
    ],
    validationChecks: [
      {
        id: "tachydysrhythmia-no-adenosine-pcp",
        ifScenarioMentionsAny: ["svt", "supraventricular tachycardia", "tachydysrhythmia"],
        shouldAvoidAny: ["adenosine"],
        severity: "high"
      }
    ]
  },

  traumaticHemorrhage: {
    tags: ["hemorrhage", "bleeding", "txa", "tranexamic acid", "trauma", "tourniquet"],
    appliesTo: {
      scenarioTypes: ["Trauma", "Environmental"],
      likelyChiefComplaints: ["significant bleeding", "traumatic hemorrhage", "penetrating trauma", "crush injury", "amputation"]
    },
    meta: { source: ["als", "companion"], confidence: "high" },
    promptBlock: [
      "External hemorrhage should be controlled first with direct pressure, wound packing, or tourniquet before other interventions.",
      "Tranexamic acid (TXA) is a PCP auxiliary intervention: 1000 mg IV or IM, one dose, age 16 or older, suspected traumatic hemorrhage with HR 110 or higher or hypotension. Contraindicated more than 3 hours from injury, in isolated head injury, or with allergy.",
      "TXA must not delay transport and must not be prioritized over management of other reversible causes.",
      "When the scenario involves significant traumatic hemorrhage, TXA must appear in expectedTreatment by name: use 'tranexamic acid' or 'TXA' explicitly so it is not omitted from the treatment plan.",
      "Research supporting TXA efficacy is in adult populations only.",
      "Ontario SMR criteria require application when age over 65 and fall mechanism is present regardless of apparent severity.",
      "Do not use spinal board for transport: use stretcher-based SMR."
    ],
    treatmentRules: {
      directPressureFirst: true,
      txaIVPreferred: true,
      txaIMAlternate: true,
      txaMustNotDelayTransport: true,
      smrAgeOver65FallRequired: true,
      noSpinalBoardForTransport: true
    },
    commonDriftErrors: [
      "Prioritizing TXA over transport or hemorrhage control.",
      "Giving TXA without noting auxiliary authorization requirement.",
      "Using spinal board language instead of stretcher-based SMR."
    ],
    validationChecks: [
      {
        id: "txa-does-not-delay-transport",
        ifTreatmentMentionsAny: ["tranexamic acid", "txa"],
        shouldAlsoMentionOneOf: ["does not delay transport", "auxiliary", "base hospital"],
        severity: "medium"
      }
    ]
  },

  hyperkalemia: {
    tags: ["hyperkalemia", "potassium", "dialysis", "renal", "peaked t waves"],
    appliesTo: {
      scenarioTypes: ["Medical"],
      likelyChiefComplaints: ["weakness", "missed dialysis", "renal failure", "ECG changes", "bradycardia with renal history"]
    },
    meta: { source: ["als", "companion"], confidence: "high" },
    promptBlock: [
      "Hyperkalemia recognition is the key PCP skill: consider it in any patient with renal failure, missed dialysis, crush injury, or metabolic acidosis.",
      "ECG findings of hyperkalemia progress from peaked T-waves, to flattened P-waves, to prolonged PR, to widened QRS, to sine-wave pattern: not all findings are present in every patient.",
      "There is no PCP medication for hyperkalemia. PCP role: recognition from ECG and clinical picture, serial 12-lead ECG, ALS intercept consideration, urgent transport with cardiac monitoring and pre-alert."
    ],
    treatmentRules: {
      calciumGluconateACPOnly: true,
      salbutamolHighDoseACPContext: true,
      sodiumBicarbonateNotRecommended: true,
      pcpRoleIsRecognitionAndTransport: true,
      serial12LeadRequired: true
    },
    commonDriftErrors: [
      "Adding a hyperkalemia medication to PCP care.",
      "Missing hyperkalemia as the underlying cause in a missed dialysis scenario.",
      "Not linking ECG changes to clinical context and transport urgency."
    ],
    validationChecks: [
      {
        id: "hyperkalemia-no-calcium-gluconate-pcp",
        ifScenarioMentionsAny: ["hyperkalemia", "missed dialysis", "peaked t waves"],
        shouldAvoidAny: ["calcium gluconate"],
        severity: "high"
      }
    ]
  },

  opioidToxicityAndWithdrawal: {
    tags: ["opioid", "naloxone", "overdose", "fentanyl", "heroin", "withdrawal"],
    appliesTo: {
      scenarioTypes: ["Medical", "Environmental"],
      likelyChiefComplaints: ["opioid overdose", "unresponsive", "slow breathing", "pinpoint pupils", "withdrawal symptoms"]
    },
    meta: { source: ["als", "companion"], confidence: "high" },
    promptBlock: [
      "Effective ventilation is the priority in opioid overdose: airway management before naloxone.",
      "Naloxone is available intranasal or IM: titrate to adequate respirations, not full reversal. Do not use the phrase 'full reversal' in expectedTreatment.",
      "Titrating to restore breathing prevents precipitated withdrawal and agitation. The goal is adequate ventilation, not full opioid antagonism.",
      "Naloxone has no routine role in confirmed cardiac arrest: do not include it as a routine arrest medication.",
      "Re-sedation risk is real with long-acting opioids such as methadone: transport is mandatory even after apparent reversal.",
      "Mixed overdose: naloxone may unmask stimulant toxidrome: be prepared for seizures, agitation, or hypertensive crisis after reversal.",
      "Naloxone age condition: patient must be 24 hours or older.",
      "Naloxone doses: 0.4 mg IV/IM, 0.8 mg SC or 2-4 mg IN, every 5 minutes, max 3 doses, for altered LOA with RR under 10 or inadequate ventilation.",
      "Buprenorphine/naloxone BUC/SL (16 mg, then 8 mg every 10 minutes, cumulative max 24 mg) only after naloxone this episode, age 16 or older, unaltered LOA, COWS 8 or more, and no methadone in the past 72 hours."
    ],
    treatmentRules: {
      ventilationBeforeNaloxone: true,
      titrateToBrathingNotFullReversal: true,
      noNaloxoneInConfirmedArrest: true,
      transportMandatoryDueToResedation: true,
      ageConditionOver24Hours: true
    },
    commonDriftErrors: [
      "Giving naloxone before ensuring adequate ventilation.",
      "Giving naloxone in confirmed cardiac arrest.",
      "Giving full reversal dose rather than titrated dose.",
      "Not warning about re-sedation with long-acting opioids."
    ],
    validationChecks: [
      {
        id: "naloxone-not-in-arrest",
        ifScenarioMentionsAny: ["cardiac arrest", "vsa", "pulseless"],
        shouldAvoidAny: ["naloxone"],
        severity: "high"
      }
    ]
  },

  emergencyChildbirth: {
    tags: ["childbirth", "delivery", "labour", "oxytocin", "postpartum", "neonate"],
    appliesTo: {
      scenarioTypes: ["OB/Peds", "Medical"],
      likelyChiefComplaints: ["active labour", "imminent delivery", "postpartum hemorrhage", "precipitous delivery"]
    },
    meta: { source: ["als", "companion"], confidence: "high" },
    promptBlock: [
      "Paramedics are not authorized to perform internal vaginal exams to determine cervical dilation.",
      "Inspect the perineum when history suggests ruptured membranes, cord prolapse, urge to push, or heavy vaginal bleeding with hypotension.",
      "Signs of imminent birth include crowning or presenting part visible, or in multips contractions 5 minutes apart or less with other second-stage signs.",
      "Oxytocin is administered immediately after delivery of all fetuses and/or placenta and up to 4 hours post-placenta delivery: for prevention and management of post-partum hemorrhage.",
      "Oxytocin can induce vasoconstriction: use caution in hypertensive patients.",
      "External uterine massage is performed only after placenta delivery when fundus is soft or boggy or bleeding is excessive.",
      "External bimanual compression if uterine massage is unsuccessful: can be performed whether or not placenta is delivered.",
      "Prolapsed cord: knee-chest or exaggerated Sims position, manual digital elevation of presenting part, maintain until transfer of care.",
      "Breech delivery: hands off until delivered to umbilicus, 4 minutes from umbilicus to head delivery, initiate Mauriceau-Smellie-Veit if head not delivered within 3 minutes.",
      "Shoulder dystocia: ALARM maneuvers: McRoberts, suprapubic pressure, Gaskin, manual release of posterior arm. 8 minutes from head delivery."
    ],
    treatmentRules: {
      noInternalVaginalExam: true,
      oxytocinAfterDelivery: true,
      externalUterineMassageAfterPlacentaOnly: true,
      prologuedCordManualElevation: true,
      breechHandsOffUntilUmbilicus: true
    },
    commonDriftErrors: [
      "Referencing internal vaginal exam to assess dilation.",
      "Omitting oxytocin from post-partum hemorrhage management.",
      "Performing uterine massage before placenta is delivered.",
      "Not specifying time limits in breech or shoulder dystocia management."
    ],
    validationChecks: [
      {
        id: "childbirth-no-internal-exam",
        ifScenarioMentionsAny: ["labour", "delivery", "childbirth"],
        shouldAvoidAny: ["internal exam", "vaginal exam", "cervical check"],
        severity: "high"
      }
    ]
  },

  rosc: {
    tags: ["rosc", "post-rosc", "return of spontaneous circulation", "post-cardiac arrest"],
    appliesTo: {
      scenarioTypes: ["Cardiac", "Medical"],
      likelyChiefComplaints: ["post-rosc", "return of pulse", "post-cardiac arrest management"]
    },
    meta: { source: ["als", "companion"], confidence: "high" },
    promptBlock: [
      "Post-ROSC oxygen target is SpO2 94-98%: avoid 100% to minimize vasoconstriction and oxygen free radical damage.",
      "Continue oxygen administration if patient remains unstable despite ideal SpO2 values.",
      "Post-ROSC ventilation rate: approximately 10 breaths per minute for adults. Target ETCO2 30-40 mmHg.",
      "Avoid hyperventilation post-ROSC: a low ETCO2 may reflect metabolic acidosis, not a reason to increase ventilation rate.",
      "Fluid bolus 10ml/kg to maximum 1000ml if SBP below 90 mmHg and chest auscultation is clear.",
      "Maximum fluid volume is 10ml/kg or 1000ml for post-ROSC and cardiogenic shock patients.",
      "If patient re-arrests en route: pull over, one immediate rhythm interpretation, treat appropriately, continue to hospital with no further stops."
    ],
    treatmentRules: {
      spo2Target94to98: true,
      avoid100PercentSpo2: true,
      etco2Target30to40: true,
      avoidHyperventilation: true,
      fluidBolusMax1000ml: true,
      dopamineACPOnly: true
    },
    commonDriftErrors: [
      "Targeting SpO2 100% post-ROSC.",
      "Hyperventilating post-ROSC patients.",
      "Giving fluid bolus without SBP and auscultation criteria."
    ],
    validationChecks: [
      {
        id: "rosc-spo2-target",
        ifScenarioMentionsAny: ["rosc", "post-rosc", "return of spontaneous circulation"],
        shouldAlsoMentionOneOf: ["94", "98", "94-98"],
        severity: "medium"
      }
    ]
  },

  cpap: {
    tags: ["cpap", "continuous positive airway pressure", "pulmonary edema", "copd", "respiratory failure"],
    appliesTo: {
      scenarioTypes: ["Respiratory", "Cardiac", "Medical"],
      likelyChiefComplaints: ["severe respiratory distress", "pulmonary edema", "COPD exacerbation", "acute dyspnea"]
    },
    meta: { source: ["als", "companion"], confidence: "high" },
    promptBlock: [
      "CPAP is indicated for severe respiratory distress with acute pulmonary edema regardless of origin, or COPD exacerbation.",
      "CPAP is a PCP auxiliary directive: requires base hospital authorization.",
      "CPAP is additive therapy to the bronchoconstriction or ACPE directives, not a replacement.",
      "CPAP is not indicated for asthma: epinephrine and salbutamol are the asthma interventions.",
      "CPAP may be interrupted momentarily to administer nitroglycerin. Salbutamol can be administered via the MDI port without interrupting CPAP.",
      "Reassess patient every 5 minutes and adjust CPAP as required.",
      "CPAP is appropriate for non-cardiogenic pulmonary edema: nitroglycerin is not."
    ],
    treatmentRules: {
      cpapForCOPDAndPulmonaryEdema: true,
      cpapNotForAsthma: true,
      cpapRequiresBaseHospitalAuthorization: true,
      cpapAdditiveNotReplacement: true,
      nitroglycenCanBeGivenWithBriefCPAPInterruption: true
    },
    contraindications: {
      avoidFramingAsGeneric: [
        "CPAP for asthma",
        "CPAP replacing bronchodilator therapy"
      ]
    },
    commonDriftErrors: [
      "Including CPAP as an asthma treatment.",
      "Framing CPAP as a standalone replacement for other treatments.",
      "Not noting base hospital authorization requirement."
    ],
    validationChecks: [
      {
        id: "cpap-not-for-asthma",
        ifScenarioMentionsAny: ["asthma"],
        shouldAvoidAny: ["cpap"],
        severity: "high"
      }
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

  maybeAdd("hypoglycemia", [
    text.includes("hypoglycemia"),
    text.includes("low blood sugar"),
    text.includes("glucagon"),
    text.includes("glucose"),
    text.includes("diabetic"),
    text.includes("bgl")
  ]);

  maybeAdd("moderateToSevereAllergicReaction", [
    text.includes("anaphylaxis"),
    text.includes("allergic reaction"),
    text.includes("epinephrine") && !text.includes("asthma"),
    text.includes("hives"),
    text.includes("angioedema")
  ]);

  maybeAdd("seizure", [
    text.includes("seizure"),
    text.includes("convulsion"),
    text.includes("epilepsy"),
    text.includes("postictal"),
    text.includes("post-ictal")
  ]);

  maybeAdd("tachydysrhythmia", [
    text.includes("svt"),
    text.includes("supraventricular tachycardia"),
    text.includes("tachydysrhythmia"),
    text.includes("palpitation"),
    text.includes("atrial flutter"),
    text.includes("atrial fibrillation"),
    text.includes("rapid heart")
  ]);

  maybeAdd("traumaticHemorrhage", [
    type === "Trauma",
    text.includes("hemorrhage"),
    text.includes("bleeding"),
    text.includes("txa"),
    text.includes("tranexamic"),
    text.includes("tourniquet"),
    text.includes("penetrating")
  ]);

  maybeAdd("hyperkalemia", [
    text.includes("hyperkalemia"),
    text.includes("potassium"),
    text.includes("missed dialysis"),
    text.includes("peaked t"),
    text.includes("renal failure")
  ]);

  maybeAdd("opioidToxicityAndWithdrawal", [
    text.includes("opioid"),
    text.includes("naloxone"),
    text.includes("overdose"),
    text.includes("fentanyl"),
    text.includes("heroin"),
    text.includes("withdrawal")
  ]);

  maybeAdd("emergencyChildbirth", [
    text.includes("labour"),
    text.includes("labor"),
    text.includes("delivery"),
    text.includes("childbirth"),
    text.includes("postpartum"),
    text.includes("obstetric"),
    text.includes("oxytocin")
  ]);

  maybeAdd("rosc", [
    text.includes("rosc"),
    text.includes("post-rosc"),
    text.includes("return of spontaneous circulation"),
    text.includes("post-cardiac arrest")
  ]);

  maybeAdd("cpap", [
    text.includes("cpap"),
    text.includes("continuous positive airway pressure"),
    text.includes("pulmonary edema"),
    type === "Respiratory" && (text.includes("severe") || text.includes("distress"))
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

/**
 * Returns lowercase substrings that must NOT appear in any expectedTreatment
 * or protocolNotes item for this specific case context. Used by post-generation
 * normalization to scrub model hallucinations that survive prompt instructions.
 */
/**
 * Outside PCP scope in Ontario (ALS PCS v5.4 PCP directives). Any expectedTreatment or protocolNotes item
 * naming one of these is removed after generation, for every scenario. Fentanyl is matched only as a treatment
 * so "suspected fentanyl overdose" survives.
 */
export const OUTSIDE_PCP_SCOPE_TERMS = [
  'atropine', 'dopamine', 'norepinephrine', 'amiodarone', 'lidocaine', 'adenosine', 'procainamide',
  'morphine', 'hydromorphone', 'ketamine', 'midazolam', 'diazepam', 'lorazepam',
  'fentanyl iv', 'fentanyl im', 'fentanyl in ', 'fentanyl intranasal', 'administer fentanyl', 'give fentanyl',
  'calcium gluconate', 'calcium chloride', 'sodium bicarbonate', 'magnesium sulfate',
  'cardioversion', 'transcutaneous pacing', 'intubat', 'intraosseous', 'io access', 'iv/io', 'iv or io', 'via io', 'io line', 'cricothyrotomy',
  'needle decompression', 'needle thoracostomy', 'procedural sedation'
];

export function buildForbiddenTreatmentTerms({
  semester,
  type,
  customPrompt = "",
  title = ""
} = {}) {
  const selected = selectDirectiveRuleSets({ semester, type, customPrompt, title });
  const forbidden = new Set(OUTSIDE_PCP_SCOPE_TERMS);

  for (const { ruleSet } of selected) {
    // validationChecks with shouldAvoidAny
    for (const check of ruleSet.validationChecks || []) {
      for (const term of check.shouldAvoidAny || []) {
        forbidden.add(term.toLowerCase());
      }
    }
    // treatmentRules flags
    const tr = ruleSet.treatmentRules || {};
    if (tr.cpapForCopdOnly) forbidden.add('cpap');
    if (tr.calciumGluconateACPOnly) forbidden.add('calcium gluconate');
    if (tr.dexamethasoneNotIndicated || tr.dexamethasoneNotForImmediateRescue) {
      // strip any item that names dexamethasone as an action
      forbidden.add('dexamethasone');
    }
    // doNotCombine pairs: nausea directive and others
    for (const combo of tr.doNotCombine || []) {
      // dimenhydrinate+diphenhydramine: diphenhydramine is forbidden as a standalone replacement
      // but only outside anaphylaxis context where diphenhydramine is a valid secondary treatment
      const comboLower = combo.map(c => c.toLowerCase());
      if (comboLower.includes('dimenhydrinate') && comboLower.includes('diphenhydramine')) {
        const isAnaphylaxisContext = selected.some(({ ruleSet }) => ruleSet.tags?.includes('anaphylaxis'));
        if (!isAnaphylaxisContext) {
          forbidden.add('diphenhydramine');
        }
      }
    }
    // forbiddenCombinations (plural): catch any directives using that field name
    for (const combo of tr.forbiddenCombinations || []) {
      if (combo.length === 1) forbidden.add(combo[0].toLowerCase());
    }
  }

  return [...forbidden];
}