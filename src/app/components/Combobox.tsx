// Text input with a suggestion list (free text still allowed), e.g. the university field.
import { forwardRef, useId, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TextField } from './Field';
import { Icon } from './Icon';

type Props = Omit<React.ComponentProps<typeof TextField>, 'onChange' | 'value'> & {
  value: string;
  onValueChange: (v: string) => void;
  suggestions: string[];
};

export const Combobox = forwardRef<HTMLInputElement, Props>(function Combobox({ value, onValueChange, suggestions, onBlur, ...rest }, ref) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();

  const shown = useMemo(() => {
    const q = value.trim();
    const list = q ? suggestions.filter((s) => s.includes(q) && s !== q) : suggestions;
    return list.slice(0, 8);
  }, [suggestions, value]);

  const pick = (s: string) => {
    onValueChange(s);
    setOpen(false);
  };

  return (
    <div className="ui-combo">
      <TextField
        ref={ref}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && shown.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          setOpen(false);
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (!open || !shown.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(shown.length - 1, i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault();
            pick(shown[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        {...rest}
      />
      <AnimatePresence>
        {open && shown.length > 0 && (
          <motion.ul
            id={listId}
            role="listbox"
            className="ui-dd-pop ui-dd-list ui-combo-list"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {shown.map((s, i) => (
              <li
                key={s}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'is-active' : undefined}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
              >
                <span>{s}</span>
                <Icon name="arrow" className="icon-flip" />
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
});
