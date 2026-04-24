'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { vehicleApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import type { EVVehicle } from '@/types';

const CHARGING_PORTS = ['Type 2', 'CCS', 'CHAdeMO', 'Type 1', 'Tesla'];

function EVCard({ vehicle, onDelete, onSetDefault }: {
  vehicle: EVVehicle;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="glass-heavy rounded-2xl border border-glass overflow-hidden">
      {vehicle.image_url && (
        <div className="h-48 bg-glass overflow-hidden">
          <img src={vehicle.image_url} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-theme-primary">{vehicle.brand} {vehicle.model}</h3>
            {vehicle.is_default && (
              <span className="badge-blue text-xs mt-1 inline-block">Default</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          {vehicle.battery_capacity_kwh && (
            <div className="bg-primary-500/5 rounded-xl p-3">
              <p className="text-xs text-theme-muted">Battery</p>
              <p className="text-sm font-semibold text-theme-primary">{vehicle.battery_capacity_kwh} kWh</p>
            </div>
          )}
          {vehicle.range_km && (
            <div className="bg-primary-500/5 rounded-xl p-3">
              <p className="text-xs text-theme-muted">Range</p>
              <p className="text-sm font-semibold text-theme-primary">{vehicle.range_km} km</p>
            </div>
          )}
          <div className="bg-primary-500/5 rounded-xl p-3">
            <p className="text-xs text-theme-muted">Fast Charging</p>
            <p className="text-sm font-semibold text-theme-primary">{vehicle.fast_charging ? 'Yes' : 'No'}</p>
          </div>
          {vehicle.charging_port_type && (
            <div className="bg-primary-500/5 rounded-xl p-3">
              <p className="text-xs text-theme-muted">Port Type</p>
              <p className="text-sm font-semibold text-theme-primary">{vehicle.charging_port_type}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t border-glass">
          {!vehicle.is_default && (
            <button onClick={() => onSetDefault(vehicle.id)} className="btn-secondary text-xs py-1.5 flex-1">
              Set as Default
            </button>
          )}
          <button
            onClick={async () => { setDeleting(true); await onDelete(vehicle.id); }}
            disabled={deleting}
            className="text-xs py-1.5 px-3 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
          >
            {deleting ? '...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddEVForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [batteryCapacity, setBatteryCapacity] = useState('');
  const [range, setRange] = useState('');
  const [fastCharging, setFastCharging] = useState(false);
  const [chargingPort, setChargingPort] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await vehicleApi.add({
        brand,
        model,
        batteryCapacityKwh: batteryCapacity ? Number(batteryCapacity) : undefined,
        rangeKm: range ? Number(range) : undefined,
        fastCharging,
        chargingPortType: chargingPort || undefined,
        imageUrl: imageUrl || undefined,
      });
      onAdded();
    } catch (err: any) {
      setError(err.message || 'Failed to add vehicle');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-heavy rounded-2xl p-6 border border-glass">
      <h3 className="text-lg font-semibold text-theme-primary mb-4">Add New EV</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Brand *</label>
            <input type="text" className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Tata" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Model *</label>
            <input type="text" className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Nexon EV" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Battery Capacity (kWh)</label>
            <input type="number" className="input" value={batteryCapacity} onChange={(e) => setBatteryCapacity(e.target.value)} placeholder="e.g. 40.5" step="0.1" min="1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Range (km)</label>
            <input type="number" className="input" value={range} onChange={(e) => setRange(e.target.value)} placeholder="e.g. 312" min="1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Charging Port</label>
            <select className="input" value={chargingPort} onChange={(e) => setChargingPort(e.target.value)}>
              <option value="">Select port type</option>
              {CHARGING_PORTS.map((port) => (
                <option key={port} value={port}>{port}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={fastCharging} onChange={(e) => setFastCharging(e.target.checked)} className="w-4 h-4 rounded border-glass accent-primary-500" />
              <span className="text-sm text-theme-secondary">Fast Charging Support</span>
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1">Vehicle Image URL</label>
          <input type="url" className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Adding...' : 'Add Vehicle'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function MyEVPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<EVVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  const fetchVehicles = useCallback(async () => {
    try {
      const data = await vehicleApi.list();
      setVehicles(data);
    } catch {
      // silently fail
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchVehicles();
  }, [user, fetchVehicles]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  async function handleDelete(id: string) {
    try {
      await vehicleApi.delete(id);
      fetchVehicles();
    } catch {
      // silently fail
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await vehicleApi.setDefault(id);
      fetchVehicles();
    } catch {
      // silently fail
    }
  }

  return (
    <>
    <Navbar />
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.back()} className="btn-ghost text-sm py-1 px-2 -ml-2 mb-2 flex items-center gap-1 text-theme-secondary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-theme-primary">My EV</h1>
          {vehicles.length > 0 && !showAddForm && (
            <button onClick={() => setShowAddForm(true)} className="btn-primary text-sm">
              + Add EV
            </button>
          )}
        </div>

        {showAddForm && (
          <div className="mb-6">
            <AddEVForm
              onAdded={() => { setShowAddForm(false); fetchVehicles(); }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}

        {loadingVehicles ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : vehicles.length === 0 && !showAddForm ? (
          <div className="glass-heavy rounded-2xl border border-glass p-12 text-center">
            <div className="w-16 h-16 bg-primary-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-theme-primary mb-2">No EV Added Yet</h3>
            <p className="text-sm text-theme-muted mb-6">Add your electric vehicle to get personalized charging recommendations</p>
            <button onClick={() => setShowAddForm(true)} className="btn-primary">
              Add Your EV
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {vehicles.map((v) => (
              <EVCard key={v.id} vehicle={v} onDelete={handleDelete} onSetDefault={handleSetDefault} />
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
