// Custom select: a pill button that opens an animated list (with optional search).
// Keyboard: arrows move, Enter picks, Escape closes, typing filters when searchable.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './Icon';

export type Option = { value: string; label: string; hint?: string };

type Props = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder: string;
  icon?: string;
  label?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  block?: boolean;
  disabled?: boolean;
};

export function Dropdown({ value, options, onChange, placeholder, icon, label, searchable, searchPlaceholder = 'بحث…', block, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();

  const current = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    const onDoc = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (o: Option) => {
    onChange(o.value);
    setOpen(false);
    root.current?.querySelector<HTMLButtonElement>('.ui-dd-btn')?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      return setOpen(true);
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (shown[active]) pick(shown[active]);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={['ui-dd', block && 'ui-dd--block', open && 'is-open', value && 'has-value'].filter(Boolean).join(' ')} ref={root} onKeyDown={onKey}>
      <button
        type="button"
        className="ui-dd-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {icon && <Icon name={icon} />}
        <span className="ui-dd-value">{current?.label ?? placeholder}</span>
        <Icon name="chevron" className="ui-dd-chevron" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="ui-dd-pop"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            {searchable && (
              <div className="ui-dd-search">
                <Icon name="search" />
                <input
                  autoFocus
                  value={query}
                  placeholder={searchPlaceholder}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                />
              </div>
            )}
            <ul id={listId} role="listbox" className="ui-dd-list" aria-label={label}>
              {shown.length === 0 && <li className="ui-dd-empty">لا نتائج</li>}
              {shown.map((o, i) => (
                <li
                  key={o.value || '__all'}
                  role="option"
                  data-index={i}
                  aria-selected={o.value === value}
                  className={[i === active && 'is-active', o.value === value && 'is-selected'].filter(Boolean).join(' ')}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                >
                  <span>
                    {o.label}
                    {o.hint && <small>{o.hint}</small>}
                  </span>
                  {o.value === value && <Icon name="check" />}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
