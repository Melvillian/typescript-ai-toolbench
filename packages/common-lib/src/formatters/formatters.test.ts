import { describe, expect, it } from 'vitest';

import { formatBytes } from './formatBytes.js';
import { formatCount } from './formatCount.js';
import { formatSeconds } from './formatSeconds.js';
import { formatUnit } from './formatUnit.js';

describe('formatUnit', () => {
  const units = [
    { value: 1000, notation: 'K' },
    { value: 1, notation: '' },
  ];

  it('picks the largest unit the value reaches', () => {
    expect(formatUnit(1500, 3, units)).toBe('1.5K');
    expect(formatUnit(12, 3, units)).toBe('12');
  });

  it('falls back to the smallest unit when the value is below all of them', () => {
    expect(formatUnit(0.5, 3, units)).toBe('0.5');
  });

  it('falls back to a unitless 1 when no units are given', () => {
    expect(formatUnit(42, 3, [])).toBe('42');
  });
});

describe('formatBytes', () => {
  it('returns an empty string for undefined', () => {
    expect(formatBytes(undefined)).toBe('');
  });

  it('formats with decimal byte units to 3 significant digits', () => {
    expect(formatBytes(999)).toBe('999B');
    expect(formatBytes(1234)).toBe('1.23KB');
    expect(formatBytes(5_000_000)).toBe('5MB');
    expect(formatBytes(2_500_000_000)).toBe('2.5GB');
    expect(formatBytes(3e12)).toBe('3TB');
    expect(formatBytes(4e15)).toBe('4PB');
  });
});

describe('formatCount', () => {
  it('returns an empty string for undefined', () => {
    expect(formatCount(undefined)).toBe('');
  });

  it('formats with count suffixes', () => {
    expect(formatCount(7)).toBe('7');
    expect(formatCount(1500)).toBe('1.5K');
    expect(formatCount(2_340_000)).toBe('2.34M');
    expect(formatCount(1e9)).toBe('1B');
  });
});

describe('formatSeconds', () => {
  it('returns an empty string for undefined', () => {
    expect(formatSeconds(undefined)).toBe('');
  });

  it('formats across time units', () => {
    expect(formatSeconds(0.25)).toBe('250ms');
    expect(formatSeconds(45)).toBe('45s');
    expect(formatSeconds(90)).toBe('1.5m');
    expect(formatSeconds(7200)).toBe('2h');
    expect(formatSeconds(2 * 24 * 60 * 60)).toBe('2d');
    expect(formatSeconds(7 * 24 * 60 * 60)).toBe('1w');
  });

  it('treats a month as 30 24-hour days', () => {
    expect(formatSeconds(30 * 24 * 60 * 60)).toBe('1M');
    expect(formatSeconds(30 * 24 * 60 * 60 - 1)).toBe('4.29w');
  });
});
