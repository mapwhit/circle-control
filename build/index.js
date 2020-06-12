require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const emitter = require('component-emitter');

module.exports = makeCircle;

const setDragImageSupported = window.DataTransfer && 'setDragImage' in window.DataTransfer.prototype;

function handle(circle, { className, ondrag, ondragend }) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvY2lyY2xlLmpzIiwibGliL2Rpc3RhbmNlLmpzIiwibGliL21hcC1jaXJjbGUtY29udHJvbC5qcyIsIm5vZGVfbW9kdWxlcy9jb21wb25lbnQtZW1pdHRlci9pbmRleC5qcyIsImluZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuS0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsImNvbnN0IGVtaXR0ZXIgPSByZXF1aXJlKCdjb21wb25lbnQtZW1pdHRlcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG1ha2VDaXJjbGU7XG5cbmNvbnN0IHNldERyYWdJbWFnZVN1cHBvcnRlZCA9IHdpbmRvdy5EYXRhVHJhbnNmZXIgJiYgJ3NldERyYWdJbWFnZScgaW4gd2luZG93LkRhdGFUcmFuc2Zlci5wcm90b3R5cGU7XG5cbmZ1bmN0aW9uIGhhbmRsZShjaXJjbGUsIHsgY2xhc3NOYW1lLCBvbmRyYWcsIG9uZHJhZ2VuZCB9KSB7XG4gIGxldCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gIGZ1bmN0aW9uIG9uZHJhZ3N0YXJ0KHsgZGF0YVRyYW5zZmVyIH0pIHtcbiAgICBjaXJjbGUucGFyZW50Tm9kZS5hZGRFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIG9uZHJhZ0NvbW1vbik7XG4gICAgZGF0YVRyYW5zZmVyLnNldERhdGEoXCJ0ZXh0L3BsYWluXCIsIFwiXCIpO1xuICAgIGRhdGFUcmFuc2Zlci5lZmZlY3RBbGxvd2VkID0gJ21vdmUnO1xuICAgIGlmIChzZXREcmFnSW1hZ2VTdXBwb3J0ZWQpIHtcbiAgICAgIC8vIG5vdCBhbGwgYnJvd3NlcnMgc3VwcG9ydCBzZXREcmFnSW1hZ2VcbiAgICAgIGRhdGFUcmFuc2Zlci5zZXREcmFnSW1hZ2UoZWwsIGVsLm9mZnNldFdpZHRoIC8gMiwgZWwub2Zmc2V0SGVpZ2h0IC8gMik7XG4gICAgfVxuICAgIGNpcmNsZS5jbGFzc0xpc3QuYWRkKCdkcmFnZ2luZycpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25kcmFnZW5kQ29tbW9uKCkge1xuICAgIGNpcmNsZS5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnZ2luZycpO1xuICAgIGNpcmNsZS5wYXJlbnROb2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVyJywgb25kcmFnQ29tbW9uKTtcbiAgICBvbmRyYWdlbmQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uZHJhZ0NvbW1vbihldmVudCkge1xuICAgIGlmIChldmVudC5jbGllbnRYID09PSB1bmRlZmluZWQgfHwgZXZlbnQuY2xpZW50WSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZygnSW52YWxpZCBkcmFnIGV2ZW50IScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBhY2NlcHQgZHJvcFxuICAgIGxldCB7XG4gICAgICBkYXRhVHJhbnNmZXIsXG4gICAgICBjbGllbnRYLCBjbGllbnRZLFxuICAgICAgY3VycmVudFRhcmdldFxuICAgIH0gPSBldmVudDtcbiAgICBkYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdtb3ZlJztcbiAgICBsZXQgeyBsZWZ0LCB0b3AgfSA9IGN1cnJlbnRUYXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgb25kcmFnKHtcbiAgICAgIGNsaWVudFg6IGNsaWVudFggLSBsZWZ0LFxuICAgICAgY2xpZW50WTogY2xpZW50WSAtIHRvcFxuICAgIH0pO1xuICB9XG5cbiAgZWwuY2xhc3NOYW1lID0gYGNpcmNsZS1oYW5kbGUgJHtjbGFzc05hbWV9YDtcbiAgZWwuZHJhZ2dhYmxlID0gdHJ1ZTtcblxuICAvLyBjYW5ub3QgdXNlICdkcmFnJyBldmVudCBiZWNhdXNlIEZpcmVmb3ggYnVnIC0gc2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD01MDU1MjFcbiAgLy8gZWwuYWRkRXZlbnRMaXN0ZW5lcignZHJhZycsIG9uZHJhZyk7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdzdGFydCcsIG9uZHJhZ3N0YXJ0KTtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIG9uZHJhZ2VuZENvbW1vbik7XG5cbiAgY2lyY2xlLmFwcGVuZENoaWxkKGVsKTtcbiAgcmV0dXJuIGVsO1xuXG59XG5cbmZ1bmN0aW9uIG1ha2VDaXJjbGUoe1xuICBjb250YWluZXIsXG4gIHJhZGl1cyA9IDEwMCxcbiAgY2VudGVyID0gWyAwLCAwIF1cbn0gPSB7fSkge1xuICBsZXQgY2lyY2xlO1xuICBsZXQgc2VsZiA9IHtcbiAgICBhZGRUbyxcbiAgICByZW1vdmVcbiAgfTtcbiAgbGV0IHN0YXRlID0ge1xuICAgIHJhZGl1cyxcbiAgICBjZW50ZXJcbiAgfTtcbiAgZW1pdHRlcihzZWxmKTtcblxuICBmdW5jdGlvbiByZXNpemVIYW5kbGUocG9zaXRpb24pIHtcbiAgICBsZXQgaG9yaXpvbnRhbCA9IHBvc2l0aW9uID09PSAnd2VzdCcgfHwgcG9zaXRpb24gPT09ICdlYXN0JztcblxuICAgIGZ1bmN0aW9uIG9uZHJhZyh7IGNsaWVudFgsIGNsaWVudFkgfSkge1xuICAgICAgbGV0IFsgeCwgeSBdID0gc2VsZi5jZW50ZXI7XG4gICAgICBsZXQgcmFkaXVzID0gaG9yaXpvbnRhbCA/IE1hdGguYWJzKHggLSBjbGllbnRYKSA6IE1hdGguYWJzKHkgLSBjbGllbnRZKTtcbiAgICAgIHNlbGYucmFkaXVzID0gcmFkaXVzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uZHJhZ2VuZCgpIHtcbiAgICAgIHNlbGYuZW1pdCgncmFkaXVzLWNoYW5nZWQnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFuZGxlKGNpcmNsZSwgeyBvbmRyYWcsIG9uZHJhZ2VuZCwgY2xhc3NOYW1lOiBgY2lyY2xlLSR7cG9zaXRpb259YCB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNlbnRlckhhbmRsZSgpIHtcbiAgICBmdW5jdGlvbiBvbmRyYWcoeyBjbGllbnRYLCBjbGllbnRZIH0pIHtcbiAgICAgIHNlbGYuY2VudGVyID0gWyBjbGllbnRYLCBjbGllbnRZIF07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25kcmFnZW5kKCkge1xuICAgICAgc2VsZi5lbWl0KCdjZW50ZXItY2hhbmdlZCcpO1xuICAgIH1cblxuICAgIHJldHVybiBoYW5kbGUoY2lyY2xlLCB7IG9uZHJhZywgb25kcmFnZW5kLCBjbGFzc05hbWU6ICdjaXJjbGUtY2VudGVyJyB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlcihjb250YWluZXIpIHtcbiAgICBjaXJjbGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjaXJjbGUuY2xhc3NOYW1lID0gJ2NpcmNsZSc7XG4gICAgY2VudGVySGFuZGxlKCk7XG4gICAgW1xuICAgICAgJ3NvdXRoJyxcbiAgICAgICdub3J0aCcsXG4gICAgICAnd2VzdCcsXG4gICAgICAnZWFzdCdcbiAgICBdLmZvckVhY2gocmVzaXplSGFuZGxlKTtcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoY2lyY2xlKTtcbiAgICByZXR1cm4gY2lyY2xlO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVwYWludENpcmNsZSgpIHtcbiAgICBsZXQgc2l6ZSA9IGAke3N0YXRlLnJhZGl1cyAqIDJ9cHhgO1xuICAgIGNpcmNsZS5zdHlsZS53aWR0aCA9IHNpemU7XG4gICAgY2lyY2xlLnN0eWxlLmhlaWdodCA9IHNpemU7XG5cbiAgICBsZXQgWyBsZWZ0LCB0b3AgXSA9IHN0YXRlLmNlbnRlcjtcbiAgICBjaXJjbGUuc3R5bGUubGVmdCA9IGAke2xlZnR9cHhgO1xuICAgIGNpcmNsZS5zdHlsZS50b3AgPSBgJHt0b3B9cHhgO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0UmFkaXVzKHJhZGl1cykge1xuICAgIHN0YXRlLnJhZGl1cyA9IHJhZGl1cztcbiAgICByZXBhaW50Q2lyY2xlKCk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRSYWRpdXMoKSB7XG4gICAgcmV0dXJuIHN0YXRlLnJhZGl1cztcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldENlbnRlcihjZW50ZXIpIHtcbiAgICBzdGF0ZS5jZW50ZXIgPSBjZW50ZXI7XG4gICAgcmVwYWludENpcmNsZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0Q2VudGVyKCkge1xuICAgIHJldHVybiBzdGF0ZS5jZW50ZXI7XG4gIH1cblxuICBmdW5jdGlvbiBhZGRUbyhjb250YWluZXIpIHtcbiAgICByZW5kZXIoY29udGFpbmVyKTtcbiAgICBzZWxmLmNlbnRlciA9IGNlbnRlcjtcbiAgICBzZWxmLnJhZGl1cyA9IHJhZGl1cztcbiAgICBzZWxmLmVtaXQoJ2NlbnRlci1jaGFuZ2VkJyk7XG4gICAgc2VsZi5lbWl0KCdyYWRpdXMtY2hhbmdlZCcpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlKCkge1xuICAgIGNpcmNsZS5yZW1vdmUoKTtcbiAgfVxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzZWxmLCAnY2VudGVyJywgeyBnZXQ6IGdldENlbnRlciwgc2V0OiBzZXRDZW50ZXIgfSk7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzZWxmLCAncmFkaXVzJywgeyBnZXQ6IGdldFJhZGl1cywgc2V0OiBzZXRSYWRpdXMgfSk7XG5cbiAgaWYgKGNvbnRhaW5lcikge1xuICAgIGFkZFRvKGNvbnRhaW5lcik7XG4gIH1cblxuICByZXR1cm4gc2VsZjtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRlcnMycGl4ZWxzLFxuICBwaXhlbHMybWV0ZXJzXG59O1xuXG5mdW5jdGlvbiBtZXRlcnMycGl4ZWxzKG1ldGVycywgWyB4LCB5IF0sIHsgZnJvbUdlbywgdG9HZW8gfSkge1xuICBsZXQgWyBsb24sIGxhdCBdID0gdG9HZW8oWyB4LCB5IF0pO1xuICBsZXQgbG9uMSA9IGxvbiArIG1ldGVycyAvIG1ldGVyc1BlckRlZ3JlZShsYXQpO1xuICBpZiAobG9uMSA+IDE4MCkge1xuICAgIGxvbjEgLT0gMzYwO1xuICB9XG4gIGxldCBbIHgxIF0gPSBmcm9tR2VvKFsgbG9uMSwgbGF0IF0pO1xuICByZXR1cm4gTWF0aC5yb3VuZChNYXRoLmFicyh4MSAtIHgpKTtcbn1cblxuXG5mdW5jdGlvbiBwaXhlbHMybWV0ZXJzKHBpeGVscywgWyB4LCB5IF0sIHsgdG9HZW8gfSkge1xuICBsZXQgeDEgPSB4ICsgcGl4ZWxzO1xuICBsZXQgWyBsb24sIGxhdCBdID0gdG9HZW8oWyB4LCB5IF0pO1xuICBsZXQgWyBsb24xIF0gPSB0b0dlbyhbIHgxLCB5IF0pO1xuICBpZiAobG9uMSA8IGxvbikge1xuICAgIGxvbjEgKz0gMzYwO1xuICB9XG4gIHJldHVybiBNYXRoLnJvdW5kKChsb24xIC0gbG9uKSAqIG1ldGVyc1BlckRlZ3JlZShsYXQpKTtcbn1cblxuY29uc3QgUiA9IDYzNzEwMDA7IC8vIH4gRWFyaCByYWRpdXMgaW4gbWV0ZXJzXG5jb25zdCBFUVVBVE9SX0RFR1JFRV9MRU4gPSBNYXRoLlBJICogUiAvIDE4MDtcblxuLy8gbGVuIG9mIGEgZGVncmVlIGF0IGxhdCA9PT0gbGVuIG9mIGRlZ3JlZSBhdCBlcXVhdG9yIG11bHRpcGxpZWQgYnkgY29zKGxhdClcbmZ1bmN0aW9uIG1ldGVyc1BlckRlZ3JlZShsYXQpIHtcbiAgcmV0dXJuIEVRVUFUT1JfREVHUkVFX0xFTiAqIE1hdGguY29zKGxhdCAqIE1hdGguUEkgLyAxODApO1xufVxuIiwiY29uc3QgbWFrZUNpcmNsZSA9IHJlcXVpcmUoJy4vY2lyY2xlJyk7XG5jb25zdCB7IG1ldGVyczJwaXhlbHMsIHBpeGVsczJtZXRlcnMgfSA9IHJlcXVpcmUoJy4vZGlzdGFuY2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBtYXBDaXJjbGVDb250cm9sO1xuXG5cbi8qXG4gKiBtYXAgb2JqZWN0IG5lZWRzIHRvIGhhdmUgdGhlIGZvbGxvd2luZyBtZXRob2RzXG4gKiAgZ2V0Q29udGFpbmVyKCkgLSByZXR1cm5zIGNvbnRhaW5lciBkaXYgaW4gd2hpY2ggbWFwIGlzIGVtYmVkZGVkIC0gdXNlZCB0byBhZGQgY2lyY2xlIGRpdlxuICogIHByb2plY3QobGwpIC0gcmV0dXJuIFt4LCB5XSBsb2NhdGlvbiBpbiBzY3JlZW4gY29vcmRpbmF0ZXMgLSBjb3JyZXNwb25kaW5nIHRvIGdlbyBbbGF0LCBsb25dXG4gKiAgdW5wcm9qZWN0KHh5KSAtIHJldHVybnMgZ2VvIGNvb3JkaW5hdGVzIGNvcnJlc3BvbmRpbmcgdG8gc2NyZWVuIGxvY2F0aW9uIFt4LCB5XVxuICovXG5cbi8qXG4gKiBsb2NhdGlvbiAtIFtsb24sIGxhdF1cbiAqIHJhZGl1cyAtIGluIG1ldGVyc1xuICovXG5mdW5jdGlvbiBtYXBDaXJjbGVDb250cm9sKHsgY2VudGVyLCByYWRpdXMgfSA9IHt9KSB7XG4gIGxldCBzZWxmID0gbWFrZUNpcmNsZSh7IGNlbnRlciwgcmFkaXVzLCB9KTtcbiAgbGV0IG1hcDtcblxuICBmdW5jdGlvbiBvbmFkZChfbWFwKSB7XG4gICAgbWFwID0gX21hcDtcbiAgICBzZWxmLmFkZFRvKG1hcC5nZXRDb250YWluZXIoKSk7XG4gIH1cblxuICBmdW5jdGlvbiBvbnJlbW92ZSgpIHtcbiAgICBzZWxmLnJlbW92ZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gZnJvbUdlbyhsbCkge1xuICAgIHJldHVybiBtYXAucHJvamVjdChsbCk7XG4gIH1cblxuICBmdW5jdGlvbiB0b0dlbyh4eSkge1xuICAgIGxldCB7IGxuZywgbGF0IH0gPSBtYXAudW5wcm9qZWN0KHh5KTtcbiAgICByZXR1cm4gWyBsbmcsIGxhdF07XG4gIH1cblxuICBmdW5jdGlvbiBnZXRHZW9DZW50ZXIoKSB7XG4gICAgcmV0dXJuIHRvR2VvKHNlbGYuY2VudGVyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldEdlb0NlbnRlcihsbCkge1xuICAgIHNlbGYuY2VudGVyID0gZnJvbUdlbyhsbCk7XG4gIH1cblxuICBmdW5jdGlvbiBzZXRHZW9SYWRpdXMobWV0ZXJzKSB7XG4gICAgc2VsZi5yYWRpdXMgPSBtZXRlcnMycGl4ZWxzKG1ldGVycywgc2VsZi5jZW50ZXIsIHsgZnJvbUdlbywgdG9HZW8gfSk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRHZW9SYWRpdXMoKSB7XG4gICAgcmV0dXJuIHBpeGVsczJtZXRlcnMoc2VsZi5yYWRpdXMsIHNlbGYuY2VudGVyLCB7IGZyb21HZW8sIHRvR2VvIH0pO1xuICB9XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNlbGYsICdnZW9DZW50ZXInLCB7IGdldDogZ2V0R2VvQ2VudGVyLCBzZXQ6IHNldEdlb0NlbnRlciB9KTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNlbGYsICdnZW9SYWRpdXMnLCB7IGdldDogZ2V0R2VvUmFkaXVzLCBzZXQ6IHNldEdlb1JhZGl1cyB9KTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbihzZWxmLCB7XG4gICAgb25hZGQsXG4gICAgb25yZW1vdmVcbiAgfSk7XG59XG4iLCJcclxuLyoqXHJcbiAqIEV4cG9zZSBgRW1pdHRlcmAuXHJcbiAqL1xyXG5cclxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgbW9kdWxlLmV4cG9ydHMgPSBFbWl0dGVyO1xyXG59XHJcblxyXG4vKipcclxuICogSW5pdGlhbGl6ZSBhIG5ldyBgRW1pdHRlcmAuXHJcbiAqXHJcbiAqIEBhcGkgcHVibGljXHJcbiAqL1xyXG5cclxuZnVuY3Rpb24gRW1pdHRlcihvYmopIHtcclxuICBpZiAob2JqKSByZXR1cm4gbWl4aW4ob2JqKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBNaXhpbiB0aGUgZW1pdHRlciBwcm9wZXJ0aWVzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXHJcbiAqIEByZXR1cm4ge09iamVjdH1cclxuICogQGFwaSBwcml2YXRlXHJcbiAqL1xyXG5cclxuZnVuY3Rpb24gbWl4aW4ob2JqKSB7XHJcbiAgZm9yICh2YXIga2V5IGluIEVtaXR0ZXIucHJvdG90eXBlKSB7XHJcbiAgICBvYmpba2V5XSA9IEVtaXR0ZXIucHJvdG90eXBlW2tleV07XHJcbiAgfVxyXG4gIHJldHVybiBvYmo7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBMaXN0ZW4gb24gdGhlIGdpdmVuIGBldmVudGAgd2l0aCBgZm5gLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cclxuICogQHJldHVybiB7RW1pdHRlcn1cclxuICogQGFwaSBwdWJsaWNcclxuICovXHJcblxyXG5FbWl0dGVyLnByb3RvdHlwZS5vbiA9XHJcbkVtaXR0ZXIucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbihldmVudCwgZm4pe1xyXG4gIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcclxuICAodGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XSA9IHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF0gfHwgW10pXHJcbiAgICAucHVzaChmbik7XHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogQWRkcyBhbiBgZXZlbnRgIGxpc3RlbmVyIHRoYXQgd2lsbCBiZSBpbnZva2VkIGEgc2luZ2xlXHJcbiAqIHRpbWUgdGhlbiBhdXRvbWF0aWNhbGx5IHJlbW92ZWQuXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxyXG4gKiBAcmV0dXJuIHtFbWl0dGVyfVxyXG4gKiBAYXBpIHB1YmxpY1xyXG4gKi9cclxuXHJcbkVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbihldmVudCwgZm4pe1xyXG4gIGZ1bmN0aW9uIG9uKCkge1xyXG4gICAgdGhpcy5vZmYoZXZlbnQsIG9uKTtcclxuICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgfVxyXG5cclxuICBvbi5mbiA9IGZuO1xyXG4gIHRoaXMub24oZXZlbnQsIG9uKTtcclxuICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZW1vdmUgdGhlIGdpdmVuIGNhbGxiYWNrIGZvciBgZXZlbnRgIG9yIGFsbFxyXG4gKiByZWdpc3RlcmVkIGNhbGxiYWNrcy5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXHJcbiAqIEByZXR1cm4ge0VtaXR0ZXJ9XHJcbiAqIEBhcGkgcHVibGljXHJcbiAqL1xyXG5cclxuRW1pdHRlci5wcm90b3R5cGUub2ZmID1cclxuRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPVxyXG5FbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPVxyXG5FbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyID0gZnVuY3Rpb24oZXZlbnQsIGZuKXtcclxuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XHJcblxyXG4gIC8vIGFsbFxyXG4gIGlmICgwID09IGFyZ3VtZW50cy5sZW5ndGgpIHtcclxuICAgIHRoaXMuX2NhbGxiYWNrcyA9IHt9O1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvLyBzcGVjaWZpYyBldmVudFxyXG4gIHZhciBjYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xyXG4gIGlmICghY2FsbGJhY2tzKSByZXR1cm4gdGhpcztcclxuXHJcbiAgLy8gcmVtb3ZlIGFsbCBoYW5kbGVyc1xyXG4gIGlmICgxID09IGFyZ3VtZW50cy5sZW5ndGgpIHtcclxuICAgIGRlbGV0ZSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvLyByZW1vdmUgc3BlY2lmaWMgaGFuZGxlclxyXG4gIHZhciBjYjtcclxuICBmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7IGkrKykge1xyXG4gICAgY2IgPSBjYWxsYmFja3NbaV07XHJcbiAgICBpZiAoY2IgPT09IGZuIHx8IGNiLmZuID09PSBmbikge1xyXG4gICAgICBjYWxsYmFja3Muc3BsaWNlKGksIDEpO1xyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogRW1pdCBgZXZlbnRgIHdpdGggdGhlIGdpdmVuIGFyZ3MuXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG4gKiBAcGFyYW0ge01peGVkfSAuLi5cclxuICogQHJldHVybiB7RW1pdHRlcn1cclxuICovXHJcblxyXG5FbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24oZXZlbnQpe1xyXG4gIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcclxuICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKVxyXG4gICAgLCBjYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xyXG5cclxuICBpZiAoY2FsbGJhY2tzKSB7XHJcbiAgICBjYWxsYmFja3MgPSBjYWxsYmFja3Muc2xpY2UoMCk7XHJcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gY2FsbGJhY2tzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XHJcbiAgICAgIGNhbGxiYWNrc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiBhcnJheSBvZiBjYWxsYmFja3MgZm9yIGBldmVudGAuXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG4gKiBAcmV0dXJuIHtBcnJheX1cclxuICogQGFwaSBwdWJsaWNcclxuICovXHJcblxyXG5FbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbihldmVudCl7XHJcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xyXG4gIHJldHVybiB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdIHx8IFtdO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENoZWNrIGlmIHRoaXMgZW1pdHRlciBoYXMgYGV2ZW50YCBoYW5kbGVycy5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59XHJcbiAqIEBhcGkgcHVibGljXHJcbiAqL1xyXG5cclxuRW1pdHRlci5wcm90b3R5cGUuaGFzTGlzdGVuZXJzID0gZnVuY3Rpb24oZXZlbnQpe1xyXG4gIHJldHVybiAhISB0aGlzLmxpc3RlbmVycyhldmVudCkubGVuZ3RoO1xyXG59O1xyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL21hcC1jaXJjbGUtY29udHJvbCcpO1xuIl19
