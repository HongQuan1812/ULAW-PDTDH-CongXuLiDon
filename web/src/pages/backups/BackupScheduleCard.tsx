/* Mục "Lịch định kì" trong khung “Lịch và nơi lưu” của trang Sao lưu: danh sách các lịch (thu gọn được, nút + để thêm lịch).
   Mỗi lịch một dòng: lúc chạy (vd "Hằng ngày lúc 02:00"), các nơi lưu, nhãn Bật / Tắt, nút Sửa.
   Hộp thêm / sửa lịch: bật / tắt, hằng ngày hoặc hằng tuần (thứ mấy), giờ chạy (giờ Việt Nam), lưu vào các nơi nào; đang sửa thì có nút Bỏ lịch. */
import { useState } from 'react';
import {
  BACKUP_MESSAGES,
  BACKUP_TARGET_KIND_LABEL,
  BackupScheduleSchema,
  WEEKDAY_LABEL,
  type BackupFrequency,
  type BackupSchedule,
  type BackupScheduleItem,
  type BackupsResponse,
} from '@ulaw/shared';
import { useSaveBackupSchedule } from '../../api/backups';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Switch } from '../../components/Switch';
import { useToast } from '../../components/Toast';
import { errorText, isTargetUsable } from './BackupTargetsCard';
import { PanelSection } from './PanelSection';
import styles from './BackupsPage.module.css';

/** Lịch mới: bật, 02:00 hằng ngày, chưa chọn nơi lưu. */
const NEW_SCHEDULE: BackupSchedule = { enabled: true, frequency: 'daily', weekday: 1, time: '02:00', targetIds: [] };

/**
 * Lúc chạy của một lịch.
 * @param schedule  lịch
 * @returns         vd "Hằng ngày lúc 02:00", "Chủ nhật hằng tuần lúc 23:00"
 */
function scheduleText(schedule: BackupSchedule): string {
  return schedule.frequency === 'daily' ? `Hằng ngày lúc ${schedule.time}` : `${WEEKDAY_LABEL[schedule.weekday]} hằng tuần lúc ${schedule.time}`;
}

/**
 * Mục Lịch định kì.
 * @param overview  tổng quan (các lịch, các nơi lưu)
 * @returns         mục, kèm hộp thêm / sửa lịch
 */
