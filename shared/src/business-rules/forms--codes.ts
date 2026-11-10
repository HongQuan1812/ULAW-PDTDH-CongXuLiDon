/* Mã đơn: <TIỀN TỐ>-<NĂM>-<STT 5 chữ số>, vd 'XMM-2026-00001'.
   Số thứ tự tăng dần theo từng tiền tố và từng năm. Máy chủ sinh mã (trong transaction), giao diện không tự sinh. */

/** Số chữ số của phần số thứ tự. */
const SEQUENCE_DIGITS = 5;

/**
 * Ghép mã đơn.
 * @param prefix    tiền tố của loại đơn, vd 'XMM'
 * @param year      năm nộp, vd 2026
 * @param sequence  số thứ tự trong năm của tiền tố đó, vd 1
 * @returns         vd 'XMM-2026-00001'
 */
export function formatFormCode(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

/**
 * Mã đơn kế tiếp: số thứ tự lớn nhất đang có của cùng tiền tố và năm, cộng 1.
 * @param prefix         tiền tố của loại đơn, vd 'XMM'
 * @param year           năm nộp, vd 2026
 * @param existingCodes  mọi mã đơn đã có (mọi tiền tố, mọi năm)
 * @returns              vd 'XMM-2026-01521'; chưa có đơn nào của tiền tố và năm đó thì 'XMM-2026-00001'
 */
export function nextFormCode(prefix: string, year: number, existingCodes: Iterable<string>): string {
  const head = `${prefix}-${year}-`;
  let largestSequence = 0;
  for (const code of existingCodes) {
    if (!code.startsWith(head)) continue;
    const sequence = Number(code.slice(head.length));
    if (Number.isInteger(sequence) && sequence > largestSequence) largestSequence = sequence;
  }
  return formatFormCode(prefix, year, largestSequence + 1);
}
