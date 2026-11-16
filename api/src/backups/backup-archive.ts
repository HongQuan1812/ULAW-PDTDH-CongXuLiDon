/* Tạo một tệp sao lưu: database (pg_dump dạng custom) và thư mục tệp tải lên, nén chung thành .tar.gz.
   Trong tệp: manifest.json (tạo lúc nào, gồm gì) · database.dump · uploads/…
   Cần pg_dump (bản khớp PostgreSQL của máy chủ) và tar trong máy chạy backend: image api đã cài sẵn (api/Dockerfile). */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Tối đa bao nhiêu kí tự lỗi của lệnh (stderr) đưa vào câu báo. */
const STDERR_LIMIT = 500;

/**
 * Chạy một lệnh, chờ xong.
 * @param command  tên lệnh, vd 'pg_dump'
 * @param args     tham số
 * @param env      biến môi trường thêm vào
 * @throws         lỗi kèm stderr khi lệnh không có hoặc thoát với mã khác 0
 */
function runCommand(command: string, args: readonly string[], env: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-STDERR_LIMIT);
    });
    child.on('error', (error) => reject(new Error(`Không chạy được ${command}: ${error.message}`)));
    child.on('close', (exitCode) => {
      if (exitCode === 0) resolve();
      else reject(new Error(`${command} lỗi (mã ${exitCode}): ${stderr.trim() || 'không rõ lí do'}`));
    });
  });
}

/**
 * Biến môi trường libpq cho pg_dump, đọc từ chuỗi kết nối (mật khẩu không nằm trên dòng lệnh).
 * Bỏ phần ?schema=… của Prisma: libpq không hiểu tham số này.
 * @param databaseUrl  vd 'postgresql://user:pass@postgres:5432/cong_xu_li_don?schema=public'
 * @returns            PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
 */
export function pgEnvOf(databaseUrl: string): Record<string, string> {
  const url = new URL(databaseUrl);
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  };
}

/** Đầu vào của createBackupArchive. */
export interface BackupArchiveInput {
  /** chuỗi kết nối PostgreSQL (DATABASE_URL) */
  databaseUrl: string;
  /** thư mục tệp tải lên (UPLOAD_DIR) */
  uploadDir: string;
  /** tệp .tar.gz cần tạo (thư mục chứa nó tự tạo nếu chưa có) */
  outputPath: string;
  /** lúc bắt đầu, giờ Việt Nam 'YYYY-MM-DDTHH:mm:ss', ghi vào manifest.json */
  startedAt: string;
}

/**
 * Tạo tệp sao lưu.
 * @param input  xem BackupArchiveInput
 * @returns      dung lượng tệp đã tạo, byte
 * @throws       lỗi kèm câu của pg_dump / tar khi không tạo được (tệp dở dang bị xóa)
 */
export async function createBackupArchive({ databaseUrl, uploadDir, outputPath, startedAt }: BackupArchiveInput): Promise<number> {
  const workDir = await mkdtemp(path.join(tmpdir(), 'sao-luu-'));
  try {
    // database.dump và manifest.json trong thư mục tạm
    await runCommand('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', `--file=${path.join(workDir, 'database.dump')}`], pgEnvOf(databaseUrl));
    await writeFile(
      path.join(workDir, 'manifest.json'),
      JSON.stringify({ app: 'cong-xu-li-don', startedAt, contents: ['database.dump', 'uploads/'], restore: 'pg_restore --clean --if-exists database.dump; chép uploads/ vào UPLOAD_DIR' }, null, 2),
    );

    // Nén chung với thư mục tệp tải lên (chưa có thì coi như trống), trong tệp luôn tên uploads/
    const uploads = path.resolve(uploadDir);
    await mkdir(uploads, { recursive: true });
    await mkdir(path.dirname(outputPath), { recursive: true });
    await runCommand('tar', [
      '-czf',
      outputPath,
      '-C',
      workDir,
      'manifest.json',
      'database.dump',
      '-C',
      path.dirname(uploads),
      `--transform=s,^${path.basename(uploads)},uploads,`,
      path.basename(uploads),
    ]);
    return (await stat(outputPath)).size;
  } catch (error) {
    await rm(outputPath, { force: true });
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
