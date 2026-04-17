import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const colorIcon = (color: "green" | "red" | "blue") =>
  L.divIcon({
    className: "",
    html: `<div style="background:${color === "green" ? "#10b981" : color === "red" ? "#ef4444" : "#3b82f6"};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.3);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

export interface MapLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

export interface MapEmployee {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: "inside" | "outside";
  time?: string;
}

interface Props {
  locations: MapLocation[];
  employees?: MapEmployee[];
  onMapClick?: (lat: number, lng: number) => void;
  pickerMarker?: { lat: number; lng: number; radius?: number } | null;
  height?: number;
  center?: [number, number];
}

function ClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitBounds({ locations, employees, pickerMarker }: { locations: MapLocation[]; employees?: MapEmployee[]; pickerMarker?: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [];
    locations.forEach((l) => points.push([l.latitude, l.longitude]));
    employees?.forEach((e) => points.push([e.latitude, e.longitude]));
    if (pickerMarker) points.push([pickerMarker.lat, pickerMarker.lng]);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 16);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
    }
  }, [locations, employees, pickerMarker, map]);
  return null;
}

export function LocationMap({
  locations,
  employees = [],
  onMapClick,
  pickerMarker,
  height = 400,
  center = [-6.2, 106.816666], // Jakarta default
}: Props) {
  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-xl border border-border">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {locations.map((loc) => (
          <div key={loc.id}>
            <Circle
              center={[loc.latitude, loc.longitude]}
              radius={loc.radius_meters}
              pathOptions={{
                color: loc.is_active ? "#10b981" : "#6b7280",
                fillColor: loc.is_active ? "#10b981" : "#6b7280",
                fillOpacity: 0.12,
                weight: 2,
              }}
            />
            <Marker position={[loc.latitude, loc.longitude]} icon={colorIcon("blue")}>
              <Popup>
                <strong>{loc.name}</strong>
                <br />
                Radius: {loc.radius_meters}m
                <br />
                {loc.is_active ? "✅ Active" : "⏸️ Inactive"}
              </Popup>
            </Marker>
          </div>
        ))}

        {employees.map((emp) => (
          <Marker
            key={emp.id}
            position={[emp.latitude, emp.longitude]}
            icon={colorIcon(emp.status === "inside" ? "green" : "red")}
          >
            <Popup>
              <strong>{emp.name}</strong>
              <br />
              {emp.time}
              <br />
              <span style={{ color: emp.status === "inside" ? "#10b981" : "#ef4444" }}>
                {emp.status === "inside" ? "✅ Inside" : "⚠️ Outside"}
              </span>
            </Popup>
          </Marker>
        ))}

        {pickerMarker && (
          <>
            <Marker position={[pickerMarker.lat, pickerMarker.lng]} icon={colorIcon("blue")} />
            {pickerMarker.radius && (
              <Circle
                center={[pickerMarker.lat, pickerMarker.lng]}
                radius={pickerMarker.radius}
                pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.15 }}
              />
            )}
          </>
        )}

        <ClickHandler onMapClick={onMapClick} />
        <FitBounds locations={locations} employees={employees} pickerMarker={pickerMarker} />
      </MapContainer>
    </div>
  );
}
