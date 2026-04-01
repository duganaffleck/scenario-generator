import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import generateScenarioRouter from './routes/generateScenario.js';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/generate-scenario', generateScenarioRouter);

app.get('/', (req, res) => {
  res.send('Scenario Generator Backend Running');
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});