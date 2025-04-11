var _mc = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // node_modules/component-emitter/index.js
  var require_component_emitter = __commonJS({
    "node_modules/component-emitter/index.js"(exports, module) {
      function Emitter(object) {
        if (object) {
          return mixin(object);
        }
        this._callbacks = /* @__PURE__ */ new Map();
      }
      function mixin(object) {
        Object.assign(object, Emitter.prototype);
        object._callbacks = /* @__PURE__ */ new Map();
        return object;
      }
      Emitter.prototype.on = function(event, listener) {
        const callbacks = this._callbacks.get(event) ?? [];
        callbacks.push(listener);
        this._callbacks.set(event, callbacks);
        return this;
      };
      Emitter.prototype.once = function(event, listener) {
        const on = (...arguments_) => {
          this.off(event, on);
          listener.apply(this, arguments_);
        };
        on.fn = listener;
        this.on(event, on);
        return this;
      };
      Emitter.prototype.off = function(event, listener) {
        if (event === void 0 && listener === void 0) {
          this._callbacks.clear();
          return this;
        }
        if (listener === void 0) {
          this._callbacks.delete(event);
          return this;
        }
        const callbacks = this._callbacks.get(event);
        if (callbacks) {
          for (const [index, callback] of callbacks.entries()) {
            if (callback === listener || callback.fn === listener) {
              callbacks.splice(index, 1);
              break;
            }
          }
          if (callbacks.length === 0) {
            this._callbacks.delete(event);
          } else {
            this._callbacks.set(event, callbacks);
          }
        }
        return this;
      };
      Emitter.prototype.emit = function(event, ...arguments_) {
        const callbacks = this._callbacks.get(event);
        if (callbacks) {
          const callbacksCopy = [...callbacks];
          for (const callback of callbacksCopy) {
            callback.apply(this, arguments_);
          }
        }
        return this;
      };
      Emitter.prototype.listeners = function(event) {
        return this._callbacks.get(event) ?? [];
      };
      Emitter.prototype.listenerCount = function(event) {
        if (event) {
          return this.listeners(event).length;
        }
        let totalCount = 0;
        for (const callbacks of this._callbacks.values()) {
          totalCount += callbacks.length;
        }
        return totalCount;
      };
      Emitter.prototype.hasListeners = function(event) {
        return this.listenerCount(event) > 0;
      };
      Emitter.prototype.addEventListener = Emitter.prototype.on;
      Emitter.prototype.removeListener = Emitter.prototype.off;
      Emitter.prototype.removeEventListener = Emitter.prototype.off;
      Emitter.prototype.removeAllListeners = Emitter.prototype.off;
      if (typeof module !== "undefined") {
        module.exports = Emitter;
      }
    }
  });

  // lib/map-circle-control.js
  var map_circle_control_exports = {};
  __export(map_circle_control_exports, {
    mapCircleControl: () => mapCircleControl
  });

  // lib/circle.js
  var import_component_emitter = __toESM(require_component_emitter(), 1);

  // lib/drag-handle.js
  function makeHandle(circle, { className, ondrag, ondragend }) {
    const el = document.createElement("div");
    el.className = `circle-handle ${className}`;
    el.draggable = true;
    el.addEventListener("dragstart", ondragstart);
    el.addEventListener("dragend", ondragendCommon);
    circle.appendChild(el);
    return el;
    function ondragstart({ dataTransfer }) {
      circle.parentNode.addEventListener("dragover", ondragCommon);
      dataTransfer.setData("text/plain", "");
      dataTransfer.effectAllowed = "move";
      dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
      circle.classList.add("dragging");
    }
    function ondragendCommon() {
      circle.classList.remove("dragging");
      circle.parentNode.removeEventListener("dragover", ondragCommon);
      ondragend();
    }
    function ondragCommon(event) {
      if (event.clientX === void 0 || event.clientY === void 0) {
        return;
      }
      event.preventDefault();
      const { dataTransfer, clientX, clientY, currentTarget } = event;
      dataTransfer.dropEffect = "move";
      const { left, top } = currentTarget.getBoundingClientRect();
      ondrag({
        clientX: clientX - left,
        clientY: clientY - top
      });
    }
  }

  // lib/touch-handle.js
  function makeHandle2(circle, { className, ondrag, ondragend }) {
    let dragging = false;
    const el = document.createElement("div");
    el.className = `circle-handle ${className}`;
    el.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    el.addEventListener("touchend", onTouchEnd);
    circle.appendChild(el);
    return el;
    function onTouchMove(event) {
      if (!dragging) {
        circle.classList.add("dragging");
        dragging = true;
      }
      event.preventDefault();
      const { clientX, clientY } = event.targetTouches[0];
      const { left, top } = circle.parentNode.getBoundingClientRect();
      ondrag({
        clientX: clientX - left,
        clientY: clientY - top
      });
    }
    function onTouchEnd() {
      circle.classList.remove("dragging");
      dragging = false;
      ondragend();
    }
  }

  // lib/circle.js
  function makeCircle({ container, radius = 100, center = [0, 0] } = {}) {
    let circle;
    const self = {
      addTo,
      remove
    };
    const state = {
      radius,
      center
    };
    (0, import_component_emitter.default)(self);
    Object.defineProperty(self, "center", { get: getCenter, set: setCenter });
    Object.defineProperty(self, "radius", { get: getRadius, set: setRadius });
    if (container) {
      addTo(container);
    }
    return self;
    function resizeHandle(handle, position) {
      const horizontal = position === "west" || position === "east";
      function ondrag({ clientX, clientY }) {
        const [x, y] = self.center;
        const radius2 = horizontal ? Math.abs(x - clientX) : Math.abs(y - clientY);
        self.radius = radius2;
      }
      function ondragend() {
        self.emit("radius-changed");
      }
      return handle(circle, { ondrag, ondragend, className: `circle-${position}` });
    }
    function centerHandle(handle) {
      function ondrag({ clientX, clientY }) {
        self.center = [clientX, clientY];
      }
      function ondragend() {
        self.emit("center-changed");
      }
      return handle(circle, { ondrag, ondragend, className: "circle-center" });
    }
    function render(container2) {
      circle = document.createElement("div");
      circle.className = "circle";
      const handle = window.matchMedia("(pointer:coarse)").matches ? makeHandle2 : makeHandle;
      centerHandle(handle);
      ["south", "north", "west", "east"].forEach((p) => resizeHandle(handle, p));
      container2.appendChild(circle);
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
    function setRadius(radius2) {
      state.radius = radius2;
      repaintCircle();
    }
    function getRadius() {
      return state.radius;
    }
    function setCenter(center2) {
      state.center = center2;
      repaintCircle();
    }
    function getCenter() {
      return state.center;
    }
    function addTo(container2) {
      render(container2);
      self.center = center;
      self.radius = radius;
      self.emit("center-changed");
      self.emit("radius-changed");
    }
    function remove() {
      circle.remove();
    }
  }

  // lib/distance.js
  function meters2pixels(meters, [x, y], { fromGeo, toGeo }) {
    const [lon, lat] = toGeo([x, y]);
    let lon1 = lon + meters / metersPerDegree(lat);
    if (lon1 > 180) {
      lon1 -= 360;
    }
    const [x1] = fromGeo([lon1, lat]);
    return Math.round(Math.abs(x1 - x));
  }
  function pixels2meters(pixels, [x, y], { toGeo }) {
    const x1 = x + pixels;
    const [lon, lat] = toGeo([x, y]);
    let [lon1] = toGeo([x1, y]);
    if (lon1 < lon) {
      lon1 += 360;
    }
    return Math.round((lon1 - lon) * metersPerDegree(lat));
  }
  var R = 6371e3;
  var EQUATOR_DEGREE_LEN = Math.PI * R / 180;
  function metersPerDegree(lat) {
    return EQUATOR_DEGREE_LEN * Math.cos(lat * Math.PI / 180);
  }

  // lib/map-circle-control.js
  function mapCircleControl({ center, radius } = {}) {
    let map;
    const self = makeCircle({ center, radius });
    Object.defineProperty(self, "geoCenter", { get: getGeoCenter, set: setGeoCenter });
    Object.defineProperty(self, "geoRadius", { get: getGeoRadius, set: setGeoRadius });
    return Object.assign(self, {
      onadd,
      onremove
    });
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
      const { lng, lat } = map.unproject(xy);
      return [lng, lat];
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
  }
  return __toCommonJS(map_circle_control_exports);
})();
