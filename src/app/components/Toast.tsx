// Small transient messages: "saved", "sent"... at the bottom, errors at the top of the screen (above
// any open popup, so a form error is seen however far the form is scrolled) and for a little longer.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './Icon';

type Toast = { id: number; tone: 'success' | 'error'; text: string };
const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((list) => list.filter((t) => t.id !== id));
  const push = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { id, tone, text }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 7000 : 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      {(['success', 'error'] as const).map((tone) => (
        <div key={tone} className={`ui-toasts ui-toasts--${tone}`} role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
          <AnimatePresence initial={false}>
            {toasts
              .filter((t) => t.tone === tone)
              .map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  className={`ui-toast ui-toast--${t.tone}`}
                  initial={{ opacity: 0, y: tone === 'error' ? -24 : 24, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: tone === 'error' ? -12 : 12, scale: 0.95, transition: { duration: 0.18 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  onClick={() => dismiss(t.id)}
                >
                  <span className="ui-toast-icon">
                    <Icon name={t.tone === 'success' ? 'check' : 'alert'} />
                  </span>
                  {t.text}
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      ))}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
