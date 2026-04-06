'use client';

import { clsx } from 'clsx';

const colorMap: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  approved: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  charging: 'bg-green-100 text-green-800',
  confirmed: 'bg-blue-100 text-blue-800',
  reserved: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  occupied: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  disabled: 'bg-gray-100 text-gray-800',
  maintenance: 'bg-gray-100 text-gray-800',
  completed: 'bg-gray-100 text-gray-700',
  expired: 'bg-gray-100 text-gray-600',
  customer: 'bg-blue-100 text-blue-800',
  manager: 'bg-purple-100 text-purple-800',
  admin: 'bg-indigo-100 text-indigo-800',
};

export default function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
      colorMap[status] || 'bg-gray-100 text-gray-800',
      className,
    )}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
