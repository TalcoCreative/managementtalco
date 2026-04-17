// Haversine distance in meters between two lat/lng points
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface OfficeLocationLite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

export interface MatchResult {
  inside: boolean;
  matchedLocation: OfficeLocationLite | null;
  distanceMeters: number | null;
}

export function matchLocation(
  userLat: number,
  userLng: number,
  locations: OfficeLocationLite[],
): MatchResult {
  let best: { loc: OfficeLocationLite; dist: number } | null = null;
  for (const loc of locations) {
    if (!loc.is_active) continue;
    const dist = haversineMeters(userLat, userLng, loc.latitude, loc.longitude);
    if (!best || dist < best.dist) best = { loc, dist };
    if (dist <= loc.radius_meters) {
      return { inside: true, matchedLocation: loc, distanceMeters: dist };
    }
  }
  return {
    inside: false,
    matchedLocation: best?.loc ?? null,
    distanceMeters: best?.dist ?? null,
  };
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation tidak didukung browser ini"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}
