// Dialog: centred card on desktop, bottom sheet on phones. Focus moves in and returns on close.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './Icon';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  closeLabel?: string;
  icon?: string;
  lead?: ReactNode;
};

export function Modal({ open, title, onClose, children, footer, wide, closeLabel = 'إغلاق', icon, lead }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  // Callers pass inline arrows: keep the latest in a ref so a re-render doesn't re-run the focus effect.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    document.body.classList.add('no-scroll');
    const timer = setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, [data-autofocus]');
      (first ?? panel.current)?.focus();
    }, 60);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="ui-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className={wide ? 'ui-modal ui-modal--wide' : 'ui-modal'}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            ref={panel}
            tabIndex={-1}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <span className="ui-modal-grip" aria-hidden="true" />
            <div className="ui-modal-head">
              {icon && (
                <span className="ui-modal-icon">
                  <Icon name={icon} />
                </span>
              )}
              <div className="ui-modal-titles">
                <h2>{title}</h2>
                {lead && <p>{lead}</p>}
              </div>
              <button type="button" className="ui-icon-btn" onClick={onClose} aria-label={closeLabel}>
                <Icon name="close" />
              </button>
            </div>
            <div className="ui-modal-body">{children}</div>
            {footer && <div className="ui-modal-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ---------- confirm dialog (replaces window.confirm) ----------
type ConfirmOptions = { title: string; message?: ReactNode; confirm: string; cancel?: string; danger?: boolean; icon?: string };
type ConfirmState = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const ask = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const done = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <Modal
        open={!!state}
        title={state?.title ?? ''}
        icon={state?.icon ?? (state?.danger ? 'alert' : 'info')}
        onClose={() => done(false)}
        closeLabel={state?.cancel ?? 'إلغاء'}
        footer={
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => done(false)}>
              {state?.cancel ?? 'إلغاء'}
            </button>
            <button type="button" className={state?.danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => done(true)} data-autofocus>
              {state?.confirm}
            </button>
          </div>
        }
      >
        {state?.message && <div className="ui-confirm-text">{state.message}</div>}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
