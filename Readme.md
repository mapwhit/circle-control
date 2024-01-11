[![NPM version][npm-image]][npm-url]
[![Build Status][build-image]][build-url]
[![Dependency Status][deps-image]][deps-url]

# map-circle-control

Draggable circle to be used with map renderer.
Click [here][demo-page] to see the demo page.

## Install

```sh
$ npm install --save map-circle-control
```

## Usage in standard container

```js
const makeCircle = require('map-circle-control');

let circle = makeCircle({
  container: document.querySelector('.map'), // dom element to which circle will be added
  center: [ 250, 200 ],                      // offset in the container
  radius: 175                                // radius in pixels
});

// `radius-changed` and `center-changed` events are supported
circle.on('radius-changed', function() {
  console.log('New radius:', circle.radius);
});
circle.on('center-changed', function() {
  console.log('New center:', circle.center);
});

// `radius` and `center` can be used to move and/or resize the circle
circle.radius = 120;
circle.center = [10, 15];

```

## Usage with [`mapbox-gl`][mapbox-gl]

Circle implements [`IControl`][mapbox-icontrol] and thus can be used with [mapbox-gl] or any other compatible map.
Cirle is using `getContainer`, `project`, and `unproject` methods only.


```js

let map = new mapboxgl.Map(/* options */);
const makeCircle = require('map-circle-control');

let circle = makeCircle({
  center: [ 250, 200 ],                      // offset in the container
  radius: 175                                // radius in pixels
});

// display circle on the map
map.add(circle);

// `radius-changed` and `center-changed` events are supported
circle.on('radius-changed', function() {
  console.log('New radius in meters:', circle.geoRadius);
});
circle.on('center-changed', function() {
  console.log('New center as [longiturde, latitude]:', circle.geoCenter);
});

// `radius` and `center` can be used to move and/or resize the circle
circle.geoRadius = 1200;           // 1.2 km
circle.geoCenter = [0.1278, 51.5074]; // London

```


## License

MIT © [Damian Krzeminski](https://pirxpilot.me)

[npm-image]: https://img.shields.io/npm/v/map-circle-control
[npm-url]: https://npmjs.org/package/map-circle-control

[build-url]: https://github.com/furkot/map-circle-control/actions/workflows/check.yaml
[build-image]: https://img.shields.io/github/actions/workflow/status/furkot/map-circle-control/check.yaml?branch=main

[deps-image]: https://img.shields.io/librariesio/release/npm/map-circle-control
[deps-url]: https://libraries.io/npm/map-circle-control


[mapbox-icontrol]: https://www.mapbox.com/mapbox-gl-js/api/#icontrol
[mapbox-gl]: https://www.mapbox.com/mapbox-gl-js
[demo-page]: https://furkot.github.io/map-circle-control/
