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

describe('distance', function () {

  it('meters to pixels', function () {
    meters2pixels(5000, [ 150, 200 ], map).should.be.approximately(89.9321, 0.0001);
  });

  it('pixels to meters', function () {
    pixels2meters(250, [ 150, 200 ], map).should.be.approximately(13899.36583, 0.0001);
  });

});
