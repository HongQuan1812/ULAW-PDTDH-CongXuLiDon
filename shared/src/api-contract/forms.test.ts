import { describe, expect, test } from 'vitest';
import { applyListQuery } from '../business-rules/lists--query';
import { FORMS_ENDPOINTS, FORM_LIST_DEFAULT_SORTING, FormCccdsResponseSchema, FormStatsSchema, MANAGED_FORM_LIST_FIELDS, ManagedFormsResponseSchema, type ManagedFormSummary } from './forms';

describe('danh sách mọi đơn (Quản lí đơn)', () => {
  const managedForm = {
    code: 'XMM-2026-001-00001',
    formTypeId: 'xmm',
    formTypeName: 'Xét miễn môn',
    submittedAt: '2026-11-01T08:30',
    status: 'nop',
    deadlineState: 'onTrack',
    receivedAt: null,
    noteCount: 0,
    applicant: { id: 'sv-2', name: 'Trần Thị Bảo Ngọc', email: 'baongoc.tran@hcmulaw.edu.vn', phone: null, maskedCccd: null },
  };
  /** Phần chung của một trang: tổng số đơn khớp, trang trả về, lựa chọn lọc. */
  const pageMeta = { total: 1, page: 1, filterOptions: { formType: [{ value: 'xmm', label: 'Xét miễn môn' }] } };

  test('đường dẫn: GET /forms lấy mọi đơn, GET /forms/cccds lấy CCCD đầy đủ', () => {
    expect(FORMS_ENDPOINTS.list).toBe('/forms');
    expect(FORMS_ENDPOINTS.cccds).toBe('/forms/cccds');
  });

  test('chấp nhận đơn có người nộp chưa có SĐT, CCCD và đơn chưa tiếp nhận', () => {
    expect(ManagedFormsResponseSchema.safeParse({ ...pageMeta, forms: [managedForm] }).success).toBe(true);
  });

  test('từ chối đơn thiếu thông tin người nộp, hoặc trang thiếu tổng số đơn', () => {
    const { applicant: _applicant, ...withoutApplicant } = managedForm;
    expect(ManagedFormsResponseSchema.safeParse({ ...pageMeta, forms: [withoutApplicant] }).success).toBe(false);
    expect(ManagedFormsResponseSchema.safeParse({ forms: [managedForm] }).success).toBe(false);
  });

  test('cột Ghi chú là cột số: sắp xếp theo số ghi chú, lọc theo khoảng', () => {
    const forms = [3, 0, 12].map((noteCount, index) => ({ ...managedForm, code: `XMM-2026-001-0000${index + 1}`, noteCount }) as ManagedFormSummary);
    const sorted = applyListQuery(forms, MANAGED_FORM_LIST_FIELDS, { page: 1, pageSize: 10, search: '', sort: [{ id: 'noteCount', desc: true }], filters: [] }, FORM_LIST_DEFAULT_SORTING);
    expect(sorted.rows.map((form) => form.noteCount)).toEqual([12, 3, 0]);
    const filtered = applyListQuery(forms, MANAGED_FORM_LIST_FIELDS, { page: 1, pageSize: 10, search: '', sort: [], filters: [{ fieldKey: 'noteCount', operator: 'range', value: '', from: '1', to: '' }] }, FORM_LIST_DEFAULT_SORTING);
    expect(filtered.rows.map((form) => form.noteCount).sort((a, b) => a - b)).toEqual([3, 12]);
  });

  test('cột Tình trạng hạn: sắp xếp gấp nhất trước; lọc theo tình trạng', () => {
    const states = ['doneOnTime', 'none', 'onTrack', 'overdue', 'dueSoon', 'doneLate'] as const;
    const forms = states.map((deadlineState, index) => ({ ...managedForm, code: `XMM-2026-001-0000${index + 1}`, deadlineState }) as ManagedFormSummary);
    const listQuery = (sort: { id: string; desc: boolean }[], filters: { fieldKey: string; operator: 'equals'; value: string; from: string; to: string }[]) =>
      applyListQuery(forms, MANAGED_FORM_LIST_FIELDS, { page: 1, pageSize: 10, search: '', sort, filters }, FORM_LIST_DEFAULT_SORTING).rows.map((form) => form.deadlineState);

    expect(listQuery([{ id: 'deadlineState', desc: false }], [])).toEqual(['overdue', 'dueSoon', 'onTrack', 'none', 'doneLate', 'doneOnTime']);
    expect(listQuery([{ id: 'deadlineState', desc: true }], [])).toEqual(['doneOnTime', 'doneLate', 'none', 'onTrack', 'dueSoon', 'overdue']);
    expect(listQuery([], [{ fieldKey: 'deadlineState', operator: 'equals', value: 'overdue', from: '', to: '' }])).toEqual(['overdue']);
  });

  test('tình trạng hạn chỉ nhận giá trị đã định', () => {
    expect(ManagedFormsResponseSchema.safeParse({ ...pageMeta, forms: [{ ...managedForm, deadlineState: 'overdue' }] }).success).toBe(true);
    expect(ManagedFormsResponseSchema.safeParse({ ...pageMeta, forms: [{ ...managedForm, deadlineState: 'late' }] }).success).toBe(false);
    expect(ManagedFormsResponseSchema.safeParse({ ...pageMeta, forms: [{ ...managedForm, deadlineState: null }] }).success).toBe(false);
  });

  test('CCCD đầy đủ trả theo id người nộp', () => {
    expect(FormCccdsResponseSchema.safeParse({ cccds: { 'cb-1': '079300000001' } }).success).toBe(true);
    expect(FormCccdsResponseSchema.safeParse({ cccds: [] }).success).toBe(false);
  });
});

describe('thống kê (Quản lí đơn)', () => {
  const stats = {
    total: 3,
    byStatus: { nop: 1, xet: 2, bs: 0, bsg: 0, duyet: 0, tc: 0 },
    byType: [{ formTypeId: 'xmm', formTypeName: 'Xét miễn môn', formTypeStatus: 'open', count: 3 }],
    byDeadline: { onTrack: 1, dueSoon: 0, overdue: 1, doneOnTime: 0, doneLate: 0, none: 1 },
  };

  test('đường dẫn: GET /forms/stats', () => {
    expect(FORMS_ENDPOINTS.stats).toBe('/forms/stats');
  });

  test('chấp nhận số liệu đủ 6 trạng thái và loại đơn đang mở / đã đóng', () => {
    expect(FormStatsSchema.safeParse(stats).success).toBe(true);
  });

  test('từ chối khi thiếu một trạng thái hoặc trạng thái loại đơn lạ', () => {
    const { tc: _tc, ...missingStatus } = stats.byStatus;
    expect(FormStatsSchema.safeParse({ ...stats, byStatus: missingStatus }).success).toBe(false);
    expect(FormStatsSchema.safeParse({ ...stats, byType: [{ ...stats.byType[0], formTypeStatus: 'x' }] }).success).toBe(false);
  });

  test('từ chối khi thiếu một tình trạng hạn', () => {
    const { none: _none, ...missingState } = stats.byDeadline;
    expect(FormStatsSchema.safeParse({ ...stats, byDeadline: missingState }).success).toBe(false);
  });
});
