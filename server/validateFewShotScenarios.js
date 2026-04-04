// validateFewShotScenarios.js
import Ajv from "ajv";
import fs from "fs";
import path from "path";

const schemaPath = path.join(__dirname, "data", "scenarioSchema.json");
const dataPath = path.join(__dirname, "data", "few-shot-scenarios.json");

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

const ajv = new Ajv();
const validate = ajv.compile(schema);

let errors = [];

for (let i = 0; i < data.length; i++) {
  const valid = validate(data[i]);
  if (!valid) {
    errors.push({
      index: i,
      title: data[i].title || "(no title)",
      errors: validate.errors
    });
  }
}

if (errors.length > 0) {
  console.error("Validation errors found in few-shot-scenarios.json:");
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
} else {
  console.log("All scenarios are valid.");
}
