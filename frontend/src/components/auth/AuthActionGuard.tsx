'use client';

import { useAuth } from '@/context/AuthContext';
import { saveReturnAction } from '@/lib/navigationFlow';
import { openAuthModal } from '@/lib/authModal';

interface AuthActionGuardProps {
  /** Current page path */
  returnTo: string;
  /** Action name (directions, start-journey, reserve) */
  action: string;
  /** Extra data to persist */
  data?: Record<string, string>;
  /** What to render (receives onClick handler) */
  children: (props: { onClick: (e: React.MouseEvent) => void }) => React.ReactNode;
  /** Called when user IS authenticated */
  onAuthenticated: () => void;
}

/**
 * Wraps an action button with auth check.
 * If logged in -> calls onAuthenticated().
 * If not -> saves intent and opens auth modal.
 */
export default function AuthActionGuard({
  returnTo,
  action,
  data,
  children,
  onAuthenticated,
}: AuthActionGuardProps) {
  const { user } = useAuth();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (user) {
      onAuthenticated();
    } else {
      saveReturnAction(returnTo, action, data);
      openAuthModal();
    }
  }

  return <>{children({ onClick: handleClick })}</>;
}
