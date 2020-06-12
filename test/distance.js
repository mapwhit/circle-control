const test = require('tape');
const { meters2pixels, pixels2meters } = require('../lib/distance');

// assume we are at 60 degrees N === 200px
// 1000 pixels - 1 degree ~ 556600 meters 60 degrees latitude

function toGeo([x]) {
  return [ x / 1000, 60 ];
}

function fromGeo([ lat ]) {
  return [ lat * 1000, 200 ];
}


let map = { fromGeo, toGeo };

test('distance', function({ test }) {

  test('meters to pixels', function (t) {
    t.plan(1);
    t.equal(meters2pixels(5000, [ 150, 200 ], map), 90);
  });

  test('pixels to meters', function (t) {
    t.plan(1);
    t.equal(pixels2meters(250, [ 150, 200 ], map), 13899);
  });

});

