'use client';

import { useEffect, useRef, useState } from 'react';
import type { Station } from '@/types';

interface LatLng {
  lat: number;
  lng: number;
}

interface StationMapProps {
  stations: Station[];
  center: { lat: number; lng: number };
  onStationClick?: (station: Station) => void;
  className?: string;
  currencySymbol?: string;
  /** Map of stationId → rank (1-based). Ranked stations get a numbered badge. */
  stationRanks?: Record<string, number>;
  // Route planner extensions
  routeLine?: { start: LatLng; end: LatLng; waypoints: LatLng[]; polyline?: LatLng[]; provider?: string };
  startMarker?: LatLng;
  endMarker?: LatLng;
  onMapClick?: (latlng: LatLng) => void;
}

export default function StationMap({
  stations,
  center,
  onStationClick,
  className = '',
  stationRanks,
  routeLine,
  startMarker,
  endMarker,
  onMapClick,
  currencySymbol = '₹',
}: StationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const leafletRef = useRef<any>(null);
  const routeLayerRef = useRef<any[]>([]);
  const onClickRef = useRef(onStationClick);
  const onMapClickRef = useRef(onMapClick);

  // Track when Leaflet + map are ready so marker effects can re-run
  const [mapReady, setMapReady] = useState(false);

  onClickRef.current = onStationClick;
  onMapClickRef.current = onMapClick;

  // Initialize map ONCE
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current) return;

      leafletRef.current = L;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current!, {
          zoomControl: true,
          attributionControl: true,
        }).setView([center.lat, center.lng], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);

        // Click-to-set-pin handler
        mapInstanceRef.current.on('click', (e: any) => {
          onMapClickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }

      // Signal that map is ready — triggers marker + route effects
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pan map when center changes (only if no route line to avoid fighting fitBounds)
  useEffect(() => {
    if (mapInstanceRef.current && !routeLine) {
      mapInstanceRef.current.setView([center.lat, center.lng], 13);
    }
  }, [center.lat, center.lng, routeLine]);

  // Update station markers — depends on mapReady + stations
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !mapReady) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    stations.forEach((station) => {
      const available = station.available_slots ?? 0;
      const total = station.total_slots ?? 0;
      const rank = stationRanks?.[station.id];
      const isRanked = rank !== undefined;
      const color = available > 0 ? '#16A34A' : '#DC2626';

      // Ranked stations get a larger marker with rank badge
      const size = isRanked ? 40 : 32;
      const rankBadge = isRanked
        ? `<div style="position:absolute;top:-8px;right:-8px;background:#2563EB;color:white;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${rank}</div>`
        : '';

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="position:relative;background:${color};color:white;border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:${isRanked ? 14 : 12}px;border:${isRanked ? 3 : 2}px solid white;box-shadow:0 2px ${isRanked ? 10 : 6}px rgba(0,0,0,${isRanked ? 0.4 : 0.3})">${available}${rankBadge}</div>`,
        iconSize: [size + 16, size + 16],
        iconAnchor: [(size + 16) / 2, (size + 16) / 2],
      });

      const rankLabel = isRanked ? `<br/><span style="color:#2563EB;font-weight:700;font-size:12px">⭐ Smart Pick #${rank}</span>` : '';

      const marker = L.marker([station.latitude, station.longitude], {
        icon,
        zIndexOffset: isRanked ? 1000 - rank : 0,
      })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:180px">
            <strong>${station.name}</strong>${rankLabel}<br/>
            <span style="color:#666;font-size:12px">${station.address}</span><br/>
            <span style="color:${color};font-weight:600">${available}/${total} available</span>
            ${station.pricing_per_kwh ? `<br/><span style="font-size:12px">${currencySymbol}${station.pricing_per_kwh}/kWh</span>` : ''}
          </div>
        `);

      marker.on('click', () => onClickRef.current?.(station));
      markersRef.current.push(marker);
    });
  }, [stations, mapReady, currencySymbol, stationRanks]);

  // Draw route line + start/end markers + numbered stop markers
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !mapReady) return;

    // Clear previous route layers
    routeLayerRef.current.forEach((layer) => layer.remove());
    routeLayerRef.current = [];

    // Draw start marker
    if (startMarker) {
      const m = L.circleMarker([startMarker.lat, startMarker.lng], {
        radius: 10,
        fillColor: '#16A34A',
        color: '#fff',
        weight: 3,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup('Start');
      routeLayerRef.current.push(m);
    }

    // Draw end marker
    if (endMarker) {
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background:#DC2626;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const m = L.marker([endMarker.lat, endMarker.lng], { icon })
        .addTo(map)
        .bindPopup('Destination');
      routeLayerRef.current.push(m);
    }

    // Draw route polyline + numbered stop markers
    if (routeLine) {
      const hasRealPolyline = routeLine.polyline && routeLine.polyline.length > 2;
      const routePoints: [number, number][] = hasRealPolyline
        ? routeLine.polyline!.map((p) => [p.lat, p.lng] as [number, number])
        : [
            [routeLine.start.lat, routeLine.start.lng],
            ...routeLine.waypoints.map((w) => [w.lat, w.lng] as [number, number]),
            [routeLine.end.lat, routeLine.end.lng],
          ];

      const polyline = L.polyline(routePoints, {
        color: '#2563EB',
        weight: hasRealPolyline ? 5 : 4,
        opacity: 0.85,
        dashArray: hasRealPolyline ? undefined : '12, 8',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      routeLayerRef.current.push(polyline);

      routeLine.waypoints.forEach((wp, i) => {
        const stopIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="background:#F59E0B;color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${i + 1}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const m = L.marker([wp.lat, wp.lng], { icon: stopIcon })
          .addTo(map)
          .bindPopup(`<strong>Stop ${i + 1}</strong>`);
        routeLayerRef.current.push(m);
      });

      const bounds = L.latLngBounds(routePoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [routeLine, startMarker, endMarker, mapReady]);

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div ref={mapRef} className={`w-full ${className}`} style={{ minHeight: '400px' }} />
    </>
  );
}
