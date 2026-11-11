/* Trang thông tin một người khác (như viewedPerson() với state.viewing của artifact/js/profile.js).
   Mở từ "Xem hồ sơ ›" ở trang đơn, hoặc bấm dòng ở trang Quản lí tài khoản; có nút "‹ Quay lại …" ở đầu trang.
   Có quyền editApplicant (Admin) thì có nút "Sửa thông tin" (cùng hộp với nút Sửa ở Quản lí tài khoản).
   Người đó là cán bộ (vai trò có quyền decide) và người xem có quyền viewAll thì có thêm mục "Đơn phụ trách". */
import { useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router';
import { can, type Account, type FormSummary, type Profile } from '@ulaw/shared';
import { usePersonForms, usePersonProfile } from '../../api/profile';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { formatPhone } from '../../lib/format';
import { readPreviousPageLabel } from '../../app/paths';
import { useCan } from '../../features/auth/useAuth';
import { AccountDialog } from '../../features/accounts/AccountDialog';
import { BASE_FORM_FIELDS, FormTable } from './FormTable';
import { PersonHandledForms } from './HandledForms';
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
  const canEdit = useCan('editApplicant');
  const canViewAll = useCan('viewAll');
  const [editOpen, setEditOpen] = useState(false);
  // Mục "Đơn phụ trách": người đó là cán bộ và người xem được xem mọi đơn
  const showHandledForms = !!profile && can(profile.role, 'decide') && canViewAll;

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
              {canEdit && (
                <Button aria-haspopup="dialog" onClick={() => setEditOpen(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 20h4L19 9l-4-4L4 16z" />
                  </svg>
                  Sửa thông tin
                </Button>
              )}
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

      {showHandledForms && <PersonHandledForms userId={userId} pageLabel="Thông tin người nộp đơn" />}

      {canEdit && profile && (
        <AccountDialog open={editOpen} account={toAccount(userId, profile)} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}

/**
 * Đổi hồ sơ người khác sang dạng tài khoản mà hộp sửa tài khoản cần.
 * @param userId   id người đó
 * @param profile  hồ sơ đã tải (CCCD che)
 * @returns        tài khoản
 */
function toAccount(userId: string, profile: Profile): Account {
  const { name, email, role, phone, maskedCccd } = profile;
  return { id: userId, name, email, role, phone, maskedCccd };
}

/** Mảng rỗng dùng chung khi chưa tải xong, để bảng không bị tính lại mỗi lần vẽ. */
const NO_FORMS: FormSummary[] = [];

