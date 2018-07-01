const makeCircle = require('./circle');

module.exports = mapCircleControl;

/*
 * location - [lon, lat]
 * radius - in meters
 */
function mapCircleControl({ center, radius } = {}) {
  let self = makeCircle({ center, radius, });

  function onadded(map) {
    self.addTo(map.getContainer());
  }

  function onremoved() {
    self.remove();
  }

  return Object.assign(self, {
    onadded,
    onremoved
  });
}
