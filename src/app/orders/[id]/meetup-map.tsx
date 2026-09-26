"use client";

/**
 * The meetup map. LOC-1, LOC-3.
 *
 * Leaflet over OpenStreetMap tiles: no API key, no billing, no account, which
 * is the constraint that shaped every other choice in the stack. Loaded only
 * on the order page through a dynamic import, so the marketplace bundle never
 * carries a mapping library it does not use.
 *
 * The map is how a point is chosen conveniently, not the only way a point
 * exists: if tiles fail to load, the coordinates, the label and the accept
 * action are all still on the page, because a handover must not be blocked by
 * a tile server.
 */

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";

/** Lagos, where the seeded catalogue is. Display only, never stored. */
const DEFAULT_CENTRE: [number, number] = [6.5244, 3.3792];

export type MeetupPoint = { lat: number; lng: number };

export function MeetupMap({
  value,
  onPick,
  interactive,
}: {
  value: MeetupPoint | null;
  onPick: (point: MeetupPoint) => void;
  interactive: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const pick = useRef(onPick);
  const [failed, setFailed] = useState(false);

  // Kept in a ref so changing the handler does not tear the map down.
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let cancelled = false;

    // Dynamic import: Leaflet touches `window` at module scope, so it cannot
    // be imported during server rendering.
    void (async () => {
      try {
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");

        if (cancelled || !container.current || map.current) return;

        const instance = L.map(container.current, {
          center: value ? [value.lat, value.lng] : DEFAULT_CENTRE,
          zoom: value ? 15 : 11,
          scrollWheelZoom: false,
        });

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          // Required by the OpenStreetMap tile usage policy.
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(instance);

        // Leaflet's default marker images resolve relative to a CSS URL that
        // a bundler rewrites, so the icon is defined explicitly instead.
        const icon = L.divIcon({
          className: "",
          html: '<div style="width:18px;height:18px;border-radius:50%;background:#1E5F4B;border:3px solid #FFFFFF;box-shadow:0 0 0 1px #1E5F4B"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        if (value) {
          marker.current = L.marker([value.lat, value.lng], { icon }).addTo(instance);
        }

        if (interactive) {
          instance.on("click", (event: { latlng: { lat: number; lng: number } }) => {
            const point = { lat: event.latlng.lat, lng: event.latlng.lng };
            if (marker.current) {
              marker.current.setLatLng([point.lat, point.lng]);
            } else {
              marker.current = L.marker([point.lat, point.lng], { icon }).addTo(instance);
            }
            pick.current(point);
          });
        }

        map.current = instance;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // Built once. Later coordinate changes move the marker in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  // Follow a point proposed by the other party, or by this one.
  useEffect(() => {
    if (!map.current || !value) return;
    marker.current?.setLatLng([value.lat, value.lng]);
    map.current.setView([value.lat, value.lng], Math.max(map.current.getZoom(), 14));
  }, [value]);

  if (failed) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded border border-dashed border-[#B4B4B4] bg-[#F7F7F7] p-6 text-center">
        <p className="text-[13px] text-[#6B6B6B]">
          The map could not load. You can still agree a point using the details below.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={container}
      role="application"
      aria-label={
        interactive ? "Map. Click to choose a meetup point." : "Map showing the meetup point."
      }
      className="h-[260px] w-full overflow-hidden rounded border border-[#B4B4B4]"
    />
  );
}
