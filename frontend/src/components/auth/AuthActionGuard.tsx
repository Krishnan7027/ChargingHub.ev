'use client';

import { useAuth } from '@/context/AuthContext';
import { redirectToSignup } from '@/lib/navigationFlow';

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
 * If logged in → calls onAuthenticated().
 * If not → saves intent and redirects to signup.
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
      redirectToSignup(returnTo, action, data);
    }
  }

  return <>{children({ onClick: handleClick })}</>;
}
