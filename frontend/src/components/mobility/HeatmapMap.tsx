'use client';

import { useEffect, useRef } from 'react';
import type { HeatmapCell } from '@/types';

interface HeatmapMapProps {
  cells: HeatmapCell[];
  center?: { lat: number; lng: number };
  className?: string;
  mode?: 'demand' | 'gap';
}

function getColor(value: number, mode: 'demand' | 'gap'): string {
  // value 0–1 normalized
  const v = Math.max(0, Math.min(1, value));
  if (mode === 'gap') {
    // Red = underserved, green = well served
    const r = Math.round(255 * v);
    const g = Math.round(255 * (1 - v));
    return `rgb(${r}, ${g}, 60)`;
  }
  // Demand: blue (low) → yellow → red (high)
  if (v < 0.5) {
    const t = v * 2;
    const r = Math.round(255 * t);
    const g = Math.round(200 + 55 * t);
    return `rgb(${r}, ${g}, ${Math.round(255 * (1 - t))})`;
  }
  const t = (v - 0.5) * 2;
  const r = 255;
  const g = Math.round(255 * (1 - t));
  return `rgb(${r}, ${g}, 0)`;
}

export default function HeatmapMap({ cells, center, className = '', mode = 'demand' }: HeatmapMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  // Compute center from cells if not provided
  const mapCenter = center || (cells.length > 0
    ? { lat: cells.reduce((s, c) => s + c.grid_lat, 0) / cells.length, lng: cells.reduce((s, c) => s + c.grid_lng, 0) / cells.length }
    : { lat: 20.5937, lng: 78.9629 });

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current!).setView([mapCenter.lat, mapCenter.lng], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(mapInstanceRef.current);
      } else {
        mapInstanceRef.current.setView([mapCenter.lat, mapCenter.lng], 11);
      }

      // Clear existing heatmap layer
      if (layerRef.current) {
        mapInstanceRef.current.removeLayer(layerRef.current);
      }

      if (cells.length === 0) return;

      // Normalize values for coloring
      const values = cells.map(c => mode === 'gap' ? c.infrastructure_gap_score : c.demand_intensity);
      const maxVal = Math.max(...values, 1);

      const layerGroup = L.layerGroup();

      cells.forEach((cell) => {
        const raw = mode === 'gap' ? cell.infrastructure_gap_score : cell.demand_intensity;
        const norm = raw / maxVal;
        const color = getColor(norm, mode);
        const radius = Math.max(400, Math.min(800, norm * 800));

        const circle = L.circle([cell.grid_lat, cell.grid_lng], {
          radius,
          fillColor: color,
          color: 'transparent',
          fillOpacity: 0.55,
          weight: 0,
        });

        const popupContent = `
          <div style="font-size:12px;line-height:1.4">
            <strong>${mode === 'gap' ? 'Infrastructure Gap' : 'Charging Demand'}</strong><br/>
            Sessions: ${cell.total_sessions}<br/>
            Energy: ${Number(cell.total_energy_kwh).toFixed(0)} kWh<br/>
            Users: ${cell.unique_users}<br/>
            Stations: ${cell.station_count} (${cell.total_slots} slots)<br/>
            Occupancy: ${Number(cell.avg_occupancy_pct).toFixed(0)}%<br/>
            Gap Score: ${Number(cell.infrastructure_gap_score).toFixed(0)}/100
          </div>
        `;
        circle.bindPopup(popupContent);
        layerGroup.addLayer(circle);
      });

      layerGroup.addTo(mapInstanceRef.current);
      layerRef.current = layerGroup;

      // Fit bounds
      if (cells.length > 1) {
        const bounds = L.latLngBounds(cells.map(c => [c.grid_lat, c.grid_lng] as [number, number]));
        mapInstanceRef.current.fitBounds(bounds.pad(0.1));
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update cells without recreating map
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      if (layerRef.current) {
        mapInstanceRef.current.removeLayer(layerRef.current);
      }

      if (cells.length === 0) return;

      const values = cells.map(c => mode === 'gap' ? c.infrastructure_gap_score : c.demand_intensity);
      const maxVal = Math.max(...values, 1);

      const layerGroup = L.layerGroup();

      cells.forEach((cell) => {
        const raw = mode === 'gap' ? cell.infrastructure_gap_score : cell.demand_intensity;
        const norm = raw / maxVal;
        const color = getColor(norm, mode);
        const radius = Math.max(400, Math.min(800, norm * 800));

        const circle = L.circle([cell.grid_lat, cell.grid_lng], {
          radius,
          fillColor: color,
          color: 'transparent',
          fillOpacity: 0.55,
          weight: 0,
        });

        const popupContent = `
          <div style="font-size:12px;line-height:1.4">
            <strong>${mode === 'gap' ? 'Infrastructure Gap' : 'Charging Demand'}</strong><br/>
            Sessions: ${cell.total_sessions}<br/>
            Energy: ${Number(cell.total_energy_kwh).toFixed(0)} kWh<br/>
            Users: ${cell.unique_users}<br/>
            Stations: ${cell.station_count} (${cell.total_slots} slots)<br/>
            Occupancy: ${Number(cell.avg_occupancy_pct).toFixed(0)}%<br/>
            Gap Score: ${Number(cell.infrastructure_gap_score).toFixed(0)}/100
          </div>
        `;
        circle.bindPopup(popupContent);
        layerGroup.addLayer(circle);
      });

      layerGroup.addTo(mapInstanceRef.current);
      layerRef.current = layerGroup;

      if (cells.length > 1) {
        const bounds = L.latLngBounds(cells.map(c => [c.grid_lat, c.grid_lng] as [number, number]));
        mapInstanceRef.current.fitBounds(bounds.pad(0.1));
      }
    });
  }, [cells, mode]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full min-h-[400px] rounded-lg z-0" />
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md z-[1000]">
        <p className="text-[10px] font-semibold text-gray-600 mb-1.5">
          {mode === 'gap' ? 'Infrastructure Gap' : 'Charging Demand'}
        </p>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-gray-500">Low</span>
          <div className="flex h-2 rounded overflow-hidden">
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
              <div key={v} className="w-4 h-2" style={{ backgroundColor: getColor(v, mode) }} />
            ))}
          </div>
          <span className="text-[9px] text-gray-500">High</span>
        </div>
      </div>
    </div>
  );
}
