// scenarioController.js
// Controller for scenario generation route
import * as scenarioService from '../services/scenarioService.js';

export async function generateScenario(req, res) {
  // Psychological safety: block forbidden terms in any input
  const forbiddenTerms = [
    /punish(ment|ing)?/i,
    /blame/i,
    /fault/i,
    /failure(?! to| of| risk| pattern| points?)/i // allow clinical use, block as personal flaw
  ];
  const checkForbidden = (val) => {
    if (!val) return false;
    if (typeof val === 'string') {
      return forbiddenTerms.some((re) => re.test(val));
    }
    if (Array.isArray(val)) {
      return val.some(checkForbidden);
    }
    if (typeof val === 'object' && val !== null) {
      return Object.values(val).some(checkForbidden);
    }
    return false;
  };
  if (checkForbidden(req.body)) {
    return res.status(400).json({ error: "Psychological safety rule: No 'punishment', 'blame', 'fault', or 'failure' (as a personal flaw) allowed in any section. Please revise your input." });
  }
  try {
    const result = await scenarioService.generateScenario(req.body);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
}
