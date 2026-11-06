// Segmented tabs with a sliding indicator.
import { useId } from 'react';
import { motion } from 'motion/react';
import { Icon } from './Icon';

type Tab<T extends string> = { value: T; label: string; count?: number; icon?: string };

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: Tab<T>[]; value: T; onChange: (v: T) => void; label?: string }) {
  const group = useId();
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button key={t.value} type="button" role="tab" aria-selected={active} className={active ? 'ui-tab is-active' : 'ui-tab'} onClick={() => onChange(t.value)}>
            {active && <motion.span layoutId={`tab-${group}`} className="ui-tab-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="ui-tab-label">
              {t.icon && <Icon name={t.icon} />}
              {t.label}
              {t.count !== undefined && <span className="ui-tab-count">{t.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
