import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { detectFormat, parseFile } from '../index';

function file(name: string, content: string | Uint8Array): File {
  const part: BlobPart = typeof content === 'string' ? content : new Blob([content as BlobPart]);
  return new File([part], name);
}

describe('detectFormat (content-sniff)', () => {
  it('detects Chrome CSV by header even with bogus filename', async () => {
    const f = file('random.csv', 'name,url,username,password,note\nGoogle,https://x,u,p,');
    expect(await detectFormat(f)).toBe('chrome');
  });

  it('detects LastPass CSV by header', async () => {
    const f = file(
      'random.csv',
      'url,username,password,totp,extra,name,grouping,fav\nhttps://x,u,p,,,N,,0',
    );
    expect(await detectFormat(f)).toBe('lastpass');
  });

  it('detects Bitwarden JSON by shape', async () => {
    const f = file('random.json', JSON.stringify({ items: [] }));
    expect(await detectFormat(f)).toBe('bitwarden');
  });

  it('detects BlindPass JSON by top-level type', async () => {
    const f = file(
      'random.json',
      JSON.stringify({ version: 1, type: 'blindpass-export', items: [] }),
    );
    expect(await detectFormat(f)).toBe('blindpass');
  });

  it('detects encrypted BlindPass JSON by top-level type', async () => {
    const f = file(
      'random.json',
      JSON.stringify({ version: 1, type: 'blindpass-export-encrypted' }),
    );
    expect(await detectFormat(f)).toBe('blindpass');
  });

  it('detects ProtonPass JSON by vaults key', async () => {
    const f = file('random.json', JSON.stringify({ vaults: {} }));
    expect(await detectFormat(f)).toBe('protonpass');
  });

  it('detects KeePassXC CSV by quoted Group/Title header', async () => {
    const f = file(
      'random.csv',
      '"Group","Title","Username","Password","URL","Notes","TOTP","Icon","Last Modified","Created"\n"","X","u","p","","","","","",""',
    );
    expect(await detectFormat(f)).toBe('keepassxc');
  });

  it('detects Apple Keychain CSV by Title header + otpauth presence', async () => {
    const f = file(
      'random.csv',
      'Title,URL,Username,Password,Notes,OTPAuth\nX,https://x,u,p,,otpauth://totp/x?secret=ABC',
    );
    expect(await detectFormat(f)).toBe('apple-keychain');
  });

  it('detects 1Password .1pux by extension + zip magic', async () => {
    const bytes = zipSync({ 'export.data': strToU8('{}') });
    const f = file('export.1pux', bytes);
    expect(await detectFormat(f)).toBe('1password');
  });

  it('detects Dashlane .zip by contents', async () => {
    const bytes = zipSync({
      'credentials.csv': strToU8('username,title,password\nu,X,p'),
    });
    const f = file('Dashlane Export.zip', bytes);
    expect(await detectFormat(f)).toBe('dashlane');
  });

  it('falls back to extension when content sniff misses', async () => {
    const f = file('vault.blindpass', '');
    expect(await detectFormat(f)).toBe('blindpass');
  });

  it('returns null for an empty file', async () => {
    const f = file('empty.dat', '');
    expect(await detectFormat(f)).toBeNull();
  });
});

describe('parseFile (registry entry)', () => {
  it('parses chrome via file', async () => {
    const f = file('x.csv', 'name,url,username,password,note\nGoogle,https://x,u,p,');
    const { items } = await parseFile('chrome', f);
    expect(items).toHaveLength(1);
  });

  it('parses bitwarden via file', async () => {
    const f = file(
      'x.json',
      JSON.stringify({
        items: [{ id: '1', name: 'G', type: 1, login: { username: 'u', password: 'p', uris: [] } }],
      }),
    );
    const { items } = await parseFile('bitwarden', f);
    expect(items).toHaveLength(1);
  });

  it('parses .1pux via file (binary path)', async () => {
    const exportData = JSON.stringify({
      accounts: [
        {
          vaults: [
            {
              items: [
                {
                  categoryUuid: '003',
                  overview: { title: 'Note' },
                  details: { notesPlain: 'body' },
                },
              ],
            },
          ],
        },
      ],
    });
    const bytes = zipSync({
      'export.attributes': strToU8('{}'),
      'export.data': strToU8(exportData),
    });
    const f = file('export.1pux', bytes);
    const { items, attachmentsDropped } = await parseFile('1password', f);
    expect(items).toHaveLength(1);
    expect(attachmentsDropped).toBe(0);
  });

  it('parses blindpass plaintext export via registry', async () => {
    const exported = JSON.stringify({
      version: 1,
      type: 'blindpass-export',
      exportedAt: new Date().toISOString(),
      items: [],
    });
    const f = file('vault.blindpass', exported);
    const { items } = await parseFile('blindpass', f);
    expect(items).toEqual([]);
  });

  it('rejects an unknown format', async () => {
    const f = file('x', 'data');
    await expect(parseFile('mystery' as never, f)).rejects.toThrow();
  });
});
