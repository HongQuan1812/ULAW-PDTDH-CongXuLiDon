/* Test mẫu xuất đơn theo mẫu Word (shared/src/seed/export-templates): đủ mỗi loại đơn một mẫu, mã {...} khớp câu hỏi của loại đơn.
   Không cần database. */
import { describe, expect, it } from 'vitest';
import { checkDocxTemplate, PRODUCTION_FORM_TYPES_SEED, seedFormTypes } from '@ulaw/shared';
import { loadSeedExportTemplates } from '../prisma/load-seed-export-templates';

describe('loadSeedExportTemplates', () => {
  const templates = loadSeedExportTemplates();
  const formTypes = seedFormTypes();

  it('mỗi loại đơn của bản thật có đúng một mẫu, không có mẫu của loại đơn lạ', () => {
    // Arrange
    const productionIds = PRODUCTION_FORM_TYPES_SEED.map((formType) => formType.id).sort();

    // Act
    const templateIds = templates.map((template) => template.formTypeId);

    // Assert
    expect(templateIds).toEqual(productionIds);
    expect(templates.map((template) => template.id)).toEqual(templateIds.map((id) => `tpl-${id}`));
  });

  it.each(templates.map((template) => [template.formTypeId, template] as const))('mẫu %s: mọi mã đều có trong loại đơn, không lỗi cú pháp', (formTypeId, template) => {
    // Arrange
    const formType = formTypes.find((candidate) => candidate.id === formTypeId);

    // Act
    const check = checkDocxTemplate(template.content, formType!.versions.at(-1)!.sections);

    // Assert
    expect(check.found.length).toBeGreaterThan(0);
    expect(check.unknown).toEqual([]);
    expect(check.error).toBe('');
  });
});
