import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldError } from './field-error';

describe('FieldError', () => {
  it('renders nothing when message is missing', () => {
    const { container } = render(<FieldError />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders centered error message when requested', () => {
    render(<FieldError message="Required" align="center" data-testid="field-error" />);

    const error = screen.getByTestId('field-error');
    expect(error).toHaveTextContent('Required');
    expect(error.className).toContain('justify-center');
  });
});
