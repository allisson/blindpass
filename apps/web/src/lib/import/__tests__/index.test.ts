import { describe, expect, it } from 'vitest';
import { detectFormat, parseFile } from '../index';

describe('detectFormat', () => {
  it('returns bitwarden for .json', () => {
    expect(detectFormat('bitwarden_export.json')).toBe('bitwarden');
  });

  it('returns lastpass for filename containing lastpass', () => {
    expect(detectFormat('lastpass_export.csv')).toBe('lastpass');
    expect(detectFormat('LastPass Export.csv')).toBe('lastpass');
  });

  it('returns chrome for any other .csv', () => {
    expect(detectFormat('passwords.csv')).toBe('chrome');
    expect(detectFormat('Chrome Passwords.csv')).toBe('chrome');
  });

  it('returns null for unknown extension', () => {
    expect(detectFormat('backup.txt')).toBeNull();
    expect(detectFormat('vault.xml')).toBeNull();
  });

  it('bitwarden takes precedence over .csv check', () => {
    // .json always wins
    expect(detectFormat('export.json')).toBe('bitwarden');
  });

  it('returns blindpass for .blindpass extension', () => {
    expect(detectFormat('vault.blindpass')).toBe('blindpass');
  });

  it('returns blindpass for filename containing blindpass-export', () => {
    expect(detectFormat('blindpass-export.json')).toBe('blindpass');
    expect(detectFormat('my blindpass-export backup.blindpass')).toBe('blindpass');
  });
});

describe('parseFile', () => {
  it('delegates to chrome parser', () => {
    const csv = 'name,url,username,password,note\nGoogle,https://google.com,user,pass,';
    const { items } = parseFile('chrome', csv);
    expect(items).toHaveLength(1);
  });

  it('delegates to lastpass parser', () => {
    const csv =
      'url,username,password,totp,extra,name,grouping,fav\nhttps://google.com,user,pass,,,Google,,0';
    const { items } = parseFile('lastpass', csv);
    expect(items).toHaveLength(1);
  });

  it('delegates to bitwarden parser', () => {
    const json = JSON.stringify({
      items: [
        {
          id: '1',
          name: 'G',
          type: 1,
          login: { username: 'u', password: 'p', uris: [], totp: null },
          notes: null,
        },
      ],
    });
    const { items } = parseFile('bitwarden', json);
    expect(items).toHaveLength(1);
  });

  it('throws for blindpass format', () => {
    expect(() => parseFile('blindpass', '')).toThrow('BlindPass files require async import');
  });
});
