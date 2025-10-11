// Normalize various incoming location shapes to your GeoPoint subschema:
// { lat, lon, name? }  OR  { latitude, longitude, name? }  OR  full GeoJSON Point.
export function toGeoPoint(input) {
  if (!input) return undefined;

  // Already in the correct GeoJSON "Point" shape?
  if (input.type === "Point" && Array.isArray(input.coordinates)) {
    const [lng, lat] = input.coordinates;
    if (Number.isFinite(lng) && Number.isFinite(lat))
      return {
        type: "Point",
        coordinates: [lng, lat],
        ...(input.name ? { name: input.name } : {}),
      };
  }

  // Coerce common lat/lon shapes
  const lat = Number(input.lat ?? input.latitude);
  const lng = Number(input.lon ?? input.lng ?? input.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return {
      type: "Point",
      // IMPORTANT: [longitude, latitude]
      coordinates: [lng, lat],
      ...(input.name ? { name: input.name } : {}),
    };
  }

  return undefined; // let Mongoose validation complain if something invalid still gets through
}
