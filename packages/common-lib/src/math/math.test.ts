import { describe, expect, it } from 'vitest';

import { cumulativeDistribution } from './cumulativeDistribution.js';
import { format } from './format.js';
import { formatPercentage } from './formatPercentage.js';
import { normalizeDistribution } from './normalizeDistribution.js';
import { roundTo } from './roundTo.js';
import { sum } from './sum.js';

describe('sum', () => {
  it('sums short arrays directly', () => {
    expect(sum([1, 2, 3])).toBe(6);
  });

  it('sums long arrays via the recursive split', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(sum(values)).toBe(5050);
  });

  it('returns 0 for an empty array', () => {
    expect(sum([])).toBe(0);
  });
});

describe('roundTo', () => {
  it('rounds to significant digits regardless of magnitude', () => {
    expect(roundTo(1234.5678, 3)).toBe(1230);
    expect(roundTo(0.0123456, 3)).toBe(0.0123);
  });

  it('treats non-positive significant digits as one digit', () => {
    expect(roundTo(1234, 0)).toBe(1000);
  });
});

describe('format', () => {
  it('returns an empty string for undefined', () => {
    expect(format(undefined)).toBe('');
  });

  it('formats with the default locale', () => {
    expect(format(1234.5)).toBe(new Intl.NumberFormat().format(1234.5));
  });
});

describe('formatPercentage', () => {
  it('rounds to one decimal place', () => {
    expect(formatPercentage(12.345)).toBe('12.3%');
    expect(formatPercentage(50)).toBe('50%');
  });
});

describe('normalizeDistribution', () => {
  it('scales values to sum to 1', () => {
    expect(normalizeDistribution([1, 1, 2])).toEqual([0.25, 0.25, 0.5]);
  });
});

describe('cumulativeDistribution', () => {
  it('returns the running normalized total', () => {
    expect(cumulativeDistribution([1, 1, 2])).toEqual([0.25, 0.5, 1]);
  });
});
