import { describe, expect, test } from 'vitest';
import { columnLabel } from './columnLabel';

describe('columnLabel', () => {
  test('cột đầu là A, đến Z', () => {
    expect(columnLabel(0)).toBe('A');
    expect(columnLabel(1)).toBe('B');
    expect(columnLabel(25)).toBe('Z');
  });

  test('sau Z là AA, AB… rồi AZ, BA', () => {
    expect(columnLabel(26)).toBe('AA');
    expect(columnLabel(27)).toBe('AB');
    expect(columnLabel(51)).toBe('AZ');
    expect(columnLabel(52)).toBe('BA');
  });

  test('cột thứ 703 (chỉ số 702) là AAA', () => {
    expect(columnLabel(701)).toBe('ZZ');
    expect(columnLabel(702)).toBe('AAA');
  });
});
