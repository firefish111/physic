/**
 * @property {string} style style object
 * @property {Array<any>} store argstore
 * 
 * @method setpath Function to define path of shape being traced
 * @method capout Jank max function
 */
class Shape {
  constructor(fill, ...args) { 
    this.style = fill;
    this.style.movable ??= true;
    console.log(this.style.movable);
    this.path = new Path2D();

    // tomfoolery
    //this.style.strokeWidth = 1e-308;

    this.velocity = [0, 0];

    // arguments to setpath function are stored as an array, then called every tick
    // this means that if a shape is a vararg (like a polygon) it will still work
    // and that constructor typesig doesn't have to be changed with each shape, only setpath
    this.store = args; // argstore
    this.setpath(...this.store);

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

const DEGREE = Math.PI/180;

class Rectangle extends Shape {
  setpath(x1, y1, x2, y2) {
    this.path.rect(x1, y1, x2 - x1, y2 - y1);
    this.area = (x2 - x1) * (y2 - y1);
  }

  translate(x, y, limx, limy) {
    let capx = x - Math.max(
      this.capout(this.store[0], x, limx),
      this.capout(this.store[2], x, limx)
    );
    let capy = y - Math.max(
      this.capout(this.store[1], y, limy),
      this.capout(this.store[3], y, limy)
    );

    this.store[0] = Math.min(this.store[0] + capx, limx);
    this.store[1] = Math.min(this.store[1] + capy, limy);
    this.store[2] = Math.min(this.store[2] + capx, limx);
    this.store[3] = Math.min(this.store[3] + capy, limy);
  }

  bottom_point() {
    return [
      Math.max(this.store[0], this.store[2]) + this.style.strokeWidth / 2,
      Math.max(this.store[1], this.store[3]) + this.style.strokeWidth / 2
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
}

class Line extends Shape {
  setpath(x1, y1, x2, y2) {
    this.path.moveTo(x1, y1);
    this.path.lineTo(x2, y2);
    this.lowest = +(y1 < y2); // 1 if y1 lower down (more than) y2, else 0

    // area is -Inf (can't be 0 as that ends in Inf, dividing by -Inf results in -0)
  }

  translate(x, y, limx, limy) {
    let capx = x - Math.max(
      this.capout(this.store[0], x, limx),
      this.capout(this.store[2], x, limx)
    );
    let capy = y - Math.max(
      this.capout(this.store[1], y, limy),
      this.capout(this.store[3], y, limy)
    );

    let min_fall = (a, b) => a < b ? a : (this.fall_by_rotate(9.81) || b)
    this.store[0] = min_fall(this.store[0] + capx, limx);
    this.store[1] = min_fall(this.store[1] + capy, limy);
    this.store[2] = min_fall(this.store[2] + capx, limx);
    this.store[3] = min_fall(this.store[3] + capy, limy);
  }

  bottom_point() {
    return [
      Math.max(this.store[0], this.store[2]) + this.style.strokeWidth / 2,
      Math.max(this.store[1], this.store[3]) + this.style.strokeWidth / 2
    ];
  }

  rotate(theta, which = 0) {
    // x' = xcos(theta) - ysin(theta)
    // y' = xsin(theta) + ycos(theta)
    
    // which is pointnum, 0 is x1-x0, 1 is x0-x1
    let Dx = this.store[2] - this.store[0];
    let Dy = this.store[3] - this.store[1]; // originified towards top-left

    if (which) {
      this.store[0] = this.store[2] - Dx * Math.cos(theta) + Dy * Math.sin(theta);
      this.store[1] = this.store[3] - Dx * Math.sin(theta) - Dy * Math.cos(theta);
    } else {
      this.store[2] = this.store[0] + Dx * Math.cos(theta) - Dy * Math.sin(theta);
      this.store[3] = this.store[1] + Dx * Math.sin(theta) + Dy * Math.cos(theta);
    }
  }

  fall_by_rotate(g) {
    // get most southernly point
    let which = +(this.store[1] < this.store[3]); // to compare against the point that we have been falling already, to prevent cartwheeling
    if (which != this.lowest) return;

    let Dx = Math.abs(this.store[2] - this.store[0]); // width
    let Dy = Math.abs(this.store[3] - this.store[1]); // height
    //let len = Math.sqrt(Dx**2 + Dy**2)
    let angle = Math.atan(Dy/Dx);
    //angle = Math.max(Math.min(angle, Math.PI*.5), 0);
    //if (!angle) return;

    let torque = Math.min((Math.PI - angle)**(2)/this.ROTATIONAL_SCALE, angle); 
    if (
      (this.store[0] < this.store[2] && this.store[1] < this.store[3]) ||
      (this.store[0] > this.store[2] && this.store[1] > this.store[3])
    ) torque *= -1; // check if needing to rotate anticlockwise instead, if p1 is either nw or se of p0

    this.rotate(torque, this.lowest);
  }
}

// arc can be applied to much the same stuff as the line
class Arc extends Line {
  setpath(x, y, r, start, angle) {
    this.path.arc(x, y, r, start, start + angle /* in radians */, angle < 0);
    this.area = Math.PI * (r**2);
  }

  translate(x, y, limx, limy) {
    let capx = x - this.capout(this.store[0] + this.store[2], x, limx);
    let capy = y - this.capout(this.store[1] + this.store[2], y, limy);

    this.store[0] = Math.min(this.store[0] + capx, limx);
    this.store[1] = Math.min(this.store[1] + capy, limy);
  }

  bottom_point() {
    return [
      this.store[0] + this.style.strokeWidth / 2,
      this.store[1] + this.store[2] + this.style.strokeWidth / 2
    ];
  }

  rotate(theta) {
    // probably the easiest thing to rotate
    this.store[3] += theta;
    this.store[3] %= Math.PI * 2;
  }

  roll(limx, limy) {
    if (this.bouncingFor <= 2) {
      this.rollable = this.area;
    }

    if (this.isBouncing === null) return;
    
    let theta = this.rollable * .01 * DEGREE;
    this.rotate(theta);
    this.velocity[0] = Math.PI * theta * this.store[2]; 

    // friction
    if (this.isBouncing == false) {
      this.rollable *= .96;
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