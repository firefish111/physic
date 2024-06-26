/**
 * @property {string} style style object
 * @property {Array<any>} store argstore
 * @property {Array<Array<Number>>} ps list of points
 * 
 * @method setpath Function to define path of shape being traced
 * @method capout Jank max function
 */
class Shape {
  constructor(fill, ...args) {
    this.style = fill;
    this.style.movable ??= true;
    this.path = new Path2D();

    // tomfoolery
    //this.style.strokeWidth = 1e-308;

    this.velocity = [0, 0];

    // arguments to setpath function are stored as an array, then called every tick
    // this means that if a shape is a vararg (like a polygon) it will still work
    // and that constructor typesig doesn't have to be changed with each shape, only setpath

    // points are specifically stored in this.ps, other args go in this.store
    // by convention, points are always first in arglist, so this naive method works
    this.PCOUNT = args.findLastIndex(k => (k instanceof Array)) + 1;

    this.ps = args.slice(0, this.PCOUNT);
    this.store = args.slice(this.PCOUNT); // argstore

    this.setpath(...this.ps, ...this.store);

    this.ROTATIONAL_SCALE = 80;
    
    this.isBouncing = null;
    this.bouncingFor = 0;

    // infinite (positive or negative) are means zero bounciness
    this.area = -Infinity;
  }

  capout(p, val, lim) {
    let should = p + val;
    return Math.max(should - lim, 0);
  }

  setpath() {}

  rotate() {}
  roll() {}

  bounce(...a) {
    this.bouncingFor++;
    if (!this.isBouncing) return;

    this.velocity[1] = -Math.abs(this.velocity[1] / (this.area ** .07));
    if (Math.abs(this.velocity[1]) < 1) this.isBouncing = false;
  }
}

class Rectangle extends Shape {
  setpath(p1, p2) {
    this.path.rect(...p1, p2[0] - p1[0], p2[1] - p1[1]);
    this.area = (p2[0] - p1[0]) * (p2[1] - p1[1]);
  }

  translate(x, y, limx, limy) {
    let capx = x - Math.max(
      this.capout(this.ps[0][0], x, limx),
      this.capout(this.ps[1][0], x, limx)
    );
    let capy = y - Math.max(
      this.capout(this.ps[0][1], y, limy),
      this.capout(this.ps[1][1], y, limy)
    );

    this.ps[0][0] = Math.min(this.ps[0][0] + capx, limx);
    this.ps[0][1] = Math.min(this.ps[0][1] + capy, limy);
    this.ps[1][0] = Math.min(this.ps[1][0] + capx, limx);
    this.ps[1][1] = Math.min(this.ps[1][1] + capy, limy);
  }

  bottom_point() {
    return [
      Math.max(this.ps[0][0], this.ps[1][0]) + this.style.strokeWidth / 2,
      Math.max(this.ps[0][1], this.ps[1][1]) + this.style.strokeWidth / 2
    ];
  }

  rotate() { 
    // nothing
    // rotation of a rectangle is difficult, because of it becomes not parallel to the floor, it is no longer a rectangle, and it becomes a polygon instead
    // i don't feel like making shapes that mutate
  }
}

// 1px wide black border, to see ground
class CanvasBorder extends Rectangle {
  setpath(canv) {
    this.path.rect(0, 0, canv.width, canv.height);
  }

  bottom_point() {
    // shouldn't ever get here
    return [0, 0];
  }
}

class Line extends Shape {
  setpath(p1, p2) {
    this.path.moveTo(...p1);
    this.path.lineTo(...p2);
    this.lowest = +(p1[1] < p2[1]); // 1 if y1 lower down (more than) y2, else 0

    // area is -Inf (can't be 0 as that ends in Inf, dividing by -Inf results in -0)
  }

  translate(x, y, limx, limy) {
    let capx = x - Math.max(
      this.capout(this.ps[0][0], x, limx),
      this.capout(this.ps[1][0], x, limx)
    );
    let capy = y - Math.max(
      this.capout(this.ps[0][1], y, limy),
      this.capout(this.ps[1][1], y, limy)
    );

    let min_fall = (a, b) => a < b ? a : (this.fall_by_rotate(9.81) || b)
    this.ps[0][0] = min_fall(this.ps[0][0] + capx, limx);
    this.ps[0][1] = min_fall(this.ps[0][1] + capy, limy);
    this.ps[1][0] = min_fall(this.ps[1][0] + capx, limx);
    this.ps[1][1] = min_fall(this.ps[1][1] + capy, limy);
  }

