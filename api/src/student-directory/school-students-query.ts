/* Tra thông tin sinh viên trong database trường theo email: dựng câu SELECT, chuyển dòng kết quả thành StudentInfo[].
   Tên database, bảng, cột lấy từ school-database.json (mục THONG_TIN_SINH_VIEN), không chép lại ở đây.
   Phần này không kết nối database, nên test được không cần database trường. */
import type { StudentInfo } from '@ulaw/shared';
import schoolDatabase from './school-database.json';

const { DATABASE, ...STUDENT_TABLES } = schoolDatabase.THONG_TIN_SINH_VIEN;

/** Tên database chứa thông tin sinh viên, vd 'CoreUis'. */
export const SCHOOL_DATABASE_NAME: string = DATABASE;

/** Tên tham số của email trong câu SELECT (gửi riêng, không nối vào câu). */
export const EMAIL_PARAMETER = 'email';

/** Một dòng kết quả của câu SELECT, mỗi cột một mục của StudentInfo; database trường có thể trả null ở mọi cột. */
export type SchoolStudentRow = { [key in keyof StudentInfo]: string | null };

/**
 * Đặt một tên bảng / cột vào [...] của SQL Server. Tên lấy từ school-database.json, chỉ nhận chữ, số, gạch dưới,
 * để tệp có sai thì báo lỗi chứ không thành câu SQL lạ.
 * @param name  tên bảng hoặc cột, vd 'psc_StudentInfo'
 * @returns     vd '[psc_StudentInfo]'
 */
function quoted(name: string): string {
  if (!/^\w+$/.test(name)) throw new Error(`Tên bảng / cột không hợp lệ trong school-database.json: ${name}`);
  return `[${name}]`;
}

/**
 * Dựng câu SELECT tìm các MSSV có email trường bằng tham số @email, kèm lớp, hình thức đào tạo, ngành, khóa hiện tại, khóa gốc.
 * Thiếu lớp, ngành hay khóa thì cột đó null (LEFT JOIN), vẫn trả MSSV. Không SELECT cột nào khác (bảng có cột mật khẩu).
 * Collation của cột email không phân biệt hoa thường nên so bằng = là đủ.
 * @returns  câu SELECT, cột đặt tên theo StudentInfo
 */
export function buildStudentsByEmailQuery(): string {
  const { THONG_TIN_SV_TABLE: info, LOP_SINH_VIEN_TABLE: studentClass, LOP_SV_TABLE: classes, NGANH_SV_TABLE: enroll, NGANH_TABLE: ology,
    KHOA_HOC_TABLE: course, HINH_THUC_DAO_TAO_TABLE: studyType } = STUDENT_TABLES;
  const column = (tableAlias: string, columnName: string) => `${tableAlias}.${quoted(columnName)}`;

  return [
    'SELECT',
    `  ${column('info', info.COLUMNS.MSSV)} AS studentId,`,
    `  ${column('studentClassInfo', classes.COLUMNS.TEN_LOP_SV)} AS className,`,
    `  ${column('studyType', studyType.COLUMNS.TEN_HINH_THUC)} AS trainingMode,`,
    `  ${column('ology', ology.COLUMNS.TEN_NGANH)} AS major,`,
    `  ${column('course', course.COLUMNS.TEN_KHOA)} AS currentCohort,`,
    `  ${column('originCourse', course.COLUMNS.TEN_KHOA)} AS originalCohort`,
    `FROM ${quoted(info.NAME)} AS info`,
    // Lớp sinh hoạt: tối đa 1 dòng mỗi MSSV
    `LEFT JOIN ${quoted(studentClass.NAME)} AS studentClass ON ${column('studentClass', studentClass.COLUMNS.MSSV)} = ${column('info', info.COLUMNS.MSSV)}`,
    `LEFT JOIN ${quoted(classes.NAME)} AS studentClassInfo ON ${column('studentClassInfo', classes.COLUMNS.MA_LOP_SV)} = ${column('studentClass', studentClass.COLUMNS.MA_LOP_SV)}`,
    // Ngành, khóa: đúng 1 dòng mỗi MSSV; hình thức đào tạo theo khóa hiện tại
    `LEFT JOIN ${quoted(enroll.NAME)} AS enroll ON ${column('enroll', enroll.COLUMNS.MSSV)} = ${column('info', info.COLUMNS.MSSV)}`,
    `LEFT JOIN ${quoted(ology.NAME)} AS ology ON ${column('ology', ology.COLUMNS.MA_NGANH)} = ${column('enroll', enroll.COLUMNS.MA_NGANH)}`,
    `LEFT JOIN ${quoted(course.NAME)} AS course ON ${column('course', course.COLUMNS.MA_KHOA)} = ${column('enroll', enroll.COLUMNS.MA_KHOA)}`,
    `LEFT JOIN ${quoted(studyType.NAME)} AS studyType ON ${column('studyType', studyType.COLUMNS.MA_HINH_THUC)} = ${column('course', course.COLUMNS.MA_HINH_THUC)}`,
    `LEFT JOIN ${quoted(course.NAME)} AS originCourse ON ${column('originCourse', course.COLUMNS.MA_KHOA)} = ${column('enroll', enroll.COLUMNS.MA_KHOA_GOC)}`,
    `WHERE ${column('info', info.COLUMNS.EMAIL_TRUONG)} = @${EMAIL_PARAMETER}`,
    `ORDER BY ${column('info', info.COLUMNS.MSSV)}`,
  ].join('\n');
}

/**
 * Cắt khoảng trắng đầu cuối; trống thì null. Không sửa gì khác: database trường ghi gì thì trả đúng như vậy.
 * @param text  chữ đọc từ database trường
 * @returns     chữ đã cắt khoảng trắng, hoặc null
 */
function trimmedOrNull(text: string | null): string | null {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/**
 * Chuyển các dòng kết quả thành danh sách MSSV theo hợp đồng StudentInfo.
 * @param rows   dòng trả về từ câu của buildStudentsByEmailQuery
 * @param email  email đã dùng để tìm
 * @returns      mỗi MSSV một mục (bỏ dòng trùng MSSV, dòng không có MSSV); MSSV trùng phần trước @ của email đứng đầu, còn lại giữ thứ tự
 */
export function toStudentInfos(rows: readonly SchoolStudentRow[], email: string): StudentInfo[] {
  // Cắt khoảng trắng mọi cột, bỏ dòng không có MSSV hoặc trùng MSSV đã gặp
  const students: StudentInfo[] = [];
  for (const row of rows) {
    const studentId = trimmedOrNull(row.studentId);
    if (!studentId || students.some((student) => student.studentId === studentId)) continue;
    students.push({
      studentId,
      className: trimmedOrNull(row.className),
      trainingMode: trimmedOrNull(row.trainingMode),
      major: trimmedOrNull(row.major),
      currentCohort: trimmedOrNull(row.currentCohort),
      originalCohort: trimmedOrNull(row.originalCohort),
    });
  }

  // MSSV trùng phần trước @ lên đầu (không phân biệt hoa thường); sort giữ nguyên thứ tự các MSSV còn lại
  const emailLocalPart = email.split('@')[0]!.toLowerCase();
  const matchesEmail = (student: StudentInfo) => (student.studentId.toLowerCase() === emailLocalPart ? 0 : 1);
  return students.sort((first, second) => matchesEmail(first) - matchesEmail(second));
}
