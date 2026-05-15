import { describe, expect, it } from 'vitest';
import { parseCsvRows } from '../csv';

describe('parseCsvRows', () => {
  it('parses a simple header + row', () => {
    const rows = parseCsvRows('name,url\nGoogle,https://google.com');
    expect(rows).toEqual([
      ['name', 'url'],
      ['Google', 'https://google.com'],
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const rows = parseCsvRows('a,b\n"hello, world",ok');
    expect(rows).toEqual([
      ['a', 'b'],
      ['hello, world', 'ok'],
    ]);
  });

  it('handles escaped quotes ("") inside quoted cells', () => {
    const rows = parseCsvRows('a\n"she said ""hi"""');
    expect(rows).toEqual([['a'], ['she said "hi"']]);
  });

  it('strips a leading UTF-8 BOM', () => {
    const rows = parseCsvRows('﻿name,url\nGoogle,https://google.com');
    expect(rows[0]).toEqual(['name', 'url']);
  });

  it('normalises CRLF and bare CR line endings', () => {
    const rows = parseCsvRows('a,b\r\n1,2\r3,4');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('preserves embedded newlines inside quoted cells', () => {
    const rows = parseCsvRows('title,notes\nfoo,"line one\nline two"');
    expect(rows).toEqual([
      ['title', 'notes'],
      ['foo', 'line one\nline two'],
    ]);
  });

  it('preserves CRLF newlines inside quoted cells (normalised to LF)', () => {
    const rows = parseCsvRows('title,notes\r\nfoo,"line one\r\nline two"');
    expect(rows).toEqual([
      ['title', 'notes'],
      ['foo', 'line one\nline two'],
    ]);
  });

  it('handles trailing newline without producing an empty row', () => {
    const rows = parseCsvRows('a,b\n1,2\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('returns an empty array for an empty input', () => {
    expect(parseCsvRows('')).toEqual([]);
    expect(parseCsvRows('\n')).toEqual([]);
  });

  it('keeps empty cells', () => {
    const rows = parseCsvRows('a,b,c\n1,,3');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ]);
  });

  it('handles a row with only a quoted cell that wraps multiple newlines', () => {
    const rows = parseCsvRows('notes\n"a\n\nb"');
    expect(rows).toEqual([['notes'], ['a\n\nb']]);
  });

  it('handles mixed quoted and unquoted cells on the same row', () => {
    const rows = parseCsvRows('a,b,c\n"x",y,"z, with comma"');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['x', 'y', 'z, with comma'],
    ]);
  });
});
