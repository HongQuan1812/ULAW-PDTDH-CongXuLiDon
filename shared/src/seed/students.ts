/* Thông tin sinh viên mẫu, thay cho database trường. */
import type { StudentInfo } from '../api-contract';

/* Các MSSV "lấy từ database trường" theo email, chỉ đọc nên không lưu lại.
   sv-1 và sv-5 có 2 MSSV (học thêm văn bằng 2), MSSV trùng email đứng đầu; sv-7 không có MSSV nào; các sinh viên khác 1 MSSV,
   có người thiếu vài mục (database trường không có). Cán bộ không có MSSV. */
export const STUDENT_DIRECTORY: Record<string, StudentInfo[]> = {
  'sv-1': [
    {
      studentId: '2253801010001',
      className: '47-LTM-A',
      trainingMode: 'Chính quy',
      major: 'Luật Thương mại quốc tế',
      currentCohort: 'K47 (2022–2026)',
      originalCohort: 'K47 (2022–2026)',
    },
    {
      studentId: '2523801040017',
      className: 'VB2-25B',
      trainingMode: 'Văn bằng 2',
      major: 'Luật',
      currentCohort: 'VB2 K25',
      originalCohort: 'VB2 K25',
    },
  ],
  'sv-2': [
    {
      studentId: '2253801010012',
      className: '47-LTM-A',
      trainingMode: 'Chính quy',
      major: 'Luật Thương mại quốc tế',
      currentCohort: 'K47 (2022–2026)',
      originalCohort: 'K47 (2022–2026)',
    },
  ],
  'sv-3': [
    {
      studentId: '2353801020145',
      className: '48-QTL-B',
      trainingMode: 'Chính quy',
      major: 'Quản trị – Luật',
      currentCohort: 'K48 (2023–2027)',
      originalCohort: 'K48 (2023–2027)',
    },
  ],
  'sv-4': [
    {
      studentId: '2253801010388',
      className: '48-L-C',
      trainingMode: 'Chính quy',
      major: 'Luật',
      currentCohort: 'K48 (2023–2027)',
      originalCohort: 'K47 (2022–2026)',
    },
  ],
  'sv-5': [
    {
      studentId: '2053801010214',
      className: '45-L-B',
      trainingMode: 'Chính quy',
      major: 'Luật',
      currentCohort: 'K45 (2020–2024)',
      originalCohort: 'K45 (2020–2024)',
    },
    {
      studentId: '2323801040021',
      className: 'VB2-23A',
      trainingMode: 'Văn bằng 2',
      major: 'Luật',
      currentCohort: 'VB2 K23',
      originalCohort: 'VB2 K23',
    },
  ],
  'sv-6': [
    {
      studentId: '2453801010507',
      className: null,
      trainingMode: 'Chính quy',
      major: 'Luật',
      currentCohort: 'K49 (2024–2028)',
      originalCohort: 'K49 (2024–2028)',
    },
  ],
  'sv-8': [
    {
      studentId: '2153801030219',
      className: '47-LDS-A',
      trainingMode: 'Chính quy',
      major: 'Luật Dân sự',
      currentCohort: 'K47 (2022–2026)',
      originalCohort: 'K46 (2021–2025)',
    },
  ],
  'sv-9': [
    {
      studentId: '2453801010733',
      className: null,
      trainingMode: null,
      major: 'Luật',
      currentCohort: null,
      originalCohort: null,
    },
  ],
  'sv-10': [
    {
      studentId: '2353801020611',
      className: '48-LTM-B',
      trainingMode: 'Chính quy',
      major: 'Luật Thương mại quốc tế',
      currentCohort: 'K48 (2023–2027)',
      originalCohort: 'K48 (2023–2027)',
    },
  ],
  'sv-11': [
    {
      studentId: '2423801050042',
      className: 'LT-24A',
      trainingMode: 'Liên thông',
      major: 'Luật',
      currentCohort: 'Liên thông K24',
      originalCohort: 'Liên thông K24',
    },
  ],
};

/* JUST FOR DEMO: START · Tài khoản mà database trường "không kết nối được" khi lấy thông tin sinh viên (API trả 503),
   để xem giao diện báo lỗi riêng phần thông tin sinh viên. sv-11 (Đỗ Thành Nam). Bản thật: lỗi thật khi database trường sập. */
export const STUDENT_DIRECTORY_DOWN_USER_IDS: readonly string[] = ['sv-11'];
/* JUST FOR DEMO: END */
