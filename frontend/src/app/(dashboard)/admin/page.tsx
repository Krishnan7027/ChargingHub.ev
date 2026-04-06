'use client';

import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import StatusBadge from '@/components/ui/StatusBadge';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import {
  usePlatformStats, useAdminUsers, useAdminStations,
  useToggleUserStatus, useApproveStation, useRejectStation,
} from '@/hooks/useAdmin';
import { useCountry } from '@/context/CountryContext';
import { formatCurrency } from '@/lib/formatCurrency';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'stations' | 'users'>('overview');
  const { country } = useCountry();

  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const { data: pendingResult } = useAdminStations({ status: 'pending' });
  const { data: usersResult, isLoading: usersLoading } = useAdminUsers();

  const toggleStatus = useToggleUserStatus();
  const approveStation = useApproveStation();
  const rejectStation = useRejectStation();

  const pendingStations = pendingResult?.stations ?? [];
  const users = usersResult?.users ?? [];

  async function handleStationAction(id: string, action: 'approve' | 'reject') {
    try {
      if (action === 'approve') {
        await approveStation.mutateAsync(id);
        toast.success('Station approved');
      } else {
        await rejectStation.mutateAsync(id);
        toast.success('Station rejected');
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} station`);
    }
  }

  async function handleToggleUser(userId: string) {
    try {
      await toggleStatus.mutateAsync(userId);
      toast.success('User status updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user status');
    }
  }

  const statCards = stats ? [
    { label: 'Total Users', value: stats.total_users, color: 'text-blue-600' },
    { label: 'Approved Stations', value: stats.approved_stations, color: 'text-green-600' },
    { label: 'Pending Approval', value: stats.pending_stations, color: 'text-yellow-600' },
    { label: 'Active Sessions', value: stats.active_sessions, color: 'text-purple-600' },
    { label: 'Active Reservations', value: stats.active_reservations, color: 'text-indigo-600' },
    { label: 'Total Energy (kWh)', value: Number(stats.total_energy_kwh).toFixed(1), color: 'text-primary-600' },
    { label: 'Total Revenue', value: formatCurrency(stats.total_revenue, country), color: 'text-green-700' },
    { label: 'Total Slots', value: stats.total_slots, color: 'text-gray-600' },
    { label: 'Available Slots', value: stats.available_slots, color: 'text-green-500' },
  ] : [];

  return (
    <ProtectedRoute roles={['admin']}>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {(['overview', 'stations', 'users'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
              {tab === 'stations' && pendingStations.length > 0 && (
                <span className="ml-1.5 bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0.5 rounded-full">{pendingStations.length}</span>
              )}
            </button>
          ))}
        </div>

        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="card h-24 animate-pulse bg-gray-100" />)}
          </div>
        ) : (
          <>
            {/* Overview */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {statCards.map((stat) => (
                  <div key={stat.label} className="card">
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Pending Stations */}
            {activeTab === 'stations' && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Pending Station Approvals</h2>
                {pendingStations.length === 0 ? (
                  <div className="card text-center py-8 text-gray-500">No pending stations</div>
                ) : (
                  <div className="space-y-3">
                    {pendingStations.map((station) => (
                      <div key={station.id} className="card">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{station.name}</h3>
                            <p className="text-sm text-gray-500">{station.address}, {station.city}</p>
                            <p className="text-sm text-gray-500 mt-1">Manager: {station.manager_name}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStationAction(station.id, 'approve')}
                              className="btn-primary text-sm py-1.5"
                              disabled={approveStation.isPending}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleStationAction(station.id, 'reject')}
                              className="btn-danger text-sm py-1.5"
                              disabled={rejectStation.isPending}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Users */}
            {activeTab === 'users' && (
              <div>
                <h2 className="text-lg font-semibold mb-4">User Management</h2>
                {usersLoading ? (
                  <div className="card h-48 animate-pulse bg-gray-100" />
                ) : (
                  <div className="card overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-2 font-medium text-gray-600">Name</th>
                          <th className="text-left py-3 px-2 font-medium text-gray-600">Email</th>
                          <th className="text-left py-3 px-2 font-medium text-gray-600">Role</th>
                          <th className="text-left py-3 px-2 font-medium text-gray-600">Status</th>
                          <th className="text-left py-3 px-2 font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className="border-b border-gray-100">
                            <td className="py-3 px-2">{u.full_name}</td>
                            <td className="py-3 px-2 text-gray-500">{u.email}</td>
                            <td className="py-3 px-2"><StatusBadge status={u.role} /></td>
                            <td className="py-3 px-2">
                              <StatusBadge status={u.is_active ? 'active' : 'disabled'} />
                            </td>
                            <td className="py-3 px-2">
                              {u.role !== 'admin' && (
                                <button
                                  onClick={() => handleToggleUser(u.id)}
                                  disabled={toggleStatus.isPending}
                                  className={`text-sm ${u.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`}
                                >
                                  {u.is_active ? 'Disable' : 'Enable'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
