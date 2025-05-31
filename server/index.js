import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import generateScenarioRouter from './routes/generateScenario.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// ✅ THIS is what allows /api/generate-scenario to work
app.use('/api/generate-scenario', generateScenarioRouter);

app.get('/', (req, res) => {
  res.send('Scenario Generator Backend Running');
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
