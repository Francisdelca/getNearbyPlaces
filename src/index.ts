import { Client, Databases } from 'node-appwrite';

interface Place {
  name: string;
  description?: string;
  image?: string;
  address?: string;
  category?: string;
  category_id?: string;
  latitude: number;
  longitude: number;
  $id?: string;
}

interface Input {
  latitude: number;
  longitude: number;
  zoom: number;
}

interface OutputPlace {
  name: string;
  latitude: number;
  longitude: number;
  $id?: string;
}

// --- Haversine formula ---
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- Convert zoom to radius (km) ---
function zoomToRadius(zoom: number): number {
  // Approximate: radius = 156543.03392 * cos(latitude * PI/180) / (2^zoom) in meters at equator
  // We'll use a fixed latitude for radius estimation (worst case)
  // At zoom 10: ~78km, zoom 12: ~20km, zoom 14: ~5km
  // We'll use: radius_km = 40000 / 2^(zoom-1) (Earth circumference / 2^(zoom-1))
  if (zoom < 10) return 0;
  return 40000 / Math.pow(2, zoom - 1); // in km
}

// --- Validate input ---
function validateInput(input: any): Input {
  if (
    typeof input !== 'object' ||
    typeof input.latitude !== 'number' ||
    typeof input.longitude !== 'number' ||
    typeof input.zoom !== 'number'
  ) {
    throw new Error('Invalid input: latitude, longitude, and zoom are required and must be numbers.');
  }
  if (input.zoom < 10) {
    throw new Error('Zoom must be at least 10.');
  }
  return input as Input;
}

// --- Main handler ---
export default async function main({ req, res, log, error }: any) {
  try {
    const input = validateInput(req.body ? JSON.parse(req.body) : {});
    const radius = zoomToRadius(input.zoom);
    if (radius === 0) {
      return res.json([]);
    }

    // Appwrite client setup
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT || '')
      .setProject(process.env.APPWRITE_PROJECT || '')
      .setKey(process.env.APPWRITE_API_KEY || '');
    const databases = new Databases(client);

    // Fetch all places (up to 500, filter in-memory)
    const dbId = 'places';
    const collectionId = 'place';
    const limit = 500;
    let documents: Place[] = [];
    let offset = 0;
    let total = 0;
    do {
      const response = await databases.listDocuments(dbId, collectionId, [
        // No geo-query, so fetch all and filter
        // Query.limit(limit),
        // Query.offset(offset),
      ]);
      documents = documents.concat(response.documents as Place[]);
      total = response.total;
      offset += response.documents.length;
    } while (documents.length < total && offset < 1000); // hard cap

    // Filter by distance
    const filtered = documents
      .map((place) => ({
        ...place,
        distance: haversineDistance(input.latitude, input.longitude, place.latitude, place.longitude),
      }))
      .filter((place) => place.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 100)
      .map(({ name, latitude, longitude, $id }) => ({ name, latitude, longitude, $id }));

    return res.json(filtered);
  } catch (err: any) {
    error(err.message || 'Unknown error');
    return res.json({ error: err.message || 'Unknown error' }, 400);
  }
} 