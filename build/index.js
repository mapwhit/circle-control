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

  el.addEventListener('touchmove', onTouchMove);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvY2lyY2xlLmpzIiwibGliL2Rpc3RhbmNlLmpzIiwibGliL2RyYWctaGFuZGxlLmpzIiwibGliL21hcC1jaXJjbGUtY29udHJvbC5qcyIsImxpYi90b3VjaC1oYW5kbGUuanMiLCJub2RlX21vZHVsZXMvY29tcG9uZW50LWVtaXR0ZXIvaW5kZXguanMiLCJpbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvS0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsImNvbnN0IGVtaXR0ZXIgPSByZXF1aXJlKCdjb21wb25lbnQtZW1pdHRlcicpO1xuY29uc3QgZHJhZ0hhbmRsZSA9IHJlcXVpcmUoJy4vZHJhZy1oYW5kbGUnKTtcbmNvbnN0IHRvdWNoSGFuZGxlID0gcmVxdWlyZSgnLi90b3VjaC1oYW5kbGUnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBtYWtlQ2lyY2xlO1xuXG5cbmZ1bmN0aW9uIG1ha2VDaXJjbGUoe1xuICBjb250YWluZXIsXG4gIHJhZGl1cyA9IDEwMCxcbiAgY2VudGVyID0gWyAwLCAwIF1cbn0gPSB7fSkge1xuICBsZXQgY2lyY2xlO1xuICBsZXQgc2VsZiA9IHtcbiAgICBhZGRUbyxcbiAgICByZW1vdmVcbiAgfTtcbiAgbGV0IHN0YXRlID0ge1xuICAgIHJhZGl1cyxcbiAgICBjZW50ZXJcbiAgfTtcbiAgZW1pdHRlcihzZWxmKTtcblxuICBmdW5jdGlvbiByZXNpemVIYW5kbGUoaGFuZGxlLCBwb3NpdGlvbikge1xuICAgIGxldCBob3Jpem9udGFsID0gcG9zaXRpb24gPT09ICd3ZXN0JyB8fCBwb3NpdGlvbiA9PT0gJ2Vhc3QnO1xuXG4gICAgZnVuY3Rpb24gb25kcmFnKHsgY2xpZW50WCwgY2xpZW50WSB9KSB7XG4gICAgICBsZXQgWyB4LCB5IF0gPSBzZWxmLmNlbnRlcjtcbiAgICAgIGxldCByYWRpdXMgPSBob3Jpem9udGFsID8gTWF0aC5hYnMoeCAtIGNsaWVudFgpIDogTWF0aC5hYnMoeSAtIGNsaWVudFkpO1xuICAgICAgc2VsZi5yYWRpdXMgPSByYWRpdXM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25kcmFnZW5kKCkge1xuICAgICAgc2VsZi5lbWl0KCdyYWRpdXMtY2hhbmdlZCcpO1xuICAgIH1cblxuICAgIHJldHVybiBoYW5kbGUoY2lyY2xlLCB7IG9uZHJhZywgb25kcmFnZW5kLCBjbGFzc05hbWU6IGBjaXJjbGUtJHtwb3NpdGlvbn1gIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gY2VudGVySGFuZGxlKGhhbmRsZSkge1xuICAgIGZ1bmN0aW9uIG9uZHJhZyh7IGNsaWVudFgsIGNsaWVudFkgfSkge1xuICAgICAgc2VsZi5jZW50ZXIgPSBbIGNsaWVudFgsIGNsaWVudFkgXTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbmRyYWdlbmQoKSB7XG4gICAgICBzZWxmLmVtaXQoJ2NlbnRlci1jaGFuZ2VkJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhbmRsZShjaXJjbGUsIHsgb25kcmFnLCBvbmRyYWdlbmQsIGNsYXNzTmFtZTogJ2NpcmNsZS1jZW50ZXInIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVuZGVyKGNvbnRhaW5lcikge1xuICAgIGNpcmNsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNpcmNsZS5jbGFzc05hbWUgPSAnY2lyY2xlJztcbiAgICBjb25zdCBoYW5kbGUgPSAnb25kcmFnc3RhcnQnIGluIGNpcmNsZSA/IGRyYWdIYW5kbGUgOiB0b3VjaEhhbmRsZTtcblxuICAgIGNlbnRlckhhbmRsZShoYW5kbGUpO1xuICAgIFtcbiAgICAgICdzb3V0aCcsXG4gICAgICAnbm9ydGgnLFxuICAgICAgJ3dlc3QnLFxuICAgICAgJ2Vhc3QnXG4gICAgXS5mb3JFYWNoKHAgPT4gcmVzaXplSGFuZGxlKGhhbmRsZSwgcCkpO1xuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChjaXJjbGUpO1xuICAgIHJldHVybiBjaXJjbGU7XG4gIH1cblxuICBmdW5jdGlvbiByZXBhaW50Q2lyY2xlKCkge1xuICAgIGxldCBzaXplID0gYCR7c3RhdGUucmFkaXVzICogMn1weGA7XG4gICAgY2lyY2xlLnN0eWxlLndpZHRoID0gc2l6ZTtcbiAgICBjaXJjbGUuc3R5bGUuaGVpZ2h0ID0gc2l6ZTtcblxuICAgIGxldCBbIGxlZnQsIHRvcCBdID0gc3RhdGUuY2VudGVyO1xuICAgIGNpcmNsZS5zdHlsZS5sZWZ0ID0gYCR7bGVmdH1weGA7XG4gICAgY2lyY2xlLnN0eWxlLnRvcCA9IGAke3RvcH1weGA7XG4gIH1cblxuICBmdW5jdGlvbiBzZXRSYWRpdXMocmFkaXVzKSB7XG4gICAgc3RhdGUucmFkaXVzID0gcmFkaXVzO1xuICAgIHJlcGFpbnRDaXJjbGUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFJhZGl1cygpIHtcbiAgICByZXR1cm4gc3RhdGUucmFkaXVzO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0Q2VudGVyKGNlbnRlcikge1xuICAgIHN0YXRlLmNlbnRlciA9IGNlbnRlcjtcbiAgICByZXBhaW50Q2lyY2xlKCk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRDZW50ZXIoKSB7XG4gICAgcmV0dXJuIHN0YXRlLmNlbnRlcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZFRvKGNvbnRhaW5lcikge1xuICAgIHJlbmRlcihjb250YWluZXIpO1xuICAgIHNlbGYuY2VudGVyID0gY2VudGVyO1xuICAgIHNlbGYucmFkaXVzID0gcmFkaXVzO1xuICAgIHNlbGYuZW1pdCgnY2VudGVyLWNoYW5nZWQnKTtcbiAgICBzZWxmLmVtaXQoJ3JhZGl1cy1jaGFuZ2VkJyk7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmUoKSB7XG4gICAgY2lyY2xlLnJlbW92ZSgpO1xuICB9XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNlbGYsICdjZW50ZXInLCB7IGdldDogZ2V0Q2VudGVyLCBzZXQ6IHNldENlbnRlciB9KTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNlbGYsICdyYWRpdXMnLCB7IGdldDogZ2V0UmFkaXVzLCBzZXQ6IHNldFJhZGl1cyB9KTtcblxuICBpZiAoY29udGFpbmVyKSB7XG4gICAgYWRkVG8oY29udGFpbmVyKTtcbiAgfVxuXG4gIHJldHVybiBzZWxmO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGVyczJwaXhlbHMsXG4gIHBpeGVsczJtZXRlcnNcbn07XG5cbmZ1bmN0aW9uIG1ldGVyczJwaXhlbHMobWV0ZXJzLCBbIHgsIHkgXSwgeyBmcm9tR2VvLCB0b0dlbyB9KSB7XG4gIGxldCBbIGxvbiwgbGF0IF0gPSB0b0dlbyhbIHgsIHkgXSk7XG4gIGxldCBsb24xID0gbG9uICsgbWV0ZXJzIC8gbWV0ZXJzUGVyRGVncmVlKGxhdCk7XG4gIGlmIChsb24xID4gMTgwKSB7XG4gICAgbG9uMSAtPSAzNjA7XG4gIH1cbiAgbGV0IFsgeDEgXSA9IGZyb21HZW8oWyBsb24xLCBsYXQgXSk7XG4gIHJldHVybiBNYXRoLnJvdW5kKE1hdGguYWJzKHgxIC0geCkpO1xufVxuXG5cbmZ1bmN0aW9uIHBpeGVsczJtZXRlcnMocGl4ZWxzLCBbIHgsIHkgXSwgeyB0b0dlbyB9KSB7XG4gIGxldCB4MSA9IHggKyBwaXhlbHM7XG4gIGxldCBbIGxvbiwgbGF0IF0gPSB0b0dlbyhbIHgsIHkgXSk7XG4gIGxldCBbIGxvbjEgXSA9IHRvR2VvKFsgeDEsIHkgXSk7XG4gIGlmIChsb24xIDwgbG9uKSB7XG4gICAgbG9uMSArPSAzNjA7XG4gIH1cbiAgcmV0dXJuIE1hdGgucm91bmQoKGxvbjEgLSBsb24pICogbWV0ZXJzUGVyRGVncmVlKGxhdCkpO1xufVxuXG5jb25zdCBSID0gNjM3MTAwMDsgLy8gfiBFYXJoIHJhZGl1cyBpbiBtZXRlcnNcbmNvbnN0IEVRVUFUT1JfREVHUkVFX0xFTiA9IE1hdGguUEkgKiBSIC8gMTgwO1xuXG4vLyBsZW4gb2YgYSBkZWdyZWUgYXQgbGF0ID09PSBsZW4gb2YgZGVncmVlIGF0IGVxdWF0b3IgbXVsdGlwbGllZCBieSBjb3MobGF0KVxuZnVuY3Rpb24gbWV0ZXJzUGVyRGVncmVlKGxhdCkge1xuICByZXR1cm4gRVFVQVRPUl9ERUdSRUVfTEVOICogTWF0aC5jb3MobGF0ICogTWF0aC5QSSAvIDE4MCk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IG1ha2VIYW5kbGU7XG5cbmNvbnN0IHNldERyYWdJbWFnZVN1cHBvcnRlZCA9IHdpbmRvdy5EYXRhVHJhbnNmZXIgJiYgJ3NldERyYWdJbWFnZScgaW4gd2luZG93LkRhdGFUcmFuc2Zlci5wcm90b3R5cGU7XG5cbmZ1bmN0aW9uIG1ha2VIYW5kbGUoY2lyY2xlLCB7IGNsYXNzTmFtZSwgb25kcmFnLCBvbmRyYWdlbmQgfSkge1xuICBsZXQgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuICBmdW5jdGlvbiBvbmRyYWdzdGFydCh7IGRhdGFUcmFuc2ZlciB9KSB7XG4gICAgY2lyY2xlLnBhcmVudE5vZGUuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ292ZXInLCBvbmRyYWdDb21tb24pO1xuICAgIGRhdGFUcmFuc2Zlci5zZXREYXRhKFwidGV4dC9wbGFpblwiLCBcIlwiKTtcbiAgICBkYXRhVHJhbnNmZXIuZWZmZWN0QWxsb3dlZCA9ICdtb3ZlJztcbiAgICBpZiAoc2V0RHJhZ0ltYWdlU3VwcG9ydGVkKSB7XG4gICAgICAvLyBub3QgYWxsIGJyb3dzZXJzIHN1cHBvcnQgc2V0RHJhZ0ltYWdlXG4gICAgICBkYXRhVHJhbnNmZXIuc2V0RHJhZ0ltYWdlKGVsLCBlbC5vZmZzZXRXaWR0aCAvIDIsIGVsLm9mZnNldEhlaWdodCAvIDIpO1xuICAgIH1cbiAgICBjaXJjbGUuY2xhc3NMaXN0LmFkZCgnZHJhZ2dpbmcnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uZHJhZ2VuZENvbW1vbigpIHtcbiAgICBjaXJjbGUuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZ2dpbmcnKTtcbiAgICBjaXJjbGUucGFyZW50Tm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIG9uZHJhZ0NvbW1vbik7XG4gICAgb25kcmFnZW5kKCk7XG4gIH1cblxuICBmdW5jdGlvbiBvbmRyYWdDb21tb24oZXZlbnQpIHtcbiAgICBpZiAoZXZlbnQuY2xpZW50WCA9PT0gdW5kZWZpbmVkIHx8IGV2ZW50LmNsaWVudFkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gY29uc29sZS5sb2coJ0ludmFsaWQgZHJhZyBldmVudCEnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgLy8gYWNjZXB0IGRyb3BcbiAgICBsZXQge1xuICAgICAgZGF0YVRyYW5zZmVyLFxuICAgICAgY2xpZW50WCwgY2xpZW50WSxcbiAgICAgIGN1cnJlbnRUYXJnZXRcbiAgICB9ID0gZXZlbnQ7XG4gICAgZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnbW92ZSc7XG4gICAgbGV0IHsgbGVmdCwgdG9wIH0gPSBjdXJyZW50VGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIG9uZHJhZyh7XG4gICAgICBjbGllbnRYOiBjbGllbnRYIC0gbGVmdCxcbiAgICAgIGNsaWVudFk6IGNsaWVudFkgLSB0b3BcbiAgICB9KTtcbiAgfVxuXG4gIGVsLmNsYXNzTmFtZSA9IGBjaXJjbGUtaGFuZGxlICR7Y2xhc3NOYW1lfWA7XG4gIGVsLmRyYWdnYWJsZSA9IHRydWU7XG5cbiAgLy8gY2Fubm90IHVzZSAnZHJhZycgZXZlbnQgYmVjYXVzZSBGaXJlZm94IGJ1ZyAtIHNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9NTA1NTIxXG4gIC8vIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWcnLCBvbmRyYWcpO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCBvbmRyYWdzdGFydCk7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCBvbmRyYWdlbmRDb21tb24pO1xuXG4gIGNpcmNsZS5hcHBlbmRDaGlsZChlbCk7XG4gIHJldHVybiBlbDtcbn1cbiIsImNvbnN0IG1ha2VDaXJjbGUgPSByZXF1aXJlKCcuL2NpcmNsZScpO1xuY29uc3QgeyBtZXRlcnMycGl4ZWxzLCBwaXhlbHMybWV0ZXJzIH0gPSByZXF1aXJlKCcuL2Rpc3RhbmNlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gbWFwQ2lyY2xlQ29udHJvbDtcblxuXG4vKlxuICogbWFwIG9iamVjdCBuZWVkcyB0byBoYXZlIHRoZSBmb2xsb3dpbmcgbWV0aG9kc1xuICogIGdldENvbnRhaW5lcigpIC0gcmV0dXJucyBjb250YWluZXIgZGl2IGluIHdoaWNoIG1hcCBpcyBlbWJlZGRlZCAtIHVzZWQgdG8gYWRkIGNpcmNsZSBkaXZcbiAqICBwcm9qZWN0KGxsKSAtIHJldHVybiBbeCwgeV0gbG9jYXRpb24gaW4gc2NyZWVuIGNvb3JkaW5hdGVzIC0gY29ycmVzcG9uZGluZyB0byBnZW8gW2xhdCwgbG9uXVxuICogIHVucHJvamVjdCh4eSkgLSByZXR1cm5zIGdlbyBjb29yZGluYXRlcyBjb3JyZXNwb25kaW5nIHRvIHNjcmVlbiBsb2NhdGlvbiBbeCwgeV1cbiAqL1xuXG4vKlxuICogbG9jYXRpb24gLSBbbG9uLCBsYXRdXG4gKiByYWRpdXMgLSBpbiBtZXRlcnNcbiAqL1xuZnVuY3Rpb24gbWFwQ2lyY2xlQ29udHJvbCh7IGNlbnRlciwgcmFkaXVzIH0gPSB7fSkge1xuICBsZXQgc2VsZiA9IG1ha2VDaXJjbGUoeyBjZW50ZXIsIHJhZGl1cywgfSk7XG4gIGxldCBtYXA7XG5cbiAgZnVuY3Rpb24gb25hZGQoX21hcCkge1xuICAgIG1hcCA9IF9tYXA7XG4gICAgc2VsZi5hZGRUbyhtYXAuZ2V0Q29udGFpbmVyKCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25yZW1vdmUoKSB7XG4gICAgc2VsZi5yZW1vdmUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZyb21HZW8obGwpIHtcbiAgICByZXR1cm4gbWFwLnByb2plY3QobGwpO1xuICB9XG5cbiAgZnVuY3Rpb24gdG9HZW8oeHkpIHtcbiAgICBsZXQgeyBsbmcsIGxhdCB9ID0gbWFwLnVucHJvamVjdCh4eSk7XG4gICAgcmV0dXJuIFsgbG5nLCBsYXRdO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0R2VvQ2VudGVyKCkge1xuICAgIHJldHVybiB0b0dlbyhzZWxmLmNlbnRlcik7XG4gIH1cblxuICBmdW5jdGlvbiBzZXRHZW9DZW50ZXIobGwpIHtcbiAgICBzZWxmLmNlbnRlciA9IGZyb21HZW8obGwpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0R2VvUmFkaXVzKG1ldGVycykge1xuICAgIHNlbGYucmFkaXVzID0gbWV0ZXJzMnBpeGVscyhtZXRlcnMsIHNlbGYuY2VudGVyLCB7IGZyb21HZW8sIHRvR2VvIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0R2VvUmFkaXVzKCkge1xuICAgIHJldHVybiBwaXhlbHMybWV0ZXJzKHNlbGYucmFkaXVzLCBzZWxmLmNlbnRlciwgeyBmcm9tR2VvLCB0b0dlbyB9KTtcbiAgfVxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzZWxmLCAnZ2VvQ2VudGVyJywgeyBnZXQ6IGdldEdlb0NlbnRlciwgc2V0OiBzZXRHZW9DZW50ZXIgfSk7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzZWxmLCAnZ2VvUmFkaXVzJywgeyBnZXQ6IGdldEdlb1JhZGl1cywgc2V0OiBzZXRHZW9SYWRpdXMgfSk7XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oc2VsZiwge1xuICAgIG9uYWRkLFxuICAgIG9ucmVtb3ZlXG4gIH0pO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBtYWtlSGFuZGxlO1xuXG5cbmZ1bmN0aW9uIG1ha2VIYW5kbGUoY2lyY2xlLCB7IGNsYXNzTmFtZSwgb25kcmFnLCBvbmRyYWdlbmQgfSkge1xuICBsZXQgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgbGV0IGRyYWdnaW5nID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gb25Ub3VjaE1vdmUoZXZlbnQpIHtcbiAgICBpZiAoIWRyYWdnaW5nKSB7XG4gICAgICBjaXJjbGUuY2xhc3NMaXN0LmFkZCgnZHJhZ2dpbmcnKTtcbiAgICAgIGRyYWdnaW5nID0gdHJ1ZTtcbiAgICB9XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBsZXQge1xuICAgICAgY2xpZW50WCwgY2xpZW50WVxuICAgIH0gPSBldmVudC50YXJnZXRUb3VjaGVzWzBdO1xuICAgIGxldCB7IGxlZnQsIHRvcCB9ID0gY2lyY2xlLnBhcmVudE5vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgb25kcmFnKHtcbiAgICAgIGNsaWVudFg6IGNsaWVudFggLSBsZWZ0LFxuICAgICAgY2xpZW50WTogY2xpZW50WSAtIHRvcFxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gb25Ub3VjaEVuZCgpIHtcbiAgICBjaXJjbGUuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZ2dpbmcnKTtcbiAgICBkcmFnZ2luZyA9IGZhbHNlO1xuICAgIG9uZHJhZ2VuZCgpO1xuICB9XG5cbiAgZWwuY2xhc3NOYW1lID0gYGNpcmNsZS1oYW5kbGUgJHtjbGFzc05hbWV9YDtcblxuICBlbC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCBvblRvdWNoTW92ZSk7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgb25Ub3VjaEVuZCk7XG5cbiAgY2lyY2xlLmFwcGVuZENoaWxkKGVsKTtcbiAgcmV0dXJuIGVsO1xufVxuIiwiXHJcbi8qKlxyXG4gKiBFeHBvc2UgYEVtaXR0ZXJgLlxyXG4gKi9cclxuXHJcbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykge1xyXG4gIG1vZHVsZS5leHBvcnRzID0gRW1pdHRlcjtcclxufVxyXG5cclxuLyoqXHJcbiAqIEluaXRpYWxpemUgYSBuZXcgYEVtaXR0ZXJgLlxyXG4gKlxyXG4gKiBAYXBpIHB1YmxpY1xyXG4gKi9cclxuXHJcbmZ1bmN0aW9uIEVtaXR0ZXIob2JqKSB7XHJcbiAgaWYgKG9iaikgcmV0dXJuIG1peGluKG9iaik7XHJcbn07XHJcblxyXG4vKipcclxuICogTWl4aW4gdGhlIGVtaXR0ZXIgcHJvcGVydGllcy5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9IG9ialxyXG4gKiBAcmV0dXJuIHtPYmplY3R9XHJcbiAqIEBhcGkgcHJpdmF0ZVxyXG4gKi9cclxuXHJcbmZ1bmN0aW9uIG1peGluKG9iaikge1xyXG4gIGZvciAodmFyIGtleSBpbiBFbWl0dGVyLnByb3RvdHlwZSkge1xyXG4gICAgb2JqW2tleV0gPSBFbWl0dGVyLnByb3RvdHlwZVtrZXldO1xyXG4gIH1cclxuICByZXR1cm4gb2JqO1xyXG59XHJcblxyXG4vKipcclxuICogTGlzdGVuIG9uIHRoZSBnaXZlbiBgZXZlbnRgIHdpdGggYGZuYC5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXHJcbiAqIEByZXR1cm4ge0VtaXR0ZXJ9XHJcbiAqIEBhcGkgcHVibGljXHJcbiAqL1xyXG5cclxuRW1pdHRlci5wcm90b3R5cGUub24gPVxyXG5FbWl0dGVyLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyID0gZnVuY3Rpb24oZXZlbnQsIGZuKXtcclxuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XHJcbiAgKHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF0gPSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdIHx8IFtdKVxyXG4gICAgLnB1c2goZm4pO1xyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgYW4gYGV2ZW50YCBsaXN0ZW5lciB0aGF0IHdpbGwgYmUgaW52b2tlZCBhIHNpbmdsZVxyXG4gKiB0aW1lIHRoZW4gYXV0b21hdGljYWxseSByZW1vdmVkLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cclxuICogQHJldHVybiB7RW1pdHRlcn1cclxuICogQGFwaSBwdWJsaWNcclxuICovXHJcblxyXG5FbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24oZXZlbnQsIGZuKXtcclxuICBmdW5jdGlvbiBvbigpIHtcclxuICAgIHRoaXMub2ZmKGV2ZW50LCBvbik7XHJcbiAgICBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gIH1cclxuXHJcbiAgb24uZm4gPSBmbjtcclxuICB0aGlzLm9uKGV2ZW50LCBvbik7XHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogUmVtb3ZlIHRoZSBnaXZlbiBjYWxsYmFjayBmb3IgYGV2ZW50YCBvciBhbGxcclxuICogcmVnaXN0ZXJlZCBjYWxsYmFja3MuXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxyXG4gKiBAcmV0dXJuIHtFbWl0dGVyfVxyXG4gKiBAYXBpIHB1YmxpY1xyXG4gKi9cclxuXHJcbkVtaXR0ZXIucHJvdG90eXBlLm9mZiA9XHJcbkVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID1cclxuRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID1cclxuRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uKGV2ZW50LCBmbil7XHJcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xyXG5cclxuICAvLyBhbGxcclxuICBpZiAoMCA9PSBhcmd1bWVudHMubGVuZ3RoKSB7XHJcbiAgICB0aGlzLl9jYWxsYmFja3MgPSB7fTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLy8gc3BlY2lmaWMgZXZlbnRcclxuICB2YXIgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XTtcclxuICBpZiAoIWNhbGxiYWNrcykgcmV0dXJuIHRoaXM7XHJcblxyXG4gIC8vIHJlbW92ZSBhbGwgaGFuZGxlcnNcclxuICBpZiAoMSA9PSBhcmd1bWVudHMubGVuZ3RoKSB7XHJcbiAgICBkZWxldGUgdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLy8gcmVtb3ZlIHNwZWNpZmljIGhhbmRsZXJcclxuICB2YXIgY2I7XHJcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyBpKyspIHtcclxuICAgIGNiID0gY2FsbGJhY2tzW2ldO1xyXG4gICAgaWYgKGNiID09PSBmbiB8fCBjYi5mbiA9PT0gZm4pIHtcclxuICAgICAgY2FsbGJhY2tzLnNwbGljZShpLCAxKTtcclxuICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBSZW1vdmUgZXZlbnQgc3BlY2lmaWMgYXJyYXlzIGZvciBldmVudCB0eXBlcyB0aGF0IG5vXHJcbiAgLy8gb25lIGlzIHN1YnNjcmliZWQgZm9yIHRvIGF2b2lkIG1lbW9yeSBsZWFrLlxyXG4gIGlmIChjYWxsYmFja3MubGVuZ3RoID09PSAwKSB7XHJcbiAgICBkZWxldGUgdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XTtcclxuICB9XHJcblxyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEVtaXQgYGV2ZW50YCB3aXRoIHRoZSBnaXZlbiBhcmdzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuICogQHBhcmFtIHtNaXhlZH0gLi4uXHJcbiAqIEByZXR1cm4ge0VtaXR0ZXJ9XHJcbiAqL1xyXG5cclxuRW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50KXtcclxuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XHJcblxyXG4gIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKVxyXG4gICAgLCBjYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xyXG5cclxuICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xyXG4gICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XHJcbiAgfVxyXG5cclxuICBpZiAoY2FsbGJhY2tzKSB7XHJcbiAgICBjYWxsYmFja3MgPSBjYWxsYmFja3Muc2xpY2UoMCk7XHJcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gY2FsbGJhY2tzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XHJcbiAgICAgIGNhbGxiYWNrc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiBhcnJheSBvZiBjYWxsYmFja3MgZm9yIGBldmVudGAuXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG4gKiBAcmV0dXJuIHtBcnJheX1cclxuICogQGFwaSBwdWJsaWNcclxuICovXHJcblxyXG5FbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbihldmVudCl7XHJcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xyXG4gIHJldHVybiB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdIHx8IFtdO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENoZWNrIGlmIHRoaXMgZW1pdHRlciBoYXMgYGV2ZW50YCBoYW5kbGVycy5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59XHJcbiAqIEBhcGkgcHVibGljXHJcbiAqL1xyXG5cclxuRW1pdHRlci5wcm90b3R5cGUuaGFzTGlzdGVuZXJzID0gZnVuY3Rpb24oZXZlbnQpe1xyXG4gIHJldHVybiAhISB0aGlzLmxpc3RlbmVycyhldmVudCkubGVuZ3RoO1xyXG59O1xyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL21hcC1jaXJjbGUtY29udHJvbCcpO1xuIl19
