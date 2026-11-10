import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const MIN_INTERVAL_MS = 20000;
const MIN_MOVE_METERS = 30;

interface ShareState {
  supported: boolean;
  active: boolean;
  lastSharedAt: Date | null;
  accuracy: number | null;
  error: string | null;
  position: { lat: number; lng: number } | null;
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Streams the agent's position to `update_agent_location` while they have an
 * active delivery. Updates are throttled to one every 20s or 30m of movement.
 */
export function useAgentLocationSharing(enabled: boolean) {
  const [state, setState] = useState<ShareState>({
    supported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
    active: false,
    lastSharedAt: null,
    accuracy: null,
    error: null,
    position: null,
  });
  const lastSent = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({ ...current, active: false }));
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState((current) => ({
        ...current,
        supported: false,
        active: false,
        error: 'Location sharing is not supported on this device.',
      }));
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, active: true, error: null }));

    const send = (lat: number, lng: number, accuracy: number | null) => {
      const now = Date.now();
      const previous = lastSent.current;
      if (previous && now - previous.at < MIN_INTERVAL_MS) {
        if (distanceMeters(previous, { lat, lng }) < MIN_MOVE_METERS) return;
      }
      lastSent.current = { lat, lng, at: now };
      void supabase
        .rpc('update_agent_location', { p_lat: lat, p_lng: lng, p_accuracy: accuracy })
        .then(({ error }) => {
          if (cancelled) return;
          setState((current) => ({
            ...current,
            lastSharedAt: error ? current.lastSharedAt : new Date(),
            accuracy: error ? current.accuracy : accuracy,
            error: error ? 'Could not share your location. Check your connection.' : null,
            position: error ? current.position : { lat, lng },
          }));
        });
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        send(position.coords.latitude, position.coords.longitude, position.coords.accuracy ?? null);
      },
      (error) => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          error:
            error.code === error.PERMISSION_DENIED
              ? 'Location permission denied. Buyers cannot see your live position.'
              : 'Could not read your GPS position.',
        }));
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);

  return state;
}
