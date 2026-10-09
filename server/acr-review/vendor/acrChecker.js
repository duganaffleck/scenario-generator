// Practice ACR document scripts. ES5 only (Acrobat).
// Every entry point takes the Doc as its first argument: field scripts call acrX(this).

var ACR_CODES = {"proc": {"1": "Clinical Note", "10": "Vital Signs", "20": "Patient Assessment", "20.01": "LAMS Assessment Score", "20.02": "Acute Stroke Protocol Assessment", "20.03": "Clinical Opiate Withdrawal Scale (COWS)", "20.04": "Point-of-Care Risk Assessment", "20.05": "Clinical Frailty Scale", "20.06": "NEWS2 Scale", "25": "Blood Sampling - Glucose Determination", "100": "Dressing", "100.01": "Hemostatic Dressing", "100.02": "Occlusive Dressing", "100.03": "Post-Op Dressing", "100.04": "Povidone Iodine Dressing", "100.05": "Tissue Adhesive", "100.06": "Reinforced Skin Closure Strip", "100.07": "Fixation Sheet", "100.08": "Non-Adherent Dressing", "101": "Control Bleeding", "102": "Arterial Tourniquet", "105": "Immobilization - Head", "109": "Reduction", "109.01": "Patellar Reduction", "110": "Splint Other", "110.01": "Pelvic Binder Device", "111": "Cervical Collar", "112": "Spinal Board", "113": "Spinal Immobilization Extrication Device", "114": "Traction Splint", "115": "Adjustable Break Away Stretcher", "116": "Lifting Chair", "116.01": "Power Lifting Chair", "117": "Patient Lifting Device", "117.01": "Powered Lifting Device", "231": "Pt. Transported Supine", "232": "Pt. Transported Semi-Prone", "233": "Pt. Transported Prone", "234": "Pt. Transported Semi-Sitting", "235": "Pt. Transported Sitting", "236": "Ambulatory", "237": "Pt. Transported Lateral", "238": "Pt. Transported in Isolette", "239": "Infant Restraint Device", "240": "Knee Chest Position", "241": "Exaggerated Sims Position", "120": "Suction", "120.1": "Gastric Port Suctioning", "129": "Oxygen - Filtered High Conc. Mask", "130": "Oxygen - High Conc. Mask", "131": "Oxygen - Simple Face Mask", "132": "Oxygen - Nasal Cannula", "133": "Oxygen - Other", "141": "Oxygen - BVM", "141.1": "Manual Ventilation Feedback Device", "142": "Oxygen - Mechanical Ventilator", "144": "Oxygen - Pocket Mask", "150": "Extricate Patient", "160": "OB Delivery", "160.01": "Delivery of Head", "160.02": "Delivery of Umbilicus", "161": "External Uterine Massage", "161.01": "External Bimanual Compression", "162": "Placental Delivery", "163": "Clamp and Cut Umbilical Cord", "164": "Apgar Score", "165": "Nuchal Cord", "165.01": "Removal of Nuchal Cord", "166": "Shoulder Dystocia", "166.01": "McRoberts Maneuver", "166.02": "Apply Suprapubic Pressure", "166.03": "Gaskin Maneuver", "167": "Breech Presentation", "167.01": "Manual Release of Limbs", "167.02": "Mauriceau Smellie Veit Manoeuver", "168": "Prolapsed Cord Management", "170": "Oro / Nasopharyngeal Airway", "180": "Restrain Patient - Physical", "181": "Spit Hood Application", "190": "Abdo / Chest / Back Thrusts", "211": "Symptom Assist Medication", "318": "Supraglottic/Alternate Airway", "319": "Supraglottic/Alternate Airway Unsuccessful", "320": "Needle Thoracostomy", "321": "Needle Thoracostomy Unsuccessful", "322": "Needle / Surgical Cricothyroidotomy", "323": "Needle / Surgical Cricothyroidotomy Unsuccessful", "324": "Nasotracheal Intubation", "325": "Nasotracheal Intubation Unsuccessful", "326": "Orotracheal Intubation", "327": "Orotracheal Intubation Unsuccessful", "328": "ETT Suctioning", "329": "Tracheostomy Tube Suctioning", "330": "Tracheostomy Tube Reinsertion", "330.01": "Tracheostomy Tube Reinsertion Unsuccessful", "331": "Magill Forceps / Foreign Body Removal", "332": "Magill Forceps / Foreign Body Removal Unsuccessful", "333": "Extubation - Any Advanced Airway (Intentional)", "334": "Extubation - Any Advanced Airway (Unintentional)", "335": "Needle Thoracostomy One-way Valve Monitored", "336": "Respiratory System Eval. (ETCO2 and SAO2)", "337": "ETT Confirmation", "338": "SpO2", "339": "PEEP", "380": "Alternative Airway", "381": "Alternative Airway - Unsuccessful", "382": "Airway Adjunct / Bougie", "383": "CPAP", "384": "CPAP - unsuccessful", "385": "Oro/Nasopharyngeal Swab", "386": "Peak Flow Meter Testing", "297": "Therapeutic Hypothermia", "298": "Defibrillation - Pads On", "298.01": "Pads Placement AL", "298.02": "Pads Placement AP", "299": "Automated CPR Device", "300": "CPR", "301": "Rhythm Interpretation", "302": "Cardioversion", "303": "Valsalva Maneuver", "305": "Defibrillation Dual Sequential", "306": "Defibrillation - Manual", "307": "Defibrillation - Semi-Automated", "308": "Analyze - SAED", "309": "External Pacing", "313": "12-Lead Acquisition", "313.1": "15-Lead Acquisition", "314": "Cardiac Monitor Disconnected", "316": "Return of Spontaneous Circulation", "317": "Return of Spontaneous Resp.", "340": "IV Monitoring", "341": "IV Cannulation", "342": "Lock", "345": "Normal Saline", "349": "Other IV Solutions", "350": "IV Cannulation Unsuccessful", "351": "Fluid Bolus", "353": "Blood Sampling", "355": "IV Discontinued (Intentional)", "356": "IV Discontinued (Unintentional)", "358": "Intraosseous Cannulation Successful", "359": "Intraosseous Cannulation Unsuccessful", "360": "Blood / Blood Product Administration", "361": "CVAD Access", "362": "Subcutaneous Cannulation Successful", "363": "Subcutaneous Cannulation Unsuccessful", "364": "Subcut. Cannulation Discontinued (Intentional)", "365": "Subcut. Cannulation Discontinued (Unintentional)", "366": "Termination of Resuscitation Medical", "367": "Termination of Resuscitation Trauma", "368": "Withhold Resuscitation Order", "370": "Other Procedure (Detail in Procedures)", "372": "Carboxyhemoglobin (SpCO)", "375": "Emerg. Dialysis Disconnect", "376": "Electronic Control Device Removal", "387": "Patient Education", "390": "Transfer of Care - Crew to Crew", "391": "Triage Report", "395": "Aid to Capacity Assessment", "396": "Consent to Care Plan", "400": "Base Hospital Physician Patch", "401": "Receiving Hospital Notified", "401.1": "Sepsis Pre-Alert / Notification", "401.2": "Trauma Notification", "401.3": "Stroke Notification", "401.4": "STEMI Notification", "402": "BHP Patch Failure (Detail in Results)", "403": "BHP Patch - No BHP Contact", "404": "Coroner Notified", "405": "Consult", "405.01": "Consult - PCI Centre", "405.02": "Consult - Stroke Centre", "405.03": "Consult - Mental Health Professional", "405.04": "Consult - Patient's Healthcare Professional", "406": "Non Dialysis - CVAD Disconnect", "407": "Health Screening Tool", "407.1": "Medication Administration Record (MAR) Received", "407.02": "COVID-19 Screening POSITIVE", "407.03": "COVID-19 Screening NEGATIVE", "407.04": "Discharge Screening Hypoglycemia", "407.05": "Discharge Screening Seizures", "407.06": "Discharge Screening Tachydysrhythmia", "407.07": "Discharge Screening", "408": "Personal Protective Equipment (PPE)", "408.1": "PPE - Not Required", "408.2": "PPE - Routine Practice", "408.3": "PPE - Contact/Droplet Precautions", "408.4": "PPE - Airborne Precautions", "408.5": "PPE - Health and Safety: Vest / Helmet", "420.01": "Medication Wastage - Diazepam", "420.02": "Medication Wastage - Fentanyl", "420.03": "Medication Wastage - Ketamine", "420.04": "Medication Wastage - Midazolam", "420.05": "Medication Wastage - Morphine", "420.06": "Medication Wastage - Hydromorphone", "420.07": "Medication Wastage - Lorazepam", "420.08": "Medication Wastage - Buprenorphine/Naloxone", "421.01": "Referral - Trillium Gift of Life Network", "422.01": "Alternate Destination Consent - OBTAINED", "422.02": "Alternate Destination Consent - DECLINED", "422.03": "Alternate Destination Patch - ACCEPTED", "422.04": "Alternate Destination Patch - DECLINED", "422.05": "Alternate Destination Patch - FAILED", "422.06": "Alternate Destination - Not Available", "423": "Naloxone Kit Distribution", "424": "Referral", "424.01": "Referral Consent - Obtained", "424.02": "Referral Consent - Declined", "424.03": "Referral Healthcare Provider/Facility - Accepted", "424.04": "Referral Healthcare Provider/Facility - Declined", "424.05": "Referral Healthcare Provider/Facility - Failed", "425.01": "Discharge Consent - Obtained", "425.02": "Discharge Consent - Declined", "430.01": "Fit2Sit", "933": "Study Procedure (933.x sub-codes: see ontario.ca)", "498": "Acetaminophen", "500": "Adenosine", "502": "Amiodarone", "503": "Antibiotic", "503.01": "Amoxicillin", "503.02": "Cefuroxime", "503.03": "Trimethoprim/Sulfamethoxazole", "503.04": "Moxifloxacin", "503.05": "Nitrofurantoin", "503.06": "Ceftriaxone", "503.07": "Cefazolin", "503.08": "Antibiotic - Ointment", "503.09": "Cephalexin", "504": "ASA", "505": "Atropine", "525": "Calcium Gluconate", "528": "Dextrose D10W", "529": "Dextrose D25W", "530": "Dextrose D50W", "531": "Diazepam", "533": "Dimenhydrinate", "534": "Diphenhydramine", "536": "Dopamine", "537": "Dexamethasone", "540": "Epinephrine 1:1,000", "541": "Epinephrine 1:10,000", "550": "Fentanyl", "551": "Furosemide", "560": "Glucagon", "561": "Glucose - Oral", "562": "Hydroxocobalamin", "565": "Haloperidol", "593": "Lidocaine", "602": "Ketamine", "603": "Midazolam", "604": "Morphine", "607": "Hydromorphone", "610": "Naloxone", "611": "Buprenorphine/Naloxone", "615": "Nitroglycerin", "620": "Oxytocin", "650": "Salbutamol", "651": "Sodium Bicarbonate", "682": "Xylometazoline", "700": "Other Drugs - Detail in Procedures", "701": "Anaesthetic Eye Drops", "704": "Ibuprofen", "706": "Ketorolac", "708": "Obidoxime", "710": "Pralidoxime Chloride", "711": "Hydrocortisone", "712": "Sodium Thiosulfate", "713": "Glycopyrrolate", "728": "Ondansetron", "729": "Electrolyte - Potassium Elixir", "730": "Lorazepam", "731": "Immunization", "731.01": "Tetanus", "732": "Tranexamic Acid"}, "routes": {"AE": "Aerosol", "BU": "Buccal", "ET": "Endotracheal", "IH": "Inhaled", "IM": "Intramuscular", "IN": "Intranasal", "IO": "Intraosseous", "IV": "Intravenous", "NB": "Nebulized", "PO": "Oral", "PR": "Rectal", "SC": "Subcutaneous", "SL": "Sublingual", "TO": "Topical"}, "rhythm": {"10": "Sinus Tachycardia", "11": "PSVT / SVT / Atrial Tachycardia", "12": "Atrial Flutter", "13": "Atrial Fibrillation", "14": "Ventricular Tachycardia", "20": "Sinus Bradycardia", "21": "First Degree Block", "22": "Second Degree Block", "23": "Third Degree Block", "30": "Ventricular Fibrillation", "31": "Pulseless Ventricular Tachycardia", "32": "PEA", "33": "Asystole", "40": "NSR", "42": "Paced Rhythm", "43": "Junctional Rhythm", "44": "Sinus Dysrhythmia", "46": "Other (Detail in Procedures)"}, "problem": {"1": "Cardiac / Medical", "2": "Traumatic", "11": "Obstruction (Partial/Complete)", "21": "Dyspnea", "24": "Respiratory Arrest", "31": "Hemorrhage", "32": "Hypertension", "33": "Hypotension", "34": "Suspected Sepsis", "40": "Traumatic Brain Injury", "41": "Stroke / TIA", "42": "Temp. Loss of Consciousness", "43": "Altered Level of Consciousness", "44": "Headache", "45": "Behaviour / Psychiatric", "45.01": "Excited Delirium", "46": "Active Seizure", "47": "Paralysis / Spinal Trauma", "48": "Confusion / Disorientation", "49": "Unconscious", "50": "Post-ictal", "51": "Ischemic", "53": "Palpitations", "54": "Pulmonary Edema", "55": "Post Arrest", "56": "Cardiogenic Shock", "57": "STEMI", "58": "Hyperkalemia", "60": "Non Ischemic Chest Pain", "61": "Abdominal / Pelvic / Perineal / Rectal Pain", "61.1": "Renal Colic", "61.2": "Suspected UTI", "62": "Back Pain", "63": "Nausea / Vomiting / Diarrhea", "65": "Integumentary", "65.1": "Skin Tear", "66": "Musculoskeletal", "67": "Trauma / Injury", "71": "Obstetrical Emergency", "72": "Gynecological Emergency", "73": "Newborn / Neonatal", "81": "Drug / Alcohol Overdose", "81.1": "Suspected Opioid Overdose", "81.2": "Alcohol Intoxication", "81.3": "Drug Overdose", "82": "Poisoning / Toxic Exposure", "83": "Diabetic Emergency", "84": "Allergic Reaction", "85": "Anaphylaxis", "86": "Adrenal Crisis", "87": "Novel Medications", "88": "Home Medical Technology", "89": "Lift Assist", "90": "Inter-facility Transfer", "91": "Environmental Emergency", "92": "Weakness / Dizziness / Unwell", "93": "Treatment / Diagnosis & Return", "94": "Convalescent / Invalid / Return Home", "95": "Infectious Disease", "96": "Organ Retrieval / Transfer", "98": "Organ Recipient", "99": "Other Medical / Trauma (see remarks)", "99.15": "No Complaint"}};
var ACR_WHITE_FIELDS = {"Service #": 1, "CACC/ACS": 1, "Call Number": 1, "Call Date": 1, "Date of birth": 1, "Health Insurance Number": 1, "Version Code": 1, "Date of Occurrence": 1, "Time of Occurrence": 1, "DNR confirmation number": 1, "Location 1": 1, "Type 1": 1, "Mechanism 1": 1, "Location 2": 1, "Type 2": 1, "Mechanism 2": 1, "Location 3": 1, "Type 3": 1, "Mechanism 3": 1, "Arrest witnessed date": 1, "Arrest witnessed Time": 1, "CPR started Date": 1, "CPR Started Time": 1, "First shock Date": 1, "First Shock Time": 1, "Date5_TOR": 1, "Time5_TOR": 1, "Vehicle Number": 1, "Station": 1, "Status": 1, "Hospital Number": 1, "UTM Code": 1, "Dispatch #": 1, "Return #": 1, "Patient #": 1, "Sequence": 1, "Base Hospital Number": 1, "Patch Log Number": 1, "Call Received HH  MM  SS": 1, "Crew Notified HH  MM  SS": 1, "Crew Mobile HH  MM  SS": 1, "Arrive Scene HH  MM  SS": 1, "Patient Contact HH  MM  SS": 1, "Depart Scene HH  MM  SS": 1, "Arrive Destination HH  MM  SS": 1, "TOC  HH  MM  SS": 1, "Crew 1 Number (Attending)": 1, "Crew 2 Number": 1, "Crew 3 Number": 1, "Crew 4 Number": 1, "Date of ACR Completion": 1, "Time of ACR Completion HH  MM  SS": 1, "Treatment Row 1 - Procedure Line": 1, "Treatment Row 1 - Result Line": 1, "Treatment Row 2 - Procedure Line": 1, "Treatment Row 2 - Result Line": 1, "Treatment Row 3 - Procedure Line": 1, "Treatment Row 3 - Result Line": 1, "Treatment Row 4 - Procedure Line": 1, "Treatment Row 4 - Result Line": 1, "Treatment Row 5 - Procedure Line": 1, "Treatment Row 5 - Result Line": 1, "Treatment Row 6 - Procedure Line": 1, "Treatment Row 6 - Result Line": 1, "Treatment Row 7 - Procedure Line": 1, "Treatment Row 7 - Result Line": 1, "Treatment Row 8 - Procedure Line": 1, "Treatment Row 8 - Result Line": 1, "Treatment Row 9 - Procedure Line": 1, "Treatment Row 9 - Result Line": 1, "Treatment Row 10 - Procedure Line": 1, "Treatment Row 10 - Result Line": 1, "Treatment Row 11 - Procedure Line": 1, "Treatment Row 11 - Result Line": 1, "Treatment Row 12 - Procedure Line": 1, "Treatment Row 12 - Result Line": 1, "Treatment Row 13 - Procedure Line": 1, "Treatment Row 13 - Result Line": 1, "Treatment Row 14 - Procedure Line": 1, "Treatment Row 14 - Result Line": 1, "Treatment Row 15 - Procedure Line": 1, "Treatment Row 15 - Result Line": 1, "Treatment Row 16 - Procedure Line": 1, "Treatment Row 16 - Result Line": 1, "Treatment Row 17 - Procedure Line": 1, "Treatment Row 17 - Result Line": 1, "Treatment Row 18 - Procedure Line": 1, "Treatment Row 18 - Result Line": 1, "Treatment Row 19 - Procedure Line": 1, "Treatment Row 19 - Result Line": 1, "Treatment Row 20 - Procedure Line": 1, "Treatment Row 20 - Result Line": 1, "Treatment Row 21 - Procedure Line": 1, "Treatment Row 21 - Result Line": 1, "Treatment Row 22 - Procedure Line": 1, "Treatment Row 22 - Result Line": 1, "Treatment Row 23 - Procedure Line": 1, "Treatment Row 23 - Result Line": 1, "Treatment Row 24 - Procedure Line": 1, "Treatment Row 24 - Result Line": 1, "Treatment Row 25 - Procedure Line": 1, "Treatment Row 25 - Result Line": 1, "Treatment Row 26 - Procedure Line": 1, "Treatment Row 26 - Result Line": 1, "Treatment Row 27 - Procedure Line": 1, "Treatment Row 27 - Result Line": 1, "Treatment Row 28 - Procedure Line": 1, "Treatment Row 28 - Result Line": 1, "Treatment Row 29 - Procedure Line": 1, "Treatment Row 29 - Result Line": 1, "Treatment Row 30 - Procedure Line": 1, "Treatment Row 30 - Result Line": 1, "Treatment Row 31 - Procedure Line": 1, "Treatment Row 31 - Result Line": 1, "Treatment Row 32 - Procedure Line": 1, "Treatment Row 32 - Result Line": 1, "Treatment Row 33 - Procedure Line": 1, "Treatment Row 33 - Result Line": 1, "Treatment Row 34 - Procedure Line": 1, "Treatment Row 34 - Result Line": 1, "Treatment Row 35 - Procedure Line": 1, "Treatment Row 35 - Result Line": 1, "Treatment Row 36 - Procedure Line": 1, "Treatment Row 36 - Result Line": 1, "Treatment Row 37 - Procedure Line": 1, "Treatment Row 37 - Result Line": 1, "Treatment Row 38 - Procedure Line": 1, "Treatment Row 38 - Result Line": 1, "Treatment Row 39 - Procedure Line": 1, "Treatment Row 39 - Result Line": 1, "Treatment Row 40 - Procedure Line": 1, "Treatment Row 40 - Result Line": 1, "Treatment Row 41 - Procedure Line": 1, "Treatment Row 41 - Result Line": 1, "Treatment Row 42 - Procedure Line": 1, "Treatment Row 42 - Result Line": 1, "Treatment Row 43 - Procedure Line": 1, "Treatment Row 43 - Result Line": 1, "Treatment Row 44 - Procedure Line": 1, "Treatment Row 44 - Result Line": 1, "Treatment Row 45 - Procedure Line": 1, "Treatment Row 45 - Result Line": 1, "Treatment Row 46 - Procedure Line": 1, "Treatment Row 46 - Result Line": 1, "Treatment Row 47 - Procedure Line": 1, "Treatment Row 47 - Result Line": 1, "Treatment Row 48 - Procedure Line": 1, "Treatment Row 48 - Result Line": 1, "Treatment Row 49 - Procedure Line": 1, "Treatment Row 49 - Result Line": 1, "Treatment Row 50 - Procedure Line": 1, "Treatment Row 50 - Result Line": 1, "Treatment Row 51 - Procedure Line": 1, "Treatment Row 51 - Result Line": 1, "Treatment Row 52 - Procedure Line": 1, "Treatment Row 52 - Result Line": 1, "Patient or SDM Signature Time": 1, "Patient or SDM Signature Date": 1, "Attending Paramedic Signature Time": 1, "Attending Paramedic Signature Date": 1, "Non-paramedic Witness Signature Time": 1, "Non-paramedic Witness Signature Date": 1};
var ACR_ALWAYS_READONLY = {"Tools Title": 1, "Submitted Stamp": 1, "Full Line Hint": 1, "Across Hint P": 1, "Across Hint R": 1, "Cont Call Number": 1, "Cont Page Number": 1, "Cont Total Pages": 1, "Full Line Hint C": 1, "Across Hint P C": 1, "Across Hint R C": 1, "Review - Call Number": 1, "Review - Call Intervals": 1, "Review - Vitals Trend": 1, "Review - Check Results": 1, "Treatment Page Number": 1, "Treatment Total Pages": 1};
var ACR_UNLOCK_CODE = "UNLOCK";
var ACR_HL = ["RGB", 1, 0.93, 0.55];
var ACR_COLS = ["Dose/Unit", "Route", "Pulse", "Resp", "BP", "Temp", "Reading/Code", "SpO2", "EtCO2", "GCS", "Pupil R", "Pupil L", "Pain"];
var ACR_ROWS = 52;
// Each row can be written across on either half of the grid, or both:
// P, the procedure side (Dose/Unit to Temp), and R, the Results side (Reading/Code to Pain Scale).
var ACR_SIDES = {
  P: { box: "Procedure Across", line: "Procedure Line", cols: ["Dose/Unit", "Route", "Pulse", "Resp", "BP", "Temp"], label: "Dose/Unit and Temp", name: "procedure side" },
  R: { box: "Result Across", line: "Result Line", cols: ["Reading/Code", "SpO2", "EtCO2", "GCS", "Pupil R", "Pupil L", "Pain"], label: "Reading/Code and Pain Scale", name: "Results side" }
};
var ACR_EVENTS = [
  ["Call Received HH  MM  SS", "Call Received"], ["Crew Notified HH  MM  SS", "Crew Notified"],
  ["Crew Mobile HH  MM  SS", "Crew Mobile"], ["Arrive Scene HH  MM  SS", "Arrive Scene"],
  ["Patient Contact HH  MM  SS", "Patient Contact"], ["Depart Scene HH  MM  SS", "Depart Scene"],
  ["Arrive Destination HH  MM  SS", "Arrive Destination"], ["TOC  HH  MM  SS", "Transfer of Care"]
];
var acrHighlighted = [];

