import { describe, expect, it } from 'vitest';
import { parse } from '../parsers/keepassxc';

const HEADER =
  '"Group","Title","Username","Password","URL","Notes","TOTP","Icon","Last Modified","Created"';

describe('keepassxc parser', () => {
  it('parses a minimal row with KeePassXC headers', () => {
    const csv = `${HEADER}\n"Root/Web","GitHub","alice","secret","https://github.com","","","48","2024-01-01","2023-01-01"`;
    const { items, skipped, attachmentsDropped } = parse(csv);
    expect(skipped).toBe(0);
    expect(attachmentsDropped).toBe(0);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'login',
      title: 'GitHub',
      username: 'alice',
      password: 'secret',
      url: 'https://github.com',
    });
  });

  it('ignores Group column entirely', () => {
    const csv = `${HEADER}\n"Personal/Banking/Chase","Bank","x","y","","","","","",""`;
    const { items } = parse(csv);
    expect(items[0]).toMatchObject({ title: 'Bank' });
    expect((items[0] as { customFields?: unknown }).customFields).toBeUndefined();
  });

  it('splits a TOTP column into a paired totp item', () => {
    const csv = `${HEADER}\n"","GitHub","alice","secret","","","otpauth://totp/GitHub:alice?secret=JBSW&issuer=GitHub","","",""`;
    const { items } = parse(csv);
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({
      type: 'totp',
      secret: 'JBSW',
      issuer: 'GitHub',
    });
  });

  it('skips rows with empty password', () => {
    const csv = `${HEADER}\n"","Foo","alice","","","","","","",""`;
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('handles multiline notes', () => {
    const csv = `${HEADER}\n"","Foo","x","y","","line 1\nline 2","","","",""`;
    const { items } = parse(csv);
    expect(items[0]).toMatchObject({ notes: 'line 1\nline 2' });
  });

  it('uses TOTP secret-only fallback when column is a bare base32 string', () => {
    const csv = `${HEADER}\n"","Foo","x","y","","","JBSW","","",""`;
    const { items } = parse(csv);
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ type: 'totp', secret: 'JBSW' });
  });

  it('TOTP item title falls back to issuer when source title is empty', () => {
    const csv = `${HEADER}\n"","","x","y","","","otpauth://totp/Acme:bob?secret=ABC&issuer=Acme","","",""`;
    const { items } = parse(csv);
    expect(items[1]).toMatchObject({ type: 'totp', title: 'Acme' });
  });
});
