import { describe, it, expect } from 'vitest';
import { mulberry32, makeNormal, normalShockMatrix, SHOCK_SEED } from './random.js';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it('produces values in [0, 1) and different seeds diverge', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('makeNormal', () => {
  it('approximates a standard normal (mean≈0, std≈1)', () => {
    const normal = makeNormal(mulberry32(42));
    const N = 20000;
    let sum = 0;
    const xs = [];
    for (let i = 0; i < N; i++) {
      const x = normal();
      xs.push(x);
      sum += x;
    }
    const mean = sum / N;
    const variance = xs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / N;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(Math.sqrt(variance) - 1)).toBeLessThan(0.05);
  });
});

describe('normalShockMatrix', () => {
  it('has the requested [paths][years] shape', () => {
    const m = normalShockMatrix(10, 7);
    expect(m).toHaveLength(10);
    expect(m[0]).toHaveLength(7);
  });

  it('is deterministic for the fixed seed (reproducible shared plans)', () => {
    const a = normalShockMatrix(5, 5, SHOCK_SEED);
    const b = normalShockMatrix(5, 5, SHOCK_SEED);
    for (let p = 0; p < 5; p++) {
      for (let y = 0; y < 5; y++) expect(a[p][y]).toBe(b[p][y]);
    }
  });
});