// ------------------------------------------------------------------ small helpers
function acrF(doc, n) { return doc.getField(n); }
function acrV(doc, n) { var f = doc.getField(n); if (!f) return ""; var v = f.valueAsString; return (v === undefined || v === null) ? "" : String(v).replace(/^\s+|\s+$/g, ""); }
function acrOn(doc, n) { var f = doc.getField(n); return !!f && f.valueAsString !== "Off" && f.valueAsString !== ""; }
function acrPad(n) { return (n < 10 ? "0" : "") + n; }
function acrMin(t) { var m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(t || "").replace(/^(~|approx\.?)\s*/i, "")); return m ? (+m[1]) * 60 + (+m[2]) + (m[3] ? (+m[3]) / 60 : 0) : null; }
function acrIsNone(t) { return /^(none|nil|n\/a|na|nka|nkda|no|-)?\.?$/i.test(t); }
function acrAge(doc) {
  var m = /^(~)?(\d{1,3})\s*([YMD])?$/i.exec(acrV(doc, "Age"));
  return m ? { n: +m[2], unit: (m[3] || "").toUpperCase(), est: !!m[1] } : null;
}
function acrRowName(i, k) { return "Treatment Row " + i + " - " + k; }
function acrLower(s) { return String(s || "").toLowerCase(); }

function acrRow(doc, i) {
  // v3.3 and earlier had one line across the whole row ("Line", "Full Line"). Read it as the procedure side.
  var legacyOn = acrOn(doc, acrRowName(i, "Full Line")), legacy = acrV(doc, acrRowName(i, "Line"));
  var r = { i: i, time: acrV(doc, acrRowName(i, "Time")), code: acrV(doc, acrRowName(i, "Procedure Code")),
            crew: acrV(doc, acrRowName(i, "Crew Member Number")),
            procLine: acrV(doc, acrRowName(i, "Procedure Line")) || legacy, resultLine: acrV(doc, acrRowName(i, "Result Line")),
            procAcross: acrOn(doc, acrRowName(i, "Procedure Across")) || legacyOn, resultAcross: acrOn(doc, acrRowName(i, "Result Across")) };
  r.line = r.procLine && r.resultLine ? r.procLine + ", " + r.resultLine : (r.procLine || r.resultLine);
  r.fullLine = r.procAcross || r.resultAcross;
  for (var c = 0; c < ACR_COLS.length; c++) r[ACR_COLS[c]] = acrV(doc, acrRowName(i, ACR_COLS[c]));
  r.hasVitals = !!(r["Pulse"] || r["BP"] || r["Resp"] || r["SpO2"]) || /\b(hr|bp|rr|spo2|pulse)\b/i.test(r.line);
  r.used = !!(r.time || r.code || r.line || r.crew);
  for (c = 0; c < ACR_COLS.length; c++) if (r[ACR_COLS[c]]) r.used = true;
  return r;
}
// A row the text carried on to from the row above is part of that entry, not an entry of its own: its words join
// the row above. It counts only when it looks exactly like a carry: written across, no time, code, crew or columns,
// and the same side of the row above is full (its text plus this row's first word wouldn't have fit). A new entry
// that's only missing its time and code, under a short line, is still flagged.
function acrLineFull(prevText, nextText, side) {
  var room = ACR_LINE_ROOM[side], first = String(nextText || "").split(/\s+/)[0] || "";
  if (!prevText) return false;
  return acrTextWidth(prevText + " mmm") > room || acrTextWidth(prevText + " " + first) > room;
}
function acrIsCarry(r, above) {
  if (!above || !r.fullLine || r.time || r.code || r.crew || !r.line) return false;
  for (var c = 0; c < ACR_COLS.length; c++) if (r[ACR_COLS[c]]) return false;
  if (r.procLine && !acrLineFull(above.procLine, r.procLine, "P")) return false;
  if (r.resultLine && !acrLineFull(above.resultLine, r.resultLine, "R")) return false;
  return true;
}
function acrRows(doc) {
  var out = [], above = null;
  for (var i = 1; i <= ACR_ROWS; i++) {
    var r = acrRow(doc, i), last = out[out.length - 1], raw = above;
    above = r;  // the row directly above the next one, as written (before any joining)
    if (!r.used) continue;
    if (last && acrIsCarry(r, raw) && last.i + (last.carried || 0) === i - 1) {
      if (r.procLine) last.procLine = last.procLine ? last.procLine + " " + r.procLine : r.procLine;
      if (r.resultLine) last.resultLine = last.resultLine ? last.resultLine + " " + r.resultLine : r.resultLine;
      last.line = last.procLine && last.resultLine ? last.procLine + ", " + last.resultLine : (last.procLine || last.resultLine);
      last.hasVitals = last.hasVitals || /\b(hr|bp|rr|spo2|pulse)\b/i.test(last.line);
      last.carried = (last.carried || 0) + 1;
      continue;
    }
    out.push(r);
  }
  return out;
}
// Codes follow the current Ontario list (ontario.ca, ACR codes): 10 not 010, and decimal sub-codes such as 401.4.
function acrNormCode(code) { return String(code || "").replace(/\s/g, "").replace(/^0+(?=\d)/, ""); }
function acrIsCode(code, list) { var c = acrNormCode(code); for (var k = 0; k < list.length; k++) if (c === list[k]) return true; return false; }
function acrIsMed(code) { var c = acrNormCode(code), n = parseFloat(c); return /^\d{3}(\.\d{1,2})?$/.test(c) && ((n >= 498 && n < 733) || c === "211"); }
function acrIsO2(code) { return acrIsCode(code, ["129", "130", "131", "132", "133", "141", "142", "144"]); }
function acrCodeName(code) {
  var c = acrNormCode(code);
  if (ACR_CODES.proc[c]) return ACR_CODES.proc[c];
  if (/^933(\.\d{1,2})?$/.test(c)) return "Study Procedure";
  var n = parseFloat(c);
  return (n >= 900 && n <= 999) ? "User defined" : "";
}
function acrNarrative(doc) {
  return [acrV(doc, "Incident Hx"), acrV(doc, "Remarks"), acrV(doc, "Remarks 2"), acrV(doc, "Remarks 3"),
          acrV(doc, "General Appearance Details"), acrV(doc, "Chest Exam Details"), acrV(doc, "Head/Neck")].join(" \n ");
}
// A write-across line can carry the dose and route: "160 mg PO, chewed and swallowed".
var ACR_DOSE_IN_LINE = /\d[\d.,]*\s*(mcg\/kg|mg\/kg|ml\/hr|l\/min|lpm|mcg|mg|g|ml|l|units?|meq|mmol|puffs?|sprays?|tabs?|%)(?![a-z])/i;
function acrLineRoute(line) {
  var t = String(line || "").split(/[^A-Za-z]+/);
  for (var k = 0; k < t.length; k++) {
    var up = t[k].toUpperCase();
    if (!ACR_CODES.routes[up]) continue;
    if ((up === "IN" || up === "TO" || up === "ET") && t[k] !== up) continue;   // ordinary words unless written in capitals
    return up;
  }
  return "";
}
function acrAllRowText(doc) { var t = [], rs = acrRows(doc); for (var k = 0; k < rs.length; k++) t.push(rs[k].line); return t.join(" "); }

// ------------------------------------------------------------------ field validators (called from field scripts)
function acrValidateCode(event) {
  var v = String(event.value || "").replace(/\s/g, "");
  if (v === "") return;
  event.value = v;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(v)) { app.alert("Procedure codes are numbers, some with a decimal sub-code (10, 504, 401.4). The list is on pages 4 and 5."); event.rc = false; return; }
  if (!acrCodeName(v)) app.alert("Code " + v + " isn't on the current Ontario code list (pages 4 and 5). Check it before you move on.", 1);
}
function acrValidateAge(event) {
  var v = String(event.value || "").replace(/^\s+|\s+$/g, "");
  if (v === "" || /^cno$/i.test(v)) { event.value = v.toUpperCase(); return; }
  var m = /^(~|approx\.?\s*)?(\d{1,3})\s*([ymd])?$/i.exec(v);
  if (!m) { app.alert("Enter the age as a number with its unit, for example 64 Y, 8 M or 12 D. Estimated: ~85 Y."); event.rc = false; return; }
  if (!m[3]) { app.alert("Add the age unit: Y for years, M for months, D for days (under 1 month use D, 1 month to 2 years use M). For example 64 Y."); event.rc = false; return; }
  event.value = (m[1] ? "~" : "") + m[2] + " " + m[3].toUpperCase();
}
function acrValidateDob(event) {
  var v = String(event.value || "").replace(/\s/g, "");
  if (v === "" || /^cno$/i.test(v)) { event.value = v.toUpperCase(); return; }
  if (/^\d{4}$/.test(v)) return;
  var m = /^(\d{4})[\/\-\.]?(\d{1,2})[\/\-\.]?(\d{1,2})$/.exec(v), ok = false, y, mo, dd;
  if (m) { y = +m[1]; mo = +m[2]; dd = +m[3]; var dt = new Date(y, mo - 1, dd); ok = dt.getFullYear() == y && dt.getMonth() == mo - 1 && dt.getDate() == dd; }
  if (!ok) { app.alert("Enter the date of birth as YYYY/MM/DD, or just the 4-digit year if that's all you have."); event.rc = false; return; }
  event.value = y + "/" + acrPad(mo) + "/" + acrPad(dd);
}
function acrValidateTime(event) {
  var v = String(event.value || "").replace(/\s/g, "");
  if (v === "") return;
  var est = /^(~|approx\.?)/i.test(v);
  var m = /^(\d{1,2}):?(\d{2})$/.exec(v.replace(/^(~|approx\.?)/i, ""));
  if (!m || +m[1] > 23 || +m[2] > 59) { app.alert("Enter 24-hour time as HH:MM, for example 19:52 (1952 also works). Put ~ in front of an estimated time."); event.rc = false; return; }
  event.value = (est ? "~" : "") + acrPad(+m[1]) + ":" + m[2];
}
function acrValidateDate(event) {
  var v = String(event.value || "").replace(/\s/g, "");
  if (v === "") return;
  var m = /^(\d{4})[\/\-\.]?(\d{1,2})[\/\-\.]?(\d{1,2})$/.exec(v), ok = false, y, mo, dd;
  if (m) { y = +m[1]; mo = +m[2]; dd = +m[3]; var dt = new Date(y, mo - 1, dd); ok = dt.getFullYear() == y && dt.getMonth() == mo - 1 && dt.getDate() == dd; }
  if (!ok) { app.alert("Enter the date as YYYY/MM/DD, for example 2026/09/24."); event.rc = false; return; }
  event.value = y + "/" + acrPad(mo) + "/" + acrPad(dd);
}
function acrValidateTimeSec(event) {
  var v = String(event.value || "").replace(/\s/g, "");
  if (v === "") return;
  var m = /^(\d{1,2}):?(\d{2})(?::?(\d{2}))?$/.exec(v);
  if (!m || +m[1] > 23 || +m[2] > 59 || (m[3] && +m[3] > 59)) { app.alert("Enter 24-hour time as HH:MM:SS, for example 19:44:10 (194410 also works)."); event.rc = false; return; }
  event.value = acrPad(+m[1]) + ":" + m[2] + (m[3] ? ":" + m[3] : "");
}
function acrValidateDose(event) {
  var v = String(event.value || "").replace(/^\s+|\s+$/g, "");
  if (v === "") return;
  if (/^[\d.,\s]+$/.test(v)) { app.alert("Add the unit so nobody has to guess, for example 160 mg, 0.4 mg or 10 L/min."); event.rc = false; }
}
function acrValidateRoute(event) {
  var v = String(event.value || "").replace(/\s/g, "").toUpperCase();
  if (v === "") return;
  event.value = v;
  if (!ACR_CODES.routes[v]) app.alert("\"" + v + "\" isn't a route code. The list is on page 5: SL, PO, IM, IN, IV, NB, IH, and so on.", 1);
}
// Crew numbers: 1 to 4 from the crew list, more than one separated by commas. "1 2", "1/2", "1&2" and "12" all become 1,2.
function acrValidateCrew(event) {
  var v = String(event.value || "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  if (v === "") return;
  var parts = /^[1-4]+$/.test(v) ? v.split("") : v.split(/[\s,\/&+;.\-]+/), seen = {}, out = [];
  for (var k = 0; k < parts.length; k++) {
    if (parts[k] === "") continue;
    if (!/^[1-4]$/.test(parts[k])) { app.alert("Crew member numbers are 1 to 4, from the crew list on page 2. For more than one, separate them with a comma: 1,2."); event.rc = false; return; }
    if (!seen[parts[k]]) { seen[parts[k]] = 1; out.push(parts[k]); }
  }
  event.value = out.join(",");
}

function acrNow(doc, withSeconds) {
  var d = new Date(), t = acrPad(d.getHours()) + ":" + acrPad(d.getMinutes());
  return withSeconds ? t + ":" + acrPad(d.getSeconds()) : t;
}

// ------------------------------------------------------------------ write-across toggles (P and R boxes in the margin)
function acrToggleLine(doc, i, side) {
  var S = ACR_SIDES[side === "R" ? "R" : "P"], p = "Treatment Row " + i + " - ", k;
  var box = doc.getField(p + S.box), line = doc.getField(p + S.line);
  if (box.valueAsString !== "Off") {
    var used = false;
    for (k = 0; k < S.cols.length; k++) if (acrV(doc, p + S.cols[k]) !== "") used = true;
    if (used) { app.alert("This row already has entries between " + S.label + ". Clear them first, then tick the box to write across the " + S.name + "."); box.value = "Off"; return; }
    for (k = 0; k < S.cols.length; k++) doc.getField(p + S.cols[k]).display = display.hidden;
    line.display = display.visible; line.setFocus();
  } else {
    if (acrV(doc, p + S.line) !== "") { app.alert("The " + S.name + " of this row has text on it. Clear it first, then untick the box to go back to the columns."); box.value = "Yes"; return; }
    line.display = display.hidden;
    for (k = 0; k < S.cols.length; k++) doc.getField(p + S.cols[k]).display = display.visible;
  }
}

// ------------------------------------------------------------------ write-across lines carry on to the next row
// The text stays one size (ACR_LINE_PT). When a line is full, the words carry on to the line of the row below:
// its box is ticked and its columns hidden, and the next procedure starts on the row after that.
// Helvetica widths (thousandths of the font size) for printable ASCII, so the form can tell when a line is full.
var ACR_LINE_PT = 8;
var ACR_HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,
  278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,
  944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,
  278,556,500,722,500,500,500,334,260,334,584];
