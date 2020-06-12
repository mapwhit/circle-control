const emitter = require('component-emitter');
const dragHandle = require('./drag-handle');
const touchHandle = require('./touch-handle');

module.exports = makeCircle;


function makeCircle({
  container,
  radius = 100,
  center = [ 0, 0 ]
} = {}) {
  let circle;
  let self = {
    addTo,
    remove
  };
  let state = {
    radius,
    center
  };
  emitter(self);

  function resizeHandle(handle, position) {
    let horizontal = position === 'west' || position === 'east';

    function ondrag({ clientX, clientY }) {
      let [ x, y ] = self.center;
      let radius = horizontal ? Math.abs(x - clientX) : Math.abs(y - clientY);
      self.radius = radius;
    }

    function ondragend() {
      self.emit('radius-changed');
    }

    return handle(circle, { ondrag, ondragend, className: `circle-${position}` });
  }

  function centerHandle(handle) {
    function ondrag({ clientX, clientY }) {
      self.center = [ clientX, clientY ];
    }

    function ondragend() {
      self.emit('center-changed');
    }

    return handle(circle, { ondrag, ondragend, className: 'circle-center' });
  }

  function render(container) {
    circle = document.createElement('div');
    circle.className = 'circle';
    const handle = 'ondragstart' in circle ? dragHandle : touchHandle;

    centerHandle(handle);
    [
      'south',
      'north',
      'west',
      'east'
    ].forEach(p => resizeHandle(handle, p));
    container.appendChild(circle);
    return circle;
  }

  function repaintCircle() {
    let size = `${state.radius * 2}px`;
    circle.style.width = size;
    circle.style.height = size;

    let [ left, top ] = state.center;
    circle.style.left = `${left}px`;
    circle.style.top = `${top}px`;
  }

  function setRadius(radius) {
    state.radius = radius;
    repaintCircle();
  }

  function getRadius() {
    return state.radius;
  }

  function setCenter(center) {
    state.center = center;
    repaintCircle();
  }

  function getCenter() {
    return state.center;
  }

  function addTo(container) {
    render(container);
    self.center = center;
    self.radius = radius;
    self.emit('center-changed');
    self.emit('radius-changed');
  }

  function remove() {
    circle.remove();
  }

  Object.defineProperty(self, 'center', { get: getCenter, set: setCenter });
  Object.defineProperty(self, 'radius', { get: getRadius, set: setRadius });

  if (container) {
    addTo(container);
  }

  return self;
}
