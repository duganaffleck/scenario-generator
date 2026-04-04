// scenarioController.js
// Controller for scenario generation route
import * as scenarioService from '../services/scenarioService.js';

export async function generateScenario(req, res) {
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