function acrTextWidth(s) {
  var w = 0;
  for (var k = 0; k < s.length; k++) { var c = s.charCodeAt(k); w += (c >= 32 && c <= 126) ? ACR_HELV[c - 32] : 600; }
  return w * ACR_LINE_PT / 1000;
}
// The usable width of a write-across line, in points: the procedure side is 191.6 wide, the Results side 159.8.
var ACR_LINE_ROOM = { P: 186.6, R: 154.8 };
function acrLineRoom(f) { var r = f && f.rect; return r ? Math.abs(r[2] - r[0]) - 5 : ACR_LINE_ROOM[/Result/.test(f && f.name) ? "R" : "P"]; }
function acrFits(f, s) { return acrTextWidth(s) <= acrLineRoom(f); }
// What fits on this line, and the rest. Breaks at a space where it can.
function acrSplitLine(f, s) {
  s = String(s || "");
  if (acrFits(f, s)) return [s, ""];
  var cut = s.length;
  while (cut > 1 && !acrFits(f, s.slice(0, cut))) cut--;
  var sp = s.lastIndexOf(" ", cut);
  if (sp > cut * 0.4) cut = sp;
  return [s.slice(0, cut).replace(/\s+$/, ""), s.slice(cut).replace(/^\s+/, "")];
}
// A row the words can carry on to: no time, no code, no crew, nothing in that side's columns. Its line may already
// hold the carried-on end of this same entry.
function acrRowFree(doc, i, side) {
  var S = ACR_SIDES[side], p = "Treatment Row " + i + " - ";
  if (i > ACR_ROWS || !doc.getField(p + S.line)) return false;
  if (acrV(doc, p + "Time") || acrV(doc, p + "Procedure Code") || acrV(doc, p + "Crew Member Number")) return false;
  for (var k = 0; k < S.cols.length; k++) if (acrV(doc, p + S.cols[k]) !== "") return false;
  return true;
}
function acrOpenLine(doc, i, side) {
  var S = ACR_SIDES[side], p = "Treatment Row " + i + " - ";
  doc.getField(p + S.box).value = "Yes";
  for (var k = 0; k < S.cols.length; k++) doc.getField(p + S.cols[k]).display = display.hidden;
  var line = doc.getField(p + S.line);
  line.display = display.visible;
  return line;
}
// Lay text (plus whatever the rows below already carry) down from row i. Plans first, writes only if it all fits.
function acrCarry(doc, i, side, text) {
  var S = ACR_SIDES[side], plan = [], n = i, rest = text;
  while (rest) {
    if (!acrRowFree(doc, n, side)) return false;
    var f = doc.getField("Treatment Row " + n + " - " + S.line), had = acrV(doc, "Treatment Row " + n + " - " + S.line);
    var parts = acrSplitLine(f, had ? rest + " " + had : rest);
    plan.push([n, parts[0]]);
    rest = parts[1];
    n++;
  }
  for (var k = 0; k < plan.length; k++) acrOpenLine(doc, plan[k][0], side).value = plan[k][1];
  return true;
}
// Keystroke (and Validate) script on each write-across line: acrLineKey(this, event, row, "P" or "R").
function acrLineKey(doc, ev, i, side) {
  var f = ev.target;
  if (ev.name === "Keystroke" && !ev.willCommit) {
    // Typing at the end of a full line: the space that would start the next word starts the next row instead.
    if (ev.change === " " && ev.selStart === ev.selEnd && ev.selStart === String(ev.value).length
        && !acrFits(f, ev.value + " mmm") && acrRowFree(doc, i + 1, side)
        && acrV(doc, "Treatment Row " + (i + 1) + " - " + ACR_SIDES[side].line) === "") {
      ev.change = "";
      acrOpenLine(doc, i + 1, side).setFocus();
    }
    return;
  }
  // Leaving the line, or pasting into it: whatever doesn't fit carries on down.
  var v = String(ev.value || "");
  if (acrFits(f, v)) return;
  var parts = acrSplitLine(f, v);
  if (acrCarry(doc, i + 1, side, parts[1])) ev.value = parts[0];
  else app.alert("Row " + i + ": this doesn't fit on one line, and the row below is already in use. Shorten it, or leave the next row empty so it can carry on there.", 3);
}

// ------------------------------------------------------------------ highlights
function acrHighlight(doc, n) {
  var f = doc.getField(n); if (!f) return;
  try { f.fillColor = ACR_HL; acrHighlighted.push(n); } catch (e) {}
}
function acrClearHighlights(doc) {
  for (var k = 0; k < acrHighlighted.length; k++) {
    var f = doc.getField(acrHighlighted[k]);
    if (f) { try { f.fillColor = ACR_WHITE_FIELDS[acrHighlighted[k]] ? color.white : color.transparent; } catch (e) {} }
  }
  acrHighlighted = [];
}

// ------------------------------------------------------------------ the checker
function acrProblemGroup(code, doc) {
  var c = acrNormCode(code);
  var txt = acrLower(acrV(doc, "Primary Problem"));
  if (/^(1|2)$/.test(c)) return "arrest";
  if (/^(51|53|54|55|56|57|58|60)$/.test(c)) return "cardiac";
  if (/^(11|21|24)$/.test(c)) return "resp";
  if (/^83/.test(c)) return "diabetic";
  if (c === "41") return "stroke";
  if (/^(46|50)$/.test(c)) return "seizure";
  if (/^(42|43|48|49)$/.test(c)) return "loc";
  if (/^(81|82)/.test(c)) return "tox";
  if (/^(84|85)$/.test(c)) return "allergy";
  if (/^(40|47|65|65\.1|66|67)$/.test(c)) return "trauma";
  if (/^(61|61\.1|61\.2|62)$/.test(c)) return "pain";
  if (/^(71|72|73)$/.test(c)) return "ob";
  if (/^(45|45\.01)$/.test(c)) return "psych";
  return "";
}
var ACR_PROMPTS = {"cardiac": ["Is the onset and character of the pain recorded (OPQRST), including what the patient was doing when it started?", "Is there a 12-lead time and your interpretation, and does the chart show whether it changed where you went or what you did?", "If ASA or nitro was given, are the checks you made first on the chart (allergies, recent PDE5 inhibitor use, BP before each nitro)?", "If you held a medication back, does the chart say why?", "Is the patient's response after each dose recorded, with a pain score and vitals?"], "resp": ["Is work of breathing described in words (speech, accessory muscle use, position) as well as a rate?", "Are breath sounds documented before and after treatment?", "Is SpO2 recorded with what the patient was on at the time (room air, or oxygen and the flow)?", "If you gave salbutamol or started CPAP, is the response documented with a time?"], "diabetic": ["Is there a glucose reading before treatment and a repeat after, both with times?", "Is level of consciousness described before and after treatment in specific terms?", "Does the chart show the patient could swallow safely before anything went by mouth?", "If they stayed home, does it record who is with them, whether they've eaten, and what they were told to watch for?"], "stroke": ["Is the last known well time documented, and where that time came from?", "Is your stroke screen recorded finding by finding?", "Is a glucose reading on the chart?", "Does the destination decision match the findings you recorded?"], "seizure": ["Is the seizure described: what it looked like, how long it lasted, and who saw it?", "Is the post-ictal course documented with times?", "Is there a glucose reading?", "Were injuries (tongue, head) looked for, and is it recorded when there were none?"], "loc": ["Is level of consciousness recorded with GCS components (E, V, M) as well as the total?", "Is a glucose reading on the chart?", "Is there a trend over time, or only one snapshot?", "Is what bystanders saw before you arrived documented, and who told you?"], "tox": ["Is it recorded what was taken, how much, when, and how you know?", "Is respiratory rate and effort documented more than once?", "If naloxone was given, is the response documented with a time?", "Is what you found on scene (bottles, paraphernalia) recorded factually, without opinion?"], "allergy": ["Is the suspected trigger and time of exposure documented?", "Are skin, airway and breathing findings described, including what was absent?", "If epinephrine was given, are the time, dose, route, site and response all there?", "Is there a repeat set of vitals after each treatment?"], "trauma": ["Is the mechanism described well enough that someone could picture it?", "Are trauma site, type and mechanism codes filled in for each injury?", "Are circulation, sensation and movement documented before and after any splinting?", "Are pertinent negatives recorded (for example no loss of consciousness, no neck pain), with how you know?"], "pain": ["Is the pain described with OPQRST, and scored at more than one time?", "Is the abdominal exam documented by quadrant, including where it wasn't tender?", "Are associated symptoms and relevant negatives recorded?"], "ob": ["Are gravida/para, gestation, and any complications documented?", "Are times recorded for the events that matter (membranes, contractions, delivery)?", "If there was a delivery, are the newborn's assessment and APGAR times documented?"], "psych": ["Are the patient's own words recorded where they matter, in quotation marks?", "Is the safety assessment documented factually: what was said and what you saw?", "If restraint or police were involved, are the reason, the time and your reassessment documented?"], "arrest": ["Are witness status, bystander CPR and first shock filled in the Cardiac Arrest section?", "Is each rhythm check and shock documented with a time?", "If resuscitation was stopped or not started, are the reason and the authority documented?"], "refusal": ["Does the chart show, in the patient's words, that they understood their situation, the risks, and had a plan?", "Is it documented what you advised, including when to call back?", "Is your assessment before the refusal complete enough to support the decision?", "If the patient or a witness wouldn't sign, are the circumstances in Remarks? They don't have to sign (ODS 4.0).", "Did the responsible adult get instructions on what to watch for, follow-up, and possible complications, and is that on the chart (ACR Manual)?"], "general": ["Does the Incident History say how and where you found the patient, and who told you what (ACR Manual)?", "Is your Primary Problem the most likely underlying cause, not the chief complaint restated? Shortness of breath can be the complaint and pulmonary edema the problem (ACR Manual).", "Could someone who wasn't on the call follow what happened from your Remarks alone?", "Is there something you decided not to do? The standards expect the reason for delaying or withholding an indicated treatment on the chart (ODS 4.0).", "If the patient declined any assessment or treatment, is it in the grid with their reason? If you had concerns the patient is at risk, are they in Remarks and in your handover (ODS 4.0)?"]};

