'use client';

import { clsx } from 'clsx';

const colorMap: Record<string, string> = {
  available: 'bg-green-500/15 text-green-500',
  approved: 'bg-green-500/15 text-green-500',
  active: 'bg-green-500/15 text-green-500',
  charging: 'bg-green-500/15 text-green-500',
  confirmed: 'bg-blue-500/15 text-blue-500',
  reserved: 'bg-yellow-500/15 text-yellow-500',
  pending: 'bg-yellow-500/15 text-yellow-500',
  occupied: 'bg-red-500/15 text-red-500',
  rejected: 'bg-red-500/15 text-red-500',
  cancelled: 'bg-red-500/15 text-red-500',
  failed: 'bg-red-500/15 text-red-500',
  disabled: 'bg-gray-500/15 text-theme-muted',
  maintenance: 'bg-gray-500/15 text-theme-muted',
  completed: 'bg-gray-500/15 text-theme-secondary',
  expired: 'bg-gray-500/15 text-theme-muted',
  customer: 'bg-blue-500/15 text-blue-500',
  manager: 'bg-purple-500/15 text-purple-500',
  admin: 'bg-indigo-500/15 text-indigo-500',
};

export default function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
      colorMap[status] || 'bg-gray-500/15 text-theme-secondary',
      className,
    )}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
