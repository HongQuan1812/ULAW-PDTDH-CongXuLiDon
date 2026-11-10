/* Trang Thông tin người nộp đơn (như viewedPerson() với state.viewing của artifact/js/profile.js): hồ sơ của một người khác,
   chỉ xem. Mở từ "Xem hồ sơ ›" ở trang đơn; có nút "‹ Quay lại đơn …" ở đầu trang. */
import { useNavigate, useLocation, useParams } from 'react-router';
import type { FormSummary } from '@ulaw/shared';
import { usePersonForms, usePersonProfile } from '../../api/profile';
import { Avatar } from '../../components/Avatar';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { formatPhone } from '../../lib/format';
import { readPreviousPageLabel } from '../../app/paths';
import { BASE_FORM_FIELDS, FormTable } from './FormTable';
import { CccdValue, StudentRow } from './ProfilePage';
import styles from './ProfilePage.module.css';

/** Câu báo khi không tải được hồ sơ mà máy chủ không gửi kèm câu báo lỗi (vd mất mạng). */
const LOAD_FAILED_TEXT = 'Không tải được thông tin người nộp đơn.';

/**
 * Tải hồ sơ và các đơn đã nộp của người trong đường dẫn rồi vẽ trang (chỉ xem, không sửa).
 * @returns  thẻ thông tin (đang tải / lỗi / thông tin) và mục "Đơn đã nộp"
 */
export function PersonProfilePage() {
  const { userId = '' } = useParams();
  const profileQuery = usePersonProfile(userId);
  const formsQuery = usePersonForms(userId);
  const navigate = useNavigate();
  const previousPageLabel = readPreviousPageLabel(useLocation().state);
  const profile = profileQuery.data;
  const mainStudent = profile?.students.find((student) => student.studentId === profile.mainStudentId) ?? null;

  return (
    <div className={styles.page}>
      {previousPageLabel && (
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          ‹ Quay lại {previousPageLabel}
        </button>
      )}
      <h1 className="sr-only">Thông tin người nộp đơn</h1>

      <section className={`${styles.card} ${styles.idCard}`}>
        {profileQuery.isPending ? (
          <p className={styles.muted}>Đang tải thông tin…</p>
        ) : profile ? (
          <>
            <div className={styles.idHead}>
              <Avatar name={profile.name} size="xl" />
              <div className={styles.titleGroup}>
                <p className={styles.idName}>{profile.name}</p>
                <RefreshButton query={profileQuery} label="thông tin người nộp đơn" size="small" />
              </div>
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
                  <CccdValue maskedCccd={profile.maskedCccd} userId={userId} />
                </dd>
              </div>
            </dl>
            {mainStudent && <StudentRow student={mainStudent} />}
          </>
        ) : (
          <div className={styles.errorCard}>
            <LoadError message={loadErrorMessage(profileQuery) ?? LOAD_FAILED_TEXT} />
            <RefreshButton query={profileQuery} label="thông tin người nộp đơn" />
          </div>
        )}
      </section>

      <section className={`${styles.card} ${styles.tableCard}`} aria-labelledby="person-forms-title">
        <div className={styles.sectionHead}>
          <div className={styles.titleGroup}>
            <h2 id="person-forms-title">Đơn đã nộp</h2>
            <RefreshButton query={formsQuery} label="Đơn đã nộp" size="small" />
          </div>
        </div>
        <FormTable
          tableId="person.submittedForms"
          fields={BASE_FORM_FIELDS}
          rows={formsQuery.data ?? NO_FORMS}
          isPending={formsQuery.isPending}
          errorMessage={loadErrorMessage(formsQuery)}
          searchPlaceholder="Tìm theo mã đơn, loại đơn, ngày nộp, trạng thái"
          searchLabel="Tìm đơn đã nộp"
          emptyText="Chưa có đơn nào."
          pageLabel="Thông tin người nộp đơn"
        />
      </section>
    </div>
  );
}

/** Mảng rỗng dùng chung khi chưa tải xong, để bảng không bị tính lại mỗi lần vẽ. */
const NO_FORMS: FormSummary[] = [];

