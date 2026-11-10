import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';

export type MapPointKind = 'shop' | 'pickup' | 'agent' | 'destination' | 'custom';

export interface MapPoint {
  id: string;
  kind: MapPointKind;
  lat: number;
  lng: number;
  label: string;
  description?: string;
  /** Metres — drawn as an accuracy circle around the marker. */
  accuracy?: number | null;
  /** Marks the point as outdated (greyed out). */
  stale?: boolean;
}

interface LeafletMapProps {
  points: MapPoint[];
  /** Fallback centre when there are no valid points. */
  center?: { lat: number; lng: number } | null;
  height?: number | string;
  className?: string;
  /** Draws a dashed line joining the points in order. */
  connectPoints?: boolean;
  showLegend?: boolean;
  interactive?: boolean;
  followPointId?: string | null;
}

const kindColor: Record<MapPointKind, string> = {
  shop: '#2563eb',
  pickup: '#7c3aed',
  agent: '#16a34a',
  destination: '#dc2626',
  custom: '#0f172a',
};

const kindLabel: Record<MapPointKind, string> = {
  shop: 'Shop',
  pickup: 'Pickup point',
  agent: 'Delivery agent',
  destination: 'Delivery address',
  custom: 'Location',
};

function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export function mapPinIcon(kind: MapPointKind, stale?: boolean) {
  const color = stale ? '#94a3b8' : kindColor[kind];
  const pulse = kind === 'agent' && !stale
    ? '<span class="shopafrica-pin-pulse" style="background:' + color + '"></span>'
    : '';
  return L.divIcon({
    className: 'shopafrica-map-pin',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
    html: `
      <span class="shopafrica-pin-wrap">
        ${pulse}
        <span class="shopafrica-pin-dot" style="background:${color}">
          <span class="shopafrica-pin-inner"></span>
        </span>
      </span>
    `,
  });
}

function MapBehaviour({
  points,
  center,
  followPointId,
}: {
  points: MapPoint[];
  center?: { lat: number; lng: number } | null;
  followPointId?: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  const followPoint = followPointId ? points.find((point) => point.id === followPointId) : undefined;
  const pointKey = points.map((point) => `${point.id}:${point.lat}:${point.lng}`).join('|');

  useEffect(() => {
    if (followPoint) {
      map.setView([followPoint.lat, followPoint.lng], Math.max(map.getZoom(), 15), { animate: true });
      return;
    }
    if (points.length > 1) {
      map.fitBounds(
        L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number])),
        { padding: [40, 40], maxZoom: 15 },
      );
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
      return;
    }
    if (center) {
      map.setView([center.lat, center.lng], 12);
    }
  }, [map, pointKey, followPoint?.lat, followPoint?.lng, center?.lat, center?.lng]);

  return null;
}

export function LeafletMap({
  points,
  center,
  height = 320,
  className,
  connectPoints = false,
  showLegend = true,
  interactive = true,
  followPointId = null,
}: LeafletMapProps) {
  const validPoints = useMemo(
    () => points.filter((point) => isValidCoordinate(point.lat, point.lng)),
    [points],
  );

  const initialCenter = useMemo<[number, number]>(() => {
    if (validPoints.length > 0) return [validPoints[0].lat, validPoints[0].lng];
    if (center && isValidCoordinate(center.lat, center.lng)) return [center.lat, center.lng];
    return [9.0765, 7.3986];
  }, [validPoints, center]);

  const kindsInUse = useMemo(
    () => Array.from(new Set(validPoints.map((point) => point.kind))),
    [validPoints],
  );

  const route = validPoints.map((point) => [point.lat, point.lng] as [number, number]);

  return (
    <div
      className={cn('relative isolate overflow-hidden rounded-xl border border-border bg-muted', className)}
      style={{ height }}
    >
      <MapContainer
        center={initialCenter}
        zoom={validPoints.length > 1 ? 11 : 14}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        doubleClickZoom={interactive}
        style={{ height: '100%', width: '100%' }}
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        {connectPoints && route.length > 1 && (
          <Polyline positions={route} pathOptions={{ color: '#0f172a', weight: 3, dashArray: '6 8', opacity: 0.55 }} />
        )}
        {validPoints.map((point) => (
          <Marker key={point.id} position={[point.lat, point.lng]} icon={mapPinIcon(point.kind, point.stale)}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{point.label}</p>
                {point.description && <p className="text-xs text-muted-foreground">{point.description}</p>}
                {point.stale && <p className="mt-1 text-xs text-muted-foreground">Last known location</p>}
              </div>
            </Popup>
            {point.kind === 'agent' && typeof point.accuracy === 'number' && point.accuracy > 0 && (
              <Circle
                center={[point.lat, point.lng]}
                radius={Math.min(point.accuracy, 2000)}
                pathOptions={{ color: kindColor.agent, weight: 1, fillOpacity: 0.08 }}
              />
            )}
          </Marker>
        ))}
        <MapBehaviour points={validPoints} center={center} followPointId={followPointId} />
      </MapContainer>

      {showLegend && kindsInUse.length > 0 && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-[500] flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-background/90 px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur">
          {kindsInUse.map((kind) => (
            <span key={kind} className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: kindColor[kind] }} />
              {kindLabel[kind]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
