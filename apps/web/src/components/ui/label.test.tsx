import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from './label';

describe('Label', () => {
  it('renders children', () => {
    render(<Label>Username</Label>);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('renders optional marker when optional prop is set', () => {
    render(<Label optional>Email</Label>);
    expect(screen.getByText('— optional')).toBeInTheDocument();
  });

  it('renders hint tooltip when hint prop is set', () => {
    render(<Label hint="Must be unique">Username</Label>);
    expect(screen.getByTitle('Must be unique')).toBeInTheDocument();
  });
});
