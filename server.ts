import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleApiRequest } from './server/apiRouter.ts';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(async (req, res, next) => {
  if (req.url.startsWith('/api/')) {
    const handled = await handleApiRequest(req, res);
    if (handled) return;
  }
  next();
});

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Personal Gemini Journal production server running on port ${PORT}`);
});
