// server.test.js
import request from 'supertest';
import express from 'express';
import generateScenarioRouter from './routes/generateScenario.js';

const app = express();
app.use(express.json());
app.use('/api/generate-scenario', generateScenarioRouter);

describe('GET /api/generate-scenario', () => {
  it('should return 400 for missing required params', async () => {
    const res = await request(app).post('/api/generate-scenario').send({});
    expect(res.statusCode).toBe(400);
  });
});
