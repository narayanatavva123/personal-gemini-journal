import express from 'express';
import path from 'path';
import fs from 'fs';
import { handleApiRequest } from './server/apiRouter.ts';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Cloud Run provides the PORT environment variable (default: 3000)
const PORT = parseInt(process.env.PORT || '3000', 10);

// Resolve static dist path cleanly for both direct execution and bundled dist/server.cjs
const rootDir = process.cwd();
const distPath = fs.existsSync(path.join(rootDir, 'dist', 'index.html'))
  ? path.join(rootDir, 'dist')
  : typeof __dirname !== 'undefined' && fs.existsSync(path.join(__dirname, 'index.html'))
  ? __dirname
  : typeof __dirname !== 'undefined'
  ? path.join(__dirname, 'dist')
  : path.join(rootDir, 'dist');

// Handle API requests
app.use(async (req, res, next) => {
  if (req.url.startsWith('/api/')) {
    const handled = await handleApiRequest(req, res);

    if (handled) {
      return;
    }
  }

  next();
});

// Serve React/Vite build files
app.use(express.static(distPath));

// SPA fallback for Express 4
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Personal Gemini Journal production server running on 0.0.0.0:${PORT} (serving: ${distPath})`
  );
});
