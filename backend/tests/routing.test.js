'use strict';

/**
 * Routing service unit tests.
 * Tests the provider abstraction, polyline decoding, and fallback logic.
 */

const {
  haversineKm,
  decodePolyline,
  sampleAlongRoute,
  distanceAlongRoute,
} = require('../src/services/routingService');

describe('haversineKm', () => {
  it('calculates distance between two known points', () => {
    // Mumbai to Delhi ≈ 1148 km straight line
    const dist = haversineKm(19.076, 72.8777, 28.6139, 77.209);
    expect(dist).toBeGreaterThan(1100);
    expect(dist).toBeLessThan(1200);
  });

  it('returns 0 for same point', () => {
    expect(haversineKm(12.97, 77.59, 12.97, 77.59)).toBe(0);
  });
});

describe('decodePolyline', () => {
  it('decodes a Google-format encoded polyline', () => {
    // Simple encoded polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
    // This decodes to 3 points: (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(points.length).toBe(3);
    expect(points[0].lat).toBeCloseTo(38.5, 1);
    expect(points[0].lng).toBeCloseTo(-120.2, 1);
    expect(points[2].lat).toBeCloseTo(43.252, 1);
  });

  it('returns empty array for empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('sampleAlongRoute', () => {
  it('samples points at regular intervals along a route', () => {
    const polyline = [
      { lat: 12.97, lng: 77.59 },
      { lat: 13.0, lng: 77.6 },
      { lat: 13.05, lng: 77.65 },
      { lat: 13.1, lng: 77.7 },
    ];
    const samples = sampleAlongRoute(polyline, 5);
    expect(samples.length).toBeGreaterThan(0);
    expect(samples[0]).toHaveProperty('cumulativeKm');
    expect(samples[0].cumulativeKm).toBe(0);
  });

  it('returns empty for empty polyline', () => {
    expect(sampleAlongRoute([], 10)).toEqual([]);
  });
});

describe('distanceAlongRoute', () => {
  it('finds closest point on route and cumulative distance', () => {
    const polyline = [
      { lat: 12.0, lng: 77.0 },
      { lat: 13.0, lng: 77.5 },
      { lat: 14.0, lng: 78.0 },
    ];
    const result = distanceAlongRoute(polyline, 13.0, 77.5);
    expect(result).toHaveProperty('distFromRoute');
    expect(result).toHaveProperty('distAlongRouteKm');
    expect(result.distFromRoute).toBeLessThan(1); // very close to a point on the route
    expect(result.distAlongRouteKm).toBeGreaterThan(0);
  });
});
