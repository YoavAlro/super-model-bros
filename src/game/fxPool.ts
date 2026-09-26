/**
 * A fixed-capacity particle pool in flat typed arrays (pure: no three.js). Spawning into a full pool
 * drops the particle; dead particles are swap-removed, so the live ones are always 0..count-1 and
 * nothing is allocated after construction.
 */
export class Pool {
  count = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly age: Float32Array;
  readonly life: Float32Array;
  readonly rot: Float32Array;
  readonly spin: Float32Array;
  /** Size at birth and at death. */
  readonly s0: Float32Array;
  readonly s1: Float32Array;
  readonly drag: Float32Array;
  readonly grav: Float32Array;
  readonly r: Float32Array;
  readonly g: Float32Array;
  readonly b: Float32Array;
  private readonly fields: Float32Array[];

  constructor(readonly cap: number) {
    const f = () => new Float32Array(cap);
    this.x = f();
    this.y = f();
    this.z = f();
    this.vx = f();
    this.vy = f();
    this.age = f();
    this.life = f();
    this.rot = f();
    this.spin = f();
    this.s0 = f();
    this.s1 = f();
    this.drag = f();
    this.grav = f();
    this.r = f();
    this.g = f();
    this.b = f();
    this.fields = [this.x, this.y, this.z, this.vx, this.vy, this.age, this.life, this.rot, this.spin, this.s0, this.s1, this.drag, this.grav, this.r, this.g, this.b];
  }

  /** A fresh slot (zeroed, life 1, size 1, white), or −1 when the pool is full. */
  spawn(): number {
    if (this.count >= this.cap) return -1;
    const i = this.count++;
    for (const a of this.fields) a[i] = 0;
    this.life[i] = 1;
    this.s0[i] = this.s1[i] = 1;
    this.r[i] = this.g[i] = this.b[i] = 1;
    return i;
  }

  step(dt: number): void {
    let i = 0;
    while (i < this.count) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        const last = --this.count;
        if (i !== last) for (const a of this.fields) a[i] = a[last];
        continue;
      }
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= k;
      this.vy[i] = this.vy[i] * k - this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.rot[i] += this.spin[i] * dt;
      i++;
    }
  }

  /** 0..1 through particle i's life. */
  progress(i: number): number {
    return Math.min(1, this.age[i] / this.life[i]);
  }

  clear(): void {
    this.count = 0;
  }
}
