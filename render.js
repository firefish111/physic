const SCALE = 100; // px = cm
const GRAVITY = 9.81; // 9.81 m/s^2
/**
 * @method putShape Initialise shape for drawing to screen
 * @method drawShape Draw shape to screen
 * @method tick Executed every frame, (every 1/TPS seconds), to move the shapes
 */
class Render {
  constructor(cv) { // init func
    this.canv = cv;
    this.rend = this.canv.getContext("2d");

    this.TPS = 60; // ticks per second (tick === frame)

    this.shp_lst = [];
  }

  tick() {
    this.rend.clearRect(0, 0, this.canv.width, this.canv.height);

    this.shp_lst.forEach(k => {
      if (!k.style.movable) return;

      let [x, y] = k.bottom_point();
      let strk = k.style.strokeWidth;
      if (x <= this.canv.width && y <= this.canv.height) {
        k.velocity[1] += GRAVITY * SCALE / this.TPS; // 9.81/60, to convert m/s^2 into px/t^2
        k.translate(
          k.velocity[0] / this.TPS, // velocity is per second, so we make it per tick
          k.velocity[1] / this.TPS,
          this.canv.width - strk/2, // half stroke width, as centre of stroke line is edge of shape
          this.canv.height - strk/2, // this stops floating shapes
        );

        k.roll(
          this.canv.width - strk/2, // half stroke width, as centre of stroke line is edge of shape
          this.canv.height - strk/2,
        );

        if (y == this.canv.height) { // if on floor
          k.isBouncing ??= true;
          k.bounce();
        }
      }

    });
    this.drawShape(this.shp_lst);
  }

  drawShape(...shps) {
    ((shps.length === 1 && shps[0] instanceof Array) ? shps[0] : shps).forEach(shp => {
      shp.path = new Path2D();
      shp.setpath(...shp.store);

      this.rend.fillStyle = shp.style.fill ?? "transparent";
      this.rend.fill(shp.path);

      this.rend.lineWidth = shp.style.strokeWidth ?? 0;
      this.rend.strokeStyle = shp.style.stroke ?? 0;
      this.rend.stroke(shp.path);
    });
  }

  putShape(...shps) {
    ((shps.length === 1 && shps[0] instanceof Array) ? shps[0] : shps).forEach(shp => {
      if (!(shp instanceof Shape)) { throw "not a shape"; };

      this.shp_lst.push(shp);

      this.drawShape(shp);
    });
  }
}

const rd = new Render(document.querySelector("canvas#canv"));
let rect = new Rectangle({ fill: "gold", stroke: "black", strokeWidth: 8 }, 100, 20, 210, 85);
let circ = new Circle({ fill: "blue", stroke: "#a4db0b", strokeWidth: 5 }, 500, 200, 25);
let curv = new Arc({ stroke: "#d29480", strokeWidth: 15 }, 300, 200, 35, .5, 1.8);
let lin = new Line({ stroke: "#a952b9", strokeWidth: 10 }, 460, 280, 330, 120);
let lin2 = new Line({ stroke: "#cd2246", strokeWidth: 5 }, 530, 350, 580, 60);

// dynamically pass the canvas, as the canvas' dimensions are tied to the viewport
let floor = new CanvasBorder({ stroke: "black", strokeWidth: 1 }, rd.canv);

rd.putShape(floor, rect, circ, curv, lin, lin2);

window.setInterval(() => {
  rd.tick();
}, 1000 / rd.TPS);