import { describe, expect, it } from 'vitest';
import { buildStudentsByEmailQuery, SCHOOL_DATABASE_NAME, toStudentInfos, type SchoolStudentRow } from './school-students-query';

/** Một dòng kết quả đủ cột, sửa từng cột khi cần. */
function rowOf(overrides: Partial<SchoolStudentRow>): SchoolStudentRow {
  return {
    studentId: '2253801011001',
    className: '178-HC50(A)',
    trainingMode: 'Chính quy',
    major: 'Luật',
    currentCohort: 'Khóa 47',
    originalCohort: 'Khóa 47',
    ...overrides,
  };
}

describe('buildStudentsByEmailQuery', () => {
  const query = buildStudentsByEmailQuery();

  it('lấy tên bảng, cột từ school-database.json, đặt trong [...]', () => {
    expect(SCHOOL_DATABASE_NAME).toBe('CoreUis');
    expect(query).toContain('FROM [psc_StudentInfo] AS info');
    expect(query).toContain('info.[Email] = @email');
    expect(query).toContain('[psc_StudyTypes]');
  });

  it('email chỉ đi qua tham số, không SELECT cột mật khẩu', () => {
    expect(query).not.toMatch(/@\w+\.edu/);
    for (const passwordColumn of ['PW', 'DefaultPW', 'PWParent', 'PWFamily', 'PWMoodle']) {
      expect(query).not.toContain(`[${passwordColumn}]`);
    }
    expect(query).not.toContain('*');
  });

  it('cột trả về đặt tên theo StudentInfo', () => {
    for (const key of ['studentId', 'className', 'trainingMode', 'major', 'currentCohort', 'originalCohort']) {
      expect(query).toContain(`AS ${key}`);
    }
  });
});

describe('toStudentInfos', () => {
  it('cắt khoảng trắng, chuỗi rỗng thành null, không tự điền thay', () => {
    const students = toStudentInfos(
      [rowOf({ studentId: ' 2253801011001 ', className: '  ', major: ' Luật (CLC) ', originalCohort: null })],
      '2253801011001@email.hcmulaw.edu.vn',
    );

    expect(students).toEqual([
      { studentId: '2253801011001', className: null, trainingMode: 'Chính quy', major: 'Luật (CLC)', currentCohort: 'Khóa 47', originalCohort: null },
    ]);
  });

  it('MSSV trùng phần trước @ đứng đầu (không phân biệt hoa thường), còn lại giữ thứ tự', () => {
    const students = toStudentInfos(
      [rowOf({ studentId: '1953801010001' }), rowOf({ studentId: '2553801010002' }), rowOf({ studentId: 'ch2253801' })],
      'CH2253801@email.hcmulaw.edu.vn',
    );

    expect(students.map((student) => student.studentId)).toEqual(['ch2253801', '1953801010001', '2553801010002']);
  });

  it('bỏ dòng trùng MSSV và dòng không có MSSV', () => {
    const students = toStudentInfos(
      [rowOf({}), rowOf({ className: 'lớp khác' }), rowOf({ studentId: null }), rowOf({ studentId: ' ' })],
      'ai.do@email.hcmulaw.edu.vn',
    );

    expect(students).toHaveLength(1);
    expect(students[0]!.className).toBe('178-HC50(A)');
  });

  it('không có dòng nào: []', () => {
    expect(toStudentInfos([], 'ai.do@hcmulaw.edu.vn')).toEqual([]);
  });
});
