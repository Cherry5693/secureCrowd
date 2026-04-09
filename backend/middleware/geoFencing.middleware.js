import * as turf from "@turf/turf";

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

const polygon = turf.polygon(coordinates);

export const isInside = async (req) => {

  const latRaw = req.headers["x-user-lat"];
  const lngRaw = req.headers["x-user-lng"];

  
  if (!latRaw || !lngRaw) {
    const error = new Error("Location required");
    error.code = "LOCATION_REQUIRED";
    error.status = 403;
    throw error;
  }

  const lat = parseFloat(latRaw);
  const lng = parseFloat(lngRaw);

  if (isNaN(lat) || isNaN(lng)) {
    const error = new Error("Invalid location data");
    error.code = "INVALID_LOCATION";
    error.status = 400;
    throw error;
  }

  const point = turf.point([lng, lat]);

  const inside = turf.booleanPointInPolygon(point, polygon);

  return inside;
};