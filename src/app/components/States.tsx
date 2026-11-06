import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Icon } from './Icon';

export function EmptyState({ icon = 'ticket', title, children, action }: { icon?: string; title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <motion.div className="ui-empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <span className="ui-empty-icon">
        <Icon name={icon} />
      </span>
      {title && <strong>{title}</strong>}
      {children && <p>{children}</p>}
      {action}
    </motion.div>
  );
}

export function ErrorState({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="ui-empty ui-empty--error" role="alert">
      <span className="ui-empty-icon">
        <Icon name="alert" />
      </span>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          <Icon name="refresh" />
          {retryLabel ?? 'إعادة المحاولة'}
        </button>
      )}
    </div>
  );
}

/** Grey placeholder blocks shown while data loads. */
export function Skeleton({ rows = 3, height = 56 }: { rows?: number; height?: number }) {
  return (
    <div className="ui-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} style={{ height }} />
      ))}
    </div>
  );
}
