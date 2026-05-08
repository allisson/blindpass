import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { VaultItem } from '@blindpass/vault';
import { TotpFields } from './TotpFields';

function Wrapper() {
  const methods = useForm<VaultItem>({
    defaultValues: {
      type: 'totp',
      title: '',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    } as Partial<VaultItem>,
  });
  return (
    <FormProvider {...methods}>
      <form>
        <TotpFields />
      </form>
    </FormProvider>
  );
}

describe('TotpFields', () => {
  it('renders secret + uri textarea', () => {
    render(<Wrapper />);
    expect(screen.getByLabelText('Secret')).toBeInTheDocument();
    expect(screen.getByLabelText('Paste URI or Secret')).toBeInTheDocument();
  });

  it('toggles advanced section', () => {
    render(<Wrapper />);
    expect(screen.queryByLabelText('Algorithm')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Advanced'));
    expect(screen.getByLabelText('Algorithm')).toBeInTheDocument();
  });

  it('parses otpauth URI on paste', () => {
    render(<Wrapper />);
    const uri = screen.getByLabelText('Paste URI or Secret') as HTMLTextAreaElement;
    fireEvent.change(uri, {
      target: {
        value: 'otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub',
      },
    });
    expect((screen.getByLabelText('Secret') as HTMLInputElement).value).toBe('JBSWY3DPEHPK3PXP');
  });

  it('shows error on invalid otpauth URI', () => {
    render(<Wrapper />);
    fireEvent.change(screen.getByLabelText('Paste URI or Secret'), {
      target: { value: 'otpauth://garbage' },
    });
    expect(screen.getByText(/Couldn't parse this URI/)).toBeInTheDocument();
  });
});
