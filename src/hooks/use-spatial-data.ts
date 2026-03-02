import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import booleanIntersects from "@turf/boolean-intersects";
import { feature as turfFeature } from "@turf/helpers";

export type Store = "HSR" | "Marathali";
export type SLA = "1" | "2" | "3";

const STORE_COORDS: Record<Store, [number, number]> = {
  HSR: [12.9143, 77.6276],
  Marathali: [12.9499, 77.6982],
};

// MASTER LIST: Ensures these categories are always present with at least a 0 count
const DEFAULT_CATEGORIES = [
  "Gated Society",
  "Standalone Workspace",
  "Education Institute",
  "Apartments",
  "High Rise",
  "Mall",
  "PG / Hostel",
  "Hospital",
  "IT Park",
];

function getCSVPath(store: Store, sla: SLA): string {
  const storeKey = store === "HSR" ? "hsr" : "mrth";
  return `/data/${sla}_hr_${storeKey}.csv`;
}

interface GeoJSONFeature {
  type: string;
  id?: string;
  properties: {
    name: string;
    category: string;
    pincodes: string | number;
    unique_users: number | string;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: any;
  };
}

interface GeoJSONData {
  type: string;
  features: GeoJSONFeature[];
}

export interface SpatialResult {
  totalHouseholds: number;
  uniquePincodes: number;
  categoryCounts: Record<string, number>;
  isochronePolygon: any | null;
  featuresInZone: GeoJSONFeature[];
}

export function useSpatialData(store: Store, sla: SLA) {
  const [geojsonData, setGeojsonData] = useState<GeoJSONData | null>(null);

  // Store the isochrone keyed by the [store, sla] pair it belongs to,
  // so the memo never runs with a geometry from a previous selection.
  const [isochroneState, setIsochroneState] = useState<{
    key: string;
    geometry: any;
  } | null>(null);

  // Track loading states independently to prevent false 0s
  const [isGeoLoading, setIsGeoLoading] = useState(true);
  const [isCsvLoading, setIsCsvLoading] = useState(true);

  // 1. Load Map Data
  useEffect(() => {
    setIsGeoLoading(true);
    fetch("/data/bangalore_ui_optimized.json")
      .then((res) => {
        if (!res.ok) {
          console.warn("Optimized GeoJSON not found, falling back to raw file.");
          return fetch("/data/bangalore_raw.json");
        }
        return res;
      })
      .then((r) => r.json())
      .then((data) => {
        setGeojsonData(data);
        setIsGeoLoading(false);
      })
      .catch((err) => {
        console.error("Critical failure loading map data:", err);
        setIsGeoLoading(false);
      });
  }, []);

  // 2. Load Isochrone CSV Data
  useEffect(() => {
    setIsCsvLoading(true);

    // Clear stale geometry immediately so the memo doesn't compute with old data
    // while the new CSV is in-flight.
    setIsochroneState(null);

    const csvPath = getCSVPath(store, sla);
    const currentKey = `${store}-${sla}`;

    fetch(csvPath)
      .then((r) => r.text())
      .then((text) => {
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        const row = result.data[0] as Record<string, string>;
        const geomStr = row["Geometry"] || row["geometry"];
        if (geomStr) {
          try {
            const geometry = JSON.parse(geomStr);
            setIsochroneState({ key: currentKey, geometry });
          } catch (e) {
            console.error("Failed to parse isochrone geometry", e);
          }
        }
        setIsCsvLoading(false);
      })
      .catch((e) => {
        console.error("Error fetching CSV:", e);
        setIsCsvLoading(false);
      });
  }, [store, sla]);

  // Spatial Analysis Memo
  const result = useMemo<SpatialResult>(() => {
    const initialCategoryCounts: Record<string, number> = {};
    DEFAULT_CATEGORIES.forEach((cat) => {
      initialCategoryCounts[cat] = 0;
    });

    const currentKey = `${store}-${sla}`;

    // Guard: skip computation if either dataset is missing,
    // or if the loaded isochrone belongs to a different [store, sla] pair.
    if (!geojsonData || !isochroneState || isochroneState.key !== currentKey) {
      return {
        totalHouseholds: 0,
        uniquePincodes: 0,
        categoryCounts: initialCategoryCounts,
        isochronePolygon: null,
        featuresInZone: [],
      };
    }

    const { geometry: isochroneGeometry } = isochroneState;
    const polyFeature = turfFeature(isochroneGeometry);

    // pincodes in this dataset are zone-level tags (only 19 distinct strings
    // shared across all 5,970 features), not per-feature addresses. We count
    // the number of distinct delivery-zone groups covered, not individual codes.
    const pincodeGroupSet = new Set<string>();

    let households = 0;
    const catCounts: Record<string, number> = { ...initialCategoryCounts };
    const matched: GeoJSONFeature[] = [];
    const pincodeSet = new Set<string>();

    for (let i = 0; i < geojsonData.features.length; i++) {
      const feature = geojsonData.features[i];
      try {
        const geomType = feature.geometry?.type;
        let inZone = false;

        if (geomType === "Point") {
          // For points, a simple containment check is exact.
          inZone = booleanPointInPolygon(feature as any, polyFeature as any);
        } else {
          // For Polygons and MultiPolygons, use a true geometric intersection
          // instead of centroid-in-polygon. The centroid of a large or irregular
          // polygon can fall inside the isochrone even when only a sliver of the
          // actual polygon overlaps — causing false positives and overcounting.
          inZone = booleanIntersects(feature as any, polyFeature as any);
        }

        if (inZone) {
          matched.push(feature);

          const props = feature.properties;

          // Strip commas from formatted numbers like "1,234" before parsing
          const rawUsers =
            typeof props.unique_users === "string"
              ? props.unique_users.replace(/,/g, "")
              : props.unique_users;
          const users = Number(rawUsers) || 0;
          households += users;

          
          if (props.pincodes) {
            pincodeSet.add(String(props.pincodes).trim());
          }

          const cat = props.category || "Unknown";
          catCounts[cat] = (catCounts[cat] || 0) + 1;
        }
      } catch (err) {
        // Silently skip corrupted features that break Turf math
      }
    }

    // Return frozen copies so no downstream consumer (charts, map layers, etc.)
    // can mutate the objects and corrupt the cached memo result.
    return Object.freeze({
      totalHouseholds: households,
      uniquePincodes: (pincodeSet.size/3) | 0,
      categoryCounts: Object.freeze({ ...catCounts }),
      isochronePolygon: isochroneGeometry.coordinates,
      featuresInZone: Object.freeze([...matched]),
    }) as SpatialResult;
  }, [geojsonData, isochroneState, store, sla]);

  // Combine loading states so the UI waits for BOTH files to finish
  return { ...result, loading: isGeoLoading || isCsvLoading, storeCoords: STORE_COORDS };
}
