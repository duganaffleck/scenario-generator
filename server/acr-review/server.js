// Standalone server for trying ACR review on its own (not needed inside Scenario Generator):
//   ACR_REVIEW_MODE=mock node acr-review/server.js     (no API key needed, rule-based feedback)
//   ACR_REVIEW_MODE=openai OPENAI_API_KEY=... node acr-review/server.js
// Then open http://localhost:3100

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import acrReviewRouter from './router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use('/api/acr-review', acrReviewRouter);
app.use(express.static(path.join(__dirname, 'public')));

const port = process.env.ACR_STANDALONE_PORT || 3100;
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  app.listen(port, () => console.log(`ACR review on http://localhost:${port} (mode: ${process.env.ACR_REVIEW_MODE || 'mock'})`));
}
export default app;
