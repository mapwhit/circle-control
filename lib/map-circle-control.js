module.exports = mapCircleControl;


function handle(circle, { className, ondrag }) {
  let el = document.createElement('div');

  function ondragstart({ dataTransfer }) {
    circle.parentNode.addEventListener('dragover', ondragCommon);
    dataTransfer.setData("text/plain", "");
    dataTransfer.effectAllowed = 'none';
    dataTransfer.dropEffect = 'none';
    dataTransfer.setDragImage(el, 0, 0);
    circle.classList.add('dragging');
  }

  function ondragend() {
    circle.classList.remove('dragging');
    circle.parentNode.removeEventListener('dragover', ondragCommon);
  }

  function ondragCommon(event) {
    if (!event.clientX && !event.clientY) {
      // console.log('Invalid drag event!');
      return;
    }
    ondrag(event);
  }

  el.className = `circle-handle ${className}`;
  el.draggable = true;

  // cannot use 'drag' event because Firefox bug - see: https://bugzilla.mozilla.org/show_bug.cgi?id=505521
  // el.addEventListener('drag', ondrag);
  el.addEventListener('dragstart', ondragstart);
  el.addEventListener('dragend', ondragend);

  circle.appendChild(el);
  return el;

}

function mapCircleControl() {
  let circle;
  let map;

  let self = {
    add,
    remove
  };

  function resizeHandle(position) {
    let horizontal = position === 'west' || position === 'east';

    function ondrag({ clientX, clientY }) {
      let [ x, y ] = self.center;
      let radius = horizontal ? Math.abs(x - clientX) : Math.abs(y - clientY);
      self.radius = radius;
    }

    return handle(circle, { ondrag, className: `circle-${position}` });
  }

  function centerHandle() {
    function ondrag({ clientX, clientY }) {
      self.center = [clientX, clientY];
    }

    return handle(circle, { ondrag, className: 'circle-center' });
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

  function setRadius(radius) {
    let size = `${radius * 2}px`;
    circle.style.width = size;
    circle.style.height = size;
  }

  function getRadius() {
    return parseFloat(circle.style.width);
  }

  function setCenter([left, top]) {
    circle.style.left = `${left}px`;
    circle.style.top = `${top}px`;
  }

  function getCenter() {
    return [
      parseFloat(circle.style.left),
      parseFloat(circle.style.top)
    ];
  }

  function add(_map) {
    map = _map;
    render(map.getContainer());
  }

  function remove() {
    circle.remove();
  }

  Object.defineProperty(self, 'center', { get: getCenter, set: setCenter });
  Object.defineProperty(self, 'radius', { get: getRadius, set: setRadius });

  return self;
}
