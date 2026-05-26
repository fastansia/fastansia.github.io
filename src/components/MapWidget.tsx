import { useEffect, useMemo, useRef, useState } from "react";
import { z } from 'astro/zod';
import maplibregl from 'maplibre-gl';
import "maplibre-gl/dist/maplibre-gl.css";

type Waypoint = {
    lng: number;
    lat: number;
};

const MAP_VIEW_KEY = 'MAP_VIEW';
const ROUTES_KEY = 'MAP_ROUTES_V1';
const ROUTE_SOURCE_ID = 'route-source';
const ROUTE_LINE_LAYER_ID = 'route-line-layer';
const ROUTE_POINT_LAYER_ID = 'route-point-layer';
const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const SNAP_ENDPOINT = 'https://fastansia.samestimable2016.workers.dev/v2/snap';
const DIRECTIONS_ENDPOINT = 'https://fastansia.samestimable2016.workers.dev/v2/directions';

type Route = {
    name: string;
    points: Waypoint[];
    snappedPoints?: Waypoint[];
    geometry?: any; // GeoJSON LineString
    distance?: number;
};

function createWaypoint(lng: number, lat: number): Waypoint {
    return { lng, lat };
}

function coordKey({ lng, lat }: Waypoint, precision = 6) {
    return `${lng.toFixed(precision)},${lat.toFixed(precision)}`;
}

type SnapFeature = {
    sourceId: number | undefined;
    point: Waypoint;
};

function normalizeSnapPoints(data: any): Waypoint[] {
    const features = Array.isArray(data?.features) ? data.features : [];

    return features
        .map((feature: any): SnapFeature | null => {
            const sourceId = feature?.properties?.source_id;
            const coordinates = feature?.geometry?.coordinates;
            if (!Array.isArray(coordinates) || coordinates.length < 2) {
                return null;
            }
            return { sourceId, point: { lng: coordinates[0], lat: coordinates[1] } };
        })
        .filter((entry: SnapFeature | null): entry is SnapFeature => entry !== null)
        .sort((a: SnapFeature, b: SnapFeature) => (a.sourceId ?? 0) - (b.sourceId ?? 0))
        .map((entry: SnapFeature) => entry.point);
}

function loadRoutes(): Route[] {
    const saved = localStorage.getItem(ROUTES_KEY);
    if (!saved) return [];

    try {
        const parsed = JSON.parse(saved);
        const WaypointSchema = z.object({ lng: z.number(), lat: z.number() });
        const RouteSchema = z.object({ name: z.string(), points: z.array(WaypointSchema), snappedPoints: z.array(WaypointSchema).optional(), geometry: z.any().optional(), distance: z.number().optional() });
        const RoutesSchema = z.array(RouteSchema);
        const result = RoutesSchema.safeParse(parsed);
        if (!result.success) return [];
        return result.data;
    } catch {
        return [];
    }
}

function loadMapView(): { center: [number, number]; zoom: number } {
    const fallback = { center: [0, 0] as [number, number], zoom: 1 };
    const saved = localStorage.getItem(MAP_VIEW_KEY);
    if (!saved) return fallback;

    try {
        const parsed = JSON.parse(saved);
        const MapViewSchema = z.object({ center: z.tuple([z.number(), z.number()]), zoom: z.number() });
        const result = MapViewSchema.safeParse(parsed);
        return result.success ? result.data : fallback;
    } catch {
        return fallback;
    }
}

