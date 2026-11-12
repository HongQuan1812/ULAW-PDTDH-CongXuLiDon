/* Trang Thông tin cá nhân (bước 3): phần thông tin cá nhân, thông tin sinh viên, mục "Đơn đã nộp",
   và mục "Đơn phụ trách" (chỉ vai trò được xử lí đơn). */
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import {
  MAIN_STUDENT_MESSAGES,
  STUDENT_INFO_LABELS,
  type Account,
  type Profile,
  type SetMainStudentRequest,
  type StudentInfo,
  type StudentsResponse,
} from '@ulaw/shared';
import { useMyFullCccd, useMyProfile, useMyStudents, usePersonFullCccd, useSetMainStudent } from '../../api/profile';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { EMPTY_TEXT, formatPhone } from '../../lib/format';
import { AccountDialog } from '../../features/accounts/AccountDialog';
import { useAuth, useCan } from '../../features/auth/useAuth';
import { readPreviousPageLabel } from '../../app/paths';
import { HandledForms } from './HandledForms';
import { SubmittedForms } from './SubmittedForms';
import styles from './ProfilePage.module.css';

/** Câu báo khi không tải được hồ sơ mà máy chủ không gửi kèm câu báo lỗi (vd mất mạng). */
const LOAD_FAILED_TEXT = 'Không tải được thông tin cá nhân.';

/**
 * Tải hồ sơ của mình rồi vẽ trang. Các bảng đơn tải riêng, không chờ hồ sơ.
 * Đã có hồ sơ thì luôn hiện hồ sơ, kể cả khi lần tải lại sau đó bị lỗi (lỗi đó báo bằng toast).
 * @returns  giao diện trang: thẻ thông tin (đang tải / lỗi / thông tin), mục Đơn đã nộp,
 *           và mục Đơn phụ trách nếu vai trò có quyền decide;
 *           mở từ trang đơn ("Xem hồ sơ ›") thì có thêm nút "‹ Quay lại đơn đang soạn" ở đầu trang
 */
export function ProfilePage() {
  const profileQuery = useMyProfile();
  const canHandleForms = useCan('decide');
  const navigate = useNavigate();
  const previousPageLabel = readPreviousPageLabel(useLocation().state);

  return (
    <div className={styles.page}>
      {previousPageLabel && (
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          ‹ Quay lại {previousPageLabel}
        </button>
      )}
      <h1 className="sr-only">Thông tin cá nhân</h1>
      {profileQuery.isPending ? (
        <section className={styles.card}>
          <p className={styles.muted}>Đang tải thông tin…</p>
        </section>
      ) : profileQuery.data ? (
        <IdentityCard profile={profileQuery.data} />
      ) : (
        <section className={`${styles.card} ${styles.errorCard}`}>
          <LoadError message={loadErrorMessage(profileQuery) ?? LOAD_FAILED_TEXT} />
          <RefreshButton query={profileQuery} label="thông tin cá nhân" />
        </section>
      )}
      <SubmittedForms />
      {canHandleForms && <HandledForms />}
    </div>
  );
}

/**
 * Thẻ thông tin cá nhân: ảnh đại diện, họ tên, email, SĐT, CCCD (che, bấm Hiện để xem đủ)
 * và thông tin của MSSV chính (tải riêng: database trường lỗi thì chỉ phần này báo lỗi, kèm nút ↻).
 * Có MSSV thì có nút "Thông tin sinh viên" mở khung chọn MSSV chính;
 * nút "Sửa thông tin" mở hộp sửa tài khoản dùng chung (họ tên, CCCD, SĐT; Admin thấy thêm Vai trò, bị khóa).
 * @param profile  hồ sơ của mình
 * @returns        thẻ thông tin
 */
