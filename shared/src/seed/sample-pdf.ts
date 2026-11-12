/* PDF mẫu: tệp trong dữ liệu mẫu chỉ có tên, không có nội dung thật, nên khi xem trước thì
   API giả (web) và backend cùng dựng một trang PDF đơn giản, ghi tên tệp. */

/**
 * Dựng nội dung một tệp PDF một trang có hai dòng chữ (chỉ chữ không dấu, vì PDF dùng phông Helvetica chuẩn).
 * @param fileName  tên tệp, vd 'Bang_diem_hoc_ky_2.pdf' (chữ có dấu được bỏ dấu)
 * @returns         nội dung PDF hợp lệ, dạng chuỗi chỉ gồm ký tự ASCII
 */
export function buildSamplePdfText(fileName: string): string {
  const safeName = fileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/[\\()]/g, '');
  const pageText = `BT /F1 20 Tf 72 740 Td (Tep mau - du lieu gia) Tj 0 -30 Td /F1 14 Tf (${safeName}) Tj ET`;

  // Các đối tượng của PDF, đánh số từ 1
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${pageText.length} >>\nstream\n${pageText}\nendstream`,
  ];

  // Ghép phần thân, nhớ vị trí từng đối tượng cho bảng xref
  let body = '%PDF-1.4\n';
  const offsets = objects.map((objectText, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${objectText}\nendobj\n`;
    return offset;
  });
  const xrefOffset = body.length;
  const xrefRows = offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xrefRows}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return body;
}
