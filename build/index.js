require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const emitter = require('component-emitter');

module.exports = makeCircle;

const requestAF = window.requestAnimationFrame || function(fn) { fn(); };
const cancelAF = window.cancelAnimationFrame || function() {};

function handle(circle, { className, ondrag, ondragend }) {
  let el = document.createElement('div');

  function ondragstart({ dataTransfer }) {
    circle.parentNode.addEventListener('dragover', ondragCommon);
    dataTransfer.setData("text/plain", "");
    dataTransfer.effectAllowed = 'move';
    dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
    circle.classList.add('dragging');
  }

  function ondragendCommon() {
    circle.classList.remove('dragging');
    circle.parentNode.removeEventListener('dragover', ondragCommon);
    ondragend();
  }

  function ondragCommon(event) {
    if (!event.clientX && !event.clientY) {
      // console.log('Invalid drag event!');
      return;
    }
    event.preventDefault(); // accept drop
    let { dataTransfer } = event;
    dataTransfer.dropEffect = 'move';
    ondrag(event);
  }

  el.className = `circle-handle ${className}`;
  el.draggable = true;

  // cannot use 'drag' event because Firefox bug - see: https://bugzilla.mozilla.org/show_bug.cgi?id=505521
  // el.addEventListener('drag', ondrag);
  el.addEventListener('dragstart', ondragstart);
  el.addEventListener('dragend', ondragendCommon);

  circle.appendChild(el);
  return el;

}

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
  let raf;
  emitter(self);

  function resizeHandle(position) {
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

  function centerHandle() {
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
    centerHandle();
    [
      'south',
      'north',
      'west',
      'east'
    ].forEach(resizeHandle);
    container.appendChild(circle);
    return circle;
  }

  function scheduleRepaint() {
    if (!raf) {
      raf = requestAF(repaintCircle);
    }
  }

  function repaintCircle() {
    raf = undefined;
    let size = `${state.radius * 2}px`;
    circle.style.width = size;
    circle.style.height = size;

    let [ left, top ] = state.center;
    circle.style.left = `${left}px`;
    circle.style.top = `${top}px`;
  }

  function setRadius(radius) {
    state.radius = radius;
    scheduleRepaint();
  }

  function getRadius() {
    return state.radius;
  }

  function setCenter(center) {
    state.center = center;
    scheduleRepaint();
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
    if (raf) {
      cancelAF(raf);
    }
    circle.remove();
  }

  Object.defineProperty(self, 'center', { get: getCenter, set: setCenter });
  Object.defineProperty(self, 'radius', { get: getRadius, set: setRadius });

  if (container) {
    addTo(container);
  }

  return self;
}

},{"component-emitter":4}],2:[function(require,module,exports){
module.exports = {
  meters2pixels,
  pixels2meters
};

function meters2pixels(meters, [ x, y ], { fromGeo, toGeo }) {
  let [ lon, lat ] = toGeo([ x, y ]);
  let lon1 = lon + meters / metersPerDegree(lat);
  if (lon1 > 180) {
    lon1 -= 360;
  }
  let [ x1 ] = fromGeo([ lon1, lat ]);
  return Math.round(Math.abs(x1 - x));
}


function pixels2meters(pixels, [ x, y ], { toGeo }) {
  let x1 = x + pixels;
  let [ lon, lat ] = toGeo([ x, y ]);
  let [ lon1 ] = toGeo([ x1, y ]);
  if (lon1 < lon) {
    lon1 += 360;
  }
  return Math.round((lon1 - lon) * metersPerDegree(lat));
}

const R = 6371000; // ~ Earh radius in meters
const EQUATOR_DEGREE_LEN = Math.PI * R / 180;

// len of a degree at lat === len of degree at equator multiplied by cos(lat)
function metersPerDegree(lat) {
  return EQUATOR_DEGREE_LEN * Math.cos(lat * Math.PI / 180);
}

},{}],3:[function(require,module,exports){
const makeCircle = require('./circle');
const { meters2pixels, pixels2meters } = require('./distance');

module.exports = mapCircleControl;


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
function mapCircleControl({ center, radius } = {}) {
  let self = makeCircle({ center, radius, });
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
    let { lng, lat } = map.unproject(xy);
    return [ lng, lat];
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

},{"./circle":1,"./distance":2}],4:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

if (typeof module !== 'undefined') {
  module.exports = Emitter;
}

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  function on() {
    this.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks['$' + event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks['$' + event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks['$' + event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks['$' + event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],"map-circle-control":[function(require,module,exports){
module.exports = require('./lib/map-circle-control');

},{"./lib/map-circle-control":3}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvY2lyY2xlLmpzIiwibGliL2Rpc3RhbmNlLmpzIiwibGliL21hcC1jaXJjbGUtY29udHJvbC5qcyIsIm5vZGVfbW9kdWxlcy9jb21wb25lbnQtZW1pdHRlci9pbmRleC5qcyIsImluZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25LQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiY29uc3QgZW1pdHRlciA9IHJlcXVpcmUoJ2NvbXBvbmVudC1lbWl0dGVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gbWFrZUNpcmNsZTtcblxuY29uc3QgcmVxdWVzdEFGID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCBmdW5jdGlvbihmbikgeyBmbigpOyB9O1xuY29uc3QgY2FuY2VsQUYgPSB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgfHwgZnVuY3Rpb24oKSB7fTtcblxuZnVuY3Rpb24gaGFuZGxlKGNpcmNsZSwgeyBjbGFzc05hbWUsIG9uZHJhZywgb25kcmFnZW5kIH0pIHtcbiAgbGV0IGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cbiAgZnVuY3Rpb24gb25kcmFnc3RhcnQoeyBkYXRhVHJhbnNmZXIgfSkge1xuICAgIGNpcmNsZS5wYXJlbnROb2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVyJywgb25kcmFnQ29tbW9uKTtcbiAgICBkYXRhVHJhbnNmZXIuc2V0RGF0YShcInRleHQvcGxhaW5cIiwgXCJcIik7XG4gICAgZGF0YVRyYW5zZmVyLmVmZmVjdEFsbG93ZWQgPSAnbW92ZSc7XG4gICAgZGF0YVRyYW5zZmVyLnNldERyYWdJbWFnZShlbCwgZWwub2Zmc2V0V2lkdGggLyAyLCBlbC5vZmZzZXRIZWlnaHQgLyAyKTtcbiAgICBjaXJjbGUuY2xhc3NMaXN0LmFkZCgnZHJhZ2dpbmcnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uZHJhZ2VuZENvbW1vbigpIHtcbiAgICBjaXJjbGUuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZ2dpbmcnKTtcbiAgICBjaXJjbGUucGFyZW50Tm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIG9uZHJhZ0NvbW1vbik7XG4gICAgb25kcmFnZW5kKCk7XG4gIH1cblxuICBmdW5jdGlvbiBvbmRyYWdDb21tb24oZXZlbnQpIHtcbiAgICBpZiAoIWV2ZW50LmNsaWVudFggJiYgIWV2ZW50LmNsaWVudFkpIHtcbiAgICAgIC8vIGNvbnNvbGUubG9nKCdJbnZhbGlkIGRyYWcgZXZlbnQhJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIGFjY2VwdCBkcm9wXG4gICAgbGV0IHsgZGF0YVRyYW5zZmVyIH0gPSBldmVudDtcbiAgICBkYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdtb3ZlJztcbiAgICBvbmRyYWcoZXZlbnQpO1xuICB9XG5cbiAgZWwuY2xhc3NOYW1lID0gYGNpcmNsZS1oYW5kbGUgJHtjbGFzc05hbWV9YDtcbiAgZWwuZHJhZ2dhYmxlID0gdHJ1ZTtcblxuICAvLyBjYW5ub3QgdXNlICdkcmFnJyBldmVudCBiZWNhdXNlIEZpcmVmb3ggYnVnIC0gc2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD01MDU1MjFcbiAgLy8gZWwuYWRkRXZlbnRMaXN0ZW5lcignZHJhZycsIG9uZHJhZyk7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdzdGFydCcsIG9uZHJhZ3N0YXJ0KTtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIG9uZHJhZ2VuZENvbW1vbik7XG5cbiAgY2lyY2xlLmFwcGVuZENoaWxkKGVsKTtcbiAgcmV0dXJuIGVsO1xuXG59XG5cbmZ1bmN0aW9uIG1ha2VDaXJjbGUoe1xuICBjb250YWluZXIsXG4gIHJhZGl1cyA9IDEwMCxcbiAgY2VudGVyID0gWyAwLCAwIF1cbn0gPSB7fSkge1xuICBsZXQgY2lyY2xlO1xuICBsZXQgc2VsZiA9IHtcbiAgICBhZGRUbyxcbiAgICByZW1vdmVcbiAgfTtcbiAgbGV0IHN0YXRlID0ge1xuICAgIHJhZGl1cyxcbiAgICBjZW50ZXJcbiAgfTtcbiAgbGV0IHJhZjtcbiAgZW1pdHRlcihzZWxmKTtcblxuICBmdW5jdGlvbiByZXNpemVIYW5kbGUocG9zaXRpb24pIHtcbiAgICBsZXQgaG9yaXpvbnRhbCA9IHBvc2l0aW9uID09PSAnd2VzdCcgfHwgcG9zaXRpb24gPT09ICdlYXN0JztcblxuICAgIGZ1bmN0aW9uIG9uZHJhZyh7IGNsaWVudFgsIGNsaWVudFkgfSkge1xuICAgICAgbGV0IFsgeCwgeSBdID0gc2VsZi5jZW50ZXI7XG4gICAgICBsZXQgcmFkaXVzID0gaG9yaXpvbnRhbCA/IE1hdGguYWJzKHggLSBjbGllbnRYKSA6IE1hdGguYWJzKHkgLSBjbGllbnRZKTtcbiAgICAgIHNlbGYucmFkaXVzID0gcmFkaXVzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uZHJhZ2VuZCgpIHtcbiAgICAgIHNlbGYuZW1pdCgncmFkaXVzLWNoYW5nZWQnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFuZGxlKGNpcmNsZSwgeyBvbmRyYWcsIG9uZHJhZ2VuZCwgY2xhc3NOYW1lOiBgY2lyY2xlLSR7cG9zaXRpb259YCB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNlbnRlckhhbmRsZSgpIHtcbiAgICBmdW5jdGlvbiBvbmRyYWcoeyBjbGllbnRYLCBjbGllbnRZIH0pIHtcbiAgICAgIHNlbGYuY2VudGVyID0gWyBjbGllbnRYLCBjbGllbnRZIF07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25kcmFnZW5kKCkge1xuICAgICAgc2VsZi5lbWl0KCdjZW50ZXItY2hhbmdlZCcpO1xuICAgIH1cblxuICAgIHJldHVybiBoYW5kbGUoY2lyY2xlLCB7IG9uZHJhZywgb25kcmFnZW5kLCBjbGFzc05hbWU6ICdjaXJjbGUtY2VudGVyJyB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlcihjb250YWluZXIpIHtcbiAgICBjaXJjbGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjaXJjbGUuY2xhc3NOYW1lID0gJ2NpcmNsZSc7XG4gICAgY2VudGVySGFuZGxlKCk7XG4gICAgW1xuICAgICAgJ3NvdXRoJyxcbiAgICAgICdub3J0aCcsXG4gICAgICAnd2VzdCcsXG4gICAgICAnZWFzdCdcbiAgICBdLmZvckVhY2gocmVzaXplSGFuZGxlKTtcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoY2lyY2xlKTtcbiAgICByZXR1cm4gY2lyY2xlO1xuICB9XG5cbiAgZnVuY3Rpb24gc2NoZWR1bGVSZXBhaW50KCkge1xuICAgIGlmICghcmFmKSB7XG4gICAgICByYWYgPSByZXF1ZXN0QUYocmVwYWludENpcmNsZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVwYWludENpcmNsZSgpIHtcbiAgICByYWYgPSB1bmRlZmluZWQ7XG4gICAgbGV0IHNpemUgPSBgJHtzdGF0ZS5yYWRpdXMgKiAyfXB4YDtcbiAgICBjaXJjbGUuc3R5bGUud2lkdGggPSBzaXplO1xuICAgIGNpcmNsZS5zdHlsZS5oZWlnaHQgPSBzaXplO1xuXG4gICAgbGV0IFsgbGVmdCwgdG9wIF0gPSBzdGF0ZS5jZW50ZXI7XG4gICAgY2lyY2xlLnN0eWxlLmxlZnQgPSBgJHtsZWZ0fXB4YDtcbiAgICBjaXJjbGUuc3R5bGUudG9wID0gYCR7dG9wfXB4YDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldFJhZGl1cyhyYWRpdXMpIHtcbiAgICBzdGF0ZS5yYWRpdXMgPSByYWRpdXM7XG4gICAgc2NoZWR1bGVSZXBhaW50KCk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRSYWRpdXMoKSB7XG4gICAgcmV0dXJuIHN0YXRlLnJhZGl1cztcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldENlbnRlcihjZW50ZXIpIHtcbiAgICBzdGF0ZS5jZW50ZXIgPSBjZW50ZXI7XG4gICAgc2NoZWR1bGVSZXBhaW50KCk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRDZW50ZXIoKSB7XG4gICAgcmV0dXJuIHN0YXRlLmNlbnRlcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZFRvKGNvbnRhaW5lcikge1xuICAgIHJlbmRlcihjb250YWluZXIpO1xuICAgIHNlbGYuY2VudGVyID0gY2VudGVyO1xuICAgIHNlbGYucmFkaXVzID0gcmFkaXVzO1xuICAgIHNlbGYuZW1pdCgnY2VudGVyLWNoYW5nZWQnKTtcbiAgICBzZWxmLmVtaXQoJ3JhZGl1cy1jaGFuZ2VkJyk7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmUoKSB7XG4gICAgaWYgKHJhZikge1xuICAgICAgY2FuY2VsQUYocmFmKTtcbiAgICB9XG4gICAgY2lyY2xlLnJlbW92ZSgpO1xuICB9XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNlbGYsICdjZW50ZXInLCB7IGdldDogZ2V0Q2VudGVyLCBzZXQ6IHNldENlbnRlciB9KTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNlbGYsICdyYWRpdXMnLCB7IGdldDogZ2V0UmFkaXVzLCBzZXQ6IHNldFJhZGl1cyB9KTtcblxuICBpZiAoY29udGFpbmVyKSB7XG4gICAgYWRkVG8oY29udGFpbmVyKTtcbiAgfVxuXG4gIHJldHVybiBzZWxmO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGVyczJwaXhlbHMsXG4gIHBpeGVsczJtZXRlcnNcbn07XG5cbmZ1bmN0aW9uIG1ldGVyczJwaXhlbHMobWV0ZXJzLCBbIHgsIHkgXSwgeyBmcm9tR2VvLCB0b0dlbyB9KSB7XG4gIGxldCBbIGxvbiwgbGF0IF0gPSB0b0dlbyhbIHgsIHkgXSk7XG4gIGxldCBsb24xID0gbG9uICsgbWV0ZXJzIC8gbWV0ZXJzUGVyRGVncmVlKGxhdCk7XG4gIGlmIChsb24xID4gMTgwKSB7XG4gICAgbG9uMSAtPSAzNjA7XG4gIH1cbiAgbGV0IFsgeDEgXSA9IGZyb21HZW8oWyBsb24xLCBsYXQgXSk7XG4gIHJldHVybiBNYXRoLnJvdW5kKE1hdGguYWJzKHgxIC0geCkpO1xufVxuXG5cbmZ1bmN0aW9uIHBpeGVsczJtZXRlcnMocGl4ZWxzLCBbIHgsIHkgXSwgeyB0b0dlbyB9KSB7XG4gIGxldCB4MSA9IHggKyBwaXhlbHM7XG4gIGxldCBbIGxvbiwgbGF0IF0gPSB0b0dlbyhbIHgsIHkgXSk7XG4gIGxldCBbIGxvbjEgXSA9IHRvR2VvKFsgeDEsIHkgXSk7XG4gIGlmIChsb24xIDwgbG9uKSB7XG4gICAgbG9uMSArPSAzNjA7XG4gIH1cbiAgcmV0dXJuIE1hdGgucm91bmQoKGxvbjEgLSBsb24pICogbWV0ZXJzUGVyRGVncmVlKGxhdCkpO1xufVxuXG5jb25zdCBSID0gNjM3MTAwMDsgLy8gfiBFYXJoIHJhZGl1cyBpbiBtZXRlcnNcbmNvbnN0IEVRVUFUT1JfREVHUkVFX0xFTiA9IE1hdGguUEkgKiBSIC8gMTgwO1xuXG4vLyBsZW4gb2YgYSBkZWdyZWUgYXQgbGF0ID09PSBsZW4gb2YgZGVncmVlIGF0IGVxdWF0b3IgbXVsdGlwbGllZCBieSBjb3MobGF0KVxuZnVuY3Rpb24gbWV0ZXJzUGVyRGVncmVlKGxhdCkge1xuICByZXR1cm4gRVFVQVRPUl9ERUdSRUVfTEVOICogTWF0aC5jb3MobGF0ICogTWF0aC5QSSAvIDE4MCk7XG59XG4iLCJjb25zdCBtYWtlQ2lyY2xlID0gcmVxdWlyZSgnLi9jaXJjbGUnKTtcbmNvbnN0IHsgbWV0ZXJzMnBpeGVscywgcGl4ZWxzMm1ldGVycyB9ID0gcmVxdWlyZSgnLi9kaXN0YW5jZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG1hcENpcmNsZUNvbnRyb2w7XG5cblxuLypcbiAqIG1hcCBvYmplY3QgbmVlZHMgdG8gaGF2ZSB0aGUgZm9sbG93aW5nIG1ldGhvZHNcbiAqICBnZXRDb250YWluZXIoKSAtIHJldHVybnMgY29udGFpbmVyIGRpdiBpbiB3aGljaCBtYXAgaXMgZW1iZWRkZWQgLSB1c2VkIHRvIGFkZCBjaXJjbGUgZGl2XG4gKiAgcHJvamVjdChsbCkgLSByZXR1cm4gW3gsIHldIGxvY2F0aW9uIGluIHNjcmVlbiBjb29yZGluYXRlcyAtIGNvcnJlc3BvbmRpbmcgdG8gZ2VvIFtsYXQsIGxvbl1cbiAqICB1bnByb2plY3QoeHkpIC0gcmV0dXJucyBnZW8gY29vcmRpbmF0ZXMgY29ycmVzcG9uZGluZyB0byBzY3JlZW4gbG9jYXRpb24gW3gsIHldXG4gKi9cblxuLypcbiAqIGxvY2F0aW9uIC0gW2xvbiwgbGF0XVxuICogcmFkaXVzIC0gaW4gbWV0ZXJzXG4gKi9cbmZ1bmN0aW9uIG1hcENpcmNsZUNvbnRyb2woeyBjZW50ZXIsIHJhZGl1cyB9ID0ge30pIHtcbiAgbGV0IHNlbGYgPSBtYWtlQ2lyY2xlKHsgY2VudGVyLCByYWRpdXMsIH0pO1xuICBsZXQgbWFwO1xuXG4gIGZ1bmN0aW9uIG9uYWRkKF9tYXApIHtcbiAgICBtYXAgPSBfbWFwO1xuICAgIHNlbGYuYWRkVG8obWFwLmdldENvbnRhaW5lcigpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9ucmVtb3ZlKCkge1xuICAgIHNlbGYucmVtb3ZlKCk7XG4gIH1cblxuICBmdW5jdGlvbiBmcm9tR2VvKGxsKSB7XG4gICAgcmV0dXJuIG1hcC5wcm9qZWN0KGxsKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvR2VvKHh5KSB7XG4gICAgbGV0IHsgbG5nLCBsYXQgfSA9IG1hcC51bnByb2plY3QoeHkpO1xuICAgIHJldHVybiBbIGxuZywgbGF0XTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEdlb0NlbnRlcigpIHtcbiAgICByZXR1cm4gdG9HZW8oc2VsZi5jZW50ZXIpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0R2VvQ2VudGVyKGxsKSB7XG4gICAgc2VsZi5jZW50ZXIgPSBmcm9tR2VvKGxsKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldEdlb1JhZGl1cyhtZXRlcnMpIHtcbiAgICBzZWxmLnJhZGl1cyA9IG1ldGVyczJwaXhlbHMobWV0ZXJzLCBzZWxmLmNlbnRlciwgeyBmcm9tR2VvLCB0b0dlbyB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEdlb1JhZGl1cygpIHtcbiAgICByZXR1cm4gcGl4ZWxzMm1ldGVycyhzZWxmLnJhZGl1cywgc2VsZi5jZW50ZXIsIHsgZnJvbUdlbywgdG9HZW8gfSk7XG4gIH1cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoc2VsZiwgJ2dlb0NlbnRlcicsIHsgZ2V0OiBnZXRHZW9DZW50ZXIsIHNldDogc2V0R2VvQ2VudGVyIH0pO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoc2VsZiwgJ2dlb1JhZGl1cycsIHsgZ2V0OiBnZXRHZW9SYWRpdXMsIHNldDogc2V0R2VvUmFkaXVzIH0pO1xuXG4gIHJldHVybiBPYmplY3QuYXNzaWduKHNlbGYsIHtcbiAgICBvbmFkZCxcbiAgICBvbnJlbW92ZVxuICB9KTtcbn1cbiIsIlxyXG4vKipcclxuICogRXhwb3NlIGBFbWl0dGVyYC5cclxuICovXHJcblxyXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICBtb2R1bGUuZXhwb3J0cyA9IEVtaXR0ZXI7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJbml0aWFsaXplIGEgbmV3IGBFbWl0dGVyYC5cclxuICpcclxuICogQGFwaSBwdWJsaWNcclxuICovXHJcblxyXG5mdW5jdGlvbiBFbWl0dGVyKG9iaikge1xyXG4gIGlmIChvYmopIHJldHVybiBtaXhpbihvYmopO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIE1peGluIHRoZSBlbWl0dGVyIHByb3BlcnRpZXMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcclxuICogQHJldHVybiB7T2JqZWN0fVxyXG4gKiBAYXBpIHByaXZhdGVcclxuICovXHJcblxyXG5mdW5jdGlvbiBtaXhpbihvYmopIHtcclxuICBmb3IgKHZhciBrZXkgaW4gRW1pdHRlci5wcm90b3R5cGUpIHtcclxuICAgIG9ialtrZXldID0gRW1pdHRlci5wcm90b3R5cGVba2V5XTtcclxuICB9XHJcbiAgcmV0dXJuIG9iajtcclxufVxyXG5cclxuLyoqXHJcbiAqIExpc3RlbiBvbiB0aGUgZ2l2ZW4gYGV2ZW50YCB3aXRoIGBmbmAuXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxyXG4gKiBAcmV0dXJuIHtFbWl0dGVyfVxyXG4gKiBAYXBpIHB1YmxpY1xyXG4gKi9cclxuXHJcbkVtaXR0ZXIucHJvdG90eXBlLm9uID1cclxuRW1pdHRlci5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uKGV2ZW50LCBmbil7XHJcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xyXG4gICh0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdID0gdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XSB8fCBbXSlcclxuICAgIC5wdXNoKGZuKTtcclxuICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBBZGRzIGFuIGBldmVudGAgbGlzdGVuZXIgdGhhdCB3aWxsIGJlIGludm9rZWQgYSBzaW5nbGVcclxuICogdGltZSB0aGVuIGF1dG9tYXRpY2FsbHkgcmVtb3ZlZC5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXHJcbiAqIEByZXR1cm4ge0VtaXR0ZXJ9XHJcbiAqIEBhcGkgcHVibGljXHJcbiAqL1xyXG5cclxuRW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKGV2ZW50LCBmbil7XHJcbiAgZnVuY3Rpb24gb24oKSB7XHJcbiAgICB0aGlzLm9mZihldmVudCwgb24pO1xyXG4gICAgZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICB9XHJcblxyXG4gIG9uLmZuID0gZm47XHJcbiAgdGhpcy5vbihldmVudCwgb24pO1xyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlbW92ZSB0aGUgZ2l2ZW4gY2FsbGJhY2sgZm9yIGBldmVudGAgb3IgYWxsXHJcbiAqIHJlZ2lzdGVyZWQgY2FsbGJhY2tzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cclxuICogQHJldHVybiB7RW1pdHRlcn1cclxuICogQGFwaSBwdWJsaWNcclxuICovXHJcblxyXG5FbWl0dGVyLnByb3RvdHlwZS5vZmYgPVxyXG5FbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9XHJcbkVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9XHJcbkVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbihldmVudCwgZm4pe1xyXG4gIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcclxuXHJcbiAgLy8gYWxsXHJcbiAgaWYgKDAgPT0gYXJndW1lbnRzLmxlbmd0aCkge1xyXG4gICAgdGhpcy5fY2FsbGJhY2tzID0ge307XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8vIHNwZWNpZmljIGV2ZW50XHJcbiAgdmFyIGNhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF07XHJcbiAgaWYgKCFjYWxsYmFja3MpIHJldHVybiB0aGlzO1xyXG5cclxuICAvLyByZW1vdmUgYWxsIGhhbmRsZXJzXHJcbiAgaWYgKDEgPT0gYXJndW1lbnRzLmxlbmd0aCkge1xyXG4gICAgZGVsZXRlIHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF07XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8vIHJlbW92ZSBzcGVjaWZpYyBoYW5kbGVyXHJcbiAgdmFyIGNiO1xyXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICBjYiA9IGNhbGxiYWNrc1tpXTtcclxuICAgIGlmIChjYiA9PT0gZm4gfHwgY2IuZm4gPT09IGZuKSB7XHJcbiAgICAgIGNhbGxiYWNrcy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBFbWl0IGBldmVudGAgd2l0aCB0aGUgZ2l2ZW4gYXJncy5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcbiAqIEBwYXJhbSB7TWl4ZWR9IC4uLlxyXG4gKiBAcmV0dXJuIHtFbWl0dGVyfVxyXG4gKi9cclxuXHJcbkVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbihldmVudCl7XHJcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xyXG4gIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpXHJcbiAgICAsIGNhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF07XHJcblxyXG4gIGlmIChjYWxsYmFja3MpIHtcclxuICAgIGNhbGxiYWNrcyA9IGNhbGxiYWNrcy5zbGljZSgwKTtcclxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjYWxsYmFja3MubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcclxuICAgICAgY2FsbGJhY2tzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogUmV0dXJuIGFycmF5IG9mIGNhbGxiYWNrcyBmb3IgYGV2ZW50YC5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcbiAqIEByZXR1cm4ge0FycmF5fVxyXG4gKiBAYXBpIHB1YmxpY1xyXG4gKi9cclxuXHJcbkVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKGV2ZW50KXtcclxuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XHJcbiAgcmV0dXJuIHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF0gfHwgW107XHJcbn07XHJcblxyXG4vKipcclxuICogQ2hlY2sgaWYgdGhpcyBlbWl0dGVyIGhhcyBgZXZlbnRgIGhhbmRsZXJzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuICogQHJldHVybiB7Qm9vbGVhbn1cclxuICogQGFwaSBwdWJsaWNcclxuICovXHJcblxyXG5FbWl0dGVyLnByb3RvdHlwZS5oYXNMaXN0ZW5lcnMgPSBmdW5jdGlvbihldmVudCl7XHJcbiAgcmV0dXJuICEhIHRoaXMubGlzdGVuZXJzKGV2ZW50KS5sZW5ndGg7XHJcbn07XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvbWFwLWNpcmNsZS1jb250cm9sJyk7XG4iXX0=
