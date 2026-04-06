import { request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TOKEN_FILE = path.join(__dirname, '.auth-tokens.json');

const USERS = [
  { key: 'customer', email: 'customer@evcharge.com', password: 'password123' },
  { key: 'manager', email: 'manager1@evcharge.com', password: 'password123' },
  { key: 'admin', email: 'admin@evcharge.com', password: 'admin123' },
];

async function globalSetup() {
  const ctx = await request.newContext({ baseURL: API_URL });
  const tokens: Record<string, string> = {};

  for (const user of USERS) {
    const res = await ctx.post('/api/auth/login', {
      data: { email: user.email, password: user.password },
    });
    if (!res.ok()) {
      throw new Error(`Global setup: login failed for ${user.email} (${res.status()})`);
    }
    const body = await res.json();
    tokens[user.email] = body.token;
  }

  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens));
  await ctx.dispose();
}

export default globalSetup;
export { TOKEN_FILE };
