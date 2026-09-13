import { describe, expect, it, vi } from 'vitest';
import { installSheetHistory, type SheetHistoryTarget } from '../lib/sheet-history';

function browserHistory() {
  const entries = [
    {
      state: {
        next: 'preserved',
        __NA: true,
        __PRIVATE_NEXTJS_INTERNALS_TREE: { route: 'feed' },
      } as unknown,
      href: 'https://example.test/feed',
    },
  ];
  let index = 0;
  const traversals: number[] = [];
  const listeners = new Set<() => void>();
  const target = {
    location: { href: 'https://example.test/feed' },
    history: {
      get state() {
        return entries[index].state;
      },
      pushState(state: unknown, _unused: string, url?: string | URL | null) {
        const href = url == null ? target.location.href : new URL(url, target.location.href).href;
        entries.splice(index + 1);
        entries.push({ state, href });
        index++;
        target.location.href = href;
      },
      back() {
        traversals.push(-1);
      },
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  const flush = () => {
    while (traversals.length) {
      const next = index + traversals.shift()!;
      if (next < 0 || next >= entries.length) continue;
      index = next;
      target.location.href = entries[index].href;
      [...listeners].forEach((listener) => listener());
    }
  };
  return {
    target: target as SheetHistoryTarget,
    entries,
    flush,
    forward: () => traversals.push(1),
    get index() {
      return index;
    },
  };
}

describe('mobile sheet history', () => {
  it('Back closes a sheet without leaving the feed', () => {
    const browser = browserHistory();
    const { target, flush } = browser;
    const onBack = vi.fn();
    const dispose = installSheetHistory(target, onBack);
    expect(target.history.state).toMatchObject({ next: 'preserved' });
    target.history.back();
    flush();
    expect(onBack).toHaveBeenCalledOnce();
    dispose();
    flush();
    expect(browser.index).toBe(0);
  });
  it('closing the top sheet preserves its underlying transcript', () => {
    const browser = browserHistory();
    const { target, flush } = browser;
    const parentBack = vi.fn();
    const disposeParent = installSheetHistory(target, parentBack);
    const disposeChild = installSheetHistory(target, vi.fn());
    disposeChild();
    flush();
    expect(parentBack).not.toHaveBeenCalled();
    expect(browser.index).toBe(1);
    disposeParent();
    flush();
    expect(browser.index).toBe(0);
  });
  it('Forward skips a dismissed definition and keeps its transcript open', () => {
    const browser = browserHistory();
    const { target, flush, forward } = browser;
    const parentBack = vi.fn();
    const disposeParent = installSheetHistory(target, parentBack);
    const parentState = target.history.state;
    const childBack = vi.fn();
    const disposeChild = installSheetHistory(target, childBack);
    disposeChild();
    flush();
    forward();
    flush();
    expect(parentBack).not.toHaveBeenCalled();
    expect(childBack).not.toHaveBeenCalled();
    expect(browser.index).toBe(1);
    expect(target.history.state).toEqual(parentState);
    expect(target.history.state).toMatchObject({
      __NA: true,
      __PRIVATE_NEXTJS_INTERNALS_TREE: { route: 'feed' },
    });
    expect(target.location.href).toBe('https://example.test/feed');
    target.history.back();
    flush();
    expect(parentBack).toHaveBeenCalledOnce();
    disposeParent();
    flush();
    expect(browser.index).toBe(0);
  });
  it('only the nearest open ancestor skips a dismissed nested sheet', () => {
    const browser = browserHistory();
    const { target, flush, forward } = browser;
    const outerBack = vi.fn();
    const middleBack = vi.fn();
    const disposeOuter = installSheetHistory(target, outerBack);
    const disposeMiddle = installSheetHistory(target, middleBack);
    const disposeInner = installSheetHistory(target, vi.fn());
    disposeInner();
    flush();
    forward();
    flush();
    expect(browser.index).toBe(2);
    expect(outerBack).not.toHaveBeenCalled();
    expect(middleBack).not.toHaveBeenCalled();
    target.history.back();
    flush();
    expect(outerBack).not.toHaveBeenCalled();
    expect(middleBack).toHaveBeenCalledOnce();
    disposeMiddle();
    flush();
    expect(browser.index).toBe(1);
    disposeOuter();
    flush();
    expect(browser.index).toBe(0);
  });
  it('browser Back dismisses only the top sheet and Forward does not revive it', () => {
    const browser = browserHistory();
    const { target, flush, forward } = browser;
    const parentBack = vi.fn();
    const disposeParent = installSheetHistory(target, parentBack);
    const childBack = vi.fn();
    const disposeChild = installSheetHistory(target, childBack);
    target.history.back();
    flush();
    expect(childBack).toHaveBeenCalledOnce();
    expect(parentBack).not.toHaveBeenCalled();
    disposeChild();
    flush();
    forward();
    flush();
    expect(browser.index).toBe(1);
    expect(childBack).toHaveBeenCalledOnce();
    expect(parentBack).not.toHaveBeenCalled();
    disposeParent();
    flush();
  });
  it('coalesces repeated Forward traversals through dismissed descendants', () => {
    const browser = browserHistory();
    const { target, flush, forward } = browser;
    const parentBack = vi.fn();
    const disposeParent = installSheetHistory(target, parentBack);
    const disposeChild = installSheetHistory(target, vi.fn());
    const disposeGrandchild = installSheetHistory(target, vi.fn());
    disposeGrandchild();
    flush();
    disposeChild();
    flush();
    forward();
    forward();
    flush();
    expect(browser.index).toBe(1);
    expect(parentBack).not.toHaveBeenCalled();
    disposeParent();
    flush();
    expect(browser.index).toBe(0);
  });
  it('cleanup never backs out of a new route', () => {
    const browser = browserHistory();
    const { target, entries, flush } = browser;
    const dispose = installSheetHistory(target, vi.fn());
    target.location.href = 'https://example.test/learn';
    target.history.pushState({}, '', '/learn');
    dispose();
    flush();
    expect(entries).toHaveLength(3);
    expect(browser.index).toBe(2);
    expect(target.location.href).toBe('https://example.test/learn');
  });
});
