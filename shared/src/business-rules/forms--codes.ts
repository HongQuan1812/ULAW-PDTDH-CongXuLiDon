/* Mã đơn: <TIỀN TỐ>-<NĂM>-<PHIÊN BẢN 3 chữ số>-<STT 5 chữ số>, vd 'XMM-2026-001-00001'.
   Phiên bản là phiên bản loại đơn mà đơn được nộp theo. Số thứ tự tăng dần theo từng tiền tố và từng năm,
   đếm tiếp qua các phiên bản (đơn thứ 8 trong năm dù nộp theo phiên bản nào cũng là 00008).
   Năm đứng trước phiên bản để sắp theo mã đơn là đúng thứ tự thời gian. Máy chủ sinh mã (trong transaction), giao diện không tự sinh. */

/** Số chữ số của phần phiên bản. */
const VERSION_DIGITS = 3;
/** Số chữ số của phần số thứ tự. */
const SEQUENCE_DIGITS = 5;

/**
 * Ghép mã đơn.
 * @param prefix    tiền tố của loại đơn, vd 'XMM'
 * @param year      năm nộp, vd 2026
 * @param version   phiên bản loại đơn lúc nộp, vd 1
 * @param sequence  số thứ tự trong năm của tiền tố đó, vd 1
 * @returns         vd 'XMM-2026-001-00001'
 */
export function formatFormCode(prefix: string, year: number, version: number, sequence: number): string {
  return `${prefix}-${year}-${String(version).padStart(VERSION_DIGITS, '0')}-${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

/**
 * Mã đơn kế tiếp: số thứ tự lớn nhất đang có của cùng tiền tố và năm (mọi phiên bản), cộng 1.
 * @param prefix         tiền tố của loại đơn, vd 'XMM'
 * @param year           năm nộp, vd 2026
 * @param version        phiên bản loại đơn đang mở, vd 2
 * @param existingCodes  mọi mã đơn đã có (mọi tiền tố, mọi năm)
 * @returns              vd 'XMM-2026-002-01521'; chưa có đơn nào của tiền tố và năm đó thì số thứ tự là 00001
 */
export function nextFormCode(prefix: string, year: number, version: number, existingCodes: Iterable<string>): string {
  const head = `${prefix}-${year}-`;
  let largestSequence = 0;
  for (const code of existingCodes) {
    if (!code.startsWith(head)) continue;
    const sequence = Number(code.slice(code.lastIndexOf('-') + 1));
    if (Number.isInteger(sequence) && sequence > largestSequence) largestSequence = sequence;
  }
  return formatFormCode(prefix, year, version, largestSequence + 1);
}