function IdentityCard({ profile }: { profile: Profile }) {
  const [studentSheetOpen, setStudentSheetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const closeEdit = useCallback(() => setEditOpen(false), []);
  const profileQuery = useMyProfile();
  const studentsQuery = useMyStudents();
  const setMainStudent = useSetMainStudent();
  const { user } = useAuth();
  const mainStudent = findMainStudent(studentsQuery.data);

  return (
    <section className={`${styles.card} ${styles.idCard}`}>
      <div className={styles.idHead}>
        <Avatar name={profile.name} size="xl" />
        <div className={styles.titleGroup}>
          <p className={styles.idName}>{profile.name}</p>
          {/* ↻ tải lại cả hồ sơ lẫn thông tin sinh viên */}
          <RefreshButton query={profileQuery} label="thông tin cá nhân" size="small" onRefresh={() => studentsQuery.refetch()} />
        </div>
        {mainStudent && <StudentInfoButton onClick={() => setStudentSheetOpen(true)} />}
        <Button aria-haspopup="dialog" onClick={() => setEditOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16z" />
          </svg>
          Sửa thông tin
        </Button>
      </div>

      <dl className={styles.info}>
        <div className={styles.readOnly}>
          <dt>Email</dt>
          <dd>{profile.email}</dd>
        </div>
        <div>
          <dt>Số điện thoại</dt>
          <dd>{formatPhone(profile.phone)}</dd>
        </div>
        <div>
          <dt>Số CCCD</dt>
          <dd>
            <CccdValue maskedCccd={profile.maskedCccd} />
          </dd>
        </div>
      </dl>

      {/* điện thoại: ẩn cho gọn, xem trong khung "Thông tin sinh viên" (nút ở đầu thẻ) */}
      {mainStudent && <StudentRow student={mainStudent} hideOnNarrowScreen />}
      <StudentsLoadState studentsQuery={studentsQuery} />

      {mainStudent && studentsQuery.data && (
        <Sheet open={studentSheetOpen} onClose={() => setStudentSheetOpen(false)} title="Thông tin sinh viên">
          <StudentPicker studentsResponse={studentsQuery.data} setMainStudent={setMainStudent} onPicked={() => setStudentSheetOpen(false)} />
        </Sheet>
      )}

      <AccountDialog open={editOpen} onClose={closeEdit} account={myAccount(user.id, profile)} />
    </section>
  );
}

/**
 * Đổi hồ sơ của mình sang dạng tài khoản mà hộp sửa tài khoản cần.
 * @param userId   id của mình
 * @param profile  hồ sơ của mình (CCCD che)
 * @returns        tài khoản
 */
function myAccount(userId: string, profile: Profile): Account {
  const { name, email, role, phone, maskedCccd } = profile;
  return { id: userId, name, email, role, phone, maskedCccd };
}

/**
 * Số CCCD: mặc định hiện dạng che. Bấm "Hiện" thì mới gọi API lấy số đầy đủ; bấm "Ẩn" thì che lại.
 * @param maskedCccd  CCCD đã che; null = chưa có CCCD (hiện "—", không có nút Hiện)
 * @param userId      id người được xem; bỏ trống = CCCD của chính mình
 * @returns           số CCCD và nút Hiện / Ẩn
 */
export function CccdValue({ maskedCccd, userId }: { maskedCccd: string | null; userId?: string }) {
  const [revealed, setRevealed] = useState(false);
  const myCccdQuery = useMyFullCccd(revealed && !userId);
  const personCccdQuery = usePersonFullCccd(userId ?? '', revealed && !!userId);
  const fullCccdQuery = userId ? personCccdQuery : myCccdQuery;
  const fullCccdError = loadErrorMessage(fullCccdQuery);

  if (!maskedCccd) return <>{EMPTY_TEXT}</>;

  // Đang hiện và đã có số đầy đủ thì hiện số đầy đủ; còn lại hiện dạng che.
  // "Đang tải…" chỉ khi chưa có số nào (lần đầu bấm Hiện); lấy lại ngầm sau khi sửa thông tin thì không hiện
  const fullCccd = revealed ? fullCccdQuery.data?.cccd : undefined;
  const loading = revealed && fullCccdQuery.isPending;

  return (
    <>
      <span>{fullCccd ?? maskedCccd}</span>
      <button type="button" className={styles.reveal} disabled={loading} onClick={() => setRevealed((value) => !value)}>
        {loading ? 'Đang tải…' : revealed ? 'Ẩn' : 'Hiện'}
      </button>
      {revealed && fullCccdError && <LoadError message={fullCccdError} compact />}
    </>
  );
}

/**
 * Tìm MSSV chính trong thông tin sinh viên đã tải.
 * @param studentsResponse  thông tin sinh viên; undefined = chưa tải xong hoặc lỗi
 * @returns                 MSSV chính; chưa có dữ liệu hoặc không có MSSV nào thì null
 */
export function findMainStudent(studentsResponse: StudentsResponse | undefined): StudentInfo | null {
  return studentsResponse?.students.find((student) => student.studentId === studentsResponse.mainStudentId) ?? null;
}

/**
 * Chỗ thông tin sinh viên khi chưa có dữ liệu: đang tải thì câu chờ; lỗi (vd database trường không kết nối được)
 * thì câu báo lỗi (tải lại bằng nút ↻ cạnh họ tên). Đã có dữ liệu thì không hiện gì (hàng MSSV do trang tự vẽ).
 * @param studentsQuery  kết quả useMyStudents / usePersonStudents
 * @returns              câu chờ, câu báo lỗi, hoặc null
 */
export function StudentsLoadState({ studentsQuery }: { studentsQuery: UseQueryResult<StudentsResponse> }) {
  if (studentsQuery.isFetching && !studentsQuery.data) return <p className={styles.muted}>Đang tải thông tin sinh viên…</p>;
  const errorMessage = loadErrorMessage(studentsQuery);
  return errorMessage ? <LoadError message={errorMessage} compact /> : null;
}

/**
 * Lấy giá trị một mục của MSSV để hiện; mục trống thì "—".
 * @param student  thông tin một MSSV
 * @param key      tên mục, vd 'className'
 * @returns        giá trị đã cắt khoảng trắng, hoặc "—"
 */
function studentValue(student: StudentInfo, key: keyof StudentInfo): string {
  return student[key]?.trim() || EMPTY_TEXT;
}

/**
 * Hàng 6 mục của MSSV chính (MSSV, Lớp, Hình thức đào tạo, Ngành, Khóa học hiện tại, Khóa học gốc).
 * Lấy từ database trường, không sửa được nên nền xám. Mục database trường không có thì ghi "—".
 * @param student             MSSV chính
 * @param hideOnNarrowScreen  true: ẩn trên điện thoại (chỉ dùng khi trang có khung "Thông tin sinh viên" để xem thay)
 * @returns                   hàng thông tin sinh viên
 */
export function StudentRow({ student, hideOnNarrowScreen = false }: { student: StudentInfo; hideOnNarrowScreen?: boolean }) {
  return (
    <dl className={`${styles.info} ${styles.studentRow} ${hideOnNarrowScreen ? styles.hideOnNarrowScreen : ''}`}>
      {STUDENT_INFO_LABELS.map(({ key, label }) => (
        <div key={key} className={styles.readOnly}>
          <dt>{label}</dt>
          <dd>{studentValue(student, key)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Nút "Thông tin sinh viên" ở đầu thẻ thông tin, mở khung chọn / xem các MSSV.
 * @param onClick  mở khung
 * @returns        nút
 */
export function StudentInfoButton({ onClick }: { onClick: () => void }) {
  return (
    <Button aria-haspopup="dialog" onClick={onClick}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M15 4v16" />
      </svg>
      Thông tin sinh viên
    </Button>
  );
}

/**
 * Danh sách mọi MSSV trong khung "Thông tin sinh viên". MSSV chính có nhãn "Đang dùng";
 * bấm MSSV khác thì lưu làm MSSV chính, báo thành công rồi đóng khung.
 * Không có lệnh lưu (người xem không được đổi MSSV chính của người khác) thì chỉ xem, các thẻ không bấm được.
 * @param studentsResponse  thông tin sinh viên đang xem (các MSSV và MSSV chính): của mình hoặc của người khác
 * @param setMainStudent    lệnh lưu MSSV chính (useSetMainStudent / useSetPersonMainStudent); null = chỉ xem
 * @param onPicked        gọi sau khi đã chọn xong (để đóng khung)
 * @returns               đoạn giới thiệu + danh sách MSSV
 */
export function StudentPicker({
  studentsResponse,
  setMainStudent,
  onPicked,
}: {
  studentsResponse: StudentsResponse;
  setMainStudent: UseMutationResult<StudentsResponse, Error, SetMainStudentRequest> | null;
  onPicked: () => void;
}) {
  const toast = useToast();
  const savingStudentId = setMainStudent?.isPending ? setMainStudent.variables?.studentId : undefined;

  // Bấm MSSV đang dùng thì chỉ đóng khung; MSSV khác thì lưu lên máy chủ
  const pick = async (studentId: string) => {
    if (!setMainStudent) return;
    if (studentId === studentsResponse.mainStudentId) {
      onPicked();
      return;
    }
    try {
      await setMainStudent.mutateAsync({ studentId });
      toast(MAIN_STUDENT_MESSAGES[200](studentId), 'success');
      onPicked();
    } catch (error) {
      toast(error instanceof Error ? error.message : MAIN_STUDENT_MESSAGES[422], 'error');
    }
  };

  return (
    <>
      <p className={styles.sheetIntro}>
        {setMainStudent
          ? 'Chọn MSSV dùng làm thông tin chính. MSSV này hiện trên trang thông tin và được điền vào file Word khi xuất đơn.'
          : 'MSSV “Đang dùng” là thông tin chính khi xuất file. Chỉ người nộp đơn hoặc Admin mới đổi được.'}
      </p>
      <div className={styles.studentList} role="radiogroup" aria-label={setMainStudent ? 'Chọn MSSV chính' : 'Các MSSV'}>
        {studentsResponse.students.map((student) => {
          const isMain = student.studentId === studentsResponse.mainStudentId;
          const isSaving = student.studentId === savingStudentId;
          return (
            <button
              key={student.studentId}
              type="button"
              role="radio"
              aria-checked={isMain}
              className={`${styles.studentOption} ${setMainStudent ? '' : styles.viewOnly}`}
              disabled={!setMainStudent || setMainStudent.isPending}
              onClick={() => pick(student.studentId)}
            >
              <span className={styles.optionTop}>
                <span className={styles.optionId}>{student.studentId}</span>
                {isMain && <span className={styles.optionTag}>Đang dùng</span>}
                {isSaving && <span className={styles.optionSaving}>Đang lưu…</span>}
              </span>
              <span className={styles.optionGrid}>
                {STUDENT_INFO_LABELS.filter(({ key }) => key !== 'studentId').map(({ key, label }) => (
                  <span key={key}>
                    <span className={styles.optionLabel}>{label}</span>
                    <span className={styles.optionValue}>{studentValue(student, key)}</span>
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
