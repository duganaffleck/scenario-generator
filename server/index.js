import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';


import generateScenarioRouter from './routes/generateScenario.js';

const app = express();
app.set('trust proxy', 1);
// Log all incoming requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
const PORT = process.env.PORT || 10000;

const allowedOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin denied'));
  }
};

const apiRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please retry shortly.' }
});

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use('/api/', apiRateLimiter);

app.use('/api/generate-scenario', generateScenarioRouter);

app.get('/', (req, res) => {
  res.send('Scenario Generator Backend Running');
});


// Global error handler for unhandled errors
app.use((err, req, res, next) => {
  console.error('UNHANDLED ERROR:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});