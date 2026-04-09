const turf = require("@turf/turf");
const geoip = require("geoip-lite");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

// Rate limiting (60 requests per minute per IP)
const geoRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Too many requests. Please try again later." },
});

// Original Coordinates
const coordinates = [
  [
    [78.59589805311452, 17.19772416909302],
    [78.5962677024014, 17.195818118091992],
    [78.59670748424293, 17.195900211943425],
    [78.59685592177141, 17.194859952533434],
    [78.59745827760537, 17.19394402956806],
    [78.59790646787206, 17.194038056180148],
    [78.59798094085556, 17.193833825459365],
    [78.59951805938545, 17.193816817549504],
    [78.59967032624854, 17.194418229974048],
    [78.5984843712888, 17.19485535603421],
    [78.59949710056821, 17.195817657285346],
    [78.6003287199544, 17.195578178294838],
    [78.60174283737177, 17.1972399570695],
    [78.59965275052855, 17.198477107651257],
    [78.59984085547188, 17.198865433043736],
    [78.59912276465354, 17.199113508402178],
    [78.59849524267332, 17.198290799370284],
    [78.59751807697285, 17.198362889101276],
    [78.59589805311452, 17.19772416909302],
  ],
];

// Create original polygon
const originalPolygon = turf.polygon(coordinates);
// Create buffered polygon (~30 meters tolerance = 0.03 km)
const bufferedPolygon = turf.buffer(originalPolygon, 0.03, { units: "kilometers" });

const logDeniedRequest = (req, reason, lat, lng) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.warn(JSON.stringify({
    event: "GEO_ACCESS_DENIED",
    userId: req.user ? req.user.id : "unknown",
    ip,
    lat,
    lng,
    reason,
    timestamp: new Date().toISOString()
  }));
};

const verifyJWT = (req) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return false;
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return true;
  } catch (err) {
    return false;
  }
};

const enforceGeoFencing = (req, res, next) => {
  // Skip geo-fencing entirely for these specific routes
  const skipRoutes = ['/users/forgot-password', '/users/reset-password'];
  if (skipRoutes.some(route => req.originalUrl.includes(route))) {
    return next();
  }

  // 1. Verify JWT first (Authentication Check)
  const publicRoutes = ['/users/login', '/users/register', '/users/verify-email', '/users/resend-otp'];
  const isPublic = publicRoutes.some(route => req.originalUrl.includes(route));
  
  // if (!isPublic) {
  //   if (!verifyJWT(req)) {
  //     return res.status(401).json({ error: "Access token required or invalid" });
  //   }
  // } else {
  //   // Attempt to verify if token exists, but don't fail if missing
  //   verifyJWT(req);
  // }

  const latRaw = req.headers["x-user-lat"];
  const lngRaw = req.headers["x-user-lng"];
  const timestampRaw = req.headers["x-timestamp"];

  // 2. Validate inputs
  if (!latRaw || !lngRaw) {
    logDeniedRequest(req, "Location required", latRaw, lngRaw);
    return res.status(403).json({ error: "Location required" });
  }

  const lat = parseFloat(latRaw);
  const lng = parseFloat(lngRaw);
  const reqTime = parseInt(timestampRaw, 10);

  if (isNaN(lat) || isNaN(lng)) {
    logDeniedRequest(req, "Invalid location data", latRaw, lngRaw);
    return res.status(400).json({ error: "Invalid location data" });
  }

  if (isNaN(reqTime)) {
    logDeniedRequest(req, "Invalid timestamp", lat, lng);
    return res.status(400).json({ error: "Invalid location data" });
  }

  // 3. Validate Timestamp (Anti-Replay)
  const now = Date.now();
  // 5 minutes in milliseconds
  const FIVE_MINUTES = 5 * 60 * 1000;
  if (now - reqTime > FIVE_MINUTES) {
    logDeniedRequest(req, "Location expired", lat, lng);
    return res.status(403).json({ error: "Location expired" });
  }

  // 4. IP Location Check (Soft Validation)
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const geoLoc = geoip.lookup(ip);
  if (geoLoc && geoLoc.country !== "IN") { // Since coords are in India, alert if country differs
    console.log(`[Suspicious IP]: Allowed user but IP originates from ${geoLoc.country} (${ip})`);
  }

  // 5. Check Location with turf
  const point = turf.point([lng, lat]);
  const isInside = turf.booleanPointInPolygon(point, bufferedPolygon);

  if (!isInside) {
    logDeniedRequest(req, "Access restricted outside allowed area", lat, lng);
    return res.status(403).json({ error: "Access restricted outside allowed area" });
  }

  // Allowed
  next();
};

module.exports = {
  geoRateLimiter,
  enforceGeoFencing
};