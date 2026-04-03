#!/usr/bin/env python3
import json

# Load the JSON file
with open('server/data/few-shot-scenarios.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Define the teaching points to convert
conversions = {
    # Opioid overdose - already has some entry, need to verify
    "This is an airway case before it is a tox case.": "This is an airway case before it is a tox case. Pinpoint pupils and paraphernalia help, but breathing pattern drives urgency more than the story. A partially awakened patient who is breathing adequately is a good outcome in the field. Reversal does not end the call; recurrence and aspiration remain major risks. Scene safety includes sharps, bystanders, and the patient's behavior after reversal.",
    
    # Simple respiratory 
    "Simple respiratory calls still require disciplined exam and trend documentation.": "Simple respiratory calls still require disciplined exam and trend documentation. Calm coaching can reduce symptom amplification from anxiety. Clear handoff should include trigger history and objective trend response.",
}

# Convert each scenario
converted_count = 0
for scenario in data:
    if "teachersPoints" in scenario:
        tp = scenario["teachersPoints"]
        
        # If it's an array, convert to string
        if isinstance(tp, list):
            scenario["teachersPoints"] = " ".join(tp)
            converted_count += 1
            print(f"Converted: {scenario.get('title', 'Unknown')}")

print(f"\nTotal converted: {converted_count}")

# Write back to file
with open('server/data/few-shot-scenarios.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("File updated successfully!")
