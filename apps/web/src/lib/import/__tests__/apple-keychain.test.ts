import { describe, expect, it } from 'vitest';
import { parse } from '../parsers/apple-keychain';

describe('apple-keychain parser', () => {
  it('parses a minimal CSV with BOM and CRLF', () => {
    const csv =
      '﻿Title,URL,Username,Password,Notes,OTPAuth\r\nGitHub,https://github.com,alice,secret,,';
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

  it('falls back to URL when Title is empty', () => {
    const csv = 'Title,URL,Username,Password,Notes,OTPAuth\n,https://example.com,bob,pw,,';
    const { items } = parse(csv);
    expect(items[0]).toMatchObject({ title: 'https://example.com' });
  });

  it('splits an OTPAuth column into a paired totp item', () => {
    const csv =
      'Title,URL,Username,Password,Notes,OTPAuth\nGitHub,https://github.com,alice,secret,,otpauth://totp/GitHub:alice?secret=JBSW&issuer=GitHub';
    const { items } = parse(csv);
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('login');
    expect(items[1]).toMatchObject({
      type: 'totp',
      title: 'GitHub',
      secret: 'JBSW',
      issuer: 'GitHub',
    });
  });

  it('skips rows with empty password', () => {
    const csv = 'Title,URL,Username,Password,Notes,OTPAuth\nFoo,https://foo,alice,,,';
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('tolerates column-order changes (case-insensitive lookup)', () => {
    const csv = 'PASSWORD,USERNAME,URL,TITLE\nsecret,alice,https://x,X';
    const { items } = parse(csv);
    expect(items[0]).toMatchObject({
      type: 'login',
      title: 'X',
      username: 'alice',
      password: 'secret',
    });
  });

  it('handles multiline notes (quoted with embedded newlines)', () => {
    const csv =
      'Title,URL,Username,Password,Notes,OTPAuth\nFoo,https://foo,alice,pw,"line 1\nline 2",';
    const { items } = parse(csv);
    expect(items[0]).toMatchObject({ notes: 'line 1\nline 2' });
  });

  it('returns zero items when password column missing', () => {
    const csv = 'Title,URL,Username,Notes\nFoo,https://foo,alice,';
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });
});
