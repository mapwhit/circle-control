import makeCircle from './circle.js';
import { meters2pixels, pixels2meters } from './distance.js';

/*
 * map object needs to have the following methods
 *  getContainer() - returns container div in which map is embedded - used to add circle div
 *  project(ll) - return [x, y] location in screen coordinates - corresponding to geo [lat, lon]
 *  unproject(xy) - returns geo coordinates corresponding to screen location [x, y]
 */

/*
 * location - [lon, lat]
 * radius - in meters
 */
export function mapCircleControl({ center, radius } = {}) {
  const self = makeCircle({ center, radius });
  let map;

  function onadd(_map) {
    map = _map;
    self.addTo(map.getContainer());
  }

  function onremove() {
    self.remove();
  }

  function fromGeo(ll) {
    return map.project(ll);
  }

  function toGeo(xy) {
    const { lng, lat } = map.unproject(xy);
    return [lng, lat];
  }

  function getGeoCenter() {
    return toGeo(self.center);
  }

  function setGeoCenter(ll) {
    self.center = fromGeo(ll);
  }

  function setGeoRadius(meters) {
    self.radius = meters2pixels(meters, self.center, { fromGeo, toGeo });
  }

  function getGeoRadius() {
    return pixels2meters(self.radius, self.center, { fromGeo, toGeo });
  }

  Object.defineProperty(self, 'geoCenter', { get: getGeoCenter, set: setGeoCenter });
  Object.defineProperty(self, 'geoRadius', { get: getGeoRadius, set: setGeoRadius });

  return Object.assign(self, {
    onadd,
    onremove
  });
}