export function BackupScheduleCard({ overview }: { overview: BackupsResponse }) {
  // Hộp thêm / sửa: undefined = đóng, null = thêm mới, lịch = sửa lịch đó
  const [editing, setEditing] = useState<BackupScheduleItem | null | undefined>(undefined);
  const targetNameOf = (targetId: string) => overview.targets.find((target) => target.id === targetId)?.name;

  return (
    <PanelSection title="Lịch định kì" count={overview.schedules.length} addLabel="Thêm lịch" onAdd={() => setEditing(null)} storageKey="backupsPanel.schedules.collapsed">
      {overview.schedules.length === 0 ? (
        <p className={styles.emptyNote}>Chưa có lịch nào, máy chủ không tự sao lưu. Bấm + để thêm lịch.</p>
      ) : (
        <ul className={styles.itemList}>
          {overview.schedules.map((schedule) => {
            const names = schedule.targetIds.map(targetNameOf).filter(Boolean);
            return (
              <li key={schedule.id} className={styles.item} data-off={!schedule.enabled}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemTitle}>
                    {scheduleText(schedule)}
                    <span className={`${styles.pill} ${styles.pillSmall} ${schedule.enabled ? styles.pill_ok : styles.pill_off}`}>{schedule.enabled ? 'Bật' : 'Tắt'}</span>
                  </span>
                  <span className={styles.targetMeta}>{names.length ? `Vào ${names.join(', ')}` : 'Chưa chọn nơi lưu'}</span>
                </div>
                <button type="button" className={styles.linkButton} onClick={() => setEditing(schedule)} aria-label={`Sửa lịch ${scheduleText(schedule)}`}>
                  Sửa
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Sửa lịch' : 'Thêm lịch'}>
        {editing !== undefined && <ScheduleForm key={editing?.id ?? 'new'} overview={overview} schedule={editing} onClose={() => setEditing(undefined)} />}
      </Modal>
    </PanelSection>
  );
}

/**
 * Form thêm / sửa một lịch: sửa trên bản nháp, bấm Lưu lịch mới gửi lên.
 * @param overview  tổng quan (các nơi lưu)
 * @param schedule  lịch cần sửa; null = thêm mới
 * @param onClose   gọi khi bấm Hủy, lưu xong hoặc bỏ xong
 * @returns         form
 */
function ScheduleForm({ overview, schedule, onClose }: { overview: BackupsResponse; schedule: BackupScheduleItem | null; onClose: () => void }) {
  const toast = useToast();
  const saveSchedule = useSaveBackupSchedule();
  const [draft, setDraft] = useState<BackupSchedule>(() => {
    if (!schedule) return NEW_SCHEDULE;
    const { id: _id, ...fields } = schedule;
    return fields;
  });
  const [error, setError] = useState('');

  // Nơi lưu đã bỏ thì không còn trong lịch
  const targetIds = draft.targetIds.filter((id) => overview.targets.some((target) => target.id === id));

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
    const parsed = BackupScheduleSchema.safeParse({ ...draft, targetIds });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? BACKUP_MESSAGES[422]);
      return;
    }
    try {
      await saveSchedule.mutateAsync({ schedule: parsed.data, scheduleId: schedule?.id });
      toast(schedule ? BACKUP_MESSAGES.scheduleSaved : BACKUP_MESSAGES.scheduleAdded, 'success');
      onClose();
    } catch (saveError) {
      toast(errorText(saveError), 'error');
    }
  };

  /** Bỏ lịch đang sửa (lịch sử giữ nguyên). */
  const remove = async () => {
    if (!schedule) return;
    try {
      await saveSchedule.mutateAsync({ scheduleId: schedule.id, remove: true });
      toast(BACKUP_MESSAGES.scheduleRemoved, 'success');
      onClose();
    } catch (removeError) {
      toast(errorText(removeError), 'error');
    }
  };

  return (
    <div className={styles.dialogBody}>
      <div className={styles.dialogHeadRow}>
        <p className={styles.dialogText}>Máy chủ tự sao lưu theo lịch, giờ Việt Nam. Máy chủ tắt đúng lúc đó thì lần ấy bị bỏ qua.</p>
        <Switch
          className={styles.scheduleSwitch}
          checked={draft.enabled}
          onChange={(isEnabled) => change({ enabled: isEnabled })}
          label={draft.enabled ? 'Đang bật' : 'Đang tắt'}
        />
      </div>

      <fieldset className={styles.plain} disabled={!draft.enabled}>
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>
            Chạy
            <select value={draft.frequency} onChange={(event) => change({ frequency: event.target.value as BackupFrequency })}>
              <option value="daily">Hằng ngày</option>
              <option value="weekly">Hằng tuần</option>
            </select>
          </label>
          {draft.frequency === 'weekly' && (
            <label className={styles.fieldLabel}>
              Vào
              <select value={draft.weekday} onChange={(event) => change({ weekday: Number(event.target.value) })}>
                {Object.entries(WEEKDAY_LABEL).map(([weekday, label]) => (
                  <option key={weekday} value={weekday}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={styles.fieldLabel}>
            Lúc
            <input type="time" value={draft.time} onChange={(event) => change({ time: event.target.value })} required />
          </label>
        </div>

        <div className={styles.fieldLabel}>
          <span>Lưu vào</span>
          {overview.targets.length === 0 ? (
            <p className={styles.dialogText}>Chưa có nơi lưu nào: thêm ở mục Nơi lưu.</p>
          ) : (
            <div className={styles.choiceList}>
              {overview.targets.map((target) => {
                const usable = isTargetUsable(target);
                return (
                  <label key={target.id} className={styles.choice} data-disabled={!draft.enabled}>
                    <input type="checkbox" checked={targetIds.includes(target.id)} onChange={(event) => toggleTarget(target.id, event.target.checked)} />
                    <span className={styles.choiceText}>
                      <span className={styles.choiceName}>{target.name}</span>
                      <span className={`${styles.choiceMeta} ${usable ? '' : styles.choiceWarn}`}>
                        {usable ? BACKUP_TARGET_KIND_LABEL[target.kind] : 'Chưa kết nối tài khoản Google: lần định kì vào đây sẽ báo lỗi'}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </fieldset>

      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.dialogButtons}>
        {schedule && (
          <Button variant="danger" onClick={() => void remove()} disabled={saveSchedule.isPending}>
            Bỏ lịch
          </Button>
        )}
        <span className={styles.spacer} />
        <Button variant="ghost" onClick={onClose}>
          Hủy
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={saveSchedule.isPending}>
          {saveSchedule.isPending ? 'Đang lưu…' : 'Lưu lịch'}
        </Button>
      </div>
    </div>
  );
}
