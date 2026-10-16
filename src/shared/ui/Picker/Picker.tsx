import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Picker.module.css';

export interface PickerOption<V extends string | number> {
  value: V;
  label: string;
  /** Leading visual in the list and the trigger (an avatar, say). */
  icon?: ReactNode;
}

interface PickerProps<V extends string | number> {
  value: V | null;
  options: PickerOption<V>[];
  onChange: (value: V) => void;
  /** Accessible name, and the trigger text while nothing is picked. */
  label: string;
  placeholder?: string;
  disabled?: boolean;
}

/** A select whose option list we draw ourselves. A native <select>'s list is
    painted by the OS, so on phones it can't be sized or styled at all; this
    one keeps the trigger compact and gives the open list big, readable rows.
    ARIA listbox pattern: focus stays on the trigger, aria-activedescendant
    tracks the highlighted row. */
export function Picker<V extends string | number>({
  value,
  options,
  onChange,
  label,
  placeholder,
  disabled,
}: PickerProps<V>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const selected = options.find((o) => o.value === value) ?? null;

  const show = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const choose = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    setOpen(false);
  };

  // Close on any press outside the picker.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    const move = (i: number) => {
      e.preventDefault();
      if (!open) show();
      else setActive(Math.min(last, Math.max(0, i)));
    };
    switch (e.key) {
      case 'ArrowDown':
        return move(active + 1);
      case 'ArrowUp':
        return move(active - 1);
      case 'Home':
        return move(0);
      case 'End':
        return move(last);
      case 'Enter':
      case ' ':
        e.preventDefault();
        return open ? choose(active) : show();
      case 'Escape':
        if (open) {
          // Don't let Esc also close a surrounding modal.
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
        return;
      case 'Tab':
        setOpen(false);
    }
  };

  return (
    <div ref={root} className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
      >
        {selected?.icon}
        <span className={selected ? styles.value : `${styles.value} ${styles.placeholder}`}>
          {selected?.label ?? placeholder ?? label}
        </span>
      </button>
      {open && (
        <ul ref={list} id={`${id}-list`} role="listbox" aria-label={label} className={styles.list}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={[
                styles.option,
                i === active ? styles.active : '',
                o.value === value ? styles.selected : '',
              ].join(' ')}
              // pointerdown would blur the trigger first; click is enough
              // since outside-press handling ignores presses inside the root.
              onClick={() => choose(i)}
              onPointerMove={() => setActive(i)}
            >
              {o.icon}
              <span className={styles.optionLabel}>{o.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
