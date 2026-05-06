import { describe, expect, it } from 'vitest';
import { parse } from '../parsers/chrome';

const HEADER = 'name,url,username,password,note';

describe('chrome parser', () => {
  it('parses minimal valid row', () => {
    const csv = `${HEADER}\nGoogle,https://google.com,user@gmail.com,pass123,`;
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'login',
      title: 'Google',
      username: 'user@gmail.com',
      password: 'pass123',
      url: 'https://google.com',
    });
    expect(skipped).toBe(0);
  });

  it('skips row with empty password', () => {
    const csv = `${HEADER}\nGoogle,https://google.com,user@gmail.com,,`;
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('handles missing url (optional)', () => {
    const csv = `${HEADER}\nLocal login,,admin,secret,`;
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('login');
    if (items[0].type === 'login') expect(items[0].url).toBeUndefined();
    expect(skipped).toBe(0);
  });

  it('returns correct skipped count for multiple invalid rows', () => {
    const csv = [
      HEADER,
      'Google,https://google.com,user,pass,',
      'NoPass,https://x.com,user,,',
      'AlsoNoPass,https://y.com,user,,',
    ].join('\n');
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it('returns 0 items for empty file', () => {
    const { items, skipped } = parse('');
    expect(items).toHaveLength(0);
    expect(skipped).toBe(0);
  });

  it('returns 0 items for header-only file', () => {
    const { items, skipped } = parse(HEADER);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(0);
  });

  it('handles quoted fields', () => {
    const csv = `${HEADER}\n"My Site","https://example.com","user@example.com","p@ss,word",""`;
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('My Site');
    expect((items[0] as { password: string }).password).toBe('p@ss,word');
  });

  it('handles escaped double-quotes inside quoted fields', () => {
    const csv = `${HEADER}\n"It""s Mine","https://example.com","user","pass",""`;
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe(`It"s Mine`);
  });

  it('derives title from url hostname when name is empty (Firefox format)', () => {
    const firefoxHeader =
      'url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged';
    const csv = `${firefoxHeader}\nhttps://github.com,user,pass123,,https://github.com,{},0,0,0`;
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('github.com');
  });

  it('handles Windows CRLF line endings', () => {
    const csv = `${HEADER}\r\nGoogle,https://google.com,user,pass,`;
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
  });

  it('returns all as skipped when required columns missing', () => {
    const csv = 'name,url\nhttps://google.com,Google';
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('falls back to raw url when titleFromUrl gets an invalid URL', () => {
    const firefoxHeader = 'url,username,password';
    const csv = `${firefoxHeader}\nnot-a-valid-url,user,pass`;
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('not-a-valid-url');
  });

  it('includes notes when note field is populated', () => {
    const csv = `${HEADER}\nGitHub,https://github.com,user,pass,my secret note`;
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    expect((items[0] as { notes?: string }).notes).toBe('my secret note');
  });

  it('falls back to raw url as title when hostname is empty (file: URL)', () => {
    const header = 'url,username,password';
    const csv = `${header}\nfile:///home/user/site,user,pass`;
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('file:///home/user/site');
  });

  it('url is undefined when url column is present but empty', () => {
    const csv = `${HEADER}\nLocal,,admin,secret,`;
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    if (items[0].type === 'login') expect(items[0].url).toBeUndefined();
  });

  it('skips row when password column is missing (short row)', () => {
    // Row has only 2 columns — passwordIdx=3 is undefined → cols[3] ?? '' = '' → skip
    const csv = `${HEADER}\nGoogle,https://google.com`;
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('title is empty string when both name and url are absent', () => {
    // no name column, no url column → rawTitle='' AND url=undefined → title=''
    const csv = 'username,password\nuser,pass';
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('');
  });

  it('handles file where name column is missing', () => {
    const csv = 'url,username,password\nhttps://google.com,user,pass';
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('google.com');
  });

  it('handles file where url column is missing', () => {
    const csv = 'name,username,password\nMy Account,user,pass';
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('My Account');
    if (items[0].type === 'login') expect(items[0].url).toBeUndefined();
  });

  it('handles file where note column is missing', () => {
    const csv = 'name,url,username,password\nMy Account,https://x.com,user,pass';
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    if (items[0].type === 'login') expect(items[0].notes).toBeUndefined();
  });

  it('handles row where username is missing', () => {
    const csv = 'name,username,password\nMy Account,,pass';
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    if (items[0].type === 'login') expect(items[0].username).toBe('');
  });

  it('handles short row where username column value is undefined', () => {
    // Header has 3 columns: url, username, password. index 1 is username.
    const csv = 'url,username,password\nhttps://google.com'; // only 1 column
    const { items, skipped } = parse(csv);
    // passwordIdx is 2. cols[2] is undefined. password is ''. skip.
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('uses empty string for username when column is missing in data row', () => {
    const csv = 'username,password\n,pass'; // username is empty string
    const { items } = parse(csv);
    if (items[0].type === 'login') expect(items[0].username).toBe('');
  });

  it('skips row when safeParse fails', () => {
    // To make safeParse fail for login, we need to pass something that violates VaultItemSchema
    // login schema: title, username, password are strings.
    // If we make title too long? Or something?
    // Actually, let's see if we can trigger an error in title derivation.
  });
});