function acrCheckIssues(doc) {
  var issues = [];
  function add(msg, fields) { issues.push({ msg: msg, fields: fields || [] }); }
  var k, r, rows = acrRows(doc);
  var narrative = acrNarrative(doc) + " " + acrAllRowText(doc);
  var lowNarr = acrLower(narrative);
  var transported = !!(acrV(doc, "Arrive Destination HH  MM  SS") || acrV(doc, "Depart Scene HH  MM  SS") || acrV(doc, "TOC  HH  MM  SS"));
  var refusal = !!(acrV(doc, "Signature of Patient or SDM  Signature du patient ou du MS") || acrV(doc, "Patient or SDM Name and Address") || acrNormCode(acrV(doc, "Return #")) === "72");

  // 1. required fields
  var req = [["Call Number", "Call Number"], ["Call Date", "Call Date"], ["Last Name", "Last Name"], ["First Name", "First Name"],
             ["Age", "Age"], ["Sex", "Sex"], ["Chief Complaint", "Chief Complaint"], ["Incident Hx", "Incident History"],
             ["Primary Problem", "Primary Problem"], ["CTAS Arrive Patient", "CTAS Arrive Patient"],
             ["Crew 1 Number (Attending)", "Paramedic 1 number"], ["Crew 1 Name", "Paramedic 1 name"], ["Crew 1 Designation", "Paramedic 1 designation"],
             ["Date of ACR Completion", "Date of ACR completion"], ["Time of ACR Completion HH  MM  SS", "Time of ACR completion"]];
  for (k = 0; k < 5; k++) req.push([ACR_EVENTS[k][0], ACR_EVENTS[k][1] + " time"]);
  if (transported) {
    req.push(["CTAS Depart Scene", "CTAS Depart Scene"], ["CTAS Arrive Destination", "CTAS Arrive Destination"],
             ["Receiving Facility/Destination", "Receiving facility"], ["Arrive Destination HH  MM  SS", "Arrive Destination time"], ["TOC  HH  MM  SS", "Transfer of Care time"]);
  }
  var blank = [], blankF = [];
  for (k = 0; k < req.length; k++) if (acrV(doc, req[k][0]) === "") { blank.push(req[k][1]); blankF.push(req[k][0]); }
  if (blank.length) add("Blank: " + blank.join(", ") + ".", blankF);
  if (acrV(doc, "Primary Problem") && !acrV(doc, "Problem Code")) add("Primary Problem chosen but Problem Code is empty.", ["Problem Code"]);
  var ppm = /\((\d+(?:\.\d+)?)\)\s*$/.exec(acrV(doc, "Primary Problem"));
  if (ppm && acrV(doc, "Problem Code") && acrV(doc, "Problem Code") !== ppm[1]) add("Problem Code " + acrV(doc, "Problem Code") + " doesn't match the Primary Problem (" + ppm[1] + ").", ["Problem Code"]);
  for (k = 1; k <= 4; k++) { var des = acrV(doc, "Crew " + k + " Designation"); if (des && !/^[1-5]P?$/i.test(des)) add("Crew " + k + " designation \"" + des + "\" should be a code from 1 to 5 (1 Student, 2 EMA, 3 PCP, 4 ACP, 5 CCP), with P after it for a preceptor, e.g. 3P. (ACR Manual)", ["Crew " + k + " Designation"]); }
  if (!acrV(doc, "Remarks") && !acrV(doc, "Remarks 2")) add("Remarks is empty. There's no narrative of the call.", ["Remarks"]);
  var pts = parseInt(acrV(doc, "Patient #"), 10);
  if (pts > 1 && !acrV(doc, "Sequence")) add("Patients is " + pts + " but Sequence is blank. With more than one patient, each report says which patient it is. (ODS 4.0)", ["Sequence"]);
  var cnoBoxes = [["Relevant Past History - CNO", "Relevant Past History"], ["Medication - CNO", "Medications"], ["Allergies - CNO", "Allergies"], ["Treatment Prior to Arrival - CNO", "Treatment Prior to Arrival"]];
  var cnoTicked = [];
  for (k = 0; k < cnoBoxes.length; k++) if (acrOn(doc, cnoBoxes[k][0])) cnoTicked.push(cnoBoxes[k][1]);
  if (cnoTicked.length && !/\bcno\b|could ?n.?o?t obtain|unable to obtain|not able to obtain/i.test(acrNarrative(doc)))
    add("CNO is ticked for " + cnoTicked.join(", ") + ", but Remarks doesn't explain why it couldn't be obtained. (ODS 4.0)", ["Remarks"]);

  function anyTicked(prefixes) {
    var n = doc.numFields;
    for (var j = 0; j < n; j++) { var nm = doc.getNthFieldName(j); for (var q = 0; q < prefixes.length; q++) if (nm.indexOf(prefixes[q]) === 0 && acrOn(doc, nm)) return true; }
    return false;
  }
  if (!anyTicked(["Past History - ", "Relevant Past History - CNO"])) add("Relevant Past History has no box ticked. At least one box must always be checked (Previously Healthy and CNO count). (ACR Manual)", ["Relevant Past History Details"]);
  if (!anyTicked(["Medication - "]) && !acrV(doc, "Medication Details")) add("Medications has nothing ticked or written.", ["Medication Details"]);
  if (!anyTicked(["Allergy - ", "Allergies - "]) && !acrV(doc, "Allergy Details")) add("Allergies has nothing ticked or written.", ["Allergy Details"]);
  if (!anyTicked(["Treatment Prior to Arrival - "])) add("Treatment Prior to Arrival has no box ticked. Tick None if nobody gave care, or tick who did. (ACR Manual)", ["Treatment Prior to Arrival Details"]);
  else if (!acrOn(doc, "Treatment Prior to Arrival - None") && !acrOn(doc, "Treatment Prior to Arrival - CNO") && !acrV(doc, "Treatment Prior to Arrival Details"))
    add("Treatment Prior to Arrival says someone gave care, but the details don't say what they did or how the patient responded. (ACR Manual)", ["Treatment Prior to Arrival Details"]);

  // 2. call event order
  var prev = null, prevLabel = "";
  for (k = 0; k < ACR_EVENTS.length; k++) {
    var t = acrMin(acrV(doc, ACR_EVENTS[k][0]));
    if (t === null) continue;
    if (prev !== null) {
      var diff = t - prev;
      if (diff < 0 && diff > -720) add(ACR_EVENTS[k][1] + " (" + acrV(doc, ACR_EVENTS[k][0]) + ") is earlier than " + prevLabel + ".", [ACR_EVENTS[k][0]]);
    }
    prev = t; prevLabel = ACR_EVENTS[k][1];
  }
  if (acrV(doc, "Arrive Destination HH  MM  SS") && !acrV(doc, "Depart Scene HH  MM  SS")) add("Arrive Destination is filled but Depart Scene is not.", ["Depart Scene HH  MM  SS"]);

  // 3. treatment grid
  var contact = acrMin(acrV(doc, "Patient Contact HH  MM  SS"));
  var prevRow = null;
  for (k = 0; k < rows.length; k++) {
    r = rows[k];
    var rt = acrMin(r.time);
    if (!r.time) add("Row " + r.i + " has entries but no time. Each assessment and procedure needs its time. (ODS 4.0)", [acrRowName(r.i, "Time")]);
    if (!r.code) add("Row " + r.i + " has entries but no procedure code.", [acrRowName(r.i, "Procedure Code")]);
    else if (!acrCodeName(r.code)) add("Row " + r.i + ": code " + r.code + " isn't on the current Ontario code list.", [acrRowName(r.i, "Procedure Code")]);
    if (!r.crew) add("Row " + r.i + " has no crew member number. Each procedure names the crew member who did it. (ODS 4.0)", [acrRowName(r.i, "Crew Member Number")]);
    else if (acrIsMed(r.code) && /[,\s\/&]/.test(r.crew)) add("Row " + r.i + " (" + (acrCodeName(r.code) || "Medication") + ") lists more than one crew member (" + r.crew + "). Giving a medication is a controlled act, so only the paramedic who gave it goes in this column. (ACR Manual)", [acrRowName(r.i, "Crew Member Number")]);
    if (rt !== null && prevRow && acrMin(prevRow.time) !== null) {
      var d2 = rt - acrMin(prevRow.time);
      if (d2 < 0 && d2 > -720) add("Row " + r.i + " (" + r.time + ") is earlier than row " + prevRow.i + " (" + prevRow.time + "). Rows should read in time order.", [acrRowName(r.i, "Time")]);
    }
    if (rt !== null && contact !== null) {
      var d3 = rt - Math.floor(contact);
      if (d3 < 0 && d3 > -720 && !acrIsCode(r.code, ["390"])) add("Row " + r.i + " (" + r.time + ") is before Patient Contact.", [acrRowName(r.i, "Time")]);
    }
    if (r.time) prevRow = r;

    if (acrIsMed(r.code) || acrIsO2(r.code)) {
      var what = acrIsO2(r.code) ? "Oxygen" : (acrCodeName(r.code) || "Medication");
      var dname = acrIsO2(r.code) ? "flow rate" : "dose";
      // Written across the procedure side, the dose and route columns are hidden, so they have to be in the line.
      if (r.procAcross || (r.procLine && !r["Dose/Unit"] && !r["Route"])) {
        var pl = acrRowName(r.i, "Procedure Line");
        if (!r.procLine) add("Row " + r.i + " (" + what + ") is set to write across the procedure side, but that side is empty.", [pl]);
        else {
          if (!ACR_DOSE_IN_LINE.test(r.procLine)) add("Row " + r.i + " (" + what + ") is written across the procedure side, but it has no " + dname + " with a unit.", [pl]);
          if (!acrIsO2(r.code) && !acrLineRoute(r.procLine)) add("Row " + r.i + " (" + what + ") is written across the procedure side, but it has no route code (PO, SL, IM, NB and so on).", [pl]);
        }
      } else {
        if (!r["Dose/Unit"]) add("Row " + r.i + " (" + what + ") has no " + dname + ".", [acrRowName(r.i, "Dose/Unit")]);
        else if (/^[\d.,\s]+$/.test(r["Dose/Unit"])) add("Row " + r.i + " (" + what + "): the dose \"" + r["Dose/Unit"] + "\" has no unit.", [acrRowName(r.i, "Dose/Unit")]);
        if (!r["Route"] && !acrIsO2(r.code)) add("Row " + r.i + " (" + what + ") has no route.", [acrRowName(r.i, "Route")]);
      }
    }
    if (acrIsMed(r.code)) {
      var before = false, after = false;
      for (var j = 0; j < rows.length; j++) { if (rows[j].hasVitals) { if (j < k) before = true; if (j > k) after = true; } }
      if (r.hasVitals) { before = true; }
      if (!before) add("Row " + r.i + " (" + acrCodeName(r.code) + "): no vitals charted before it.", [acrRowName(r.i, "Time")]);
      if (!after) add("Row " + r.i + " (" + acrCodeName(r.code) + "): no vitals charted after it, so the response isn't shown.", [acrRowName(r.i, "Time")]);
    }
    if (acrIsCode(r.code, ["313", "313.1"]) && !r.line && !r["Reading/Code"] && !/12[- ]?lead|stemi|\bst\b|elevation|depression/i.test(narrative))
      add("Row " + r.i + ": 12-lead acquired, but no interpretation in the row or the narrative.", [acrRowName(r.i, "Reading/Code")]);
    if (acrIsCode(r.code, ["25"]) && !r["Reading/Code"] && !/\d/.test(r.line)) add("Row " + r.i + ": glucose check with no reading.", [acrRowName(r.i, "Reading/Code")]);
    if (acrIsCode(r.code, ["301"]) && !r["Reading/Code"] && !r.line) add("Row " + r.i + ": rhythm interpretation with no rhythm code.", [acrRowName(r.i, "Reading/Code")]);
  }
  var vitalsRows = 0;
  for (k = 0; k < rows.length; k++) if (rows[k].hasVitals) vitalsRows++;
  if (vitalsRows === 0) add("No vitals in the treatment grid.", [acrRowName(1, "Pulse")]);
  else if (vitalsRows === 1) add("Only one set of vitals. There's no reassessment on the chart.", []);

  // 4. contradictions and cross-checks
  if (acrOn(doc, "Allergy - NKA") && acrV(doc, "Allergy Details") && !acrIsNone(acrV(doc, "Allergy Details"))) add("NKA is ticked but allergy details are written.", ["Allergy Details"]);
  if (acrOn(doc, "Allergy - Other (list below)") && !acrV(doc, "Allergy Details")) add("Allergy \"Other\" is ticked but nothing is listed.", ["Allergy Details"]);
  if (acrOn(doc, "Medication - None") && acrV(doc, "Medication Details") && !acrIsNone(acrV(doc, "Medication Details"))) add("Medications \"None\" is ticked but medications are written.", ["Medication Details"]);
  if (acrOn(doc, "Past History - Previously Healthy") && acrV(doc, "Relevant Past History Details") && !acrIsNone(acrV(doc, "Relevant Past History Details"))) add("Previously Healthy is ticked but history details are written.", ["Relevant Past History Details"]);
  if (acrOn(doc, "Past History - Other (list below)") && !acrV(doc, "Relevant Past History Details")) add("Past history \"Other\" is ticked but nothing is listed.", ["Relevant Past History Details"]);
  if (acrOn(doc, "Treatment Prior to Arrival - None") && acrV(doc, "Treatment Prior to Arrival Details") && !acrIsNone(acrV(doc, "Treatment Prior to Arrival Details"))) add("Treatment Prior to Arrival \"None\" is ticked but details are written.", ["Treatment Prior to Arrival Details"]);
  if (acrV(doc, "Skin Colour") === "Unremarkable" && /\b(pale|cyanos|cyanotic|flushed|jaundice)/i.test(narrative)) add("Skin colour says Unremarkable, but the narrative describes a colour change.", ["Skin Colour"]);
  if (acrV(doc, "Skin Condition") === "Unremarkable" && /\b(diaphor|clammy|sweaty)/i.test(narrative)) add("Skin condition says Unremarkable, but the narrative describes diaphoresis or clammy skin.", ["Skin Condition"]);
  if (/pain/i.test(acrV(doc, "Chief Complaint"))) {
    var anyPain = /\d+\s*\/\s*10/.test(narrative);
    for (k = 0; k < rows.length; k++) if (rows[k]["Pain"]) anyPain = true;
    if (!anyPain) add("The chief complaint is pain, but there's no pain score anywhere.", [acrRowName(1, "Pain")]);
  }
  var dob = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(acrV(doc, "Date of birth")), cd = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(acrV(doc, "Call Date"));
  var ag = acrAge(doc), age = ag ? ag.n : NaN;
  if (acrV(doc, "Age") && !/^cno$/i.test(acrV(doc, "Age")) && (!ag || !ag.unit)) add("Age needs its unit: Y, M or D, e.g. 64 Y. (ACR Manual)", ["Age"]);
  if (dob && cd && ag && ag.unit === "Y" && !ag.est) {
    var yrs = (+cd[1]) - (+dob[1]) - (((+cd[2]) * 100 + (+cd[3])) < ((+dob[2]) * 100 + (+dob[3])) ? 1 : 0);
    if (Math.abs(yrs - age) >= 1) add("Age is " + age + " but the date of birth works out to " + yrs + ".", ["Age", "Date of birth"]);
  }
  if (ag && (ag.unit === "M" || ag.unit === "D" || ag.n < 18) && !acrV(doc, "Weight kg")) add("Pediatric patient with no weight recorded.", ["Weight kg"]);
  var occ = acrV(doc, "Date of Occurrence");
  if (occ && cd && occ > acrV(doc, "Call Date")) add("Date of Occurrence is after the Call Date.", ["Date of Occurrence"]);
  if (acrV(doc, "Date of ACR Completion") && cd && acrV(doc, "Date of ACR Completion") < acrV(doc, "Call Date")) add("ACR completion date is before the call date.", ["Date of ACR Completion"]);
  if (/^(mvc|mva|mcc|fall|fell|assault|pedestrian struck|ped struck)\.?$/i.test(acrV(doc, "Chief Complaint")))
    add("Chief Complaint is a mechanism (\"" + acrV(doc, "Chief Complaint") + "\"), not a complaint. Use the patient's own words, e.g. \"left hip pain after a fall\". (ACR Manual)", ["Chief Complaint"]);
  if (acrOn(doc, "Deceased - DNR") && !acrV(doc, "DNR confirmation number")) add("DNR is ticked but the DNR Confirmation Number is blank. (ACR Manual)", ["DNR confirmation number"]);
  if (/^0?[235689]$/.test(acrV(doc, "Sp Trans Code")) && !/bypass|pci|stroke cent|trauma cent|lead trauma|refus|divert/i.test(narrative))
    add("Special Transport Code " + acrV(doc, "Sp Trans Code") + " is a no-bypass code, but Remarks doesn't give the reason. (ACR Manual)", ["Sp Trans Code"]);
  if (acrOn(doc, "Disposition of Effects - Disposition of effects: Other") && !acrV(doc, "Disposition of Effects - Other Details")) add("Disposition of Effects \"Other\" is ticked but doesn't say who. (ACR Manual)", ["Disposition of Effects - Other Details"]);
  if (acrNormCode(acrV(doc, "Return #")) === "75" && !/\b\d{4}\b/.test(narrative)) add("Return code 75 (transported by other ambulance): the other vehicle number goes in Remarks. (ACR Manual)", ["Remarks"]);
  if (acrProblemGroup(acrV(doc, "Problem Code"), doc) === "trauma" && !acrV(doc, "Location 1")) add("Trauma problem code, but the Trauma Problem Site/Type boxes are empty. Code up to the three most serious injuries. (ACR Manual)", ["Location 1"]);
  for (k = 0; k < rows.length; k++) {
    var g = rows[k]["GCS"], pn = rows[k]["Pain"];
    if (g && !/^cno$/i.test(g) && !(/^\d{1,2}$/.test(g) && +g >= 3 && +g <= 15)) add("Row " + rows[k].i + ": GCS \"" + g + "\" should be the total, 3 to 15, or CNO. Put the components (E, V, M) in Remarks. (ACR Manual)", [acrRowName(rows[k].i, "GCS")]);
    if (pn && !(/^\d{1,2}$/.test(pn) && +pn <= 10)) add("Row " + rows[k].i + ": pain score \"" + pn + "\" should be a number from 0 to 10. (ACR Manual)", [acrRowName(rows[k].i, "Pain")]);
  }
  if (refusal && transported) add("A refusal is documented, but transport times are also documented. Which happened?", ["Signature of Patient or SDM  Signature du patient ou du MS"]);
  if (transported && acrV(doc, "TOC  HH  MM  SS") && !/\b(rn|nurse|physician|doctor|dr\.?|md|charge|triage|staff|crew|transferred to|report (was )?(given )?to)\b/i.test(narrative))
    add("Transfer of care is timed, but the chart doesn't say who took over care. (ODS 4.0)", ["Remarks"]);
  if (refusal && !acrV(doc, "Signature of Patient or SDM  Signature du patient ou du MS") && !/(refus\w*|declin\w*|would ?n.?o?t|unwilling|unable|did ?n.?o?t|didn't|not able) to sign|not sign(ed)?\b|without (a |her |his |their )?signature/i.test(narrative))
    add("A refusal is recorded without the patient's signature, and Remarks doesn't say why. The patient doesn't have to sign, but the circumstances go in Remarks. (ODS 4.0)", ["Remarks"]);
  if (refusal) {
    var cap = ["Capacity - Understands clinical situation", "Capacity - Appreciates applicable risks", "Capacity - Can make an alternative care plan"], capNo = false, capBlank = false;
    for (k = 0; k < cap.length; k++) { var cv = acrV(doc, cap[k]); if (cv === "No") capNo = true; if (cv === "" || cv === "Off") capBlank = true; }
    if (capBlank) add("Refusal documented but the capacity questions aren't all answered.", [cap[0]]);
    if (capNo && !/capacity/i.test(narrative)) add("A capacity question is answered No, and the narrative doesn't explain how that was handled.", ["Remarks"]);
    if (!acrV(doc, "Non-paramedic Witness Name") && !acrV(doc, "Witness or Paramedic 2 Signature")) add("Refusal has no witness.", ["Non-paramedic Witness Name"]);
    if (!acrV(doc, "Attending Paramedic Signature")) add("Refusal: the attending paramedic's signature, date and time are required in every refusal. (ACR Manual)", ["Attending Paramedic Signature"]);
    if (!acrV(doc, "Patient or SDM Name and Address")) add("Refusal: the patient's or SDM's name and address are blank. (ACR Manual)", ["Patient or SDM Name and Address"]);
    if (!/capacit|understood|understands|appreciat|repeated (the )?risks|own words/i.test(narrative)) add("Refusal documented, but Remarks doesn't describe your capacity findings. All capacity findings go in Remarks. (ACR Manual)", ["Remarks"]);
  }
  return issues;
}

// Questions drawn from the Ontario Ambulance Documentation Standards v4.0 that depend on judgment, built from this chart.
function acrNeedsResult(code) {
  var c = acrNormCode(code), n = parseFloat(c);
  if (!/^\d/.test(c)) return false;
  return (n >= 100 && n < 115) || c === "120" || c === "170" || c === "190" || (n >= 297 && n < 310) || (n >= 318 && n < 340 && c !== "338") ||
         (n >= 340 && n < 366) || (n >= 380 && n < 387);
}
function acrStandardsQuestions(doc) {
  var q = [], rows = acrRows(doc), k, need = [];
  for (k = 0; k < rows.length; k++) if (acrNeedsResult(rows[k].code) && !rows[k].line) need.push(rows[k].i + " (" + (acrCodeName(rows[k].code) || rows[k].code) + ")");
  if (need.length) q.push("Row" + (need.length > 1 ? "s " : " ") + need.join(", ") + ": each procedure needs a brief narrative of what was done and the result (ODS 4.0). Is it in the row or in Remarks?");
  function ev(n) { return acrMin(acrV(doc, n)); }
  var arr = ev("Arrive Scene HH  MM  SS"), con = ev("Patient Contact HH  MM  SS"), dep = ev("Depart Scene HH  MM  SS");
  var access = (arr !== null && con !== null) ? con - arr : null, onScene = (arr !== null && dep !== null) ? dep - arr : null;
  if (access !== null && access < -720) access += 1440;
  if (onScene !== null && onScene < -720) onScene += 1440;
  if ((access !== null && access > 5) || (onScene !== null && onScene > 20)) {
    q.push("It took " + (access === null ? "?" : Math.round(access)) + " min to reach the patient and you were on scene " + (onScene === null ? "?" : Math.round(onScene)) +
           " min. If either delay was considerable, the reason belongs in Remarks (ODS 4.0). Is it there?");
  }
  var toc = ev("TOC  HH  MM  SS"), done = ev("Time of ACR Completion HH  MM  SS");
  if (toc !== null && done !== null && acrV(doc, "Date of ACR Completion") === acrV(doc, "Call Date") && done - toc > 720)
    q.push("The ACR was completed more than 12 hours after transfer of care. Reports are due by the end of the scheduled shift (ODS 4.0).");
  return q;
}
function acrPromptsFor(doc) {
  var g = acrProblemGroup(acrV(doc, "Problem Code"), doc);
  var list = acrStandardsQuestions(doc);
  if (g && ACR_PROMPTS[g]) list = list.concat(ACR_PROMPTS[g]);
  if (acrV(doc, "Signature of Patient or SDM  Signature du patient ou du MS") || acrV(doc, "Patient or SDM Name and Address") || acrNormCode(acrV(doc, "Return #")) === "72") list = list.concat(ACR_PROMPTS.refusal);
  list = list.concat(ACR_PROMPTS.general);
  return list;
}

function acrCheck(doc) {
  acrClearHighlights(doc);
  var issues = acrCheckIssues(doc), k, j;
  for (k = 0; k < issues.length; k++) for (j = 0; j < issues[k].fields.length; j++) acrHighlight(doc, issues[k].fields[j]);
  var prompts = acrPromptsFor(doc);
  var lines = [];
  if (issues.length === 0) lines.push("No documentation gaps found by the checker. That doesn't mean the chart is good. It means nothing obvious is missing.");
  else { lines.push(issues.length + " thing" + (issues.length === 1 ? "" : "s") + " to look at (highlighted yellow on screen):"); for (k = 0; k < issues.length; k++) lines.push("  " + (k + 1) + ". " + issues[k].msg); }
  lines.push("");
  lines.push("Questions the checker can't answer for you:");
  for (k = 0; k < prompts.length; k++) lines.push("  - " + prompts[k]);
  var text = lines.join("\n");
  var out = doc.getField("Review - Check Results");
  if (out) out.value = "Checked " + acrNow(doc, false) + " (saved snapshot; rerun after edits)\n" + text;
  if(out)acrFitValue(out,out.value);
  var shown = text;
  if (shown.length > 2400) shown = shown.slice(0, 2400) + "\n\n(Full list on the Documentation Review page.)";
  app.alert({ cMsg: shown, cTitle: "Check my ACR", nIcon: 3 });
  return issues;
}

// ------------------------------------------------------------------ handover read-back
function acrTrimDot(t) { return String(t || "").replace(/[.\s]+$/, ""); }
function acrVitalsText(r) {
  var p = [];
  if (r["Pulse"]) p.push("HR " + r["Pulse"]);
  if (r["Resp"]) p.push("RR " + r["Resp"]);
  if (r["BP"]) p.push("BP " + r["BP"]);
  if (r["SpO2"]) p.push("SpO2 " + r["SpO2"] + "%");
  if (r["GCS"]) p.push("GCS " + r["GCS"]);
  if (r["Pain"]) p.push("pain " + r["Pain"] + "/10");
  if (r["Temp"]) p.push("temp " + r["Temp"]);
  return p.length ? p.join(", ") : r.line;
}
function acrTicked(doc, prefix) {
  var out = [], n = doc.numFields;
  for (var j = 0; j < n; j++) { var nm = doc.getNthFieldName(j); if (nm.indexOf(prefix) === 0 && acrOn(doc, nm)) out.push(nm.slice(prefix.length)); }
  return out;
}
function acrReadBack(doc) {
  var rows = acrRows(doc), k, gaps = [];
  var sexWord = { m: "male", f: "female" }[acrLower(acrV(doc, "Sex"))] || acrV(doc, "Sex") || "[sex?]";
  var s = [];
  s.push("Transfer of care practice. Say it out loud and aim for under a minute.\n");
  var cc = acrTrimDot(acrV(doc, "Chief Complaint"));
  s.push(acrAgeWords(doc) + " " + sexWord + ", " + (cc ? cc.charAt(0).toLowerCase() + cc.slice(1) : "[chief complaint?]") + ".");
  var hx = acrV(doc, "Incident Hx");
  if (hx) {
    var sents = hx.split(/(?:\.\s+)|\n/), found = "";
    for (k = 0; k < sents.length && found.length < 90; k++) if (sents[k]) found += (found ? ". " : "") + acrTrimDot(sents[k]);
    s.push("Found: " + found + ".");
  } else gaps.push("no incident history to summarize");
  var ph = acrTicked(doc, "Past History - "), meds = acrTicked(doc, "Medication - "), al = acrTicked(doc, "Allergy - ").concat(acrTicked(doc, "Allergies - "));
  s.push("History: " + (ph.length ? ph.join(", ") : "[none ticked]") + (acrV(doc, "Relevant Past History Details") ? " (" + acrTrimDot(acrV(doc, "Relevant Past History Details")) + ")" : "") + ".");
  s.push("Meds: " + (meds.length ? meds.join(", ") : "[none ticked]") + (acrV(doc, "Medication Details") ? " (" + acrTrimDot(acrV(doc, "Medication Details")) + ")" : "") + ".");
  s.push("Allergies: " + (al.length ? al.join(", ") : "[none ticked]") + (acrV(doc, "Allergy Details") ? " (" + acrTrimDot(acrV(doc, "Allergy Details")) + ")" : "") + ".");
  var vit = [];
  for (k = 0; k < rows.length; k++) if (rows[k].hasVitals) vit.push(rows[k]);
  if (vit.length) {
    s.push("First vitals" + (vit[0].time ? " at " + vit[0].time : "") + ": " + acrVitalsText(vit[0]) + ".");
    if (vit.length > 1) s.push("Most recent" + (vit[vit.length - 1].time ? " at " + vit[vit.length - 1].time : "") + ": " + acrVitalsText(vit[vit.length - 1]) + ".");
    else gaps.push("only one set of vitals, so there's no trend to hand over");
  } else gaps.push("no vitals in the grid");
  var tx = [];
  for (k = 0; k < rows.length; k++) {
    var r = rows[k];
    if (acrIsMed(r.code) || acrIsO2(r.code) || /^(313|383|170|141|111|110|114|300|307|308|341|351)$/.test(r.code)) {
      var d = [r.time, acrCodeName(r.code) || r.code];
      if (r["Dose/Unit"]) d.push(r["Dose/Unit"]);
      if (r["Route"]) d.push(r["Route"]);
      if (r.line) d.push("(" + acrTrimDot(r.line) + ")");
      tx.push(d.join(" "));
    }
  }
  s.push("Treatment: " + (tx.length ? tx.join("; ") : "[nothing charted]") + ".");
  if (tx.length && vit.length) {
    var lastTx = null;
    for (k = rows.length - 1; k >= 0; k--) if (acrIsMed(rows[k].code)) { lastTx = k; break; }
    if (lastTx !== null) { var after = false; for (k = lastTx + 1; k < rows.length; k++) if (rows[k].hasVitals) after = true; if (!after) gaps.push("nothing charted after your last medication, so you can't say how they responded"); }
  }
  s.push("CTAS: arrive patient " + (acrV(doc, "CTAS Arrive Patient") || "?") + ", depart scene " + (acrV(doc, "CTAS Depart Scene") || "?") + ", arrive destination " + (acrV(doc, "CTAS Arrive Destination") || "?") + ".");
  var text = s.join("\n");
  if (gaps.length) text += "\n\nHard to hand over from this chart: " + gaps.join("; ") + ".";
  text += "\n\nThis is built only from what's on your chart. Anything you'd want to say that isn't here, chart it.";
  app.alert({ cMsg: text, cTitle: "Triage report (handover practice)", nIcon: 3 });
  return text;
}

// ------------------------------------------------------------------ lock / unlock
function acrLock(doc) {
  if (app.alert("Lock this ACR for submission?\n\nEvery field except the Documentation Review pages becomes read-only, and a submitted stamp is added to page 1. Your instructor can unlock it.", 2, 2) !== 4) return;
  var n = doc.numFields;
  for (var j = 0; j < n; j++) {
    var nm = doc.getNthFieldName(j), f = doc.getField(nm);
    if (!f || f.type === "button" || nm.indexOf("Review - ") === 0) continue;
    f.readonly = true;
  }
  var d = new Date();
  doc.getField("Submitted Stamp").value = "LOCKED FOR SUBMISSION " + d.getFullYear() + "/" + acrPad(d.getMonth() + 1) + "/" + acrPad(d.getDate()) + " " + acrPad(d.getHours()) + ":" + acrPad(d.getMinutes());
  acrClearHighlights(doc);
}
function acrUnlock(doc) {
  var ans = app.response({ cQuestion: "Instructor unlock code:", cTitle: "Unlock ACR", bPassword: true });
  if (ans === null || ans === undefined) return;
  if (String(ans).toUpperCase() !== ACR_UNLOCK_CODE) { app.alert("That code didn't match."); return; }
  var n = doc.numFields;
  for (var j = 0; j < n; j++) {
    var nm = doc.getNthFieldName(j), f = doc.getField(nm);
    if (!f || f.type === "button" || ACR_ALWAYS_READONLY[nm]) continue;
    f.readonly = false;
  }
  doc.getField("Submitted Stamp").value = "";
}

// ------------------------------------------------------------------ calculated fields
function acrCalcTotalPages(doc) {
  var used = !!(acrV(doc, "Remarks 2") || acrV(doc, "Remarks 3"));
  for (var i = 27; i <= ACR_ROWS && !used; i++) if (acrRow(doc, i).used) used = true;
  return used ? "2" : "1";
}
function acrFmtDur(a, b) {
  if (a === null || b === null) return "-";
  var d = b - a; if (d < -720) d += 1440; if (d < 0) return "check times";
  var m = Math.floor(d), sec = Math.round((d - m) * 60);
  return m + " min" + (sec ? " " + sec + " s" : "");
}
function acrCalcIntervals(doc) {
  function ev(k) { return acrMin(acrV(doc, ACR_EVENTS[k][0])); }
  var rows = acrRows(doc), firstMed = null, first12 = null, k;
  for (k = 0; k < rows.length; k++) {
    if (firstMed === null && acrIsMed(rows[k].code)) firstMed = acrMin(rows[k].time);
    if (first12 === null && acrIsCode(rows[k].code, ["313", "313.1"])) first12 = acrMin(rows[k].time);
  }
  var contact = ev(4);
  var out = [
    "Crew notified to mobile: " + acrFmtDur(ev(1), ev(2)),
    "Crew notified to arrive scene: " + acrFmtDur(ev(1), ev(3)),
    "Arrive scene to patient contact: " + acrFmtDur(ev(3), ev(4)),
    "On scene (arrive to depart): " + acrFmtDur(ev(3), ev(5)),
    "Transport (depart to arrive destination): " + acrFmtDur(ev(5), ev(6)),
    "Arrive destination to transfer of care: " + acrFmtDur(ev(6), ev(7)),
    "Patient contact to first 12-lead: " + (first12 === null ? "no 12-lead charted" : acrFmtDur(contact === null ? null : Math.floor(contact), first12)),
    "Patient contact to first medication: " + (firstMed === null ? "no medication charted" : acrFmtDur(contact === null ? null : Math.floor(contact), firstMed)),
    "Call received to transfer of care: " + acrFmtDur(ev(0), ev(7))
  ];
  return out.join("\n");
}
function acrCalcTrend(doc) {
  var rows = acrRows(doc), vit = [], k;
  for (k = 0; k < rows.length; k++) if (rows[k]["Pulse"] || rows[k]["BP"] || rows[k]["SpO2"] || rows[k]["Pain"] || rows[k]["GCS"]) vit.push(rows[k]);
  if (!vit.length) return "No vitals in the grid yet.";
  function series(key) { var s = []; for (var j = 0; j < vit.length; j++) if (vit[j][key]) s.push(vit[j][key]); return s.length ? s.join(" > ") : "-"; }
  var out = ["Sets of vitals: " + vit.length + " (first " + (vit[0].time || "?") + ", last " + (vit[vit.length - 1].time || "?") + ")",
             "HR: " + series("Pulse"), "BP: " + series("BP"), "RR: " + series("Resp"), "SpO2: " + series("SpO2"), "GCS: " + series("GCS"), "Pain: " + series("Pain")];
  var f = vit[0], sbp = parseInt(String(f["BP"]).split("/")[0], 10), hr = parseInt(f["Pulse"], 10);
  if (sbp > 0 && hr > 0) out.push("Shock index, first set (HR / systolic): " + (Math.round(hr / sbp * 100) / 100));
  return out.join("\n");
}

var ACR_BASE_SIZES={"Call Number": 8.0, "Hospital Registration Number": 7.5, "Service Name": 7.5, "Service #": 7.5, "Call Date": 7.2, "Last Name": 7.5, "First Name": 7.5, "Age": 7.5, "Sex": 7.5, "Weight kg": 7.5, "Date of birth": 7.2, "Health Insurance Number": 7.5, "Version Code": 7.5, "Street Number": 7.5, "Street Name": 7.5, "City/Town": 7.5, "Province": 7.5, "Postal Code": 7.5, "Country": 7.5, "Pick-up Location or Sending Facility": 7.5, "Date of Occurrence": 7.2, "Time of Occurrence": 7.5, "Chief Complaint": 7.5, "Incident Hx": 7.5, "DNR confirmation number": 7.5, "Relevant Past History - Other Provider": 7.5, "Relevant Past History Details": 7.5, "Medication Details": 7.5, "Allergy Details": 7.5, "Treatment Prior to Arrival Details": 7.5, "Arrest witnessed date": 7.2, "Arrest witnessed Time": 7.5, "CPR started Date": 7.2, "CPR Started Time": 7.5, "First shock Date": 7.2, "First Shock Time": 7.5, "General Appearance Details": 7.5, "Head/Neck": 7.5, "Chest Exam Details": 7.5, "Abdomen": 7.5, "Back/Pelvis Details": 7.5, "Extremities Details": 7.5, "Treatment Row 1 - Time": 7.0, "Treatment Row 1 - Procedure Code": 7.0, "Treatment Row 1 - Crew Member Number": 7.0, "Treatment Row 2 - Time": 7.0, "Treatment Row 2 - Procedure Code": 7.0, "Treatment Row 2 - Crew Member Number": 7.0, "Treatment Row 3 - Time": 7.0, "Treatment Row 3 - Procedure Code": 7.0, "Treatment Row 3 - Crew Member Number": 7.0, "Treatment Row 4 - Time": 7.0, "Treatment Row 4 - Procedure Code": 7.0, "Treatment Row 4 - Crew Member Number": 7.0, "Treatment Row 5 - Time": 7.0, "Treatment Row 5 - Procedure Code": 7.0, "Treatment Row 5 - Crew Member Number": 7.0, "Treatment Row 6 - Time": 7.0, "Treatment Row 6 - Procedure Code": 7.0, "Treatment Row 6 - Crew Member Number": 7.0, "Treatment Row 7 - Time": 7.0, "Treatment Row 7 - Procedure Code": 7.0, "Treatment Row 7 - Crew Member Number": 7.0, "Treatment Row 8 - Time": 7.0, "Treatment Row 8 - Procedure Code": 7.0, "Treatment Row 8 - Crew Member Number": 7.0, "Treatment Row 9 - Time": 7.0, "Treatment Row 9 - Procedure Code": 7.0, "Treatment Row 9 - Crew Member Number": 7.0, "Treatment Row 10 - Time": 7.0, "Treatment Row 10 - Procedure Code": 7.0, "Treatment Row 10 - Crew Member Number": 7.0, "Treatment Row 11 - Time": 7.0, "Treatment Row 11 - Procedure Code": 7.0, "Treatment Row 11 - Crew Member Number": 7.0, "Treatment Row 12 - Time": 7.0, "Treatment Row 12 - Procedure Code": 7.0, "Treatment Row 12 - Crew Member Number": 7.0, "Treatment Row 13 - Time": 7.0, "Treatment Row 13 - Procedure Code": 7.0, "Treatment Row 13 - Crew Member Number": 7.0, "Treatment Row 14 - Time": 7.0, "Treatment Row 14 - Procedure Code": 7.0, "Treatment Row 14 - Crew Member Number": 7.0, "Treatment Row 15 - Time": 7.0, "Treatment Row 15 - Procedure Code": 7.0, "Treatment Row 15 - Crew Member Number": 7.0, "Treatment Row 16 - Time": 7.0, "Treatment Row 16 - Procedure Code": 7.0, "Treatment Row 16 - Crew Member Number": 7.0, "Treatment Row 17 - Time": 7.0, "Treatment Row 17 - Procedure Code": 7.0, "Treatment Row 17 - Crew Member Number": 7.0, "Treatment Row 18 - Time": 7.0, "Treatment Row 18 - Procedure Code": 7.0, "Treatment Row 18 - Crew Member Number": 7.0, "Treatment Row 19 - Time": 7.0, "Treatment Row 19 - Procedure Code": 7.0, "Treatment Row 19 - Crew Member Number": 7.0, "Treatment Row 20 - Time": 7.0, "Treatment Row 20 - Procedure Code": 7.0, "Treatment Row 20 - Crew Member Number": 7.0, "Treatment Row 21 - Time": 7.0, "Treatment Row 21 - Procedure Code": 7.0, "Treatment Row 21 - Crew Member Number": 7.0, "Treatment Row 22 - Time": 7.0, "Treatment Row 22 - Procedure Code": 7.0, "Treatment Row 22 - Crew Member Number": 7.0, "Treatment Row 23 - Time": 7.0, "Treatment Row 23 - Procedure Code": 7.0, "Treatment Row 23 - Crew Member Number": 7.0, "Treatment Row 24 - Time": 7.0, "Treatment Row 24 - Procedure Code": 7.0, "Treatment Row 24 - Crew Member Number": 7.0, "Treatment Row 25 - Time": 7.0, "Treatment Row 25 - Procedure Code": 7.0, "Treatment Row 25 - Crew Member Number": 7.0, "Treatment Row 26 - Time": 7.0, "Treatment Row 26 - Procedure Code": 7.0, "Treatment Row 26 - Crew Member Number": 7.0, "Remarks": 7.5, "Disposition of Effects - Other Details": 7.5, "Physician or BHP Name": 7.5, "Date5_TOR": 7.0, "Time5_TOR": 7.0, "Vehicle Number": 7.5, "Station": 7.5, "Status": 7.5, "Hospital Number": 7.5, "UTM Code": 7.5, "Dispatch #": 7.5, "Return #": 7.5, "Patient #": 7.5, "Sequence": 7.5, "Base Hospital Name": 7.5, "Base Hospital Number": 7.5, "Base Hospital Physician NameNo if patch": 7.5, "Patch Log Number": 7.5, "Call Received HH  MM  SS": 7.1, "Crew Notified HH  MM  SS": 7.1, "Crew Mobile HH  MM  SS": 7.1, "Arrive Scene HH  MM  SS": 7.1, "Patient Contact HH  MM  SS": 7.1, "Depart Scene HH  MM  SS": 7.1, "Arrive Destination HH  MM  SS": 7.1, "TOC  HH  MM  SS": 7.1, "Crew 1 Number (Attending)": 7.5, "Crew 1 Name": 7.5, "Crew 1 Designation": 7.5, "Crew 2 Number": 7.5, "Crew 2 Name": 7.5, "Crew 2 Designation": 7.5, "Crew 2 Signature": 7.5, "Crew 3 Number": 7.5, "Crew 3 Name": 7.5, "Crew 3 Designation": 7.5, "Crew 3 Signature": 7.5, "Crew 4 Number": 7.5, "Crew 4 Name": 7.5, "Crew 4 Designation": 7.5, "Date of ACR Completion": 7.5, "Time of ACR Completion HH  MM  SS": 7.5, "Capacity Assessment Subject": 7.5, "SDM Relationship to Patient": 7.5, "Patient or SDM Signature Date": 7.5, "Signature of Patient or SDM  Signature du patient ou du MS": 7.5, "Attending Paramedic Signature Date": 7.5, "Attending Paramedic Signature": 7.5, "Non-paramedic Witness Signature Time": 8.0, "Non-paramedic Witness Signature Date": 7.5, "Treatment Page Number": 8.0, "Treatment Total Pages": 8.0, "Problem Code": 7.0, "Patient or SDM Signature Time": 8.0, "Attending Paramedic Signature Time": 8.0, "Crew 1 Signature": 7.5, "Crew 4 Signature": 7.5, "Patient or SDM Name and Address": 7.5, "Non-paramedic Witness Name": 7.5, "Witness or Paramedic 2 Signature": 7.5, "Treatment Row 1 - Dose/Unit": 7.0, "Treatment Row 1 - Route": 7.0, "Treatment Row 1 - Pulse": 7.0, "Treatment Row 1 - Resp": 7.0, "Treatment Row 1 - BP": 7.0, "Treatment Row 1 - Temp": 7.0, "Treatment Row 1 - Reading/Code": 7.0, "Treatment Row 1 - SpO2": 7.0, "Treatment Row 1 - EtCO2": 7.0, "Treatment Row 1 - GCS": 7.0, "Treatment Row 1 - Pupil R": 7.0, "Treatment Row 1 - Pupil L": 7.0, "Treatment Row 1 - Pain": 7.0, "Treatment Row 2 - Dose/Unit": 7.0, "Treatment Row 2 - Route": 7.0, "Treatment Row 2 - Pulse": 7.0, "Treatment Row 2 - Resp": 7.0, "Treatment Row 2 - BP": 7.0, "Treatment Row 2 - Temp": 7.0, "Treatment Row 2 - Reading/Code": 7.0, "Treatment Row 2 - SpO2": 7.0, "Treatment Row 2 - EtCO2": 7.0, "Treatment Row 2 - GCS": 7.0, "Treatment Row 2 - Pupil R": 7.0, "Treatment Row 2 - Pupil L": 7.0, "Treatment Row 2 - Pain": 7.0, "Treatment Row 3 - Dose/Unit": 7.0, "Treatment Row 3 - Route": 7.0, "Treatment Row 3 - Pulse": 7.0, "Treatment Row 3 - Resp": 7.0, "Treatment Row 3 - BP": 7.0, "Treatment Row 3 - Temp": 7.0, "Treatment Row 3 - Reading/Code": 7.0, "Treatment Row 3 - SpO2": 7.0, "Treatment Row 3 - EtCO2": 7.0, "Treatment Row 3 - GCS": 7.0, "Treatment Row 3 - Pupil R": 7.0, "Treatment Row 3 - Pupil L": 7.0, "Treatment Row 3 - Pain": 7.0, "Treatment Row 4 - Dose/Unit": 7.0, "Treatment Row 4 - Route": 7.0, "Treatment Row 4 - Pulse": 7.0, "Treatment Row 4 - Resp": 7.0, "Treatment Row 4 - BP": 7.0, "Treatment Row 4 - Temp": 7.0, "Treatment Row 4 - Reading/Code": 7.0, "Treatment Row 4 - SpO2": 7.0, "Treatment Row 4 - EtCO2": 7.0, "Treatment Row 4 - GCS": 7.0, "Treatment Row 4 - Pupil R": 7.0, "Treatment Row 4 - Pupil L": 7.0, "Treatment Row 4 - Pain": 7.0, "Treatment Row 5 - Dose/Unit": 7.0, "Treatment Row 5 - Route": 7.0, "Treatment Row 5 - Pulse": 7.0, "Treatment Row 5 - Resp": 7.0, "Treatment Row 5 - BP": 7.0, "Treatment Row 5 - Temp": 7.0, "Treatment Row 5 - Reading/Code": 7.0, "Treatment Row 5 - SpO2": 7.0, "Treatment Row 5 - EtCO2": 7.0, "Treatment Row 5 - GCS": 7.0, "Treatment Row 5 - Pupil R": 7.0, "Treatment Row 5 - Pupil L": 7.0, "Treatment Row 5 - Pain": 7.0, "Treatment Row 6 - Dose/Unit": 7.0, "Treatment Row 6 - Route": 7.0, "Treatment Row 6 - Pulse": 7.0, "Treatment Row 6 - Resp": 7.0, "Treatment Row 6 - BP": 7.0, "Treatment Row 6 - Temp": 7.0, "Treatment Row 6 - Reading/Code": 7.0, "Treatment Row 6 - SpO2": 7.0, "Treatment Row 6 - EtCO2": 7.0, "Treatment Row 6 - GCS": 7.0, "Treatment Row 6 - Pupil R": 7.0, "Treatment Row 6 - Pupil L": 7.0, "Treatment Row 6 - Pain": 7.0, "Treatment Row 7 - Dose/Unit": 7.0, "Treatment Row 7 - Route": 7.0, "Treatment Row 7 - Pulse": 7.0, "Treatment Row 7 - Resp": 7.0, "Treatment Row 7 - BP": 7.0, "Treatment Row 7 - Temp": 7.0, "Treatment Row 7 - Reading/Code": 7.0, "Treatment Row 7 - SpO2": 7.0, "Treatment Row 7 - EtCO2": 7.0, "Treatment Row 7 - GCS": 7.0, "Treatment Row 7 - Pupil R": 7.0, "Treatment Row 7 - Pupil L": 7.0, "Treatment Row 7 - Pain": 7.0, "Treatment Row 8 - Dose/Unit": 7.0, "Treatment Row 8 - Route": 7.0, "Treatment Row 8 - Pulse": 7.0, "Treatment Row 8 - Resp": 7.0, "Treatment Row 8 - BP": 7.0, "Treatment Row 8 - Temp": 7.0, "Treatment Row 8 - Reading/Code": 7.0, "Treatment Row 8 - SpO2": 7.0, "Treatment Row 8 - EtCO2": 7.0, "Treatment Row 8 - GCS": 7.0, "Treatment Row 8 - Pupil R": 7.0, "Treatment Row 8 - Pupil L": 7.0, "Treatment Row 8 - Pain": 7.0, "Treatment Row 9 - Dose/Unit": 7.0, "Treatment Row 9 - Route": 7.0, "Treatment Row 9 - Pulse": 7.0, "Treatment Row 9 - Resp": 7.0, "Treatment Row 9 - BP": 7.0, "Treatment Row 9 - Temp": 7.0, "Treatment Row 9 - Reading/Code": 7.0, "Treatment Row 9 - SpO2": 7.0, "Treatment Row 9 - EtCO2": 7.0, "Treatment Row 9 - GCS": 7.0, "Treatment Row 9 - Pupil R": 7.0, "Treatment Row 9 - Pupil L": 7.0, "Treatment Row 9 - Pain": 7.0, "Treatment Row 10 - Dose/Unit": 7.0, "Treatment Row 10 - Route": 7.0, "Treatment Row 10 - Pulse": 7.0, "Treatment Row 10 - Resp": 7.0, "Treatment Row 10 - BP": 7.0, "Treatment Row 10 - Temp": 7.0, "Treatment Row 10 - Reading/Code": 7.0, "Treatment Row 10 - SpO2": 7.0, "Treatment Row 10 - EtCO2": 7.0, "Treatment Row 10 - GCS": 7.0, "Treatment Row 10 - Pupil R": 7.0, "Treatment Row 10 - Pupil L": 7.0, "Treatment Row 10 - Pain": 7.0, "Treatment Row 11 - Dose/Unit": 7.0, "Treatment Row 11 - Route": 7.0, "Treatment Row 11 - Pulse": 7.0, "Treatment Row 11 - Resp": 7.0, "Treatment Row 11 - BP": 7.0, "Treatment Row 11 - Temp": 7.0, "Treatment Row 11 - Reading/Code": 7.0, "Treatment Row 11 - SpO2": 7.0, "Treatment Row 11 - EtCO2": 7.0, "Treatment Row 11 - GCS": 7.0, "Treatment Row 11 - Pupil R": 7.0, "Treatment Row 11 - Pupil L": 7.0, "Treatment Row 11 - Pain": 7.0, "Treatment Row 12 - Dose/Unit": 7.0, "Treatment Row 12 - Route": 7.0, "Treatment Row 12 - Pulse": 7.0, "Treatment Row 12 - Resp": 7.0, "Treatment Row 12 - BP": 7.0, "Treatment Row 12 - Temp": 7.0, "Treatment Row 12 - Reading/Code": 7.0, "Treatment Row 12 - SpO2": 7.0, "Treatment Row 12 - EtCO2": 7.0, "Treatment Row 12 - GCS": 7.0, "Treatment Row 12 - Pupil R": 7.0, "Treatment Row 12 - Pupil L": 7.0, "Treatment Row 12 - Pain": 7.0, "Treatment Row 13 - Dose/Unit": 7.0, "Treatment Row 13 - Route": 7.0, "Treatment Row 13 - Pulse": 7.0, "Treatment Row 13 - Resp": 7.0, "Treatment Row 13 - BP": 7.0, "Treatment Row 13 - Temp": 7.0, "Treatment Row 13 - Reading/Code": 7.0, "Treatment Row 13 - SpO2": 7.0, "Treatment Row 13 - EtCO2": 7.0, "Treatment Row 13 - GCS": 7.0, "Treatment Row 13 - Pupil R": 7.0, "Treatment Row 13 - Pupil L": 7.0, "Treatment Row 13 - Pain": 7.0, "Treatment Row 14 - Dose/Unit": 7.0, "Treatment Row 14 - Route": 7.0, "Treatment Row 14 - Pulse": 7.0, "Treatment Row 14 - Resp": 7.0, "Treatment Row 14 - BP": 7.0, "Treatment Row 14 - Temp": 7.0, "Treatment Row 14 - Reading/Code": 7.0, "Treatment Row 14 - SpO2": 7.0, "Treatment Row 14 - EtCO2": 7.0, "Treatment Row 14 - GCS": 7.0, "Treatment Row 14 - Pupil R": 7.0, "Treatment Row 14 - Pupil L": 7.0, "Treatment Row 14 - Pain": 7.0, "Treatment Row 15 - Dose/Unit": 7.0, "Treatment Row 15 - Route": 7.0, "Treatment Row 15 - Pulse": 7.0, "Treatment Row 15 - Resp": 7.0, "Treatment Row 15 - BP": 7.0, "Treatment Row 15 - Temp": 7.0, "Treatment Row 15 - Reading/Code": 7.0, "Treatment Row 15 - SpO2": 7.0, "Treatment Row 15 - EtCO2": 7.0, "Treatment Row 15 - GCS": 7.0, "Treatment Row 15 - Pupil R": 7.0, "Treatment Row 15 - Pupil L": 7.0, "Treatment Row 15 - Pain": 7.0, "Treatment Row 16 - Dose/Unit": 7.0, "Treatment Row 16 - Route": 7.0, "Treatment Row 16 - Pulse": 7.0, "Treatment Row 16 - Resp": 7.0, "Treatment Row 16 - BP": 7.0, "Treatment Row 16 - Temp": 7.0, "Treatment Row 16 - Reading/Code": 7.0, "Treatment Row 16 - SpO2": 7.0, "Treatment Row 16 - EtCO2": 7.0, "Treatment Row 16 - GCS": 7.0, "Treatment Row 16 - Pupil R": 7.0, "Treatment Row 16 - Pupil L": 7.0, "Treatment Row 16 - Pain": 7.0, "Treatment Row 17 - Dose/Unit": 7.0, "Treatment Row 17 - Route": 7.0, "Treatment Row 17 - Pulse": 7.0, "Treatment Row 17 - Resp": 7.0, "Treatment Row 17 - BP": 7.0, "Treatment Row 17 - Temp": 7.0, "Treatment Row 17 - Reading/Code": 7.0, "Treatment Row 17 - SpO2": 7.0, "Treatment Row 17 - EtCO2": 7.0, "Treatment Row 17 - GCS": 7.0, "Treatment Row 17 - Pupil R": 7.0, "Treatment Row 17 - Pupil L": 7.0, "Treatment Row 17 - Pain": 7.0, "Treatment Row 18 - Dose/Unit": 7.0, "Treatment Row 18 - Route": 7.0, "Treatment Row 18 - Pulse": 7.0, "Treatment Row 18 - Resp": 7.0, "Treatment Row 18 - BP": 7.0, "Treatment Row 18 - Temp": 7.0, "Treatment Row 18 - Reading/Code": 7.0, "Treatment Row 18 - SpO2": 7.0, "Treatment Row 18 - EtCO2": 7.0, "Treatment Row 18 - GCS": 7.0, "Treatment Row 18 - Pupil R": 7.0, "Treatment Row 18 - Pupil L": 7.0, "Treatment Row 18 - Pain": 7.0, "Treatment Row 19 - Dose/Unit": 7.0, "Treatment Row 19 - Route": 7.0, "Treatment Row 19 - Pulse": 7.0, "Treatment Row 19 - Resp": 7.0, "Treatment Row 19 - BP": 7.0, "Treatment Row 19 - Temp": 7.0, "Treatment Row 19 - Reading/Code": 7.0, "Treatment Row 19 - SpO2": 7.0, "Treatment Row 19 - EtCO2": 7.0, "Treatment Row 19 - GCS": 7.0, "Treatment Row 19 - Pupil R": 7.0, "Treatment Row 19 - Pupil L": 7.0, "Treatment Row 19 - Pain": 7.0, "Treatment Row 20 - Dose/Unit": 7.0, "Treatment Row 20 - Route": 7.0, "Treatment Row 20 - Pulse": 7.0, "Treatment Row 20 - Resp": 7.0, "Treatment Row 20 - BP": 7.0, "Treatment Row 20 - Temp": 7.0, "Treatment Row 20 - Reading/Code": 7.0, "Treatment Row 20 - SpO2": 7.0, "Treatment Row 20 - EtCO2": 7.0, "Treatment Row 20 - GCS": 7.0, "Treatment Row 20 - Pupil R": 7.0, "Treatment Row 20 - Pupil L": 7.0, "Treatment Row 20 - Pain": 7.0, "Treatment Row 21 - Dose/Unit": 7.0, "Treatment Row 21 - Route": 7.0, "Treatment Row 21 - Pulse": 7.0, "Treatment Row 21 - Resp": 7.0, "Treatment Row 21 - BP": 7.0, "Treatment Row 21 - Temp": 7.0, "Treatment Row 21 - Reading/Code": 7.0, "Treatment Row 21 - SpO2": 7.0, "Treatment Row 21 - EtCO2": 7.0, "Treatment Row 21 - GCS": 7.0, "Treatment Row 21 - Pupil R": 7.0, "Treatment Row 21 - Pupil L": 7.0, "Treatment Row 21 - Pain": 7.0, "Treatment Row 22 - Dose/Unit": 7.0, "Treatment Row 22 - Route": 7.0, "Treatment Row 22 - Pulse": 7.0, "Treatment Row 22 - Resp": 7.0, "Treatment Row 22 - BP": 7.0, "Treatment Row 22 - Temp": 7.0, "Treatment Row 22 - Reading/Code": 7.0, "Treatment Row 22 - SpO2": 7.0, "Treatment Row 22 - EtCO2": 7.0, "Treatment Row 22 - GCS": 7.0, "Treatment Row 22 - Pupil R": 7.0, "Treatment Row 22 - Pupil L": 7.0, "Treatment Row 22 - Pain": 7.0, "Treatment Row 23 - Dose/Unit": 7.0, "Treatment Row 23 - Route": 7.0, "Treatment Row 23 - Pulse": 7.0, "Treatment Row 23 - Resp": 7.0, "Treatment Row 23 - BP": 7.0, "Treatment Row 23 - Temp": 7.0, "Treatment Row 23 - Reading/Code": 7.0, "Treatment Row 23 - SpO2": 7.0, "Treatment Row 23 - EtCO2": 7.0, "Treatment Row 23 - GCS": 7.0, "Treatment Row 23 - Pupil R": 7.0, "Treatment Row 23 - Pupil L": 7.0, "Treatment Row 23 - Pain": 7.0, "Treatment Row 24 - Dose/Unit": 7.0, "Treatment Row 24 - Route": 7.0, "Treatment Row 24 - Pulse": 7.0, "Treatment Row 24 - Resp": 7.0, "Treatment Row 24 - BP": 7.0, "Treatment Row 24 - Temp": 7.0, "Treatment Row 24 - Reading/Code": 7.0, "Treatment Row 24 - SpO2": 7.0, "Treatment Row 24 - EtCO2": 7.0, "Treatment Row 24 - GCS": 7.0, "Treatment Row 24 - Pupil R": 7.0, "Treatment Row 24 - Pupil L": 7.0, "Treatment Row 24 - Pain": 7.0, "Treatment Row 25 - Dose/Unit": 7.0, "Treatment Row 25 - Route": 7.0, "Treatment Row 25 - Pulse": 7.0, "Treatment Row 25 - Resp": 7.0, "Treatment Row 25 - BP": 7.0, "Treatment Row 25 - Temp": 7.0, "Treatment Row 25 - Reading/Code": 7.0, "Treatment Row 25 - SpO2": 7.0, "Treatment Row 25 - EtCO2": 7.0, "Treatment Row 25 - GCS": 7.0, "Treatment Row 25 - Pupil R": 7.0, "Treatment Row 25 - Pupil L": 7.0, "Treatment Row 25 - Pain": 7.0, "Treatment Row 26 - Dose/Unit": 7.0, "Treatment Row 26 - Route": 7.0, "Treatment Row 26 - Pulse": 7.0, "Treatment Row 26 - Resp": 7.0, "Treatment Row 26 - BP": 7.0, "Treatment Row 26 - Temp": 7.0, "Treatment Row 26 - Reading/Code": 7.0, "Treatment Row 26 - SpO2": 7.0, "Treatment Row 26 - EtCO2": 7.0, "Treatment Row 26 - GCS": 7.0, "Treatment Row 26 - Pupil R": 7.0, "Treatment Row 26 - Pupil L": 7.0, "Treatment Row 26 - Pain": 7.0, "Treatment Row 1 - Procedure Line": 8.0, "Treatment Row 1 - Result Line": 8.0, "Treatment Row 2 - Procedure Line": 8.0, "Treatment Row 2 - Result Line": 8.0, "Treatment Row 3 - Procedure Line": 8.0, "Treatment Row 3 - Result Line": 8.0, "Treatment Row 4 - Procedure Line": 8.0, "Treatment Row 4 - Result Line": 8.0, "Treatment Row 5 - Procedure Line": 8.0, "Treatment Row 5 - Result Line": 8.0, "Treatment Row 6 - Procedure Line": 8.0, "Treatment Row 6 - Result Line": 8.0, "Treatment Row 7 - Procedure Line": 8.0, "Treatment Row 7 - Result Line": 8.0, "Treatment Row 8 - Procedure Line": 8.0, "Treatment Row 8 - Result Line": 8.0, "Treatment Row 9 - Procedure Line": 8.0, "Treatment Row 9 - Result Line": 8.0, "Treatment Row 10 - Procedure Line": 8.0, "Treatment Row 10 - Result Line": 8.0, "Treatment Row 11 - Procedure Line": 8.0, "Treatment Row 11 - Result Line": 8.0, "Treatment Row 12 - Procedure Line": 8.0, "Treatment Row 12 - Result Line": 8.0, "Treatment Row 13 - Procedure Line": 8.0, "Treatment Row 13 - Result Line": 8.0, "Treatment Row 14 - Procedure Line": 8.0, "Treatment Row 14 - Result Line": 8.0, "Treatment Row 15 - Procedure Line": 8.0, "Treatment Row 15 - Result Line": 8.0, "Treatment Row 16 - Procedure Line": 8.0, "Treatment Row 16 - Result Line": 8.0, "Treatment Row 17 - Procedure Line": 8.0, "Treatment Row 17 - Result Line": 8.0, "Treatment Row 18 - Procedure Line": 8.0, "Treatment Row 18 - Result Line": 8.0, "Treatment Row 19 - Procedure Line": 8.0, "Treatment Row 19 - Result Line": 8.0, "Treatment Row 20 - Procedure Line": 8.0, "Treatment Row 20 - Result Line": 8.0, "Treatment Row 21 - Procedure Line": 8.0, "Treatment Row 21 - Result Line": 8.0, "Treatment Row 22 - Procedure Line": 8.0, "Treatment Row 22 - Result Line": 8.0, "Treatment Row 23 - Procedure Line": 8.0, "Treatment Row 23 - Result Line": 8.0, "Treatment Row 24 - Procedure Line": 8.0, "Treatment Row 24 - Result Line": 8.0, "Treatment Row 25 - Procedure Line": 8.0, "Treatment Row 25 - Result Line": 8.0, "Treatment Row 26 - Procedure Line": 8.0, "Treatment Row 26 - Result Line": 8.0, "Full Line Hint": 4.2, "Across Hint P": 5.5, "Across Hint R": 5.5, "Tools Title": 6.0, "Submitted Stamp": 7.0, "Cont Call Number": 7.5, "Cont Page Number": 8.0, "Cont Total Pages": 8.0, "Treatment Row 27 - Time": 7.0, "Treatment Row 27 - Procedure Code": 7.0, "Treatment Row 27 - Dose/Unit": 7.0, "Treatment Row 27 - Route": 7.0, "Treatment Row 27 - Pulse": 7.0, "Treatment Row 27 - Resp": 7.0, "Treatment Row 27 - BP": 7.0, "Treatment Row 27 - Temp": 7.0, "Treatment Row 27 - Reading/Code": 7.0, "Treatment Row 27 - SpO2": 7.0, "Treatment Row 27 - EtCO2": 7.0, "Treatment Row 27 - GCS": 7.0, "Treatment Row 27 - Pupil R": 7.0, "Treatment Row 27 - Pupil L": 7.0, "Treatment Row 27 - Pain": 7.0, "Treatment Row 27 - Crew Member Number": 7.0, "Treatment Row 27 - Procedure Line": 8.0, "Treatment Row 27 - Result Line": 8.0, "Treatment Row 28 - Time": 7.0, "Treatment Row 28 - Procedure Code": 7.0, "Treatment Row 28 - Dose/Unit": 7.0, "Treatment Row 28 - Route": 7.0, "Treatment Row 28 - Pulse": 7.0, "Treatment Row 28 - Resp": 7.0, "Treatment Row 28 - BP": 7.0, "Treatment Row 28 - Temp": 7.0, "Treatment Row 28 - Reading/Code": 7.0, "Treatment Row 28 - SpO2": 7.0, "Treatment Row 28 - EtCO2": 7.0, "Treatment Row 28 - GCS": 7.0, "Treatment Row 28 - Pupil R": 7.0, "Treatment Row 28 - Pupil L": 7.0, "Treatment Row 28 - Pain": 7.0, "Treatment Row 28 - Crew Member Number": 7.0, "Treatment Row 28 - Procedure Line": 8.0, "Treatment Row 28 - Result Line": 8.0, "Treatment Row 29 - Time": 7.0, "Treatment Row 29 - Procedure Code": 7.0, "Treatment Row 29 - Dose/Unit": 7.0, "Treatment Row 29 - Route": 7.0, "Treatment Row 29 - Pulse": 7.0, "Treatment Row 29 - Resp": 7.0, "Treatment Row 29 - BP": 7.0, "Treatment Row 29 - Temp": 7.0, "Treatment Row 29 - Reading/Code": 7.0, "Treatment Row 29 - SpO2": 7.0, "Treatment Row 29 - EtCO2": 7.0, "Treatment Row 29 - GCS": 7.0, "Treatment Row 29 - Pupil R": 7.0, "Treatment Row 29 - Pupil L": 7.0, "Treatment Row 29 - Pain": 7.0, "Treatment Row 29 - Crew Member Number": 7.0, "Treatment Row 29 - Procedure Line": 8.0, "Treatment Row 29 - Result Line": 8.0, "Treatment Row 30 - Time": 7.0, "Treatment Row 30 - Procedure Code": 7.0, "Treatment Row 30 - Dose/Unit": 7.0, "Treatment Row 30 - Route": 7.0, "Treatment Row 30 - Pulse": 7.0, "Treatment Row 30 - Resp": 7.0, "Treatment Row 30 - BP": 7.0, "Treatment Row 30 - Temp": 7.0, "Treatment Row 30 - Reading/Code": 7.0, "Treatment Row 30 - SpO2": 7.0, "Treatment Row 30 - EtCO2": 7.0, "Treatment Row 30 - GCS": 7.0, "Treatment Row 30 - Pupil R": 7.0, "Treatment Row 30 - Pupil L": 7.0, "Treatment Row 30 - Pain": 7.0, "Treatment Row 30 - Crew Member Number": 7.0, "Treatment Row 30 - Procedure Line": 8.0, "Treatment Row 30 - Result Line": 8.0, "Treatment Row 31 - Time": 7.0, "Treatment Row 31 - Procedure Code": 7.0, "Treatment Row 31 - Dose/Unit": 7.0, "Treatment Row 31 - Route": 7.0, "Treatment Row 31 - Pulse": 7.0, "Treatment Row 31 - Resp": 7.0, "Treatment Row 31 - BP": 7.0, "Treatment Row 31 - Temp": 7.0, "Treatment Row 31 - Reading/Code": 7.0, "Treatment Row 31 - SpO2": 7.0, "Treatment Row 31 - EtCO2": 7.0, "Treatment Row 31 - GCS": 7.0, "Treatment Row 31 - Pupil R": 7.0, "Treatment Row 31 - Pupil L": 7.0, "Treatment Row 31 - Pain": 7.0, "Treatment Row 31 - Crew Member Number": 7.0, "Treatment Row 31 - Procedure Line": 8.0, "Treatment Row 31 - Result Line": 8.0, "Treatment Row 32 - Time": 7.0, "Treatment Row 32 - Procedure Code": 7.0, "Treatment Row 32 - Dose/Unit": 7.0, "Treatment Row 32 - Route": 7.0, "Treatment Row 32 - Pulse": 7.0, "Treatment Row 32 - Resp": 7.0, "Treatment Row 32 - BP": 7.0, "Treatment Row 32 - Temp": 7.0, "Treatment Row 32 - Reading/Code": 7.0, "Treatment Row 32 - SpO2": 7.0, "Treatment Row 32 - EtCO2": 7.0, "Treatment Row 32 - GCS": 7.0, "Treatment Row 32 - Pupil R": 7.0, "Treatment Row 32 - Pupil L": 7.0, "Treatment Row 32 - Pain": 7.0, "Treatment Row 32 - Crew Member Number": 7.0, "Treatment Row 32 - Procedure Line": 8.0, "Treatment Row 32 - Result Line": 8.0, "Treatment Row 33 - Time": 7.0, "Treatment Row 33 - Procedure Code": 7.0, "Treatment Row 33 - Dose/Unit": 7.0, "Treatment Row 33 - Route": 7.0, "Treatment Row 33 - Pulse": 7.0, "Treatment Row 33 - Resp": 7.0, "Treatment Row 33 - BP": 7.0, "Treatment Row 33 - Temp": 7.0, "Treatment Row 33 - Reading/Code": 7.0, "Treatment Row 33 - SpO2": 7.0, "Treatment Row 33 - EtCO2": 7.0, "Treatment Row 33 - GCS": 7.0, "Treatment Row 33 - Pupil R": 7.0, "Treatment Row 33 - Pupil L": 7.0, "Treatment Row 33 - Pain": 7.0, "Treatment Row 33 - Crew Member Number": 7.0, "Treatment Row 33 - Procedure Line": 8.0, "Treatment Row 33 - Result Line": 8.0, "Treatment Row 34 - Time": 7.0, "Treatment Row 34 - Procedure Code": 7.0, "Treatment Row 34 - Dose/Unit": 7.0, "Treatment Row 34 - Route": 7.0, "Treatment Row 34 - Pulse": 7.0, "Treatment Row 34 - Resp": 7.0, "Treatment Row 34 - BP": 7.0, "Treatment Row 34 - Temp": 7.0, "Treatment Row 34 - Reading/Code": 7.0, "Treatment Row 34 - SpO2": 7.0, "Treatment Row 34 - EtCO2": 7.0, "Treatment Row 34 - GCS": 7.0, "Treatment Row 34 - Pupil R": 7.0, "Treatment Row 34 - Pupil L": 7.0, "Treatment Row 34 - Pain": 7.0, "Treatment Row 34 - Crew Member Number": 7.0, "Treatment Row 34 - Procedure Line": 8.0, "Treatment Row 34 - Result Line": 8.0, "Treatment Row 35 - Time": 7.0, "Treatment Row 35 - Procedure Code": 7.0, "Treatment Row 35 - Dose/Unit": 7.0, "Treatment Row 35 - Route": 7.0, "Treatment Row 35 - Pulse": 7.0, "Treatment Row 35 - Resp": 7.0, "Treatment Row 35 - BP": 7.0, "Treatment Row 35 - Temp": 7.0, "Treatment Row 35 - Reading/Code": 7.0, "Treatment Row 35 - SpO2": 7.0, "Treatment Row 35 - EtCO2": 7.0, "Treatment Row 35 - GCS": 7.0, "Treatment Row 35 - Pupil R": 7.0, "Treatment Row 35 - Pupil L": 7.0, "Treatment Row 35 - Pain": 7.0, "Treatment Row 35 - Crew Member Number": 7.0, "Treatment Row 35 - Procedure Line": 8.0, "Treatment Row 35 - Result Line": 8.0, "Treatment Row 36 - Time": 7.0, "Treatment Row 36 - Procedure Code": 7.0, "Treatment Row 36 - Dose/Unit": 7.0, "Treatment Row 36 - Route": 7.0, "Treatment Row 36 - Pulse": 7.0, "Treatment Row 36 - Resp": 7.0, "Treatment Row 36 - BP": 7.0, "Treatment Row 36 - Temp": 7.0, "Treatment Row 36 - Reading/Code": 7.0, "Treatment Row 36 - SpO2": 7.0, "Treatment Row 36 - EtCO2": 7.0, "Treatment Row 36 - GCS": 7.0, "Treatment Row 36 - Pupil R": 7.0, "Treatment Row 36 - Pupil L": 7.0, "Treatment Row 36 - Pain": 7.0, "Treatment Row 36 - Crew Member Number": 7.0, "Treatment Row 36 - Procedure Line": 8.0, "Treatment Row 36 - Result Line": 8.0, "Treatment Row 37 - Time": 7.0, "Treatment Row 37 - Procedure Code": 7.0, "Treatment Row 37 - Dose/Unit": 7.0, "Treatment Row 37 - Route": 7.0, "Treatment Row 37 - Pulse": 7.0, "Treatment Row 37 - Resp": 7.0, "Treatment Row 37 - BP": 7.0, "Treatment Row 37 - Temp": 7.0, "Treatment Row 37 - Reading/Code": 7.0, "Treatment Row 37 - SpO2": 7.0, "Treatment Row 37 - EtCO2": 7.0, "Treatment Row 37 - GCS": 7.0, "Treatment Row 37 - Pupil R": 7.0, "Treatment Row 37 - Pupil L": 7.0, "Treatment Row 37 - Pain": 7.0, "Treatment Row 37 - Crew Member Number": 7.0, "Treatment Row 37 - Procedure Line": 8.0, "Treatment Row 37 - Result Line": 8.0, "Treatment Row 38 - Time": 7.0, "Treatment Row 38 - Procedure Code": 7.0, "Treatment Row 38 - Dose/Unit": 7.0, "Treatment Row 38 - Route": 7.0, "Treatment Row 38 - Pulse": 7.0, "Treatment Row 38 - Resp": 7.0, "Treatment Row 38 - BP": 7.0, "Treatment Row 38 - Temp": 7.0, "Treatment Row 38 - Reading/Code": 7.0, "Treatment Row 38 - SpO2": 7.0, "Treatment Row 38 - EtCO2": 7.0, "Treatment Row 38 - GCS": 7.0, "Treatment Row 38 - Pupil R": 7.0, "Treatment Row 38 - Pupil L": 7.0, "Treatment Row 38 - Pain": 7.0, "Treatment Row 38 - Crew Member Number": 7.0, "Treatment Row 38 - Procedure Line": 8.0, "Treatment Row 38 - Result Line": 8.0, "Treatment Row 39 - Time": 7.0, "Treatment Row 39 - Procedure Code": 7.0, "Treatment Row 39 - Dose/Unit": 7.0, "Treatment Row 39 - Route": 7.0, "Treatment Row 39 - Pulse": 7.0, "Treatment Row 39 - Resp": 7.0, "Treatment Row 39 - BP": 7.0, "Treatment Row 39 - Temp": 7.0, "Treatment Row 39 - Reading/Code": 7.0, "Treatment Row 39 - SpO2": 7.0, "Treatment Row 39 - EtCO2": 7.0, "Treatment Row 39 - GCS": 7.0, "Treatment Row 39 - Pupil R": 7.0, "Treatment Row 39 - Pupil L": 7.0, "Treatment Row 39 - Pain": 7.0, "Treatment Row 39 - Crew Member Number": 7.0, "Treatment Row 39 - Procedure Line": 8.0, "Treatment Row 39 - Result Line": 8.0, "Treatment Row 40 - Time": 7.0, "Treatment Row 40 - Procedure Code": 7.0, "Treatment Row 40 - Dose/Unit": 7.0, "Treatment Row 40 - Route": 7.0, "Treatment Row 40 - Pulse": 7.0, "Treatment Row 40 - Resp": 7.0, "Treatment Row 40 - BP": 7.0, "Treatment Row 40 - Temp": 7.0, "Treatment Row 40 - Reading/Code": 7.0, "Treatment Row 40 - SpO2": 7.0, "Treatment Row 40 - EtCO2": 7.0, "Treatment Row 40 - GCS": 7.0, "Treatment Row 40 - Pupil R": 7.0, "Treatment Row 40 - Pupil L": 7.0, "Treatment Row 40 - Pain": 7.0, "Treatment Row 40 - Crew Member Number": 7.0, "Treatment Row 40 - Procedure Line": 8.0, "Treatment Row 40 - Result Line": 8.0, "Treatment Row 41 - Time": 7.0, "Treatment Row 41 - Procedure Code": 7.0, "Treatment Row 41 - Dose/Unit": 7.0, "Treatment Row 41 - Route": 7.0, "Treatment Row 41 - Pulse": 7.0, "Treatment Row 41 - Resp": 7.0, "Treatment Row 41 - BP": 7.0, "Treatment Row 41 - Temp": 7.0, "Treatment Row 41 - Reading/Code": 7.0, "Treatment Row 41 - SpO2": 7.0, "Treatment Row 41 - EtCO2": 7.0, "Treatment Row 41 - GCS": 7.0, "Treatment Row 41 - Pupil R": 7.0, "Treatment Row 41 - Pupil L": 7.0, "Treatment Row 41 - Pain": 7.0, "Treatment Row 41 - Crew Member Number": 7.0, "Treatment Row 41 - Procedure Line": 8.0, "Treatment Row 41 - Result Line": 8.0, "Treatment Row 42 - Time": 7.0, "Treatment Row 42 - Procedure Code": 7.0, "Treatment Row 42 - Dose/Unit": 7.0, "Treatment Row 42 - Route": 7.0, "Treatment Row 42 - Pulse": 7.0, "Treatment Row 42 - Resp": 7.0, "Treatment Row 42 - BP": 7.0, "Treatment Row 42 - Temp": 7.0, "Treatment Row 42 - Reading/Code": 7.0, "Treatment Row 42 - SpO2": 7.0, "Treatment Row 42 - EtCO2": 7.0, "Treatment Row 42 - GCS": 7.0, "Treatment Row 42 - Pupil R": 7.0, "Treatment Row 42 - Pupil L": 7.0, "Treatment Row 42 - Pain": 7.0, "Treatment Row 42 - Crew Member Number": 7.0, "Treatment Row 42 - Procedure Line": 8.0, "Treatment Row 42 - Result Line": 8.0, "Treatment Row 43 - Time": 7.0, "Treatment Row 43 - Procedure Code": 7.0, "Treatment Row 43 - Dose/Unit": 7.0, "Treatment Row 43 - Route": 7.0, "Treatment Row 43 - Pulse": 7.0, "Treatment Row 43 - Resp": 7.0, "Treatment Row 43 - BP": 7.0, "Treatment Row 43 - Temp": 7.0, "Treatment Row 43 - Reading/Code": 7.0, "Treatment Row 43 - SpO2": 7.0, "Treatment Row 43 - EtCO2": 7.0, "Treatment Row 43 - GCS": 7.0, "Treatment Row 43 - Pupil R": 7.0, "Treatment Row 43 - Pupil L": 7.0, "Treatment Row 43 - Pain": 7.0, "Treatment Row 43 - Crew Member Number": 7.0, "Treatment Row 43 - Procedure Line": 8.0, "Treatment Row 43 - Result Line": 8.0, "Treatment Row 44 - Time": 7.0, "Treatment Row 44 - Procedure Code": 7.0, "Treatment Row 44 - Dose/Unit": 7.0, "Treatment Row 44 - Route": 7.0, "Treatment Row 44 - Pulse": 7.0, "Treatment Row 44 - Resp": 7.0, "Treatment Row 44 - BP": 7.0, "Treatment Row 44 - Temp": 7.0, "Treatment Row 44 - Reading/Code": 7.0, "Treatment Row 44 - SpO2": 7.0, "Treatment Row 44 - EtCO2": 7.0, "Treatment Row 44 - GCS": 7.0, "Treatment Row 44 - Pupil R": 7.0, "Treatment Row 44 - Pupil L": 7.0, "Treatment Row 44 - Pain": 7.0, "Treatment Row 44 - Crew Member Number": 7.0, "Treatment Row 44 - Procedure Line": 8.0, "Treatment Row 44 - Result Line": 8.0, "Treatment Row 45 - Time": 7.0, "Treatment Row 45 - Procedure Code": 7.0, "Treatment Row 45 - Dose/Unit": 7.0, "Treatment Row 45 - Route": 7.0, "Treatment Row 45 - Pulse": 7.0, "Treatment Row 45 - Resp": 7.0, "Treatment Row 45 - BP": 7.0, "Treatment Row 45 - Temp": 7.0, "Treatment Row 45 - Reading/Code": 7.0, "Treatment Row 45 - SpO2": 7.0, "Treatment Row 45 - EtCO2": 7.0, "Treatment Row 45 - GCS": 7.0, "Treatment Row 45 - Pupil R": 7.0, "Treatment Row 45 - Pupil L": 7.0, "Treatment Row 45 - Pain": 7.0, "Treatment Row 45 - Crew Member Number": 7.0, "Treatment Row 45 - Procedure Line": 8.0, "Treatment Row 45 - Result Line": 8.0, "Treatment Row 46 - Time": 7.0, "Treatment Row 46 - Procedure Code": 7.0, "Treatment Row 46 - Dose/Unit": 7.0, "Treatment Row 46 - Route": 7.0, "Treatment Row 46 - Pulse": 7.0, "Treatment Row 46 - Resp": 7.0, "Treatment Row 46 - BP": 7.0, "Treatment Row 46 - Temp": 7.0, "Treatment Row 46 - Reading/Code": 7.0, "Treatment Row 46 - SpO2": 7.0, "Treatment Row 46 - EtCO2": 7.0, "Treatment Row 46 - GCS": 7.0, "Treatment Row 46 - Pupil R": 7.0, "Treatment Row 46 - Pupil L": 7.0, "Treatment Row 46 - Pain": 7.0, "Treatment Row 46 - Crew Member Number": 7.0, "Treatment Row 46 - Procedure Line": 8.0, "Treatment Row 46 - Result Line": 8.0, "Treatment Row 47 - Time": 7.0, "Treatment Row 47 - Procedure Code": 7.0, "Treatment Row 47 - Dose/Unit": 7.0, "Treatment Row 47 - Route": 7.0, "Treatment Row 47 - Pulse": 7.0, "Treatment Row 47 - Resp": 7.0, "Treatment Row 47 - BP": 7.0, "Treatment Row 47 - Temp": 7.0, "Treatment Row 47 - Reading/Code": 7.0, "Treatment Row 47 - SpO2": 7.0, "Treatment Row 47 - EtCO2": 7.0, "Treatment Row 47 - GCS": 7.0, "Treatment Row 47 - Pupil R": 7.0, "Treatment Row 47 - Pupil L": 7.0, "Treatment Row 47 - Pain": 7.0, "Treatment Row 47 - Crew Member Number": 7.0, "Treatment Row 47 - Procedure Line": 8.0, "Treatment Row 47 - Result Line": 8.0, "Treatment Row 48 - Time": 7.0, "Treatment Row 48 - Procedure Code": 7.0, "Treatment Row 48 - Dose/Unit": 7.0, "Treatment Row 48 - Route": 7.0, "Treatment Row 48 - Pulse": 7.0, "Treatment Row 48 - Resp": 7.0, "Treatment Row 48 - BP": 7.0, "Treatment Row 48 - Temp": 7.0, "Treatment Row 48 - Reading/Code": 7.0, "Treatment Row 48 - SpO2": 7.0, "Treatment Row 48 - EtCO2": 7.0, "Treatment Row 48 - GCS": 7.0, "Treatment Row 48 - Pupil R": 7.0, "Treatment Row 48 - Pupil L": 7.0, "Treatment Row 48 - Pain": 7.0, "Treatment Row 48 - Crew Member Number": 7.0, "Treatment Row 48 - Procedure Line": 8.0, "Treatment Row 48 - Result Line": 8.0, "Treatment Row 49 - Time": 7.0, "Treatment Row 49 - Procedure Code": 7.0, "Treatment Row 49 - Dose/Unit": 7.0, "Treatment Row 49 - Route": 7.0, "Treatment Row 49 - Pulse": 7.0, "Treatment Row 49 - Resp": 7.0, "Treatment Row 49 - BP": 7.0, "Treatment Row 49 - Temp": 7.0, "Treatment Row 49 - Reading/Code": 7.0, "Treatment Row 49 - SpO2": 7.0, "Treatment Row 49 - EtCO2": 7.0, "Treatment Row 49 - GCS": 7.0, "Treatment Row 49 - Pupil R": 7.0, "Treatment Row 49 - Pupil L": 7.0, "Treatment Row 49 - Pain": 7.0, "Treatment Row 49 - Crew Member Number": 7.0, "Treatment Row 49 - Procedure Line": 8.0, "Treatment Row 49 - Result Line": 8.0, "Treatment Row 50 - Time": 7.0, "Treatment Row 50 - Procedure Code": 7.0, "Treatment Row 50 - Dose/Unit": 7.0, "Treatment Row 50 - Route": 7.0, "Treatment Row 50 - Pulse": 7.0, "Treatment Row 50 - Resp": 7.0, "Treatment Row 50 - BP": 7.0, "Treatment Row 50 - Temp": 7.0, "Treatment Row 50 - Reading/Code": 7.0, "Treatment Row 50 - SpO2": 7.0, "Treatment Row 50 - EtCO2": 7.0, "Treatment Row 50 - GCS": 7.0, "Treatment Row 50 - Pupil R": 7.0, "Treatment Row 50 - Pupil L": 7.0, "Treatment Row 50 - Pain": 7.0, "Treatment Row 50 - Crew Member Number": 7.0, "Treatment Row 50 - Procedure Line": 8.0, "Treatment Row 50 - Result Line": 8.0, "Treatment Row 51 - Time": 7.0, "Treatment Row 51 - Procedure Code": 7.0, "Treatment Row 51 - Dose/Unit": 7.0, "Treatment Row 51 - Route": 7.0, "Treatment Row 51 - Pulse": 7.0, "Treatment Row 51 - Resp": 7.0, "Treatment Row 51 - BP": 7.0, "Treatment Row 51 - Temp": 7.0, "Treatment Row 51 - Reading/Code": 7.0, "Treatment Row 51 - SpO2": 7.0, "Treatment Row 51 - EtCO2": 7.0, "Treatment Row 51 - GCS": 7.0, "Treatment Row 51 - Pupil R": 7.0, "Treatment Row 51 - Pupil L": 7.0, "Treatment Row 51 - Pain": 7.0, "Treatment Row 51 - Crew Member Number": 7.0, "Treatment Row 51 - Procedure Line": 8.0, "Treatment Row 51 - Result Line": 8.0, "Treatment Row 52 - Time": 7.0, "Treatment Row 52 - Procedure Code": 7.0, "Treatment Row 52 - Dose/Unit": 7.0, "Treatment Row 52 - Route": 7.0, "Treatment Row 52 - Pulse": 7.0, "Treatment Row 52 - Resp": 7.0, "Treatment Row 52 - BP": 7.0, "Treatment Row 52 - Temp": 7.0, "Treatment Row 52 - Reading/Code": 7.0, "Treatment Row 52 - SpO2": 7.0, "Treatment Row 52 - EtCO2": 7.0, "Treatment Row 52 - GCS": 7.0, "Treatment Row 52 - Pupil R": 7.0, "Treatment Row 52 - Pupil L": 7.0, "Treatment Row 52 - Pain": 7.0, "Treatment Row 52 - Crew Member Number": 7.0, "Treatment Row 52 - Procedure Line": 8.0, "Treatment Row 52 - Result Line": 8.0, "Remarks 2": 7.5, "Remarks 3": 7.5, "Full Line Hint C": 4.2, "Across Hint P C": 5.5, "Across Hint R C": 5.5, "Review - Call Number": 8.0, "Review - Reflection 1": 7.5, "Review - Reflection 2": 7.5, "Review - Call Intervals": 6.8, "Review - Vitals Trend": 6.8, "Review - Check Results": 6.3, "Review - Instructor Notes": 7.5};
var ACR_MULTILINE={"Incident Hx": true, "Relevant Past History Details": true, "Medication Details": true, "Allergy Details": true, "Treatment Prior to Arrival Details": true, "General Appearance Details": true, "Head/Neck": true, "Chest Exam Details": true, "Remarks": true, "Patient or SDM Name and Address": true, "Remarks 2": true, "Remarks 3": true, "Review - Reflection 1": true, "Review - Reflection 2": true, "Review - Call Intervals": true, "Review - Vitals Trend": true, "Review - Check Results": true, "Review - Instructor Notes": true};
// Repair overrides. ES5 syntax for Acrobat. All existing field names and page geometry retained.
function acrMin(t) {
 var m=/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(t||'').replace(/^(~|approx\.?)\s*/i,''));
 if(!m || +m[1]>23 || +m[2]>59 || (m[3] && +m[3]>59)) return null;
 return (+m[1])*60+(+m[2])+(m[3]?(+m[3])/60:0);
}
function acrRowFree(doc,i,side) {
 if(i<1 || i>ACR_ROWS)return false;
 var p='Treatment Row '+i+' - ';
 if(!doc.getField(p+ACR_SIDES[side].line))return false;
 var names=['Time','Procedure Code','Crew Member Number','Procedure Line','Result Line'].concat(ACR_COLS);
 for(var k=0;k<names.length;k++)if(acrV(doc,p+names[k]))return false;
 return true;
}
function acrCarry(doc,i,side,text) {
 var plan=[],n=i,rest=String(text||'');
 while(rest){
  if(!acrRowFree(doc,n,side))return false;
  var f=doc.getField(acrRowName(n,ACR_SIDES[side].line)),parts=acrSplitLine(f,rest);
  if(!parts[0] || parts[1]===rest)return false;
  plan.push([n,parts[0]]);rest=parts[1];n++;
 }
 // No writes occur until every destination is verified empty and the entire remainder fits.
 for(var k=0;k<plan.length;k++){var out=acrOpenLine(doc,plan[k][0],side);out.value=plan[k][1];acrFitValue(out,plan[k][1]);}
 return true;
}
function acrLineKey(doc,ev,i,side) {
 // Validate only. Keystroke never mutates another field or changes focus.
 if(ev.name==='Keystroke')return;
 var f=ev.target,v=String(ev.value||'');acrFitValue(f,v);
 if(acrFits(f,v))return;
 var parts=acrSplitLine(f,v);
 if(acrCarry(doc,i+1,side,parts[1])){ev.value=parts[0];acrFitValue(f,parts[0]);}
 else app.alert('Row '+i+': the full text is kept in this field and sized to fit. No other entry was changed. If it is too small to read, continue in Remarks and identify this row and time.',3);
}
function acrIsYellow(c){return c && c.length===4 && c[0]==='RGB' && Math.abs(c[1]-1)<0.01 && Math.abs(c[2]-0.93)<0.01 && Math.abs(c[3]-0.55)<0.01;}
function acrClearHighlights(doc) {
 // Persisted backgrounds survive reopening; the old in-memory list does not.
 for(var k=0;k<doc.numFields;k++){
  var n=doc.getNthFieldName(k),f=doc.getField(n);
  if(f && acrIsYellow(f.fillColor)){try{f.fillColor=ACR_WHITE_FIELDS[n]?color.white:color.transparent;}catch(e){}}
 }
 acrHighlighted=[];
}
var acrStaleLabel='OUT OF DATE - the chart changed or was reopened. Run Check my ACR again.\n';
function acrInvalidate(doc){
 var f=doc.getField('Review - Check Results');
 if(f && f.valueAsString && String(f.valueAsString).indexOf(acrStaleLabel)!==0){f.value=acrStaleLabel+String(f.valueAsString);acrFitValue(f,f.value);acrClearHighlights(doc);}
}
function acrChanged(doc,ev){if(!ev || ev.rc!==false){if(ev && ev.target && ev.target.type==='text')acrFitValue(ev.target,ev.value);acrInvalidate(doc);}}
function acrAgeWords(doc){
 var a=acrAge(doc);if(!a)return acrV(doc,'Age')||'[age?]';
 return (a.est?'approximately ':'')+a.n+' '+({Y:'year',M:'month',D:'day'}[a.unit]||'year')+' old';
}
function acrCalcTotalPages(doc){return '2';} // There are always two fixed treatment sheets in this PDF.
function acrCalcTrend(doc){
 var rows=acrRows(doc),vit=[],keys=['Pulse','BP','Resp','SpO2','EtCO2','GCS','Pain','Temp','Reading/Code','Pupil R','Pupil L'],k,j;
 for(k=0;k<rows.length;k++){for(j=0;j<keys.length;j++)if(rows[k][keys[j]]){vit.push(rows[k]);break;}}
 if(!vit.length)return 'No vitals in the grid yet.';
 function series(key){var s=[];for(var n=0;n<vit.length;n++)if(vit[n][key])s.push(vit[n][key]);return s.length?s.join(' > '):'-';}
 var out=['Sets of vitals: '+vit.length+' (first '+(vit[0].time||'?')+', last '+(vit[vit.length-1].time||'?')+')'];
 var labels=['HR','BP','RR','SpO2','EtCO2','GCS','Pain','Temp','Reading/code','Pupil R','Pupil L'];
 for(k=0;k<keys.length;k++)if(series(keys[k])!=='-')out.push(labels[k]+': '+series(keys[k]));
 var f=vit[0],sbp=parseInt(String(f.BP).split('/')[0],10),hr=parseInt(f.Pulse,10);
 if(sbp>0 && hr>0)out.push('Shock index, first set (HR / systolic): '+(Math.round(hr/sbp*100)/100));
 return out.join('\n');
}

// Keep the original type size; reduce it only when the actual text needs more room.
function acrFitValue(f,value){
 if(!f || !f.rect)return;
 var v=String(value||''),r=f.rect,room=Math.max(1,Math.abs(r[2]-r[0])-5),height=Math.max(1,Math.abs(r[1]-r[3])-4);
 var base=ACR_BASE_SIZES[f.name]||7.5,multi=!!ACR_MULTILINE[f.name];
 function lineCount(size){
  var paragraphs=v.split(/\r\n|\r|\n/),count=0;
  for(var p=0;p<paragraphs.length;p++){
   var words=paragraphs[p].split(/\s+/),width=0;count++;
   for(var k=0;k<words.length;k++){
    var word=acrTextWidth(words[k])*size/8,space=width?acrTextWidth(' ')*size/8:0;
    if(width && width+space+word>room){count++;width=0;space=0;}
    if(word>room){var n=Math.ceil(word/room);count+=n-1;word-=room*(n-1);}
    width+=space+word;
   }
  }
  return count;
 }
 var size=base;
 if(multi){while(size>0.5 && lineCount(size)*size*1.2>height)size=Math.max(0.5,size-0.1);}
 else {var width=acrTextWidth(v);if(width>0)size=Math.min(base,8*room/width);size=Math.min(size,height);}
 var fitted=Math.max(0.5,Math.round(size*100)/100);if(typeof f.textSize!=='number' || Math.abs(f.textSize-fitted)>0.005)f.textSize=fitted;
}

// Conservative on reopen: never present a saved checker snapshot as a fresh check.
acrInvalidate(this);
acrClearHighlights(this);

for(var acrFitIndex=0;acrFitIndex<this.numFields;acrFitIndex++){var acrFitField=this.getField(this.getNthFieldName(acrFitIndex));if(acrFitField && acrFitField.type==='text' && acrFitField.valueAsString)acrFitValue(acrFitField,acrFitField.valueAsString);}
