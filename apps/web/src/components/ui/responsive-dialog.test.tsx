import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResponsiveDialog } from './responsive-dialog';
import { Button } from './button';

vi.mock('@/hooks/use-is-mobile', () => ({
  useIsMobile: vi.fn(),
}));

// Import after vi.mock so the mocked version is used
import { useIsMobile } from '@/hooks/use-is-mobile';

const mockUseIsMobile = vi.mocked(useIsMobile);

describe('ResponsiveDialog', () => {
  const onOpenChange = vi.fn();

  const defaultProps = {
    open: true,
    onOpenChange,
    title: 'Confirm action',
    description: 'This cannot be undone.',
    footer: (
      <>
        <Button variant="destructive">Delete</Button>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </>
    ),
  };

  beforeEach(() => vi.clearAllMocks());

  describe('desktop (Dialog)', () => {
    beforeEach(() => mockUseIsMobile.mockReturnValue(false));

    it('renders title and description', () => {
      render(<ResponsiveDialog {...defaultProps} />);
      expect(screen.getByText('Confirm action')).toBeInTheDocument();
      expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    });

    it('renders footer buttons', () => {
      render(<ResponsiveDialog {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('calls onOpenChange when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ResponsiveDialog {...defaultProps} />);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('renders optional children', () => {
      render(
        <ResponsiveDialog {...defaultProps}>
          <p>Form content</p>
        </ResponsiveDialog>,
      );
      expect(screen.getByText('Form content')).toBeInTheDocument();
    });

    it('renders close button when showCloseButton is true', () => {
      render(<ResponsiveDialog {...defaultProps} showCloseButton />);
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });

  describe('mobile (Drawer)', () => {
    beforeEach(() => mockUseIsMobile.mockReturnValue(true));

    it('renders title and description', () => {
      render(<ResponsiveDialog {...defaultProps} />);
      expect(screen.getByText('Confirm action')).toBeInTheDocument();
      expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    });

    it('renders footer buttons', () => {
      render(<ResponsiveDialog {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders optional children', () => {
      render(
        <ResponsiveDialog {...defaultProps}>
          <p>Form content</p>
        </ResponsiveDialog>,
      );
      expect(screen.getByText('Form content')).toBeInTheDocument();
    });

    it('renders JSX description nodes', () => {
      render(
        <ResponsiveDialog
          {...defaultProps}
          description={
            <>
              Delete <strong>my-item</strong>?
            </>
          }
        />,
      );
      expect(screen.getByText('my-item')).toBeInTheDocument();
    });

    it('renders without description', () => {
      render(
        <ResponsiveDialog
          open={true}
          onOpenChange={onOpenChange}
          title="Confirm action"
          footer={defaultProps.footer}
        />,
      );
      expect(screen.getByText('Confirm action')).toBeInTheDocument();
    });
  });
});