  bottom_point() {
    return [
      Math.max(this.ps[0][0], this.ps[1][0]) + this.style.strokeWidth / 2,
      Math.max(this.ps[0][1], this.ps[1][1]) + this.style.strokeWidth / 2
    ];
  }

  rotate(theta, which = 0) {
    // x' = xcos(theta) - ysin(theta)
    // y' = xsin(theta) + ycos(theta)
    
    // which is pointnum, 0 is x1-x0, 1 is x0-x1
    let Dx = this.ps[1][0] - this.ps[0][0];
    let Dy = this.ps[1][1] - this.ps[0][1]; // originified towards top-left

    if (which) {
      this.ps[0][0] = this.ps[1][0] - Dx * Math.cos(theta) + Dy * Math.sin(theta);
      this.ps[0][1] = this.ps[1][1] - Dx * Math.sin(theta) - Dy * Math.cos(theta);
    } else {
      this.ps[1][0] = this.ps[0][0] + Dx * Math.cos(theta) - Dy * Math.sin(theta);
      this.ps[1][1] = this.ps[0][1] + Dx * Math.sin(theta) + Dy * Math.cos(theta);
    }
  }

  fall_by_rotate(g) {
    // get most southernly point
    let which = +(this.ps[0][1] < this.ps[1][1]); // to compare against the point that we have been falling already, to prevent cartwheeling
    if (which != this.lowest) return;

    let Dx = Math.abs(this.ps[1][0] - this.ps[0][0]); // width
    let Dy = Math.abs(this.ps[1][1] - this.ps[0][1]); // height
    //let len = Math.sqrt(Dx**2 + Dy**2)
    let angle = Math.atan(Dy/Dx);
    //angle = Math.max(Math.min(angle, Math.PI*.5), 0);
    //if (!angle) return;

    let torque = Math.min((Math.PI - angle)**(2)/this.ROTATIONAL_SCALE, angle); 
    if (
      (this.ps[0][0] < this.ps[1][0] && this.ps[0][1] < this.ps[1][1]) ||
      (this.ps[0][0] > this.ps[1][0] && this.ps[0][1] > this.ps[1][1])
    ) torque *= -1; // check if needing to rotate anticlockwise instead, if p1 is either nw or se of p0

    this.rotate(torque, this.lowest);
  }
}

// arc can be applied to much the same stuff as the line
class Arc extends Line {
  setpath(p, r, start, angle) {
    this.path.arc(p[0], p[1], r, start, start + angle /* in radians */, angle < 0);
    this.area = Math.PI * (r**2);
  }

  translate(x, y, limx, limy) {
    let capx = x - this.capout(this.ps[0][0] + this.store[0], x, limx);
    let capy = y - this.capout(this.ps[0][1] + this.store[0], y, limy);

    this.ps[0][0] = Math.min(this.ps[0][0] + capx, limx);
    this.ps[0][1] = Math.min(this.ps[0][1] + capy, limy);
  }

  bottom_point() { // we pretend it's a circle, so it's basically just a transparent ball with an arc on it
    return [
      this.ps[0][0] + this.style.strokeWidth / 2,
      this.ps[0][1] + this.store[0] + this.style.strokeWidth / 2
    ];
  }

  rotate(theta) {
    // probably the easiest thing to rotate
    this.store[1] += theta;
    this.store[1] %= Math.PI * 2;
  }

  roll(limx, limy) {
    if (this.bouncingFor <= 2) {
      this.rollable = this.area * 2;
    }

    // if we haven't started bouncing, ignore
    if (this.isBouncing === null) return;
    
    let theta = this.rollable * .01 * DEGREE;
    this.rotate(theta / TPS); // we divide by TPS, as we are calling this once every tick - we rotate only 1/60th in one sec
    this.velocity[0] = Math.PI * theta * this.store[0];

    // friction
    if (this.isBouncing == false) {
      this.rollable *= .995;
    }
  }
}

// circle is just a 360deg (2pi rad) arc
class Circle extends Arc {
  constructor(...args) {
    super(...args, 0, Math.PI * 2);
  }

  rotate() {
    // it's a circle
    // rotations mean nothing
    // what do you expect
  }
}
