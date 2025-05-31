import express from 'express'; // ✅ Must be first
import dotenv from 'dotenv';
import cors from 'cors';
import scenarioRoute from './routes/generateScenario.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') }); //

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

app.use('/api/scenario', scenarioRoute);

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
