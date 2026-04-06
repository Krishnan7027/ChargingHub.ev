import { APIRequestContext } from '@playwright/test';
import { USERS, TestUser } from '../fixtures/test-users';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TOKEN_FILE = path.join(__dirname, '..', 'fixtures', '.auth-tokens.json');

/** Cache tokens per email — seeded from globalSetup file, falls back to API login. */
const tokenCache = new Map<string, string>();

function loadTokensFromFile() {
  if (tokenCache.size > 0) return;
  try {
    const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    for (const [email, token] of Object.entries(data)) {
      tokenCache.set(email, token as string);
    }
  } catch {
    // File not found — will fall back to API login
  }
}

export async function getToken(
  request: APIRequestContext,
  user: TestUser = USERS.customer,
): Promise<string> {
  loadTokensFromFile();

  const cached = tokenCache.get(user.email);
  if (cached) return cached;

  // Fallback: login via API (only if globalSetup didn't run)
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: user.email, password: user.password },
  });

  if (!res.ok()) {
    throw new Error(`Login failed for ${user.email}: ${res.status()}`);
  }

  const body = await res.json();
  tokenCache.set(user.email, body.token);
  return body.token;
}

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Login and return { token, headers } for convenience. */
export async function loginAs(
  request: APIRequestContext,
  user: TestUser = USERS.customer,
) {
  const token = await getToken(request, user);
  return { token, headers: authHeaders(token) };
}

/** Clear token cache (call in globalTeardown if needed). */
export function clearTokenCache() {
  tokenCache.clear();
}

/**
 * Find an available slot from a station.
 * If all slots are occupied, attempts to complete a charging session to free one.
 * Searches up to 10 stations for robustness.
 */
export async function findAvailableSlot(
  request: APIRequestContext,
  token: string,
): Promise<{ stationId: string; slotId: string; slotNumber: number } | null> {
  const res = await request.get(`${API_URL}/api/stations/nearby`, {
    params: { latitude: '37.7749', longitude: '-122.4194', radiusKm: '100', limit: '50' },
  });
  if (!res.ok()) return null;

  const stations = await res.json();

  // First pass: look for already-available slots
  for (const station of stations) {
    if (Number(station.available_slots) === 0) continue;
    const detailRes = await request.get(`${API_URL}/api/stations/${station.id}`);
    if (!detailRes.ok()) continue;
    const detail = await detailRes.json();
    const slot = detail.slots?.find((s: any) => s.status === 'available');
    if (slot) {
      return { stationId: station.id, slotId: slot.id, slotNumber: slot.slot_number };
    }
  }

  // Second pass: free a slot by completing an active session (needs manager auth)
  const manager = await loginAs(request, USERS.manager);
  for (const station of stations.slice(0, 10)) {
    const detailRes = await request.get(`${API_URL}/api/stations/${station.id}`);
    if (!detailRes.ok()) continue;
    const detail = await detailRes.json();
    const occupiedSlot = detail.slots?.find(
      (s: any) => s.status === 'occupied' && s.current_session_id
    );
    if (occupiedSlot) {
      const completeRes = await request.patch(
        `${API_URL}/api/charging/${occupiedSlot.current_session_id}/complete`,
        { headers: manager.headers }
      );
      if (completeRes.ok()) {
        return {
          stationId: station.id,
          slotId: occupiedSlot.id,
          slotNumber: occupiedSlot.slot_number,
        };
      }
    }
  }

  return null;
}
