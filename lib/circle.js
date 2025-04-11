import emitter from 'component-emitter';
import dragHandle from './drag-handle.js';
import touchHandle from './touch-handle.js';

export default function makeCircle({ container, radius = 100, center = [0, 0] } = {}) {
  let circle;
  const self = {
    addTo,
    remove
  };
  const state = {
    radius,
    center
  };
  emitter(self);

  Object.defineProperty(self, 'center', { get: getCenter, set: setCenter });
  Object.defineProperty(self, 'radius', { get: getRadius, set: setRadius });

  if (container) {
    addTo(container);
  }

  return self;

  function resizeHandle(handle, position) {
    const horizontal = position === 'west' || position === 'east';

    function ondrag({ clientX, clientY }) {
      const [x, y] = self.center;
      const radius = horizontal ? Math.abs(x - clientX) : Math.abs(y - clientY);
      self.radius = radius;
    }

    function ondragend() {
      self.emit('radius-changed');
    }

    return handle(circle, { ondrag, ondragend, className: `circle-${position}` });
  }

  function centerHandle(handle) {
    function ondrag({ clientX, clientY }) {
      self.center = [clientX, clientY];
    }

    function ondragend() {
      self.emit('center-changed');
    }

    return handle(circle, { ondrag, ondragend, className: 'circle-center' });
  }

  function render(container) {
    circle = document.createElement('div');
    circle.className = 'circle';

    const handle = window.matchMedia('(pointer:coarse)').matches ? touchHandle : dragHandle;

    centerHandle(handle);
    ['south', 'north', 'west', 'east'].forEach(p => resizeHandle(handle, p));
    container.appendChild(circle);
    return circle;
  }

  function repaintCircle() {
    const size = `${state.radius * 2}px`;
    circle.style.width = size;
    circle.style.height = size;

    const [left, top] = state.center;
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
}
