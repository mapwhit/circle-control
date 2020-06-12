require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

    const handle = window.matchMedia('(pointer:coarse)').matches ? touchHandle : dragHandle;

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

},{"./drag-handle":3,"./touch-handle":5,"component-emitter":6}],2:[function(require,module,exports){
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
module.exports = makeHandle;

const setDragImageSupported = window.DataTransfer && 'setDragImage' in window.DataTransfer.prototype;

function makeHandle(circle, { className, ondrag, ondragend }) {
  let el = document.createElement('div');

  function ondragstart({ dataTransfer }) {
    circle.parentNode.addEventListener('dragover', ondragCommon);
    dataTransfer.setData("text/plain", "");
    dataTransfer.effectAllowed = 'move';
    if (setDragImageSupported) {
      // not all browsers support setDragImage
      dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
    }
    circle.classList.add('dragging');
  }

  function ondragendCommon() {
    circle.classList.remove('dragging');
    circle.parentNode.removeEventListener('dragover', ondragCommon);
    ondragend();
  }

  function ondragCommon(event) {
    if (event.clientX === undefined || event.clientY === undefined) {
      // console.log('Invalid drag event!');
      return;
    }
    event.preventDefault(); // accept drop
    let {
      dataTransfer,
      clientX, clientY,
      currentTarget
    } = event;
    dataTransfer.dropEffect = 'move';
    let { left, top } = currentTarget.getBoundingClientRect();
    ondrag({
      clientX: clientX - left,
      clientY: clientY - top
    });
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

},{}],4:[function(require,module,exports){
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

},{"./circle":1,"./distance":2}],5:[function(require,module,exports){
module.exports = makeHandle;


function makeHandle(circle, { className, ondrag, ondragend }) {
  let el = document.createElement('div');
  let dragging = false;

  function onTouchMove(event) {
    if (!dragging) {
      circle.classList.add('dragging');
      dragging = true;
    }
    event.preventDefault();
    let {
      clientX, clientY
    } = event.targetTouches[0];
    let { left, top } = circle.parentNode.getBoundingClientRect();
    ondrag({
      clientX: clientX - left,
      clientY: clientY - top
    });
  }

  function onTouchEnd() {
    circle.classList.remove('dragging');
    dragging = false;
    ondragend();
  }

  el.className = `circle-handle ${className}`;

  el.addEventListener('touchmove', onTouchMove,  { capture: true, passive: false });
  el.addEventListener('touchend', onTouchEnd);

  circle.appendChild(el);
  return el;
}

},{}],6:[function(require,module,exports){

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

  // Remove event specific arrays for event types that no
  // one is subscribed for to avoid memory leak.
  if (callbacks.length === 0) {
    delete this._callbacks['$' + event];
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

  var args = new Array(arguments.length - 1)
    , callbacks = this._callbacks['$' + event];

  for (var i = 1; i < arguments.length; i++) {
    args[i - 1] = arguments[i];
  }

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

},{"./lib/map-circle-control":4}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvY2lyY2xlLmpzIiwibGliL2Rpc3RhbmNlLmpzIiwibGliL2RyYWctaGFuZGxlLmpzIiwibGliL21hcC1jaXJjbGUtY29udHJvbC5qcyIsImxpYi90b3VjaC1oYW5kbGUuanMiLCJub2RlX21vZHVsZXMvY29tcG9uZW50LWVtaXR0ZXIvaW5kZXguanMiLCJpbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9LQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiY29uc3QgZW1pdHRlciA9IHJlcXVpcmUoJ2NvbXBvbmVudC1lbWl0dGVyJyk7XG5jb25zdCBkcmFnSGFuZGxlID0gcmVxdWlyZSgnLi9kcmFnLWhhbmRsZScpO1xuY29uc3QgdG91Y2hIYW5kbGUgPSByZXF1aXJlKCcuL3RvdWNoLWhhbmRsZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG1ha2VDaXJjbGU7XG5cblxuZnVuY3Rpb24gbWFrZUNpcmNsZSh7XG4gIGNvbnRhaW5lcixcbiAgcmFkaXVzID0gMTAwLFxuICBjZW50ZXIgPSBbIDAsIDAgXVxufSA9IHt9KSB7XG4gIGxldCBjaXJjbGU7XG4gIGxldCBzZWxmID0ge1xuICAgIGFkZFRvLFxuICAgIHJlbW92ZVxuICB9O1xuICBsZXQgc3RhdGUgPSB7XG4gICAgcmFkaXVzLFxuICAgIGNlbnRlclxuICB9O1xuICBlbWl0dGVyKHNlbGYpO1xuXG4gIGZ1bmN0aW9uIHJlc2l6ZUhhbmRsZShoYW5kbGUsIHBvc2l0aW9uKSB7XG4gICAgbGV0IGhvcml6b250YWwgPSBwb3NpdGlvbiA9PT0gJ3dlc3QnIHx8IHBvc2l0aW9uID09PSAnZWFzdCc7XG5cbiAgICBmdW5jdGlvbiBvbmRyYWcoeyBjbGllbnRYLCBjbGllbnRZIH0pIHtcbiAgICAgIGxldCBbIHgsIHkgXSA9IHNlbGYuY2VudGVyO1xuICAgICAgbGV0IHJhZGl1cyA9IGhvcml6b250YWwgPyBNYXRoLmFicyh4IC0gY2xpZW50WCkgOiBNYXRoLmFicyh5IC0gY2xpZW50WSk7XG4gICAgICBzZWxmLnJhZGl1cyA9IHJhZGl1cztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbmRyYWdlbmQoKSB7XG4gICAgICBzZWxmLmVtaXQoJ3JhZGl1cy1jaGFuZ2VkJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhbmRsZShjaXJjbGUsIHsgb25kcmFnLCBvbmRyYWdlbmQsIGNsYXNzTmFtZTogYGNpcmNsZS0ke3Bvc2l0aW9ufWAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBjZW50ZXJIYW5kbGUoaGFuZGxlKSB7XG4gICAgZnVuY3Rpb24gb25kcmFnKHsgY2xpZW50WCwgY2xpZW50WSB9KSB7XG4gICAgICBzZWxmLmNlbnRlciA9IFsgY2xpZW50WCwgY2xpZW50WSBdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uZHJhZ2VuZCgpIHtcbiAgICAgIHNlbGYuZW1pdCgnY2VudGVyLWNoYW5nZWQnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFuZGxlKGNpcmNsZSwgeyBvbmRyYWcsIG9uZHJhZ2VuZCwgY2xhc3NOYW1lOiAnY2lyY2xlLWNlbnRlcicgfSk7XG4gIH1cblxuICBmdW5jdGlvbiByZW5kZXIoY29udGFpbmVyKSB7XG4gICAgY2lyY2xlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgY2lyY2xlLmNsYXNzTmFtZSA9ICdjaXJjbGUnO1xuXG4gICAgY29uc3QgaGFuZGxlID0gd2luZG93Lm1hdGNoTWVkaWEoJyhwb2ludGVyOmNvYXJzZSknKS5tYXRjaGVzID8gdG91Y2hIYW5kbGUgOiBkcmFnSGFuZGxlO1xuXG4gICAgY2VudGVySGFuZGxlKGhhbmRsZSk7XG4gICAgW1xuICAgICAgJ3NvdXRoJyxcbiAgICAgICdub3J0aCcsXG4gICAgICAnd2VzdCcsXG4gICAgICAnZWFzdCdcbiAgICBdLmZvckVhY2gocCA9PiByZXNpemVIYW5kbGUoaGFuZGxlLCBwKSk7XG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGNpcmNsZSk7XG4gICAgcmV0dXJuIGNpcmNsZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlcGFpbnRDaXJjbGUoKSB7XG4gICAgbGV0IHNpemUgPSBgJHtzdGF0ZS5yYWRpdXMgKiAyfXB4YDtcbiAgICBjaXJjbGUuc3R5bGUud2lkdGggPSBzaXplO1xuICAgIGNpcmNsZS5zdHlsZS5oZWlnaHQgPSBzaXplO1xuXG4gICAgbGV0IFsgbGVmdCwgdG9wIF0gPSBzdGF0ZS5jZW50ZXI7XG4gICAgY2lyY2xlLnN0eWxlLmxlZnQgPSBgJHtsZWZ0fXB4YDtcbiAgICBjaXJjbGUuc3R5bGUudG9wID0gYCR7dG9wfXB4YDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldFJhZGl1cyhyYWRpdXMpIHtcbiAgICBzdGF0ZS5yYWRpdXMgPSByYWRpdXM7XG4gICAgcmVwYWludENpcmNsZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0UmFkaXVzKCkge1xuICAgIHJldHVybiBzdGF0ZS5yYWRpdXM7XG4gIH1cblxuICBmdW5jdGlvbiBzZXRDZW50ZXIoY2VudGVyKSB7XG4gICAgc3RhdGUuY2VudGVyID0gY2VudGVyO1xuICAgIHJlcGFpbnRDaXJjbGUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldENlbnRlcigpIHtcbiAgICByZXR1cm4gc3RhdGUuY2VudGVyO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkVG8oY29udGFpbmVyKSB7XG4gICAgcmVuZGVyKGNvbnRhaW5lcik7XG4gICAgc2VsZi5jZW50ZXIgPSBjZW50ZXI7XG4gICAgc2VsZi5yYWRpdXMgPSByYWRpdXM7XG4gICAgc2VsZi5lbWl0KCdjZW50ZXItY2hhbmdlZCcpO1xuICAgIHNlbGYuZW1pdCgncmFkaXVzLWNoYW5nZWQnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZSgpIHtcbiAgICBjaXJjbGUucmVtb3ZlKCk7XG4gIH1cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoc2VsZiwgJ2NlbnRlcicsIHsgZ2V0OiBnZXRDZW50ZXIsIHNldDogc2V0Q2VudGVyIH0pO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoc2VsZiwgJ3JhZGl1cycsIHsgZ2V0OiBnZXRSYWRpdXMsIHNldDogc2V0UmFkaXVzIH0pO1xuXG4gIGlmIChjb250YWluZXIpIHtcbiAgICBhZGRUbyhjb250YWluZXIpO1xuICB9XG5cbiAgcmV0dXJuIHNlbGY7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0ZXJzMnBpeGVscyxcbiAgcGl4ZWxzMm1ldGVyc1xufTtcblxuZnVuY3Rpb24gbWV0ZXJzMnBpeGVscyhtZXRlcnMsIFsgeCwgeSBdLCB7IGZyb21HZW8sIHRvR2VvIH0pIHtcbiAgbGV0IFsgbG9uLCBsYXQgXSA9IHRvR2VvKFsgeCwgeSBdKTtcbiAgbGV0IGxvbjEgPSBsb24gKyBtZXRlcnMgLyBtZXRlcnNQZXJEZWdyZWUobGF0KTtcbiAgaWYgKGxvbjEgPiAxODApIHtcbiAgICBsb24xIC09IDM2MDtcbiAgfVxuICBsZXQgWyB4MSBdID0gZnJvbUdlbyhbIGxvbjEsIGxhdCBdKTtcbiAgcmV0dXJuIE1hdGgucm91bmQoTWF0aC5hYnMoeDEgLSB4KSk7XG59XG5cblxuZnVuY3Rpb24gcGl4ZWxzMm1ldGVycyhwaXhlbHMsIFsgeCwgeSBdLCB7IHRvR2VvIH0pIHtcbiAgbGV0IHgxID0geCArIHBpeGVscztcbiAgbGV0IFsgbG9uLCBsYXQgXSA9IHRvR2VvKFsgeCwgeSBdKTtcbiAgbGV0IFsgbG9uMSBdID0gdG9HZW8oWyB4MSwgeSBdKTtcbiAgaWYgKGxvbjEgPCBsb24pIHtcbiAgICBsb24xICs9IDM2MDtcbiAgfVxuICByZXR1cm4gTWF0aC5yb3VuZCgobG9uMSAtIGxvbikgKiBtZXRlcnNQZXJEZWdyZWUobGF0KSk7XG59XG5cbmNvbnN0IFIgPSA2MzcxMDAwOyAvLyB+IEVhcmggcmFkaXVzIGluIG1ldGVyc1xuY29uc3QgRVFVQVRPUl9ERUdSRUVfTEVOID0gTWF0aC5QSSAqIFIgLyAxODA7XG5cbi8vIGxlbiBvZiBhIGRlZ3JlZSBhdCBsYXQgPT09IGxlbiBvZiBkZWdyZWUgYXQgZXF1YXRvciBtdWx0aXBsaWVkIGJ5IGNvcyhsYXQpXG5mdW5jdGlvbiBtZXRlcnNQZXJEZWdyZWUobGF0KSB7XG4gIHJldHVybiBFUVVBVE9SX0RFR1JFRV9MRU4gKiBNYXRoLmNvcyhsYXQgKiBNYXRoLlBJIC8gMTgwKTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gbWFrZUhhbmRsZTtcblxuY29uc3Qgc2V0RHJhZ0ltYWdlU3VwcG9ydGVkID0gd2luZG93LkRhdGFUcmFuc2ZlciAmJiAnc2V0RHJhZ0ltYWdlJyBpbiB3aW5kb3cuRGF0YVRyYW5zZmVyLnByb3RvdHlwZTtcblxuZnVuY3Rpb24gbWFrZUhhbmRsZShjaXJjbGUsIHsgY2xhc3NOYW1lLCBvbmRyYWcsIG9uZHJhZ2VuZCB9KSB7XG4gIGxldCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gIGZ1bmN0aW9uIG9uZHJhZ3N0YXJ0KHsgZGF0YVRyYW5zZmVyIH0pIHtcbiAgICBjaXJjbGUucGFyZW50Tm9kZS5hZGRFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIG9uZHJhZ0NvbW1vbik7XG4gICAgZGF0YVRyYW5zZmVyLnNldERhdGEoXCJ0ZXh0L3BsYWluXCIsIFwiXCIpO1xuICAgIGRhdGFUcmFuc2Zlci5lZmZlY3RBbGxvd2VkID0gJ21vdmUnO1xuICAgIGlmIChzZXREcmFnSW1hZ2VTdXBwb3J0ZWQpIHtcbiAgICAgIC8vIG5vdCBhbGwgYnJvd3NlcnMgc3VwcG9ydCBzZXREcmFnSW1hZ2VcbiAgICAgIGRhdGFUcmFuc2Zlci5zZXREcmFnSW1hZ2UoZWwsIGVsLm9mZnNldFdpZHRoIC8gMiwgZWwub2Zmc2V0SGVpZ2h0IC8gMik7XG4gICAgfVxuICAgIGNpcmNsZS5jbGFzc0xpc3QuYWRkKCdkcmFnZ2luZycpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25kcmFnZW5kQ29tbW9uKCkge1xuICAgIGNpcmNsZS5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnZ2luZycpO1xuICAgIGNpcmNsZS5wYXJlbnROb2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVyJywgb25kcmFnQ29tbW9uKTtcbiAgICBvbmRyYWdlbmQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uZHJhZ0NvbW1vbihldmVudCkge1xuICAgIGlmIChldmVudC5jbGllbnRYID09PSB1bmRlZmluZWQgfHwgZXZlbnQuY2xpZW50WSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZygnSW52YWxpZCBkcmFnIGV2ZW50IScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBhY2NlcHQgZHJvcFxuICAgIGxldCB7XG4gICAgICBkYXRhVHJhbnNmZXIsXG4gICAgICBjbGllbnRYLCBjbGllbnRZLFxuICAgICAgY3VycmVudFRhcmdldFxuICAgIH0gPSBldmVudDtcbiAgICBkYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdtb3ZlJztcbiAgICBsZXQgeyBsZWZ0LCB0b3AgfSA9IGN1cnJlbnRUYXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgb25kcmFnKHtcbiAgICAgIGNsaWVudFg6IGNsaWVudFggLSBsZWZ0LFxuICAgICAgY2xpZW50WTogY2xpZW50WSAtIHRvcFxuICAgIH0pO1xuICB9XG5cbiAgZWwuY2xhc3NOYW1lID0gYGNpcmNsZS1oYW5kbGUgJHtjbGFzc05hbWV9YDtcbiAgZWwuZHJhZ2dhYmxlID0gdHJ1ZTtcblxuICAvLyBjYW5ub3QgdXNlICdkcmFnJyBldmVudCBiZWNhdXNlIEZpcmVmb3ggYnVnIC0gc2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD01MDU1MjFcbiAgLy8gZWwuYWRkRXZlbnRMaXN0ZW5lcignZHJhZycsIG9uZHJhZyk7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdzdGFydCcsIG9uZHJhZ3N0YXJ0KTtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIG9uZHJhZ2VuZENvbW1vbik7XG5cbiAgY2lyY2xlLmFwcGVuZENoaWxkKGVsKTtcbiAgcmV0dXJuIGVsO1xufVxuIiwiY29uc3QgbWFrZUNpcmNsZSA9IHJlcXVpcmUoJy4vY2lyY2xlJyk7XG5jb25zdCB7IG1ldGVyczJwaXhlbHMsIHBpeGVsczJtZXRlcnMgfSA9IHJlcXVpcmUoJy4vZGlzdGFuY2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBtYXBDaXJjbGVDb250cm9sO1xuXG5cbi8qXG4gKiBtYXAgb2JqZWN0IG5lZWRzIHRvIGhhdmUgdGhlIGZvbGxvd2luZyBtZXRob2RzXG4gKiAgZ2V0Q29udGFpbmVyKCkgLSByZXR1cm5zIGNvbnRhaW5lciBkaXYgaW4gd2hpY2ggbWFwIGlzIGVtYmVkZGVkIC0gdXNlZCB0byBhZGQgY2lyY2xlIGRpdlxuICogIHByb2plY3QobGwpIC0gcmV0dXJuIFt4LCB5XSBsb2NhdGlvbiBpbiBzY3JlZW4gY29vcmRpbmF0ZXMgLSBjb3JyZXNwb25kaW5nIHRvIGdlbyBbbGF0LCBsb25dXG4gKiAgdW5wcm9qZWN0KHh5KSAtIHJldHVybnMgZ2VvIGNvb3JkaW5hdGVzIGNvcnJlc3BvbmRpbmcgdG8gc2NyZWVuIGxvY2F0aW9uIFt4LCB5XVxuICovXG5cbi8qXG4gKiBsb2NhdGlvbiAtIFtsb24sIGxhdF1cbiAqIHJhZGl1cyAtIGluIG1ldGVyc1xuICovXG5mdW5jdGlvbiBtYXBDaXJjbGVDb250cm9sKHsgY2VudGVyLCByYWRpdXMgfSA9IHt9KSB7XG4gIGxldCBzZWxmID0gbWFrZUNpcmNsZSh7IGNlbnRlciwgcmFkaXVzLCB9KTtcbiAgbGV0IG1hcDtcblxuICBmdW5jdGlvbiBvbmFkZChfbWFwKSB7XG4gICAgbWFwID0gX21hcDtcbiAgICBzZWxmLmFkZFRvKG1hcC5nZXRDb250YWluZXIoKSk7XG4gIH1cblxuICBmdW5jdGlvbiBvbnJlbW92ZSgpIHtcbiAgICBzZWxmLnJlbW92ZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gZnJvbUdlbyhsbCkge1xuICAgIHJldHVybiBtYXAucHJvamVjdChsbCk7XG4gIH1cblxuICBmdW5jdGlvbiB0b0dlbyh4eSkge1xuICAgIGxldCB7IGxuZywgbGF0IH0gPSBtYXAudW5wcm9qZWN0KHh5KTtcbiAgICByZXR1cm4gWyBsbmcsIGxhdF07XG4gIH1cblxuICBmdW5jdGlvbiBnZXRHZW9DZW50ZXIoKSB7XG4gICAgcmV0dXJuIHRvR2VvKHNlbGYuY2VudGVyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldEdlb0NlbnRlcihsbCkge1xuICAgIHNlbGYuY2VudGVyID0gZnJvbUdlbyhsbCk7XG4gIH1cblxuICBmdW5jdGlvbiBzZXRHZW9SYWRpdXMobWV0ZXJzKSB7XG4gICAgc2VsZi5yYWRpdXMgPSBtZXRlcnMycGl4ZWxzKG1ldGVycywgc2VsZi5jZW50ZXIsIHsgZnJvbUdlbywgdG9HZW8gfSk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRHZW9SYWRpdXMoKSB7XG4gICAgcmV0dXJuIHBpeGVsczJtZXRlcnMoc2VsZi5yYWRpdXMsIHNlbGYuY2VudGVyLCB7IGZyb21HZW8sIHRvR2VvIH0pO1xuICB9XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNlbGYsICdnZW9DZW50ZXInLCB7IGdldDogZ2V0R2VvQ2VudGVyLCBzZXQ6IHNldEdlb0NlbnRlciB9KTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNlbGYsICdnZW9SYWRpdXMnLCB7IGdldDogZ2V0R2VvUmFkaXVzLCBzZXQ6IHNldEdlb1JhZGl1cyB9KTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbihzZWxmLCB7XG4gICAgb25hZGQsXG4gICAgb25yZW1vdmVcbiAgfSk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IG1ha2VIYW5kbGU7XG5cblxuZnVuY3Rpb24gbWFrZUhhbmRsZShjaXJjbGUsIHsgY2xhc3NOYW1lLCBvbmRyYWcsIG9uZHJhZ2VuZCB9KSB7XG4gIGxldCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBsZXQgZHJhZ2dpbmcgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBvblRvdWNoTW92ZShldmVudCkge1xuICAgIGlmICghZHJhZ2dpbmcpIHtcbiAgICAgIGNpcmNsZS5jbGFzc0xpc3QuYWRkKCdkcmFnZ2luZycpO1xuICAgICAgZHJhZ2dpbmcgPSB0cnVlO1xuICAgIH1cbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGxldCB7XG4gICAgICBjbGllbnRYLCBjbGllbnRZXG4gICAgfSA9IGV2ZW50LnRhcmdldFRvdWNoZXNbMF07XG4gICAgbGV0IHsgbGVmdCwgdG9wIH0gPSBjaXJjbGUucGFyZW50Tm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICBvbmRyYWcoe1xuICAgICAgY2xpZW50WDogY2xpZW50WCAtIGxlZnQsXG4gICAgICBjbGllbnRZOiBjbGllbnRZIC0gdG9wXG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBvblRvdWNoRW5kKCkge1xuICAgIGNpcmNsZS5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnZ2luZycpO1xuICAgIGRyYWdnaW5nID0gZmFsc2U7XG4gICAgb25kcmFnZW5kKCk7XG4gIH1cblxuICBlbC5jbGFzc05hbWUgPSBgY2lyY2xlLWhhbmRsZSAke2NsYXNzTmFtZX1gO1xuXG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIG9uVG91Y2hNb3ZlLCAgeyBjYXB0dXJlOiB0cnVlLCBwYXNzaXZlOiBmYWxzZSB9KTtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCBvblRvdWNoRW5kKTtcblxuICBjaXJjbGUuYXBwZW5kQ2hpbGQoZWwpO1xuICByZXR1cm4gZWw7XG59XG4iLCJcclxuLyoqXHJcbiAqIEV4cG9zZSBgRW1pdHRlcmAuXHJcbiAqL1xyXG5cclxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgbW9kdWxlLmV4cG9ydHMgPSBFbWl0dGVyO1xyXG59XHJcblxyXG4vKipcclxuICogSW5pdGlhbGl6ZSBhIG5ldyBgRW1pdHRlcmAuXHJcbiAqXHJcbiAqIEBhcGkgcHVibGljXHJcbiAqL1xyXG5cclxuZnVuY3Rpb24gRW1pdHRlcihvYmopIHtcclxuICBpZiAob2JqKSByZXR1cm4gbWl4aW4ob2JqKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBNaXhpbiB0aGUgZW1pdHRlciBwcm9wZXJ0aWVzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXHJcbiAqIEByZXR1cm4ge09iamVjdH1cclxuICogQGFwaSBwcml2YXRlXHJcbiAqL1xyXG5cclxuZnVuY3Rpb24gbWl4aW4ob2JqKSB7XHJcbiAgZm9yICh2YXIga2V5IGluIEVtaXR0ZXIucHJvdG90eXBlKSB7XHJcbiAgICBvYmpba2V5XSA9IEVtaXR0ZXIucHJvdG90eXBlW2tleV07XHJcbiAgfVxyXG4gIHJldHVybiBvYmo7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBMaXN0ZW4gb24gdGhlIGdpdmVuIGBldmVudGAgd2l0aCBgZm5gLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cclxuICogQHJldHVybiB7RW1pdHRlcn1cclxuICogQGFwaSBwdWJsaWNcclxuICovXHJcblxyXG5FbWl0dGVyLnByb3RvdHlwZS5vbiA9XHJcbkVtaXR0ZXIucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbihldmVudCwgZm4pe1xyXG4gIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcclxuICAodGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XSA9IHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF0gfHwgW10pXHJcbiAgICAucHVzaChmbik7XHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogQWRkcyBhbiBgZXZlbnRgIGxpc3RlbmVyIHRoYXQgd2lsbCBiZSBpbnZva2VkIGEgc2luZ2xlXHJcbiAqIHRpbWUgdGhlbiBhdXRvbWF0aWNhbGx5IHJlbW92ZWQuXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxyXG4gKiBAcmV0dXJuIHtFbWl0dGVyfVxyXG4gKiBAYXBpIHB1YmxpY1xyXG4gKi9cclxuXHJcbkVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbihldmVudCwgZm4pe1xyXG4gIGZ1bmN0aW9uIG9uKCkge1xyXG4gICAgdGhpcy5vZmYoZXZlbnQsIG9uKTtcclxuICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgfVxyXG5cclxuICBvbi5mbiA9IGZuO1xyXG4gIHRoaXMub24oZXZlbnQsIG9uKTtcclxuICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZW1vdmUgdGhlIGdpdmVuIGNhbGxiYWNrIGZvciBgZXZlbnRgIG9yIGFsbFxyXG4gKiByZWdpc3RlcmVkIGNhbGxiYWNrcy5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXHJcbiAqIEByZXR1cm4ge0VtaXR0ZXJ9XHJcbiAqIEBhcGkgcHVibGljXHJcbiAqL1xyXG5cclxuRW1pdHRlci5wcm90b3R5cGUub2ZmID1cclxuRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPVxyXG5FbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPVxyXG5FbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyID0gZnVuY3Rpb24oZXZlbnQsIGZuKXtcclxuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XHJcblxyXG4gIC8vIGFsbFxyXG4gIGlmICgwID09IGFyZ3VtZW50cy5sZW5ndGgpIHtcclxuICAgIHRoaXMuX2NhbGxiYWNrcyA9IHt9O1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvLyBzcGVjaWZpYyBldmVudFxyXG4gIHZhciBjYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xyXG4gIGlmICghY2FsbGJhY2tzKSByZXR1cm4gdGhpcztcclxuXHJcbiAgLy8gcmVtb3ZlIGFsbCBoYW5kbGVyc1xyXG4gIGlmICgxID09IGFyZ3VtZW50cy5sZW5ndGgpIHtcclxuICAgIGRlbGV0ZSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvLyByZW1vdmUgc3BlY2lmaWMgaGFuZGxlclxyXG4gIHZhciBjYjtcclxuICBmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7IGkrKykge1xyXG4gICAgY2IgPSBjYWxsYmFja3NbaV07XHJcbiAgICBpZiAoY2IgPT09IGZuIHx8IGNiLmZuID09PSBmbikge1xyXG4gICAgICBjYWxsYmFja3Muc3BsaWNlKGksIDEpO1xyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFJlbW92ZSBldmVudCBzcGVjaWZpYyBhcnJheXMgZm9yIGV2ZW50IHR5cGVzIHRoYXQgbm9cclxuICAvLyBvbmUgaXMgc3Vic2NyaWJlZCBmb3IgdG8gYXZvaWQgbWVtb3J5IGxlYWsuXHJcbiAgaWYgKGNhbGxiYWNrcy5sZW5ndGggPT09IDApIHtcclxuICAgIGRlbGV0ZSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogRW1pdCBgZXZlbnRgIHdpdGggdGhlIGdpdmVuIGFyZ3MuXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG4gKiBAcGFyYW0ge01peGVkfSAuLi5cclxuICogQHJldHVybiB7RW1pdHRlcn1cclxuICovXHJcblxyXG5FbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24oZXZlbnQpe1xyXG4gIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcclxuXHJcbiAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpXHJcbiAgICAsIGNhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF07XHJcblxyXG4gIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcclxuICB9XHJcblxyXG4gIGlmIChjYWxsYmFja3MpIHtcclxuICAgIGNhbGxiYWNrcyA9IGNhbGxiYWNrcy5zbGljZSgwKTtcclxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjYWxsYmFja3MubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcclxuICAgICAgY2FsbGJhY2tzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogUmV0dXJuIGFycmF5IG9mIGNhbGxiYWNrcyBmb3IgYGV2ZW50YC5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcbiAqIEByZXR1cm4ge0FycmF5fVxyXG4gKiBAYXBpIHB1YmxpY1xyXG4gKi9cclxuXHJcbkVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKGV2ZW50KXtcclxuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XHJcbiAgcmV0dXJuIHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF0gfHwgW107XHJcbn07XHJcblxyXG4vKipcclxuICogQ2hlY2sgaWYgdGhpcyBlbWl0dGVyIGhhcyBgZXZlbnRgIGhhbmRsZXJzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuICogQHJldHVybiB7Qm9vbGVhbn1cclxuICogQGFwaSBwdWJsaWNcclxuICovXHJcblxyXG5FbWl0dGVyLnByb3RvdHlwZS5oYXNMaXN0ZW5lcnMgPSBmdW5jdGlvbihldmVudCl7XHJcbiAgcmV0dXJuICEhIHRoaXMubGlzdGVuZXJzKGV2ZW50KS5sZW5ndGg7XHJcbn07XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvbWFwLWNpcmNsZS1jb250cm9sJyk7XG4iXX0=
