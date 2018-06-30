var makeCircle = require('../');

describe('map-circle-control', function () {
  before(function() {
    document.body.innerHTML = '<div class="container"></div>';
  });

  it('create DOM nodes', function () {
    const map = {
      getContainer:  () => document.querySelector('.container')
    };

    let circle = makeCircle();
    circle.add(map);
    circle.center = [ 250, 200 ];
    circle.radius = 175;


    let c = document.querySelector('.container .circle');

    c.childNodes.should.have.length(5);
    c.should.have.property('style');
    c.style.should.have.property('left', '250px');
    c.style.should.have.property('top', '200px');
  });
});
