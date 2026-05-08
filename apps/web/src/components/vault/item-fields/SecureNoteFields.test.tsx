import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { VaultItem } from '@blindpass/vault';
import { SecureNoteFields } from './SecureNoteFields';

function Wrapper() {
  const methods = useForm<VaultItem>({
    defaultValues: { type: 'secure_note', title: '', content: '' } as Partial<VaultItem>,
  });
  return (
    <FormProvider {...methods}>
      <form>
        <SecureNoteFields />
      </form>
    </FormProvider>
  );
}

describe('SecureNoteFields', () => {
  it('renders content textarea', () => {
    render(<Wrapper />);
    expect(screen.getByLabelText('Content')).toBeInTheDocument();
  });
});
