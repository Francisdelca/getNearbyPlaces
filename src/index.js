const { Client, Databases } = require('node-appwrite');

// --- Haversine formula ---
function haversineDistance(lat1, lon1, lat2, lon2) {
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
function zoomToRadius(zoom) {
  if (zoom < 10) return 0;
  return 40000 / Math.pow(2, zoom - 1); // in km
}

// --- Validate input ---
function validateInput(input) {
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
  return input;
}

// --- Main handler ---
module.exports = async function main({ req, res, log, error }) {
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
    let documents = [];
    let offset = 0;
    let total = 0;
    do {
      const response = await databases.listDocuments(dbId, collectionId, []);
      documents = documents.concat(response.documents);
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
  } catch (err) {
    error(err.message || 'Unknown error');
    return res.json({ error: err.message || 'Unknown error' }, 400);
  }
}; 