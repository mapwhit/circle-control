const test = require('tape');

require('jsdom-global')();

window.matchMedia = () => ({ matches: false });

const makeCircle = require('../lib/circle');

document.body.innerHTML = '<div class="container"></div>';

test('map-circle-control - create DOM nodes', function (t) {
  const container = document.querySelector('.container');

  let circle = makeCircle();
  circle.addTo(container);
  circle.center = [ 250, 200 ];
  circle.radius = 175;


  let c = document.querySelector('.container .circle');

  t.plan(4);
  t.equal(c.childNodes.length, 5, 'circle should have 5 child elements');
  t.ok(c.style, 'circle should have style property');
  t.equal(c.style.left, '250px');
  t.equal(c.style.top, '200px');
});
