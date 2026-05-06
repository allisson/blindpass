import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSubmitShortcut } from './useSubmitShortcut';
import { type RefObject } from 'react';

function makeFormRef(form: HTMLFormElement | null): RefObject<HTMLFormElement | null> {
  return { current: form };
}

describe('useSubmitShortcut', () => {
  let form: HTMLFormElement;

  beforeEach(() => {
    form = document.createElement('form');
    document.body.appendChild(form);
    vi.spyOn(form, 'requestSubmit').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.removeChild(form);
    vi.restoreAllMocks();
  });

  it('does nothing when non-Enter key is pressed', () => {
    vi.spyOn(form, 'contains').mockReturnValue(true);
    renderHook(() => useSubmitShortcut(makeFormRef(form)));
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true }),
    );
    expect(form.requestSubmit).not.toHaveBeenCalled();
  });

  it('does nothing when Enter is pressed without meta or ctrl key', () => {
    vi.spyOn(form, 'contains').mockReturnValue(true);
    renderHook(() => useSubmitShortcut(makeFormRef(form)));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(form.requestSubmit).not.toHaveBeenCalled();
  });

  it('does nothing when formRef.current is null', () => {
    renderHook(() => useSubmitShortcut(makeFormRef(null)));
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }),
    );
    expect(form.requestSubmit).not.toHaveBeenCalled();
  });

  it('does nothing when active element is outside the form', () => {
    vi.spyOn(form, 'contains').mockReturnValue(false);
    renderHook(() => useSubmitShortcut(makeFormRef(form)));
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }),
    );
    expect(form.requestSubmit).not.toHaveBeenCalled();
  });

  it('submits form on Cmd+Enter when active element is inside form', () => {
    vi.spyOn(form, 'contains').mockReturnValue(true);
    renderHook(() => useSubmitShortcut(makeFormRef(form)));
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }),
    );
    expect(form.requestSubmit).toHaveBeenCalledOnce();
  });

  it('submits form on Ctrl+Enter when active element is inside form', () => {
    vi.spyOn(form, 'contains').mockReturnValue(true);
    renderHook(() => useSubmitShortcut(makeFormRef(form)));
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
    );
    expect(form.requestSubmit).toHaveBeenCalledOnce();
  });

  it('removes keydown listener on unmount', () => {
    vi.spyOn(form, 'contains').mockReturnValue(true);
    const { unmount } = renderHook(() => useSubmitShortcut(makeFormRef(form)));
    unmount();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }),
    );
    expect(form.requestSubmit).not.toHaveBeenCalled();
  });
});
