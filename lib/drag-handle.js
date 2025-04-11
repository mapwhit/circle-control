export default function makeHandle(circle, { className, ondrag, ondragend }) {
  const el = document.createElement('div');
  el.className = `circle-handle ${className}`;
  el.draggable = true;
  // cannot use 'drag' event because Firefox bug - see: https://bugzilla.mozilla.org/show_bug.cgi?id=505521
  // el.addEventListener('drag', ondrag);
  el.addEventListener('dragstart', ondragstart);
  el.addEventListener('dragend', ondragendCommon);
  circle.appendChild(el);
  return el;

  function ondragstart({ dataTransfer }) {
    circle.parentNode.addEventListener('dragover', ondragCommon);
    dataTransfer.setData('text/plain', '');
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
    if (event.clientX === undefined || event.clientY === undefined) {
      // console.log('Invalid drag event!');
      return;
    }
    event.preventDefault(); // accept drop
    const { dataTransfer, clientX, clientY, currentTarget } = event;
    dataTransfer.dropEffect = 'move';
    const { left, top } = currentTarget.getBoundingClientRect();
    ondrag({
      clientX: clientX - left,
      clientY: clientY - top
    });
  }
}
