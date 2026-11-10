import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stateCenter } from '@/lib/nigeria';
import { mapPinIcon } from '@/components/map/LeafletMap';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface Coordinates {
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  value: Coordinates | null;
  onChange: (value: Coordinates | null) => void;
  state?: string | null;
  label?: string;
  description?: string;
  height?: number;
  disabled?: boolean;
  className?: string;
}

function ClickHandler({ onPick }: { onPick: (value: Coordinates) => void }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function FollowValue({
  value,
  fallback,
}: {
  value: Coordinates | null;
  fallback: Coordinates | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (value) {
      map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15));
      return;
    }
    if (fallback) {
      map.setView([fallback.lat, fallback.lng], 11);
    }
  }, [map, value?.lat, value?.lng, fallback?.lat, fallback?.lng]);

  return null;
}

export function LocationPicker({
  value,
  onChange,
  state,
  label = 'Pin your exact location',
  description = 'Tap the map to drop a pin, or drag the pin to adjust it.',
  height = 240,
  disabled = false,
  className,
}: LocationPickerProps) {
  const [locating, setLocating] = useState(false);

  const fallback = useMemo(() => stateCenter(state), [state]);
  const initialCenter = useMemo<[number, number]>(() => {
    if (value) return [value.lat, value.lng];
    if (fallback) return [fallback.lat, fallback.lng];
    return [9.0765, 7.3986];
  }, [value, fallback]);

  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('This device does not support location sharing.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChange({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        setLocating(false);
        toast.error(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Allow access or tap the map instead.'
            : 'Could not read your location. Tap the map to set it manually.',
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-lg"
            onClick={locate}
            disabled={disabled || locating}
          >
            {locating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Crosshair className="mr-1.5 h-3.5 w-3.5" />}
            Use my location
          </Button>
          {value && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg"
              onClick={() => onChange(null)}
              disabled={disabled}
              aria-label="Clear pinned location"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div
        className="relative isolate overflow-hidden rounded-xl border border-border"
        style={{ height, filter: disabled ? 'grayscale(0.6)' : undefined }}
      >
        <MapContainer
          center={initialCenter}
          zoom={value ? 15 : 11}
          scrollWheelZoom={!disabled}
          dragging={!disabled}
          doubleClickZoom={!disabled}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={mapPinIcon('custom')}
              draggable={!disabled}
              eventHandlers={{
                dragend: (event) => {
                  const latlng = event.target.getLatLng();
                  onChange({ lat: latlng.lat, lng: latlng.lng });
                },
              }}
            />
          )}
          {!disabled && <ClickHandler onPick={onChange} />}
          <FollowValue value={value} fallback={fallback} />
        </MapContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        {value
          ? `Pinned at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
          : 'No pin yet — buyers and agents will fall back to your state centre.'}
      </p>
    </div>
  );
}
