/**
 * Navigation Flow — return-to-action system.
 *
 * Stores the user's intended action before auth redirect,
 * then replays it after login/signup.
 */

const STORAGE_KEY = 'ev_return_action';

export interface ReturnAction {
  /** Page to return to */
  returnTo: string;
  /** Action to auto-trigger: 'directions', 'start-journey', 'reserve' */
  action?: string;
  /** Additional data (station coords, route ID, etc.) */
  data?: Record<string, string>;
  /** Timestamp to expire stale entries (15 min TTL) */
  ts: number;
}

const TTL_MS = 15 * 60 * 1000; // 15 minutes

export function saveReturnAction(returnTo: string, action?: string, data?: Record<string, string>) {
  if (typeof window === 'undefined') return;
  const entry: ReturnAction = { returnTo, action, data, ts: Date.now() };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
}

export function getReturnAction(): ReturnAction | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const entry: ReturnAction = JSON.parse(raw);
    // Expire after TTL
    if (Date.now() - entry.ts > TTL_MS) {
      clearReturnAction();
      return null;
    }
    // Validate returnTo is a local path
    if (!entry.returnTo.startsWith('/')) {
      clearReturnAction();
      return null;
    }
    return entry;
  } catch {
    clearReturnAction();
    return null;
  }
}

export function clearReturnAction() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Build a Google Maps directions URL.
 */
export function buildDirectionsUrl(
  destLat: number,
  destLng: number,
  originLat?: number,
  originLng?: number,
): string {
  const dest = `${destLat},${destLng}`;
  if (originLat != null && originLng != null) {
    return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${dest}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

/**
 * Redirect to signup with return-to-action saved.
 */
export function redirectToSignup(
  returnTo: string,
  action?: string,
  data?: Record<string, string>,
) {
  saveReturnAction(returnTo, action, data);
  window.location.href = '/register';
}
