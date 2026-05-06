import { describe, it, expect } from 'vitest';
import { getAvatarColor, getInitial, withAlpha } from './avatar';

describe('getAvatarColor', () => {
  it('returns a string', () => {
    expect(typeof getAvatarColor('GitHub')).toBe('string');
  });

  it('is deterministic for the same title', () => {
    expect(getAvatarColor('Test')).toBe(getAvatarColor('Test'));
  });

  it('returns different colors for different titles', () => {
    const colors = new Set(
      ['GitHub', 'Gmail', 'Twitter', 'Facebook', 'Netflix', 'Spotify', 'Amazon', 'Apple'].map(
        getAvatarColor,
      ),
    );
    expect(colors.size).toBeGreaterThan(1);
  });

  it('handles empty string', () => {
    expect(typeof getAvatarColor('')).toBe('string');
  });
});

describe('getInitial', () => {
  it('returns uppercase first char', () => {
    expect(getInitial('github')).toBe('G');
  });

  it('returns ? for empty string', () => {
    expect(getInitial('')).toBe('?');
  });

  it('trims leading whitespace', () => {
    expect(getInitial('  hello')).toBe('H');
  });

  it('handles single char', () => {
    expect(getInitial('a')).toBe('A');
  });
});

describe('withAlpha', () => {
  it('injects alpha into color string', () => {
    const color = 'oklch(0.62 0.18 295)';
    const result = withAlpha(color, 0.5);
    expect(result).toBe('oklch(0.62 0.18 295 / 0.5)');
  });

  it('handles alpha 0', () => {
    expect(withAlpha('oklch(0.5 0.1 180)', 0)).toBe('oklch(0.5 0.1 180 / 0)');
  });

  it('handles alpha 1', () => {
    expect(withAlpha('oklch(0.5 0.1 180)', 1)).toBe('oklch(0.5 0.1 180 / 1)');
  });
});
