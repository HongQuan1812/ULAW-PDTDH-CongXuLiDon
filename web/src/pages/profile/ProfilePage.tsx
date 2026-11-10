/* Trang Thông tin cá nhân (bước 3): phần thông tin cá nhân, thông tin sinh viên, mục "Đơn đã nộp",
   và mục "Đơn phụ trách" (chỉ vai trò được xử lí đơn). */
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { MAIN_STUDENT_MESSAGES, STUDENT_INFO_LABELS, type Profile, type StudentInfo } from '@ulaw/shared';
import { useMyFullCccd, useMyProfile, useSetMainStudent } from '../../api/profile';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { EMPTY_TEXT, formatPhone } from '../../lib/format';
import { useCan } from '../../features/auth/useAuth';
import { readPreviousPageLabel } from '../../app/paths';
import { EditProfileDialog } from './EditProfileDialog';
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
 * và thông tin của MSSV chính. Có MSSV thì có nút "Thông tin sinh viên" mở khung chọn MSSV chính;
 * nút "Sửa thông tin" mở hộp thoại sửa họ tên, CCCD, SĐT.
 * @param profile  hồ sơ của mình
 * @returns        thẻ thông tin
 */
function IdentityCard({ profile }: { profile: Profile }) {
  const [studentSheetOpen, setStudentSheetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const closeEdit = useCallback(() => setEditOpen(false), []);
  const profileQuery = useMyProfile();
  const mainStudent = profile.students.find((student) => student.studentId === profile.mainStudentId) ?? null;

  return (
    <section className={`${styles.card} ${styles.idCard}`}>
      <div className={styles.idHead}>
        <Avatar name={profile.name} size="xl" />
        <div className={styles.titleGroup}>
          <p className={styles.idName}>{profile.name}</p>
          <RefreshButton query={profileQuery} label="thông tin cá nhân" size="small" />
        </div>
        {mainStudent && (
          <Button aria-haspopup="dialog" onClick={() => setStudentSheetOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M15 4v16" />
            </svg>
            Thông tin sinh viên
          </Button>
        )}
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

      {mainStudent && <StudentRow student={mainStudent} />}

      {mainStudent && (
        <Sheet open={studentSheetOpen} onClose={() => setStudentSheetOpen(false)} title="Thông tin sinh viên">
          <StudentPicker profile={profile} onPicked={() => setStudentSheetOpen(false)} />
        </Sheet>
      )}

      <EditProfileDialog open={editOpen} onClose={closeEdit} profile={profile} />
    </section>
  );
}

/**
 * Số CCCD: mặc định hiện dạng che. Bấm "Hiện" thì mới gọi API lấy số đầy đủ; bấm "Ẩn" thì che lại.
 * @param maskedCccd  CCCD đã che; null = chưa có CCCD (hiện "—", không có nút Hiện)
 * @returns           số CCCD và nút Hiện / Ẩn
 */
function CccdValue({ maskedCccd }: { maskedCccd: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const fullCccdQuery = useMyFullCccd(revealed);
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
 * @param student  MSSV chính
 * @returns        hàng thông tin sinh viên
 */
function StudentRow({ student }: { student: StudentInfo }) {
  return (
    <dl className={`${styles.info} ${styles.studentRow}`}>
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
 * Danh sách mọi MSSV trong khung "Thông tin sinh viên". MSSV chính có nhãn "Đang dùng";
 * bấm MSSV khác thì lưu làm MSSV chính, báo thành công rồi đóng khung.
 * @param profile   hồ sơ của mình (các MSSV và MSSV chính)
 * @param onPicked  gọi sau khi đã chọn xong (để đóng khung)
 * @returns         đoạn giới thiệu + danh sách MSSV
 */
function StudentPicker({ profile, onPicked }: { profile: Profile; onPicked: () => void }) {
  const toast = useToast();
  const setMainStudent = useSetMainStudent();
  const savingStudentId = setMainStudent.isPending ? setMainStudent.variables?.studentId : undefined;

  // Bấm MSSV đang dùng thì chỉ đóng khung; MSSV khác thì lưu lên máy chủ
  const pick = async (studentId: string) => {
    if (studentId === profile.mainStudentId) {
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
        Chọn MSSV dùng làm thông tin chính. MSSV này hiện trên trang thông tin và được điền vào file Word khi xuất đơn.
      </p>
      <div className={styles.studentList} role="radiogroup" aria-label="Chọn MSSV chính">
        {profile.students.map((student) => {
          const isMain = student.studentId === profile.mainStudentId;
          const isSaving = student.studentId === savingStudentId;
          return (
            <button
              key={student.studentId}
              type="button"
              role="radio"
              aria-checked={isMain}
              className={styles.studentOption}
              disabled={setMainStudent.isPending}
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
