import type { IncomingMessage, ServerResponse } from 'http';
import { generateReflection, generatePrompts, synthesizeEntries } from './geminiService.ts';

// Helper to parse JSON body from incoming request
async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // Protect against gigantic payloads (10MB max)
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const method = req.method || 'GET';

  // Health check endpoint
  if (url === '/api/health' || url.startsWith('/api/health?')) {
    const hasKey = Boolean(process.env.GEMINI_API_KEY);
    sendJson(res, 200, {
      status: 'ok',
      hasApiKey: hasKey,
      timestamp: new Date().toISOString(),
      security: {
        serverSideGemini: true,
        clientKeyExposed: false,
        aesStorageSupport: true,
      },
    });
    return true;
  }

  // Reflect on entry
  if (url === '/api/gemini/reflect' && method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body.entryText || typeof body.entryText !== 'string') {
        sendJson(res, 400, { error: 'entryText is required' });
        return true;
      }
      const result = await generateReflection(body);
      sendJson(res, 200, result);
    } catch (err: any) {
      console.error('Error in /api/gemini/reflect:', err);
      sendJson(res, 500, {
        error: err.message || 'Failed to generate reflection with Gemini',
      });
    }
    return true;
  }

  // Generate prompts
  if (url === '/api/gemini/prompt' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await generatePrompts(body);
      sendJson(res, 200, { prompts: result });
    } catch (err: any) {
      console.error('Error in /api/gemini/prompt:', err);
      sendJson(res, 500, {
        error: err.message || 'Failed to generate prompts with Gemini',
      });
    }
    return true;
  }

  // Synthesize entries
  if (url === '/api/gemini/synthesize' && method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!Array.isArray(body.entries) || body.entries.length === 0) {
        sendJson(res, 400, { error: 'entries array is required' });
        return true;
      }
      const result = await synthesizeEntries(body);
      sendJson(res, 200, result);
    } catch (err: any) {
      console.error('Error in /api/gemini/synthesize:', err);
      sendJson(res, 500, {
        error: err.message || 'Failed to synthesize entries with Gemini',
      });
    }
    return true;
  }

  return false;
}
