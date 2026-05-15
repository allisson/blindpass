import { describe, expect, it } from 'vitest';
import { coerceToSecureNote } from '../coerce';

describe('coerceToSecureNote', () => {
  it('produces a valid secure_note with category-prefixed title', () => {
    const item = coerceToSecureNote({
      categoryName: 'Bank Account',
      title: 'Chase Checking',
      customFields: [{ label: 'Account Number', value: '1234' }],
    });
    expect(item).toMatchObject({
      type: 'secure_note',
      title: '[Bank Account] Chase Checking',
      customFields: [{ label: 'Account Number', value: '1234' }],
    });
  });

  it('omits prefix when categoryName missing', () => {
    const item = coerceToSecureNote({ title: 'Note', customFields: [] });
    expect(item).toMatchObject({ type: 'secure_note', title: 'Note' });
  });

  it('substitutes (untitled) when title is blank', () => {
    const item = coerceToSecureNote({
      categoryName: 'X',
      title: '   ',
      customFields: [],
    });
    expect(item?.title).toBe('[X] (untitled)');
  });

  it('joins sourceNotes and extraContent into content', () => {
    const item = coerceToSecureNote({
      title: 't',
      customFields: [],
      sourceNotes: 'user notes',
      extraContent: '[Lost attachments: x.pdf]',
    });
    expect(item).toMatchObject({
      type: 'secure_note',
      content: 'user notes\n\n[Lost attachments: x.pdf]',
    });
  });

  it('omits customFields key entirely when array is empty', () => {
    const item = coerceToSecureNote({ title: 't', customFields: [] });
    expect(item).not.toHaveProperty('customFields');
  });
});
