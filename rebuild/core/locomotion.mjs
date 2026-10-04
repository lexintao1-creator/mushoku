const START_MS = 80;
const STOP_MS = 90;
const STRIDE_DISTANCE = 78;

// Read-only measurements, not an approval of the walk artwork or planted-foot data.
export const RUDEUS_LOCOMOTION_ASSETS = Object.freeze({
  targetBodyHeight: 48,
  idle: Object.freeze({
    path: 'assets/rudeus-idle-v3.png',
    sheetSize: Object.freeze([1254, 1254]),
    cellSize: 627,
    columns: 2,
    bodyHeightReference: 539,
    scale: 48 / 539,
    headTop: Object.freeze([43, 41, 40, 37]),
    shoeBottom: Object.freeze([575, 579, 579, 575]),
    // Visual support centers; verify pelvis alignment at runtime after scaling.
    rootX: Object.freeze([315, 297, 321, 305]),
    rootY: Object.freeze([575, 579, 579, 575]),
  }),
  walk: Object.freeze({
    path: 'assets/rudeus-sheet.png',
    sheetSize: Object.freeze([1536, 1024]),
    cellSize: 256,
    columns: 6,
    bodyHeightReference: 235.5,
    scale: 48 / 235.5,
    headTop: Object.freeze([
      17, 14, 15, 17, 17, 17, 6, 6, 7, 6, 5, 6,
      6, 6, 4, 4, 4, 4, 4, 0, 3, 2, 2, 2,
    ]),
    shoeBottom: Object.freeze([
      245, 249, 242, 250, 249, 245, 242, 239, 242, 242, 239, 242,
      243, 241, 241, 241, 239, 241, 233, 232, 233, 233, 232, 233,
    ]),
    // Row medians preserve visible within-row drift for rejection review.
    rootX: Object.freeze([128, 128, 128, 128]),
    rootY: Object.freeze([247, 242, 241, 233]),
    accepted: false,
  }),
});

function rowFor(vector, fallback) {
  const x = vector?.x ?? 0;
  const y = vector?.y ?? 0;
  if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return fallback;
  return Math.abs(x) > Math.abs(y) ? (x < 0 ? 1 : 2) : (y < 0 ? 3 : 0);
}

export class Locomotion {
  constructor({ facingRow = 0 } = {}) {
    if (!Number.isInteger(facingRow) || facingRow < 0 || facingRow > 3) {
      throw new RangeError('facingRow must be an integer from 0 to 3');
    }
    this.bodyRow = facingRow;
    this.facingRow = facingRow;
    this.state = 'idle';
    this.elapsed = 0;
    this.cycleDistance = 0;
  }

  step({ dtMs = 0, distance = 0, move, aim, casting = false, dodging = false } = {}) {
    if (!Number.isFinite(dtMs) || dtMs < 0 || !Number.isFinite(distance) || distance < 0) {
      throw new RangeError('dtMs and distance must be finite nonnegative numbers');
    }
    if (dtMs === 0) return this.snapshot();

    const moving = distance > 0 && rowFor(move, -1) !== -1;
    if (dodging || casting) {
      this.state = dodging ? 'dodge' : 'cast';
      this.elapsed = 0;
      this.cycleDistance = 0;
      if (dodging && moving) this.bodyRow = rowFor(move, this.bodyRow);
      this.facingRow = dodging ? this.bodyRow : rowFor(aim, this.bodyRow);
      return this.snapshot();
    }

    this.facingRow = this.bodyRow;
    if (moving) {
      this.bodyRow = this.facingRow = rowFor(move, this.bodyRow);
      if (this.state !== 'start' && this.state !== 'walk') {
        this.state = 'start';
        this.elapsed = 0;
        this.cycleDistance = 0;
      }
      let walkingDistance = distance;
      if (this.state === 'start') {
        const remaining = START_MS - this.elapsed;
        this.elapsed = Math.min(START_MS, this.elapsed + dtMs);
        if (dtMs < remaining) return this.snapshot();
        // Input distance covers the whole interval; assume constant speed within it.
        walkingDistance *= (dtMs - remaining) / dtMs;
        this.state = 'walk';
        this.elapsed = 0;
      }
      this.cycleDistance = (this.cycleDistance + walkingDistance % STRIDE_DISTANCE) % STRIDE_DISTANCE;
    } else {
      if (this.state === 'start' || this.state === 'walk') {
        this.state = 'stop';
        this.elapsed = 0;
        this.cycleDistance = 0;
      } else if (this.state === 'cast' || this.state === 'dodge') {
        this.state = 'idle';
        this.elapsed = 0;
      }
      if (this.state === 'stop') {
        this.elapsed = Math.min(STOP_MS, this.elapsed + dtMs);
        if (this.elapsed === STOP_MS) {
          this.state = 'idle';
          this.elapsed = 0;
        }
      }
    }
    return this.snapshot();
  }

  snapshot() {
    const walking = this.state === 'walk';
    const progress = walking ? this.cycleDistance / STRIDE_DISTANCE
      : this.state === 'start' ? this.elapsed / START_MS
      : this.state === 'stop' ? this.elapsed / STOP_MS : 0;
    const phase = Math.min(5, Math.floor(progress * 6));
    return {
      state: this.state,
      facingRow: this.facingRow,
      texture: walking ? 'walk' : 'idle',
      frame: walking ? this.facingRow * 6 + phase : this.facingRow,
      progress,
    };
  }
}
