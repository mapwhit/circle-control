import assert from 'node:assert/strict';
import test from 'node:test';
import { meters2pixels, pixels2meters } from '../lib/distance.js';

// assume we are at 60 degrees N === 200px
// 1000 pixels - 1 degree ~ 556600 meters 60 degrees latitude

function toGeo([x]) {
  return [x / 1000, 60];
}

function fromGeo([lat]) {
  return [lat * 1000, 200];
}

const map = { fromGeo, toGeo };

test('distance', async function (t) {
  await t.test('meters to pixels', function () {
    assert.equal(meters2pixels(5000, [150, 200], map), 90);
  });

  await t.test('pixels to meters', function () {
    assert.equal(pixels2meters(250, [150, 200], map), 13899);
  });
});
