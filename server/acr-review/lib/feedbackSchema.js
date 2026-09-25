// Strict JSON schema for the reviewer's output (OpenAI structured outputs, strict mode).
// Strict mode needs every property required and additionalProperties false. Limits like "at most three fixes"
// are enforced in the prompt and again in postProcess(), since strict mode ignores maxItems.

const DOMAINS = ['Completeness', 'Accuracy and consistency', 'Chronology and reassessment',
  'Clinical reasoning in the narrative', 'Codes, times and format', 'Handover, disposition and refusal'];

const str = { type: 'string' };
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'strengths', 'fixes', 'scenario_questions', 'question_to_think_about', 'rubric',
    'improvement_since_last', 'model_sentence', 'instructor_flags'],
  properties: {
    summary: str,
    strengths: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['point', 'evidence'], properties: { point: str, evidence: str } } },
    fixes: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['priority', 'issue', 'evidence', 'why_it_matters', 'what_to_do'],
      properties: { priority: { type: 'integer' }, issue: str, evidence: str, why_it_matters: str, what_to_do: str } } },
    scenario_questions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['question', 'scenario_fact'], properties: { question: str, scenario_fact: str } } },
    question_to_think_about: str,
    rubric: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['domain', 'score', 'evidence'],
      properties: { domain: { type: 'string', enum: DOMAINS }, score: { type: ['integer', 'null'] }, evidence: str } } },
    improvement_since_last: { type: 'array', items: str },
    model_sentence: { type: 'object', additionalProperties: false, required: ['offered', 'text', 'note'], properties: { offered: { type: 'boolean' }, text: str, note: str } },
    instructor_flags: { type: 'array', items: str },
  },
};

export { schema, DOMAINS };
