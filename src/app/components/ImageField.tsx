// Image picker for the admin forms: drop or choose a photo, preview it, replace or remove it.
import { useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Spinner } from './PageLoader';
import { uploadImage } from '../lib/upload';

type Props = {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  folder: 'activities' | 'coupons' | 'services';
  hint?: string;
  onBusy?: (busy: boolean) => void;
};

export function ImageField({ label, value, onChange, folder, hint, onBusy }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    onBusy?.(true);
    try {
      onChange(await uploadImage(file, folder));
    } catch (err) {
      const m = (err as Error).message;
      setError(m === 'type' ? 'الصيغ المقبولة: JPG أو PNG أو WebP.' : m === 'size' ? 'الصورة أكبر من 5 ميجابايت.' : 'تعذّر رفع الصورة، حاول مرة أخرى.');
    } finally {
      setBusy(false);
      onBusy?.(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="ui-field ui-field--full">
      <span className="ui-label" id={`${id}-label`}>{label}</span>
      <div
        className={['img-field', value && 'has-image', drag && 'is-drag'].filter(Boolean).join(' ')}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files[0]);
        }}
      >
        {value ? <img src={value} alt="" /> : (
          <button type="button" className="img-field-empty" onClick={() => input.current?.click()} aria-labelledby={`${id}-label`}>
            <Icon name="plus" />
            <strong>اختر صورة</strong>
            <small>أو اسحبها هنا · JPG أو PNG أو WebP</small>
          </button>
        )}
        {busy && <span className="img-field-busy"><Spinner /></span>}
        {value && !busy && (
          <div className="img-field-actions">
            <button type="button" className="btn btn-xs btn-soft" onClick={() => input.current?.click()}><Icon name="refresh" />تغيير</button>
            <button type="button" className="btn btn-xs btn-soft btn-danger-text" onClick={() => onChange(null)}><Icon name="trash" />إزالة</button>
          </div>
        )}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {error ? <p className="ui-error" role="alert"><Icon name="alert" />{error}</p> : hint ? <p className="ui-hint">{hint}</p> : null}
    </div>
  );
}
