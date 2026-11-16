/* Trang nhỏ mở trong cửa sổ popup khi Google chuyển về sau bước kết nối Google Drive (trang Sao lưu, hộp thêm / sửa nơi lưu):
   gửi kết quả (DriveConnectMessage) cho cửa sổ của cổng rồi tự đóng. Kết quả nằm trong thẻ <script type="application/json">,
   một script nhỏ (chạy nhờ nonce của Content-Security-Policy) đọc ra rồi gửi bằng postMessage cho window.opener và BroadcastChannel. */
import { randomBytes } from 'node:crypto';
import { DRIVE_CONNECT_CHANNEL, type DriveConnectMessage } from '@ulaw/shared';

/** id của thẻ chứa kết quả (test đọc thẻ này). */
export const DRIVE_CONNECT_RESULT_ID = 'drive-connect-result';

/** Trang đã dựng, kèm header Content-Security-Policy đi cùng. */
export interface DriveConnectPage {
  html: string;
  contentSecurityPolicy: string;
}

/**
 * Viết JSON để đặt trong thẻ <script> mà không thoát được ra ngoài (chặn "</script>", "<!--").
 * @param jsonValue  giá trị cần ghi
 * @returns          chuỗi JSON an toàn trong HTML
 */
function jsonForHtml(jsonValue: unknown): string {
  return JSON.stringify(jsonValue).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/**
 * Dựng trang báo kết quả kết nối Drive.
 * @param message    kết quả gửi về hộp thoại
 * @param webOrigin  địa chỉ gốc của cổng (chỉ gửi postMessage cho đúng địa chỉ này)
 * @returns          HTML và CSP (chỉ cho chạy đúng script của trang)
 */
export function driveConnectPage(message: DriveConnectMessage, webOrigin: string): DriveConnectPage {
  const nonce = randomBytes(16).toString('base64');
  const text = message.ok ? `Đã kết nối ${message.email}. Cửa sổ này sẽ tự đóng.` : 'Chưa kết nối được Google Drive. Cửa sổ này sẽ tự đóng.';

  // Gửi hai đường: opener (cách thường), BroadcastChannel (phòng khi trình duyệt cắt opener sau khi qua trang Google)
  const script = `
const message = JSON.parse(document.getElementById(${jsonForHtml(DRIVE_CONNECT_RESULT_ID)}).textContent);
try { if (window.opener) window.opener.postMessage(message, ${jsonForHtml(webOrigin)}); } catch {}
try { const channel = new BroadcastChannel(${jsonForHtml(DRIVE_CONNECT_CHANNEL)}); channel.postMessage(message); channel.close(); } catch {}
setTimeout(() => window.close(), 300);`;

  const html = `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kết nối Google Drive</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;text-align:center}</style></head>
<body><p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>
<script type="application/json" id="${DRIVE_CONNECT_RESULT_ID}">${jsonForHtml(message)}</script>
<script nonce="${nonce}">${script}</script></body>
</html>`;
  return { html, contentSecurityPolicy: `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'` };
}
