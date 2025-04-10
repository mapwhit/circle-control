module.exports = {
  meters2pixels,
  pixels2meters
};

function meters2pixels(meters, [x, y], { fromGeo, toGeo }) {
  const [lon, lat] = toGeo([x, y]);
  let lon1 = lon + meters / metersPerDegree(lat);
  if (lon1 > 180) {
    lon1 -= 360;
  }
  const [x1] = fromGeo([lon1, lat]);
  return Math.round(Math.abs(x1 - x));
}

function pixels2meters(pixels, [x, y], { toGeo }) {
  const x1 = x + pixels;
  const [lon, lat] = toGeo([x, y]);
  let [lon1] = toGeo([x1, y]);
  if (lon1 < lon) {
    lon1 += 360;
  }
  return Math.round((lon1 - lon) * metersPerDegree(lat));
}

const R = 6371000; // ~ Earh radius in meters
const EQUATOR_DEGREE_LEN = (Math.PI * R) / 180;

// len of a degree at lat === len of degree at equator multiplied by cos(lat)
function metersPerDegree(lat) {
  return EQUATOR_DEGREE_LEN * Math.cos((lat * Math.PI) / 180);
}
