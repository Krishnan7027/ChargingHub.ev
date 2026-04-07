'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import { useManagerStations, useCreateStation, useAddSlot } from '@/hooks/useStations';
import OperatingHoursEditor from '@/components/stations/OperatingHoursEditor';
import { useCountry } from '@/context/CountryContext';
import { formatPricePerKwh } from '@/lib/formatCurrency';
import type { OperatingHours } from '@/types';
import toast from 'react-hot-toast';

export default function ManagerDashboard() {
  const { country } = useCountry();
  const { data: stations, isLoading } = useManagerStations();
  const createStation = useCreateStation();
  const addSlot = useAddSlot();

  const [showAddForm, setShowAddForm] = useState(false);
  const [addSlotModal, setAddSlotModal] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', address: '', city: '', state: '', zipCode: '',
    latitude: '', longitude: '', pricingPerKwh: '',
  });
  const [operatingHours, setOperatingHours] = useState<OperatingHours>({
    type: 'ALWAYS_OPEN', schedule: null,
  });
  const [slotForm, setSlotForm] = useState({
    slotNumber: '', chargingType: 'level2', connectorType: 'type2', powerOutputKw: '',
  });

  async function handleAddStation(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (operatingHours.type === 'SCHEDULED' && (!operatingHours.schedule || Object.keys(operatingHours.schedule).length === 0)) {
        toast.error('Please select at least one open day');
        return;
      }
      await createStation.mutateAsync({
        name: form.name,
        description: form.description,
        address: form.address,
        city: form.city,
        state: form.state,
        zipCode: form.zipCode,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        pricingPerKwh: form.pricingPerKwh ? parseFloat(form.pricingPerKwh) : undefined,
        operatingHours,
      } as any);
      toast.success('Station submitted for approval!');
      setShowAddForm(false);
      setForm({ name: '', description: '', address: '', city: '', state: '', zipCode: '', latitude: '', longitude: '', pricingPerKwh: '' });
      setOperatingHours({ type: 'ALWAYS_OPEN', schedule: null });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create station');
    }
  }

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!addSlotModal) return;
    try {
      await addSlot.mutateAsync({
        stationId: addSlotModal,
        data: {
          slotNumber: parseInt(slotForm.slotNumber),
          chargingType: slotForm.chargingType,
          connectorType: slotForm.connectorType,
          powerOutputKw: parseFloat(slotForm.powerOutputKw),
        },
      });
      toast.success('Slot added!');
      setAddSlotModal(null);
      setSlotForm({ slotNumber: '', chargingType: 'level2', connectorType: 'type2', powerOutputKw: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to add slot');
    }
  }

  return (
    <ProtectedRoute roles={['manager']}>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-theme-primary">Station Manager Dashboard</h1>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
            {showAddForm ? 'Cancel' : '+ Add Station'}
          </button>
        </div>

        {/* Add Station Form */}
        {showAddForm && (
          <div className="card mb-6">
            <h2 className="text-lg font-semibold text-theme-primary mb-4">Register New Station</h2>
            <form onSubmit={handleAddStation} className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-theme-secondary mb-1">Station Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-theme-secondary mb-1">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-theme-secondary mb-1">Address</label>
                <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">City</label>
                <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">State</label>
                <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Latitude</label>
                <input type="number" step="any" className="input" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Longitude</label>
                <input type="number" step="any" className="input" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Price per kWh ($)</label>
                <input type="number" step="0.01" className="input" value={form.pricingPerKwh} onChange={(e) => setForm({ ...form, pricingPerKwh: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <OperatingHoursEditor value={operatingHours} onChange={setOperatingHours} />
              </div>
              <div className="md:col-span-2">
                <button type="submit" className="btn-primary" disabled={createStation.isPending}>
                  {createStation.isPending ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* My Stations */}
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => <div key={i} className="card h-32 bg-[var(--bg-tertiary)]" />)}
          </div>
        ) : !stations || stations.length === 0 ? (
          <EmptyState title="No stations registered yet" description="Add your first station using the button above." />
        ) : (
          <div className="space-y-4">
            {stations.map((station) => (
              <div key={station.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg text-theme-primary">{station.name}</h3>
                    <p className="text-sm text-theme-secondary">{station.address}, {station.city}</p>
                    <div className="flex gap-3 mt-2 text-sm text-theme-secondary">
                      <span>{station.total_slots || 0} slots</span>
                      <span>{station.available_slots || 0} available</span>
                      {station.pricing_per_kwh && <span>{formatPricePerKwh(station.pricing_per_kwh, country)}</span>}
                    </div>
                  </div>
                  <StatusBadge status={station.status} />
                </div>
                <div className="mt-4 flex gap-3">
                  <Link href={`/stations/${station.id}`} className="text-sm text-primary-600 hover:underline">
                    View Details
                  </Link>
                  {station.status === 'approved' && (
                    <button onClick={() => setAddSlotModal(station.id)} className="text-sm text-primary-600 hover:underline">
                      + Add Slot
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Slot Modal */}
        <Modal open={!!addSlotModal} onClose={() => setAddSlotModal(null)} title="Add Charging Slot">
          <form onSubmit={handleAddSlot} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">Slot Number</label>
              <input type="number" className="input" value={slotForm.slotNumber} onChange={(e) => setSlotForm({ ...slotForm, slotNumber: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">Charging Type</label>
              <select className="input" value={slotForm.chargingType} onChange={(e) => setSlotForm({ ...slotForm, chargingType: e.target.value })}>
                <option value="level1">Level 1</option>
                <option value="level2">Level 2</option>
                <option value="dc_fast">DC Fast</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">Connector Type</label>
              <select className="input" value={slotForm.connectorType} onChange={(e) => setSlotForm({ ...slotForm, connectorType: e.target.value })}>
                <option value="type1">Type 1</option>
                <option value="type2">Type 2</option>
                <option value="ccs">CCS</option>
                <option value="chademo">CHAdeMO</option>
                <option value="tesla">Tesla</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">Power Output (kW)</label>
              <input type="number" step="0.1" className="input" value={slotForm.powerOutputKw} onChange={(e) => setSlotForm({ ...slotForm, powerOutputKw: e.target.value })} required />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={addSlot.isPending}>
              {addSlot.isPending ? 'Adding...' : 'Add Slot'}
            </button>
          </form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
}
