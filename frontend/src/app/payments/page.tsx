'use client';

import Navbar from '@/components/layout/Navbar';
import PageTransition from '@/components/ui/PageTransition';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useCountry } from '@/context/CountryContext';
import { formatCurrency } from '@/lib/formatCurrency';
import { useMyPayments, useWalletSummary, useRefundPayment } from '@/hooks/useIntelligent';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import type { Payment, PaymentStatus } from '@/types';

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Refunded', value: 'refunded' },
];

function paymentStatusColor(status: PaymentStatus): string {
  switch (status) {
    case 'completed': return 'bg-green-500/10 text-green-500';
    case 'pending': return 'bg-yellow-500/10 text-yellow-500';
    case 'processing': return 'bg-blue-500/10 text-blue-500';
    case 'failed': return 'bg-red-500/10 text-red-500';
    case 'refunded': return 'glass text-theme-secondary';
    default: return 'glass text-theme-secondary';
  }
}

export default function PaymentsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { country } = useCountry();
  const [statusFilter, setStatusFilter] = useState('');
  const { data: payments, isLoading } = useMyPayments({ status: statusFilter || undefined, limit: 50 });
  const { data: wallet } = useWalletSummary();
  const refundPayment = useRefundPayment();

  async function handleRefund(paymentId: string) {
    if (!confirm('Are you sure you want to request a refund?')) return;
    try {
      await refundPayment.mutateAsync(paymentId);
      toast.success('Refund requested');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Refund failed');
    }
  }

  if (loading || !user) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      </>
    );
  }

  const paymentList: Payment[] = payments ?? [];

  const totalSpent = paymentList
    .filter((p: Payment) => p.status === 'completed')
    .reduce((sum: number, p: Payment) => sum + p.amount, 0);

  const pendingAmount = paymentList
    .filter((p: Payment) => p.status === 'pending' || p.status === 'processing')
    .reduce((sum: number, p: Payment) => sum + p.amount, 0);

  return (
    <ProtectedRoute roles={['customer', 'manager', 'admin']}>
      <Navbar />
      <PageTransition>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="btn-ghost text-sm py-1 px-2 -ml-2 mb-2 flex items-center gap-1 text-theme-secondary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Payments & Wallet</h1>
          <Link href="/customer" className="text-sm text-primary-600 hover:underline">Back to Dashboard</Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="card">
            <p className="text-xs text-theme-muted mb-1">Points Balance</p>
            <p className="text-2xl font-bold text-primary-600">
              {wallet?.wallet?.totalPoints?.toLocaleString() ?? '0'}
            </p>
            {wallet?.level && (
              <p className="text-xs text-theme-muted mt-1">{wallet.level.current.name}</p>
            )}
          </div>
          <div className="card">
            <p className="text-xs text-theme-muted mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-theme-primary">{formatCurrency(totalSpent, country)}</p>
            <p className="text-xs text-theme-muted mt-1">{paymentList.filter((p: Payment) => p.status === 'completed').length} transactions</p>
          </div>
          <div className="card">
            <p className="text-xs text-theme-muted mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingAmount, country)}</p>
            <p className="text-xs text-theme-muted mt-1">{paymentList.filter((p: Payment) => p.status === 'pending' || p.status === 'processing').length} pending</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-primary-600 text-white'
                  : 'glass text-theme-secondary hover:bg-primary-500/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Payment List */}
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="card h-20" />)}
          </div>
        ) : paymentList.length === 0 ? (
          <EmptyState
            title="No payments found"
            description={statusFilter ? 'No payments match this filter.' : 'Your payment history will appear here after your first charge.'}
            action={<Link href="/map" className="btn-primary text-sm">Find a Station</Link>}
          />
        ) : (
          <div className="space-y-3">
            {paymentList.map((payment: Payment) => (
              <div key={payment.id} className="card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                      <span className="text-xs text-theme-muted">
                        {new Date(payment.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-theme-secondary">
                      {payment.paymentMethod} payment
                      {payment.sessionId && <span> for charging session</span>}
                      {payment.reservationId && <span> for reservation</span>}
                    </p>
                    {payment.paidAt && (
                      <p className="text-xs text-theme-muted mt-0.5">
                        Paid {new Date(payment.paidAt).toLocaleDateString()}
                      </p>
                    )}
                    {payment.refundedAt && (
                      <p className="text-xs text-theme-muted mt-0.5">
                        Refunded {new Date(payment.refundedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={`text-lg font-bold ${payment.status === 'refunded' ? 'text-theme-muted line-through' : 'text-theme-primary'}`}>
                      {formatCurrency(payment.amount, country)}
                    </p>
                    {payment.status === 'completed' && (
                      <button
                        onClick={() => handleRefund(payment.id)}
                        disabled={refundPayment.isPending}
                        className="text-xs text-red-600 hover:text-red-700 font-medium whitespace-nowrap"
                      >
                        Request Refund
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </PageTransition>
    </ProtectedRoute>
  );
}
