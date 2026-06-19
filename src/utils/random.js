// Seeded pseudo-random number generation for the Monte-Carlo withdrawal engine.
//
// Why seeded: the simulation must be DETERMINISTIC. The same inputs have to
// reproduce the exact same chart — otherwise shared URLs and the localStorage
// restore would show a different plan than the one the user saved, and the
// binary search for the sustainable withdrawal (which re-evaluates the same
// scenarios many times) would not converge. So we reuse one fixed set of
// market shocks instead of drawing fresh randomness each run.

// mulberry32 — a tiny, fast, well-distributed 32-bit PRNG.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform: turn two uniform draws into one standard-normal sample.
export function makeNormal(rand) {
  return function () {
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

// Fixed seed → identical scenarios for identical inputs (see file header).
export const SHOCK_SEED = 0x9e3779b9;

// Pre-generate a [paths][years] matrix of standard-normal shocks. The engine
// scales each shock by the volatility and offset by the drift, so the raw
// matrix can be cached and reused across every withdrawal-amount candidate the
// solver tries.
export function normalShockMatrix(paths, years, seed = SHOCK_SEED) {
  const rand = mulberry32(seed);
  const normal = makeNormal(rand);
  const matrix = new Array(paths);
  for (let p = 0; p < paths; p++) {
    const row = new Float64Array(years);
    for (let y = 0; y < years; y++) row[y] = normal();
    matrix[p] = row;
  }
  return matrix;
}
