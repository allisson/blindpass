import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

function renderDialogContent({
  showCloseButton = true,
  footerClose = false,
}: {
  showCloseButton?: boolean;
  footerClose?: boolean;
} = {}) {
  return render(
    <Dialog open>
      <DialogContent showCloseButton={showCloseButton}>
        <DialogHeader>
          <DialogTitle>Dialog title</DialogTitle>
          <DialogDescription>Dialog description</DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton={footerClose}>
          <button type="button">Primary action</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  );
}

describe('Dialog primitives', () => {
  it('renders the top-right close button by default', () => {
    renderDialogContent();

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('omits the top-right close button when disabled', () => {
    renderDialogContent({ showCloseButton: false });

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('renders footer close action when requested', () => {
    renderDialogContent({ footerClose: true });

    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
  });
});
