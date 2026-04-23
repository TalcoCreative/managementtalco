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

type GeolocationErrorLike = {
  code?: number;
  message?: string;
};

function requestPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function getGeolocationPermissionState(): Promise<PermissionState | "unsupported"> {
  if (!navigator.permissions?.query) return "unsupported";

  try {
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state;
  } catch {
    return "unsupported";
  }
}

export function getGeolocationErrorMessage(error: unknown): string {
  const geoError = error as GeolocationErrorLike | null;
  const message = geoError?.message?.toLowerCase() ?? "";

  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Akses lokasi hanya berjalan di koneksi aman (HTTPS).";
  }

  if (geoError?.code === 1 || message.includes("denied") || message.includes("permission")) {
    return "Izin lokasi ditolak. Aktifkan GPS dan izinkan akses lokasi di browser/device Anda.";
  }

  if (geoError?.code === 2 || message.includes("unavailable")) {
    return "Lokasi belum tersedia. Pastikan GPS perangkat aktif dan sinyal lokasi stabil.";
  }

  if (geoError?.code === 3 || message.includes("timeout")) {
    return "Lokasi terlalu lama didapatkan. Coba pindah ke area dengan sinyal lebih baik lalu ulangi.";
  }

  return "Lokasi belum bisa diambil. Pastikan GPS aktif dan izin lokasi sudah diberikan.";
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
  return new Promise(async (resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Browser ini tidak mendukung akses lokasi."));
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      reject(new Error("Akses lokasi hanya berjalan di koneksi aman (HTTPS)."));
      return;
    }

    try {
      const precisePosition = await requestPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      resolve(precisePosition);
    } catch (firstError) {
      const firstGeoError = firstError as GeolocationErrorLike | null;

      if (firstGeoError?.code === 1) {
        reject(new Error(getGeolocationErrorMessage(firstError)));
        return;
      }

      try {
        const fallbackPosition = await requestPosition({
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 30000,
        });

        resolve(fallbackPosition);
      } catch (fallbackError) {
        reject(new Error(getGeolocationErrorMessage(fallbackError ?? firstError)));
      }
    }
  });
}
