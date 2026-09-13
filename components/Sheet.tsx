'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { installSheetHistory } from '@/lib/sheet-history';
export function Sheet({
  children,
  titleId,
  onClose,
  className = '',
  dismissDirection,
}: {
  children: React.ReactNode;
  titleId: string;
  onClose: () => void;
  className?: string;
  dismissDirection?: 'left' | 'right';
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  const dragStart = useRef<number | null>(null);
  const horizontalStart = useRef<{ x: number; y: number; time: number } | null>(null);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    let disposeHistory: (() => void) | undefined;
    // Defer registration so React's development effect replay adds no entries.
    const timer = setTimeout(() => {
      disposeHistory = installSheetHistory(window, () => close.current());
    }, 0);
    const viewport = window.visualViewport;
    const resize = () => {
      if (!element || !viewport) return;
      element.style.setProperty('--sheet-viewport-height', `${viewport.height}px`);
      element.style.setProperty(
        '--sheet-keyboard-inset',
        `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`,
      );
    };
    resize();
    viewport?.addEventListener('resize', resize);
    return () => {
      clearTimeout(timer);
      disposeHistory?.();
      viewport?.removeEventListener('resize', resize);
      element?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`sheet ${className}`}
      aria-labelledby={titleId}
      onCancel={onClose}
      onPointerDown={(event) => {
        if (
          !dismissDirection ||
          !event.isPrimary ||
          event.button !== 0 ||
          (event.target as HTMLElement).closest('button, a, input, textarea, select')
        )
          return;
        horizontalStart.current = { x: event.clientX, y: event.clientY, time: performance.now() };
      }}
      onPointerUp={(event) => {
        const start = horizontalStart.current;
        horizontalStart.current = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (
          performance.now() - start.time < 800 &&
          Math.abs(dx) > 75 &&
          Math.abs(dx) > Math.abs(dy) * 1.4 &&
          (dismissDirection === 'right' ? dx > 0 : dx < 0)
        )
          onClose();
      }}
      onPointerCancel={() => {
        horizontalStart.current = null;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientY < rect.top ||
            event.clientY > rect.bottom ||
            event.clientX < rect.left ||
            event.clientX > rect.right
          )
            onClose();
        }
      }}
    >
      <div
        className="sheet-drag-zone"
        aria-hidden="true"
        onPointerDown={(event) => {
          dragStart.current = event.clientY;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          if (dragStart.current !== null && event.clientY - dragStart.current > 65) onClose();
          dragStart.current = null;
        }}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
      >
        <div className="sheet-handle" />
      </div>
      <button className="sheet-close icon-button" onClick={onClose} aria-label="Close sheet">
        <X size={20} />
      </button>
      {children}
    </dialog>
  );
}
