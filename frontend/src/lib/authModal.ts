/**
 * Global auth modal trigger.
 * Components dispatch 'open-auth-modal' event, Navbar listens and opens modal.
 */
export function openAuthModal(mode?: 'login' | 'signup') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode } }));
}
