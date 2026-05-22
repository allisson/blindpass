import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentlyViewedSection } from './RecentlyViewedSection';
import type { DecryptedItem } from '@/hooks/useVault';

vi.mock('./ItemCard', () => ({
  ItemCard: ({ item }: { item: DecryptedItem }) => (
    <div data-testid={`mock-item-${item.id}`}>{item.title}</div>
  ),
}));

function makeItem(id: string, title: string): DecryptedItem {
  return {
    id,
    type: 'login',
    title,
    username: 'u',
    password: 'p',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  } as unknown as DecryptedItem;
}

describe('RecentlyViewedSection', () => {
  it('renders null when items is empty', () => {
    const { container } = render(<RecentlyViewedSection items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders label and one card per item, in order', () => {
    render(<RecentlyViewedSection items={[makeItem('a', 'Alpha'), makeItem('b', 'Beta')]} />);
    expect(screen.getByTestId('recently-viewed-section')).toBeTruthy();
    expect(screen.getByText('Recently Viewed')).toBeTruthy();
    const cards = screen.getAllByTestId(/^mock-item-/);
    expect(cards.map((c) => c.textContent)).toEqual(['Alpha', 'Beta']);
  });
});
