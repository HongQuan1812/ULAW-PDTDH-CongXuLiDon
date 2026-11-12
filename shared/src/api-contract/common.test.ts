import { describe, expect, it } from 'vitest';
import type { ListQuery } from '../aux-schema/lists';
import { LIST_PAGE_SIZE_MAX, USER_IDS_MAX, listQueryParams, parseListQuery, parseUserIdsParam } from './common';

/** Các cột của một bảng thử: chữ, lựa chọn, ngày. */
const FIELDS = [
  { key: 'code', type: 'text' },
  { key: 'status', type: 'select' },
  { key: 'submittedAt', type: 'date' },
] as const;

describe('listQueryParams / parseListQuery', () => {
  it('ghi rồi đọc lại được đúng lần hỏi trang', () => {
    const listQuery: ListQuery = {
      page: 3,
      pageSize: 8,
      search: 'nguyễn văn',
      sort: [{ id: 'submittedAt', desc: true }, { id: 'code', desc: false }],
      filters: [
        { fieldKey: 'status', operator: 'equals', value: 'xet', from: '', to: '' },
        { fieldKey: 'submittedAt', operator: 'range', value: '', from: '2026-10-01', to: '' },
      ],
    };
    const params = listQueryParams(listQuery);
    expect(params.sort).toBe('submittedAt:desc,code:asc');
    expect(parseListQuery(params, FIELDS)).toEqual(listQuery);
  });

  it('không gửi gì thì trang 1, 20 dòng, không tìm, không xếp, không lọc', () => {
    expect(parseListQuery({}, FIELDS)).toEqual({ page: 1, pageSize: 20, search: '', sort: [], filters: [] });
  });

  it('từ chối trang, số dòng sai; cột không có; xếp một cột hai lần; lọc khoảng ở cột chữ; filters không phải JSON', () => {
    expect(parseListQuery({ page: '0' }, FIELDS)).toBeNull();
    expect(parseListQuery({ page: '1.5' }, FIELDS)).toBeNull();
    expect(parseListQuery({ pageSize: String(LIST_PAGE_SIZE_MAX + 1) }, FIELDS)).toBeNull();
    expect(parseListQuery({ sort: 'email:asc' }, FIELDS)).toBeNull();
    expect(parseListQuery({ sort: 'code:up' }, FIELDS)).toBeNull();
    expect(parseListQuery({ sort: 'code:asc,code:desc' }, FIELDS)).toBeNull();
    expect(parseListQuery({ filters: JSON.stringify([{ fieldKey: 'code', operator: 'range', from: 'A' }]) }, FIELDS)).toBeNull();
    expect(parseListQuery({ filters: JSON.stringify([{ fieldKey: 'email', operator: 'equals', value: 'a' }]) }, FIELDS)).toBeNull();
    expect(parseListQuery({ filters: '[{' }, FIELDS)).toBeNull();
  });
});

describe('parseUserIdsParam', () => {
  it('đọc các id, bỏ trùng; trống hoặc quá nhiều người thì từ chối', () => {
    expect(parseUserIdsParam('sv-1,sv-2,sv-1')).toEqual(['sv-1', 'sv-2']);
    expect(parseUserIdsParam('')).toBeNull();
    expect(parseUserIdsParam(undefined)).toBeNull();
    expect(parseUserIdsParam(Array.from({ length: USER_IDS_MAX + 1 }, (_, i) => `sv-${i}`).join(','))).toBeNull();
  });
});
