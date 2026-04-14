'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook for auth-gated actions with modal.
 *
 * Usage:
 *   const { requireAuth, authModalProps } = useAuthAction();
 *   <button onClick={() => requireAuth(() => openGoogleMaps())}>Directions</button>
 *   <AuthModal {...authModalProps} />
 */
export function useAuthAction() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireAuth = useCallback((action: () => void) => {
    if (user) {
      action();
    } else {
      setPendingAction(() => action);
      setShowModal(true);
    }
  }, [user]);

  const handleAuthenticated = useCallback(() => {
    setShowModal(false);
    if (pendingAction) {
      // Small delay to let auth state propagate
      setTimeout(() => {
        pendingAction();
        setPendingAction(null);
      }, 100);
    }
  }, [pendingAction]);

  const handleClose = useCallback(() => {
    setShowModal(false);
    setPendingAction(null);
  }, []);

  return {
    requireAuth,
    authModalProps: {
      open: showModal,
      onClose: handleClose,
      onAuthenticated: handleAuthenticated,
    },
  };
}
