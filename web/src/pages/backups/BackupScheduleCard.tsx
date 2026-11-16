/* Thẻ Lịch định kì của trang Sao lưu: bật / tắt, hằng ngày hoặc hằng tuần (thứ mấy), giờ chạy (giờ Việt Nam), lưu vào các nơi nào. */
import { useState } from 'react';
import {
  BACKUP_MESSAGES,
  BACKUP_TARGET_KIND_LABEL,
  BackupScheduleSchema,
  WEEKDAY_LABEL,
  type BackupFrequency,
  type BackupSchedule,
  type BackupsResponse,
} from '@ulaw/shared';
import { useSaveBackupSchedule } from '../../api/backups';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import profileStyles from '../profile/ProfilePage.module.css';
import styles from './BackupsPage.module.css';

/**
 * Thẻ lịch định kì: sửa tại chỗ, bấm Lưu lịch mới gửi lên.
 * @param overview  tổng quan (lịch đang dùng, các nơi lưu)
 * @returns         thẻ
 */
export function BackupScheduleCard({ overview }: { overview: BackupsResponse }) {
  const toast = useToast();
  const saveSchedule = useSaveBackupSchedule();
  const [draft, setDraft] = useState<BackupSchedule>(overview.schedule);
  const [error, setError] = useState('');

  // Nơi lưu đã bỏ thì không còn trong lịch; có sửa gì so với lịch đang dùng không
  const targetIds = draft.targetIds.filter((id) => overview.targets.some((target) => target.id === id));
  const schedule = { ...draft, targetIds };
  const changed = JSON.stringify(schedule) !== JSON.stringify(overview.schedule);

  /**
   * Sửa một phần của lịch đang soạn.
   * @param changes  phần cần sửa
   */
  const change = (changes: Partial<BackupSchedule>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setError('');
  };

  /**
   * Bật / tắt một nơi lưu trong lịch.
   * @param targetId  id nơi lưu
   * @param checked   có lưu vào đó không
   */
  const toggleTarget = (targetId: string, checked: boolean) =>
    change({ targetIds: checked ? [...targetIds, targetId] : targetIds.filter((id) => id !== targetId) });

  /** Kiểm tra rồi lưu lịch. */
  const save = async () => {
    const parsed = BackupScheduleSchema.safeParse(schedule);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? BACKUP_MESSAGES[422]);
      return;
    }
    try {
      const saved = await saveSchedule.mutateAsync(parsed.data);
      setDraft(saved.schedule);
      toast(BACKUP_MESSAGES.scheduleSaved, 'success');
    } catch (saveError) {
      toast(saveError instanceof Error ? saveError.message : BACKUP_MESSAGES[422], 'error');
    }
  };

  return (
    <section className={profileStyles.card} aria-labelledby="schedule-title">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleBlock}>
          <h2 id="schedule-title">Lịch định kì</h2>
          <p className={styles.cardDescription}>Máy chủ tự sao lưu theo lịch, giờ Việt Nam. Máy chủ tắt đúng lúc đó thì lần ấy bị bỏ qua.</p>
        </div>
        <label className={styles.switch}>
          <input type="checkbox" checked={draft.enabled} onChange={(event) => change({ enabled: event.target.checked })} />
          <span>{draft.enabled ? 'Đang bật' : 'Đang tắt'}</span>
        </label>
      </div>

      <fieldset className={styles.scheduleGrid} disabled={!draft.enabled}>
        <label className={styles.inlineField}>
          <span>Chạy</span>
          <select value={draft.frequency} onChange={(event) => change({ frequency: event.target.value as BackupFrequency })}>
            <option value="daily">Hằng ngày</option>
            <option value="weekly">Hằng tuần</option>
          </select>
        </label>
        {draft.frequency === 'weekly' && (
          <label className={styles.inlineField}>
            <span>Vào</span>
            <select value={draft.weekday} onChange={(event) => change({ weekday: Number(event.target.value) })}>
              {Object.entries(WEEKDAY_LABEL).map(([weekday, label]) => (
                <option key={weekday} value={weekday}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={styles.inlineField}>
          <span>Lúc</span>
          <input type="time" value={draft.time} onChange={(event) => change({ time: event.target.value })} required />
        </label>
      </fieldset>

      <fieldset className={styles.scheduleTargets} disabled={!draft.enabled}>
        <legend>Lưu vào</legend>
        {overview.targets.length === 0 ? (
          <p className={profileStyles.muted}>Chưa có nơi lưu nào: thêm ở thẻ Nơi lưu.</p>
        ) : (
          overview.targets.map((target) => (
            <label key={target.id} className={styles.checkRow}>
              <input type="checkbox" checked={targetIds.includes(target.id)} onChange={(event) => toggleTarget(target.id, event.target.checked)} />
              <span>
                {target.name} <small>({BACKUP_TARGET_KIND_LABEL[target.kind]})</small>
              </span>
            </label>
          ))
        )}
      </fieldset>

      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.cardActions}>
        <Button variant="ghost" onClick={() => setDraft(overview.schedule)} disabled={!changed || saveSchedule.isPending}>
          Bỏ thay đổi
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={!changed || saveSchedule.isPending}>
          {saveSchedule.isPending ? 'Đang lưu…' : 'Lưu lịch'}
        </Button>
      </div>
    </section>
  );
}
