'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { openAuthModal } from '@/lib/authModal';

export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
    setTimeout(() => openAuthModal(), 100);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );
}
