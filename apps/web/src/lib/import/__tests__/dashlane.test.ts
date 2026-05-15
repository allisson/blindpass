import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parse, __internal } from '../parsers/dashlane';

describe('dashlane sub-parsers', () => {
  it('parses credentials with TOTP split', () => {
    const csv = [
      'username,username2,title,password,note,url,category,otpSecret',
      'alice,,GitHub,secret,my work,https://github.com,Work,otpauth://totp/GitHub:alice?secret=JBSW&issuer=GitHub',
    ].join('\n');
    const { items, skipped } = __internal.parseCredentials(csv);
    expect(skipped).toBe(0);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      type: 'login',
      title: 'GitHub',
      username: 'alice',
      password: 'secret',
      url: 'https://github.com',
      notes: 'my work',
    });
    expect(items[1]).toMatchObject({ type: 'totp', secret: 'JBSW' });
  });

  it('skips credential rows with empty password', () => {
    const csv = 'username,title,password,url\nalice,X,,https://x';
    const { items, skipped } = __internal.parseCredentials(csv);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('parses payments → payment_card', () => {
    const csv = [
      'type,account_name,account_holder,cc_number,code,expiration_month,expiration_year,note',
      'card,Visa,A. Person,4111111111111111,123,12,2030,vacation card',
    ].join('\n');
    const { items, skipped } = __internal.parsePayments(csv);
    expect(skipped).toBe(0);
    expect(items[0]).toMatchObject({
      type: 'payment_card',
      title: 'Visa',
      cardholderName: 'A. Person',
      number: '4111111111111111',
      expMonth: '12',
      expYear: '2030',
      cvv: '123',
    });
  });

  it('ids → coerced secure_note with category prefix', () => {
    const csv =
      'type,number,name,issue_date,expiration_date,place_of_issue\npassport,P12345,Alice Smith,2020-01-01,2030-01-01,USA';
    const { items, skipped } = __internal.parseIds(csv);
    expect(skipped).toBe(0);
    expect(items[0]).toMatchObject({
      type: 'secure_note',
      title: '[Passport] Alice Smith',
    });
    const cf = (items[0] as { customFields?: { label: string; value: string }[] }).customFields;
    expect(cf).toEqual(
      expect.arrayContaining([
        { label: 'Type', value: 'passport' },
        { label: 'Number', value: 'P12345' },
      ]),
    );
  });

  it('ids: maps driver / license / ssn keywords to friendly category names', () => {
    const passport = __internal.parseIds('type,name\npassport,X').items[0];
    const license = __internal.parseIds('type,name\ndriver_license,Y').items[0];
    const ssn = __internal.parseIds('type,name\nsocial_security_number,Z').items[0];
    expect(passport.title).toContain('[Passport]');
    expect(license.title).toContain("[Driver's License]");
    expect(ssn.title).toContain('[SSN]');
  });

  it('personalInfo: maps to identity when first+last present', () => {
    const csv =
      'first_name,last_name,email,phone_number,city,country\nAlice,Smith,a@b.com,555,NYC,US';
    const { items } = __internal.parsePersonalInfo(csv);
    expect(items[0]).toMatchObject({
      type: 'identity',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'a@b.com',
    });
  });

  it('personalInfo: coerces when name fields missing', () => {
    const csv = 'first_name,last_name,email\n,,bob@x.com';
    const { items } = __internal.parsePersonalInfo(csv);
    expect(items[0]).toMatchObject({
      type: 'secure_note',
      title: expect.stringContaining('[Personal Info]'),
    });
  });

  it('payments skips rows with empty cc_number', () => {
    const csv = 'type,cc_number,account_name\ncard,,My Card';
    const { items, skipped } = __internal.parsePayments(csv);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('payments harvests pin/issuer/validFrom to customFields', () => {
    const csv =
      'cc_number,account_name,account_holder,issuer,start_month,start_year\n4111,Visa,A,Chase,01,2020';
    const { items } = __internal.parsePayments(csv);
    const cf = (items[0] as { customFields?: { label: string; value: string }[] }).customFields;
    expect(cf).toEqual(
      expect.arrayContaining([
        { label: 'Issuer', value: 'Chase' },
        { label: 'Start Month', value: '01' },
        { label: 'Start Year', value: '2020' },
      ]),
    );
  });

  it('ids without name uses number as title', () => {
    const csv = 'type,number\npassport,P9999';
    const { items } = __internal.parseIds(csv);
    expect(items[0].title).toBe('[Passport] P9999');
  });

  it('ids without name or number uses (untitled)', () => {
    const csv = 'type\npassport';
    const { items } = __internal.parseIds(csv);
    expect(items[0].title).toBe('[Passport] (untitled)');
  });

  it('securenotes → secure_note', () => {
    const csv = 'title,note\nMy Note,body content';
    const { items } = __internal.parseSecureNotes(csv);
    expect(items[0]).toMatchObject({
      type: 'secure_note',
      title: 'My Note',
      content: 'body content',
    });
  });
});

describe('dashlane zip dispatch', () => {
  it('parses a full bundle (multiple CSVs)', async () => {
    const bytes = zipSync({
      'credentials.csv': strToU8(
        'username,title,password,url\nalice,GitHub,secret,https://github.com',
      ),
      'securenotes.csv': strToU8('title,note\nKey,important'),
      'unrelated.txt': strToU8('ignored'),
    });
    const { items, skipped } = await parse(bytes);
    expect(skipped).toBe(0);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.type).sort()).toEqual(['login', 'secure_note']);
  });

  it('tolerates missing category files', async () => {
    const bytes = zipSync({
      'credentials.csv': strToU8('username,title,password\nalice,X,secret'),
    });
    const { items } = await parse(bytes);
    expect(items).toHaveLength(1);
  });

  it('case-insensitive filename matching', async () => {
    const bytes = zipSync({
      'Dashlane-Credentials-20260101.csv': strToU8(
        'username,title,password,url\nalice,X,secret,https://x',
      ),
    });
    const { items } = await parse(bytes);
    expect(items).toHaveLength(1);
  });
});
