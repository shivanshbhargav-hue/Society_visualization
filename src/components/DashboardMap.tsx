import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Store, SpatialResult } from "@/hooks/use-spatial-data";

const STORE_COORDS: Record<Store, [number, number]> = {
  HSR: [12.9143, 77.6276],
  Marathali: [12.9499, 77.6982],
};

interface Props {
  store: Store;
  result: SpatialResult;
}

export function DashboardMap({ store, result }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const featuresLayerRef = useRef<L.GeoJSON | null>(null); // NEW: Ref to hold the demand features
  const markersRef = useRef<L.Marker[]>([]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: STORE_COORDS[store],
      zoom: 12,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);

    // Add static store markers
    const markerIcon = L.divIcon({
      className: "",
      html: `<div style="width:14px;height:14px;background:#000;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.7);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    (Object.entries(STORE_COORDS) as [Store, [number, number]][]).forEach(([, coords]) => {
      const marker = L.marker(coords, { icon: markerIcon }).addTo(map);
      markersRef.current.push(marker);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update polygon and features when isochrone or store changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 1. CLEAR OLD LAYERS
    // Remove old isochrone polygon
    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
    // Remove old demand features
    if (featuresLayerRef.current) {
      map.removeLayer(featuresLayerRef.current);
      featuresLayerRef.current = null;
    }

    const { isochronePolygon, featuresInZone } = result;
    
    // 2. DRAW NEW ISOCHRONE POLYGON
    if (isochronePolygon && isochronePolygon[0]) {
      // Convert [lng, lat] to [lat, lng] for Leaflet
      const latlngs = isochronePolygon[0].map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );

      const poly = L.polygon(latlngs, {
        color: "#22d3ee",
        fillColor: "#22d3ee",
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);

      polygonRef.current = poly;
      
      // Auto-fit the map strictly to the new boundaries
      map.fitBounds(poly.getBounds(), { padding: [40, 40] });
    } else {
      map.setView(STORE_COORDS[store], 12);
    }

    // 3. DRAW NEW DEMAND FEATURES (Societies, IT Parks, etc.)
    if (featuresInZone && featuresInZone.length > 0) {
      const geoJsonLayer = L.geoJSON(
        {
          type: "FeatureCollection",
          features: featuresInZone,
        } as any, 
        {
          // Style the matched features in amber so they stand out
          style: {
            color: "#fbbf24", 
            weight: 1,
            fillColor: "#f59e0b",
            fillOpacity: 0.4,
          },
          // Add popups to inspect the data by clicking on the map
          onEachFeature: (feature, layer) => {
            const props = feature.properties;
            if (props) {
              layer.bindPopup(
                `<div style="font-family: sans-serif; color: #0f172a;">
                  <strong style="font-size: 14px;">${props.name || "Unnamed Feature"}</strong><br/>
                  <span style="font-size: 12px; color: #475569;">${props.category || "Unknown Category"}</span><br/>
                  <div style="margin-top: 4px; font-weight: bold;">
                    Users: ${props.unique_users || 0}
                  </div>
                </div>`
              );
            }
          }
        }
      ).addTo(map);

      // Save to ref so it can be cleared on the next render
      featuresLayerRef.current = geoJsonLayer;
    }

  }, [result.isochronePolygon, result.featuresInZone, store]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: "#0d1117" }}
    />
  );
}