import { describe, expect, it } from 'vitest';
import { toVietnamTime } from './vietnam-time';

describe('toVietnamTime', () => {
  it('cộng 7 giờ và bỏ giây', () => {
    expect(toVietnamTime(new Date('2026-10-30T00:00:45Z'))).toBe('2026-10-30T07:00');
  });

  it('sang ngày hôm sau khi quá nửa đêm giờ Việt Nam', () => {
    expect(toVietnamTime(new Date('2026-10-30T20:30:00Z'))).toBe('2026-10-31T03:30');
  });
});