export default function () {
    const mapRef = useRef<HTMLDivElement | null>(null);
    const mapInstanceRef = useRef<maplibregl.Map | null>(null);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [activeRouteIndex, setActiveRouteIndex] = useState<number>(0);
    const [isRenamingRoute, setIsRenamingRoute] = useState(false);
    const [routeNameDraft, setRouteNameDraft] = useState('');
    const [isSnapping, setIsSnapping] = useState(false);
    const [snappingRouteIndex, setSnappingRouteIndex] = useState<number | null>(null);
    const [geolocationPoint, setGeolocationPoint] = useState<Waypoint | null>(null);
    const geolocateControlRef = useRef<{ ctrl: any; handler: (e: any) => void } | null>(null);

    const activeRoute = routes[activeRouteIndex] ?? { name: `Route ${activeRouteIndex + 1}`, points: [] };
    const routePoints = activeRoute.points;



    const cloneRoutes = (prev: Route[]): Route[] => prev.map((route): Route => ({
        ...route,
        points: [...route.points],
        snappedPoints: route.snappedPoints ? [...route.snappedPoints] : undefined,
        geometry: route.geometry ? { ...route.geometry } : route.geometry,
    }));

    async function requestSnap(routeIndex: number, coords: Array<[number, number]>) {
        setIsSnapping(true);
        setSnappingRouteIndex(routeIndex);
        try {
            const res = await fetch(`${SNAP_ENDPOINT}/driving-car/geojson`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locations: coords, radius: 350 }),
            });
            if (!res.ok) {
                console.warn('Snapping request failed', await res.text());
                return;
            }
            const data = await res.json();

            const snappedPoints = normalizeSnapPoints(data);
            let routeGeometry: any = null;
            let routeDistance: number | undefined;

            if (snappedPoints.length > 1) {
                try {
                    const directionsRes = await fetch(`${DIRECTIONS_ENDPOINT}/driving-car/geojson`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ coordinates: snappedPoints.map((point) => [point.lng, point.lat]) }),
                    });

                    if (directionsRes.ok) {
                        const directionsData = await directionsRes.json();
                        const firstFeature = directionsData?.features?.[0];
                        routeGeometry = firstFeature?.geometry ?? null;
                        routeDistance = firstFeature?.properties?.summary?.distance;
                    } else {
                        console.warn('Directions request failed', await directionsRes.text());
                    }
                } catch (directionsErr) {
                    console.warn('Error calling directions endpoint', directionsErr);
                }
            }

            setRoutes((prev) => {
                const copy = prev.map((r) => ({ ...r, points: [...r.points], snappedPoints: r.snappedPoints ? [...r.snappedPoints] : undefined, geometry: r.geometry ? { ...r.geometry } : r.geometry }));
                if (!copy[routeIndex]) return copy;

                if (snappedPoints.length > 0) {
                    copy[routeIndex].snappedPoints = snappedPoints;
                } else {
                    copy[routeIndex].snappedPoints = undefined;
                }

                copy[routeIndex].geometry = routeGeometry;
                copy[routeIndex].distance = routeDistance;

                return copy;
            });
        } catch (err) {
            console.warn('Error calling snap endpoint', err);
        } finally {
            setIsSnapping(false);
            setSnappingRouteIndex(null);
        }
    }

    const appendPointToRoute = (routeIndex: number, point: Waypoint) => {
        setRoutes((prev) => {
            const copy = cloneRoutes(prev);
            if (copy[routeIndex]) {
                copy[routeIndex].points.push(point);
                const coords = copy[routeIndex].points.map((p) => [p.lng, p.lat] as [number, number]);
                requestSnap(routeIndex, coords);
            } else {
                const nextRoute: Route = { name: `Route ${copy.length + 1}`, points: [point], snappedPoints: undefined, geometry: undefined };
                copy.push(nextRoute);
                const nextRouteIndex = copy.length - 1;
                setActiveRouteIndex(nextRouteIndex);
                requestSnap(nextRouteIndex, [[point.lng, point.lat]]);
            }
            return copy;
        });
    };

    const undoLastPoint = () => {
        setRoutes((prev) => {
            const copy = prev.map((r) => ({ ...r, points: [...r.points] }));
            if (copy[activeRouteIndex] && copy[activeRouteIndex].points.length > 0) {
                copy[activeRouteIndex].points.pop();
                const coords = copy[activeRouteIndex].points.map((p) => [p.lng, p.lat] as [number, number]);
                requestSnap(activeRouteIndex, coords);
            }
            return copy;
        });
    };

    const routeGeoJson = useMemo(() => {
        // prefer snappedPoints for point placement, and geometry for line
        const pointsToRender: Waypoint[] = (activeRoute.snappedPoints && activeRoute.snappedPoints.length > 0) ? activeRoute.snappedPoints : routePoints;

        const pointFeatures = pointsToRender.map((point, index) => ({
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates: [point.lng, point.lat],
            },
            properties: {
                key: coordKey(point),
                order: index + 1,
            },
        }));

        const lineCoords = (activeRoute.geometry && activeRoute.geometry.type === 'LineString' && Array.isArray(activeRoute.geometry.coordinates) && activeRoute.geometry.coordinates.length > 1)
            ? (activeRoute.geometry.coordinates as Array<[number, number]>)
            : [];

        const lineFeature = lineCoords.length > 1 ? {
            type: 'Feature' as const,
            geometry: {
                type: 'LineString' as const,
                coordinates: lineCoords,
            },
            properties: {},
        } : null;

        const features: any[] = lineFeature ? [lineFeature, ...pointFeatures] : [...pointFeatures];

        return ({
            type: 'FeatureCollection' as const,
            features,
        } as any);
    }, [routePoints, activeRouteIndex, activeRoute.snappedPoints, activeRoute.geometry]);

    const routeGeoJsonRef = useRef(routeGeoJson);

    useEffect(() => {
        routeGeoJsonRef.current = routeGeoJson;
    }, [routeGeoJson]);

    useEffect(() => {
        if (!mapRef.current) return;

        // Load saved view from localStorage or use defaults
        const { center: initialCenter, zoom: initialZoom } = loadMapView();

        const map = new maplibregl.Map({
            container: mapRef.current,
            style: MAP_STYLE_URL,
            center: initialCenter,
            zoom: initialZoom,
            renderWorldCopies: false,
        });
        mapInstanceRef.current = map;

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.addControl(new maplibregl.FullscreenControl(), 'top-right');
        const createGeolocateControl = () => {
            const ctrl = new maplibregl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: false,
                showAccuracyCircle: true,
            });

            const handler = (event: GeolocationPosition) => {
                setGeolocationPoint(createWaypoint(event.coords.longitude, event.coords.latitude));
            };

            ctrl.on('geolocate', handler);
            geolocateControlRef.current = { ctrl, handler };
            map.addControl(ctrl, 'top-right');
        };

        createGeolocateControl();

        const addRouteLayers = () => {
            if (map.getSource(ROUTE_SOURCE_ID)) {
                return;
            }

            map.addSource(ROUTE_SOURCE_ID, {
                type: 'geojson',
                data: routeGeoJsonRef.current,
            });

            map.addLayer({
                id: ROUTE_LINE_LAYER_ID,
                type: 'line',
                source: ROUTE_SOURCE_ID,
                filter: ['==', '$type', 'LineString'],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                },
                paint: {
                    'line-color': '#2563eb',
                    'line-width': 4,
                    'line-opacity': 0.9,
                },
            });

            map.addLayer({
                id: ROUTE_POINT_LAYER_ID,
                type: 'circle',
                source: ROUTE_SOURCE_ID,
                filter: ['==', '$type', 'Point'],
                paint: {
                    'circle-color': '#ffffff',
                    'circle-radius': 6,
                    'circle-stroke-color': '#2563eb',
                    'circle-stroke-width': 3,
                },
            });

            map.addSource('geolocation-source', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [],
                },
            });

            map.addLayer({
                id: 'geolocation-point-layer',
                type: 'circle',
                source: 'geolocation-source',
                filter: ['==', '$type', 'Point'],
                paint: {
                    'circle-color': '#0f766e',
                    'circle-radius': 7,
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2,
                },
            });
        };

        const onMapLoad = () => {
            addRouteLayers();
        };

        const onMapMove = () => {
            const center = map.getCenter();
            const zoom = map.getZoom();
            localStorage.setItem(MAP_VIEW_KEY, JSON.stringify({ center: [center.lng, center.lat], zoom }));
        };

        map.on('load', onMapLoad);
        map.on('moveend', onMapMove);

        return () => {
            map.off('load', onMapLoad);
            map.off('moveend', onMapMove);
            const stored = geolocateControlRef.current;
            if (stored) {
                try { stored.ctrl.off('geolocate', stored.handler); } catch { }
                try { map.removeControl(stored.ctrl); } catch { }
                geolocateControlRef.current = null;
            }
            mapInstanceRef.current = null;
            map.remove();
        };
    }, []);

    useEffect(() => {
        const saved = loadRoutes();
        if (saved.length > 0) {
            setRoutes(saved);
            setActiveRouteIndex(0);
        } else {
            setRoutes([{ name: 'Route 1', points: [] }]);
            setActiveRouteIndex(0);
        }
    }, []);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        const handler = (event: maplibregl.MapMouseEvent) => {
            const { lng, lat } = event.lngLat;
            appendPointToRoute(activeRouteIndex, createWaypoint(lng, lat));
        };

        map.on('click', handler);
        return () => {
            map.off('click', handler);
        };
    }, [activeRouteIndex]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            const meta = e.ctrlKey || e.metaKey;
            if (!meta || key !== 'z') return;

            const target = e.target as HTMLElement | null;
            if (target) {
                const tag = target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
            }

            e.preventDefault();
            undoLastPoint();
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [activeRouteIndex]);

    // persist all routes
    useEffect(() => {
        localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
    }, [routes]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !map.isStyleLoaded()) return;
        const source = map.getSource(ROUTE_SOURCE_ID) as any;
        if (source && typeof source.setData === 'function') {
            source.setData(routeGeoJson);
        }
    }, [routeGeoJson, activeRouteIndex]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !map.isStyleLoaded()) return;
        const source = map.getSource('geolocation-source') as any;
        if (source && typeof source.setData === 'function') {
            source.setData(geolocationPoint ? {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [geolocationPoint.lng, geolocationPoint.lat],
                    },
                    properties: {},
                }],
            } : {
                type: 'FeatureCollection',
                features: [],
            });
        }
    }, [geolocationPoint]);

    const clearRoute = () => {
        setRoutes((prev) => {
            const copy = cloneRoutes(prev);
            if (copy[activeRouteIndex]) copy[activeRouteIndex].points = [];
            requestSnap(activeRouteIndex, []);
            return copy;
        });
    };

    const addRoute = () => {
        const name = window.prompt('Enter new route name');
        if (!name) return;
        const trimmed = name.trim();
        if (!trimmed) return;
        setRoutes((prev) => {
            const newRoutes = [...prev, { name: trimmed, points: [] }];
            setActiveRouteIndex(newRoutes.length - 1);
            return newRoutes;
        });
    };

    const startRenameActiveRoute = () => {
        setRouteNameDraft(activeRoute.name);
        setIsRenamingRoute(true);
    };

    const cancelRenameActiveRoute = () => {
        setIsRenamingRoute(false);
        setRouteNameDraft('');
    };

    const saveRenamedRoute = () => {
        const trimmed = routeNameDraft.trim();
        if (!trimmed) return;

        setRoutes((prev) => {
            const copy = cloneRoutes(prev);
            if (copy[activeRouteIndex]) {
                copy[activeRouteIndex].name = trimmed;
            }
            return copy;
        });
        setIsRenamingRoute(false);
        setRouteNameDraft('');
    };

    const deleteActiveRoute = () => {
        setRoutes((prev) => {
            if (prev.length <= 1) return prev; // keep at least one
            const copy = cloneRoutes(prev);
            copy.splice(activeRouteIndex, 1);
            // adjust active index to remain in bounds
            const newIndex = Math.max(0, Math.min(activeRouteIndex - 1, copy.length - 1));
            setActiveRouteIndex(newIndex);
            return copy;
        });
    };

    const removeGeolocationPoint = () => {
        setGeolocationPoint(null);
        const map = mapInstanceRef.current;
        const stored = geolocateControlRef.current;
        if (!map || !stored) return;

        try {
            stored.ctrl.off('geolocate', stored.handler);
        } catch { }
        try {
            map.removeControl(stored.ctrl);
        } catch { }

        // recreate a fresh control so its internal markers are removed
        const newCtrl = new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
            showAccuracyCircle: true,
        });
        // reuse the same handler function
        newCtrl.on('geolocate', stored.handler);
        geolocateControlRef.current = { ctrl: newCtrl, handler: stored.handler };
        map.addControl(newCtrl, 'top-right');
    };

    return <>
        <div className="relative h-full min-h-0 w-full overflow-hidden">
            <div className="absolute left-3 top-3 z-10 w-fit rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-black/10 backdrop-blur">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-600">Route</label>
                        <select
                            value={activeRouteIndex}
                            onChange={(e) => setActiveRouteIndex(Number(e.target.value))}
                            className="ml-1 rounded-md border px-2 py-1 text-sm"
                        >
                            {routes.map((r, idx) => (
                                <option key={idx} value={idx}>{r.name}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            className="ml-2 rounded-md bg-slate-200 px-2 py-1 text-xs"
                            onClick={addRoute}
                        >
                            New
                        </button>
                        <button
                            type="button"
                            className="ml-1 rounded-md bg-slate-200 px-2 py-1 text-xs"
                            onClick={startRenameActiveRoute}
                            disabled={routes.length === 0 || isRenamingRoute}
                        >
                            Rename
                        </button>
                        <button
                            type="button"
                            className="ml-1 rounded-md bg-rose-100 px-2 py-1 text-xs text-rose-700"
                            onClick={deleteActiveRoute}
                            disabled={routes.length <= 1}
                        >
                            Delete
                        </button>
                        {geolocationPoint ? (
                            <button
                                type="button"
                                className="ml-1 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-800"
                                onClick={removeGeolocationPoint}
                            >
                                Remove location
                            </button>
                        ) : null}
                        <div className="ml-3">
                            {isRenamingRoute ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        value={routeNameDraft}
                                        autoFocus
                                        onChange={(e) => setRouteNameDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                saveRenamedRoute();
                                            }
                                            if (e.key === 'Escape') {
                                                e.preventDefault();
                                                cancelRenameActiveRoute();
                                            }
                                        }}
                                        onBlur={saveRenamedRoute}
                                        className="min-w-0 rounded-md border border-slate-300 px-2 py-1 text-sm font-semibold text-slate-900 outline-none ring-0 focus:border-slate-500"
                                    />
                                    <button
                                        type="button"
                                        className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white"
                                        onClick={saveRenamedRoute}
                                    >
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-md bg-slate-200 px-2 py-1 text-xs"
                                        onClick={cancelRenameActiveRoute}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-baseline gap-2">
                                    <p className="text-sm font-semibold text-slate-900">{activeRoute.name}</p>
                                    {isSnapping && snappingRouteIndex === activeRouteIndex ? (
                                        <p className="text-xs text-slate-500">Snapping...</p>
                                    ) : null}
                                </div>
                            )}
                            <p className="text-xs text-slate-600">{routePoints.length} point{routePoints.length === 1 ? '' : 's'}</p>
                            {typeof activeRoute.distance === 'number' ? (
                                <p className="text-xs text-slate-500">{(activeRoute.distance / 1000).toFixed(2)} km</p>
                            ) : null}
                        </div>
                    </div>
                </div>

                <p className="mt-2 text-xs text-slate-600">
                    Click the map to add points in order.
                </p>

                <div className="mt-3 flex gap-2">
                    <button
                        type="button"
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                        onClick={undoLastPoint}
                        disabled={routePoints.length === 0}
                    >
                        Undo
                    </button>
                    <button
                        type="button"
                        className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-rose-300"
                        onClick={clearRoute}
                        disabled={routePoints.length === 0}
                    >
                        Clear
                    </button>
                </div>
            </div>

            <div ref={mapRef} className="h-full min-h-0 w-full" />
        </div>
    </>;
}
