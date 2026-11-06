// Form controls for the platform: labelled inputs with a leading icon, animated error messages,
// password visibility + caps-lock hint, styled selects and checkboxes.
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './Icon';

type Base = { label: string; icon?: string; error?: string; hint?: string; full?: boolean; optional?: string };

function FieldShell({ id, label, icon, error, hint, full, optional, children, end }: Base & { id: string; children: ReactNode; end?: ReactNode }) {
  return (
    <div className={['ui-field', full && 'ui-field--full', error && 'has-error'].filter(Boolean).join(' ')}>
      <label className="ui-label" htmlFor={id}>
        {label}
        {optional && <span className="ui-optional">{optional}</span>}
      </label>
      <div className="ui-control">
        {icon && <Icon name={icon} className="ui-control-icon" />}
        {children}
        {end}
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

export function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  return (
    <AnimatePresence initial={false} mode="wait">
      {error ? (
        <motion.p
          key={error}
          id={`${id}-msg`}
          className="ui-error"
          role="alert"
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Icon name="alert" />
          {error}
        </motion.p>
      ) : hint ? (
        <motion.p key="hint" id={`${id}-msg`} className="ui-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {hint}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

type InputProps = Base & InputHTMLAttributes<HTMLInputElement> & { end?: ReactNode };

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, icon, error, hint, full, optional, end, id: idProp, className, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell id={id} label={label} icon={icon} error={error} hint={hint} full={full} optional={optional} end={end}>
      <input
        ref={ref}
        id={id}
        className={['ui-input', icon && 'has-icon', end && 'has-end', className].filter(Boolean).join(' ')}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        {...rest}
      />
    </FieldShell>
  );
});

type PasswordProps = Omit<InputProps, 'type' | 'end'> & { showLabel: string; hideLabel: string; capsLabel?: string };

// Copying a password out of an Arabic message brings invisible direction marks (and often a
// trailing space on paste) that the eye can't see but break the sign-in.
const INVISIBLE = /[؜​-‏‪-‮⁦-⁩﻿]/g;

export const PasswordField = forwardRef<HTMLInputElement, PasswordProps>(function PasswordField(
  { showLabel, hideLabel, capsLabel, hint, onKeyUp, onChange, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  return (
    <TextField
      ref={ref}
      type={visible ? 'text' : 'password'}
      dir="ltr"
      hint={caps && capsLabel ? capsLabel : hint}
      onKeyUp={(e) => {
        setCaps(e.getModifierState?.('CapsLock') ?? false);
        onKeyUp?.(e);
      }}
      onChange={(e) => {
        const pasted = (e.nativeEvent as InputEvent).inputType === 'insertFromPaste';
        let value = e.target.value.replace(INVISIBLE, '');
        if (pasted) value = value.trim();
        if (value !== e.target.value) e.target.value = value;
        onChange?.(e);
      }}
      end={
        <button type="button" className="ui-control-end" onClick={() => setVisible((v) => !v)} aria-label={visible ? hideLabel : showLabel} aria-pressed={visible}>
          <Icon name={visible ? 'eye-off' : 'eye'} />
        </button>
      }
      {...rest}
    />
  );
});

type SelectProps = Base & SelectHTMLAttributes<HTMLSelectElement>;

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, icon, error, hint, full, optional, id: idProp, children, className, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell
      id={id}
      label={label}
      icon={icon}
      error={error}
      hint={hint}
      full={full}
      optional={optional}
      end={<Icon name="chevron" className="ui-select-chevron" />}
    >
      <select
        ref={ref}
        id={id}
        className={['ui-input ui-select', icon && 'has-icon', className].filter(Boolean).join(' ')}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});

type AreaProps = Base & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextArea = forwardRef<HTMLTextAreaElement, AreaProps>(function TextArea(
  { label, icon, error, hint, full, optional, id: idProp, className, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} full={full} optional={optional} icon={icon}>
      <textarea
        ref={ref}
        id={id}
        className={['ui-input ui-textarea', icon && 'has-icon', className].filter(Boolean).join(' ')}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        {...rest}
      />
    </FieldShell>
  );
});

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { children: ReactNode; error?: string }>(
  function Checkbox({ children, error, className, ...rest }, ref) {
    const id = useId();
    return (
      <div className={['ui-check-wrap', className].filter(Boolean).join(' ')}>
        <label className={error ? 'ui-check has-error' : 'ui-check'}>
          <input ref={ref} type="checkbox" aria-invalid={!!error} aria-describedby={error ? `${id}-msg` : undefined} {...rest} />
          <span className="ui-check-box" aria-hidden="true">
            <Icon name="check" />
          </span>
          <span className="ui-check-label">{children}</span>
        </label>
        <FieldMessage id={id} error={error} />
      </div>
    );
  },
);

/** Form-level message (success / error / info) with an icon; animates in and out. */
export function Alert({ tone, children, onClose }: { tone: 'success' | 'error' | 'info'; children: ReactNode; onClose?: () => void }) {
  const icon = tone === 'success' ? 'check-circle' : tone === 'error' ? 'x-circle' : 'info';
  return (
    <motion.div
      className={`ui-alert ui-alert--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Icon name={icon} />
      <div className="ui-alert-body">{children}</div>
      {onClose && (
        <button type="button" className="ui-alert-close" onClick={onClose} aria-label="×">
          <Icon name="close" />
        </button>
      )}
    </motion.div>
  );
}

/** Kept for older call sites: same as <Alert>. */
export function FormStatus({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  return <Alert tone={tone}>{children}</Alert>;
}
