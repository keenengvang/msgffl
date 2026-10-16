import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  children: ReactNode;
}

/** A native <dialog> opened with showModal(): focus trap, Esc to close and
    an inert page behind it, all from the browser. Click the backdrop to close. */
export function Modal({ open, onClose, label, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={label}
      // Esc fires cancel; let the parent own the open state.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click that lands on the dialog element itself is the backdrop.
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {open && children}
    </dialog>
  );
}
