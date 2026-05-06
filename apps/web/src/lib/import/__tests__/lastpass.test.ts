import { describe, expect, it } from 'vitest';
import { parse } from '../parsers/lastpass';

const HEADER = 'url,username,password,totp,extra,name,grouping,fav';

describe('lastpass parser', () => {
  it('parses login row', () => {
    const csv = `${HEADER}\nhttps://google.com,user@gmail.com,pass123,,,Google,Personal,0`;
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

  it('skips rows with empty password', () => {
    const csv = `${HEADER}\nhttps://google.com,user@gmail.com,,,, Google,Personal,0`;
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('skips secure notes (url === http://sn)', () => {
    // note: password column must be non-empty so the http://sn check is reached
    const csv = [
      HEADER,
      'https://google.com,user,pass,,,Google,Personal,0',
      'http://sn,user,fakepass,,,My Note,Personal,0',
    ].join('\n');
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it('returns correct skipped count for mixed rows', () => {
    const csv = [
      HEADER,
      'https://a.com,user,pass,,,A,,0',
      'https://b.com,user,,,,B,,0',
      'https://c.com,user,pass,,,C,,0',
    ].join('\n');
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(2);
    expect(skipped).toBe(1);
  });

  it('returns 0 items for empty file', () => {
    const { items, skipped } = parse('');
    expect(items).toHaveLength(0);
    expect(skipped).toBe(0);
  });

  it('returns all as skipped when password column missing', () => {
    const csv = 'url,username,name\nhttps://google.com,user,Google';
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('handles Windows CRLF line endings', () => {
    const csv = `${HEADER}\r\nhttps://google.com,user,pass,,,Google,,0`;
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
  });

  it('includes notes when extra field is populated', () => {
    const csvWithNote =
      'url,username,password,totp,extra,name,grouping,fav\nhttps://google.com,user,pass,,my extra note,Google,,0';
    const { items } = parse(csvWithNote);
    expect(items).toHaveLength(1);
    expect((items[0] as { notes?: string }).notes).toBe('my extra note');
  });

  it('url is undefined when url column is present but empty', () => {
    const csv = `${HEADER}\n,user,pass,,,Local,,0`;
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    if (items[0].type === 'login') expect(items[0].url).toBeUndefined();
  });

  it('item title is empty string when name column value is empty', () => {
    const csv = `${HEADER}\n,user,pass,,,,,grouping,0`;
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('');
  });

  it('handles file where url column is missing', () => {
    const csv = 'name,username,password,extra\nSite,user,pass,note';
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Site');
    if (items[0].type === 'login') expect(items[0].url).toBeUndefined();
  });

  it('handles file where name column is missing', () => {
    const csv = 'url,username,password\nhttps://x.com,user,pass';
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('');
  });

  it('handles file where extra column is missing', () => {
    const csv = 'url,username,password\nhttps://x.com,user,pass';
    const { items } = parse(csv);
    expect(items).toHaveLength(1);
    if (items[0].type === 'login') expect(items[0].notes).toBeUndefined();
  });

  it('skips row when password column value is undefined (short row)', () => {
    // Row has only 1 column — passwordIdx=3 is undefined → cols[3] ?? '' = '' → skip
    const csv = `${HEADER}\nshortrow`;
    const { items, skipped } = parse(csv);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('uses empty string for username when column value is undefined', () => {
    // url,username,password,...
    const csv = 'url,username,password\nhttps://google.com,,pass';
    const { items } = parse(csv);
    if (items[0].type === 'login') expect(items[0].username).toBe('');
  });

  it('uses empty string for title when name column value is null/undefined', () => {
    const csv = 'password,name\npass,';
    const { items } = parse(csv);
    expect(items[0].title).toBe('');
  });
});
