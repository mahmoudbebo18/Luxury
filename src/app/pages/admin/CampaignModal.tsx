// Write an email to one member, a selection, or everyone matching a filter; preview, then queue it.
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Modal } from '../../components/Modal';
import { TextArea, TextField } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Tabs } from '../../components/Tabs';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { adminError, memberIdsFor, type MemberFilter } from './shared';

/** Who an action is for: chosen ids, or everyone matching a filter. */
export type Target = { ids?: string[]; filter?: MemberFilter; label: string; count: number };

/** Plain text with blank-line paragraphs → simple HTML; {{name}} is filled per member by the mail worker. */
export function textToHtml(text: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

const GREETING = 'أهلًا {{name}}،\n\n';

type Props = { open: boolean; onClose: () => void; target: Target | null; onDone?: () => void };

export function CampaignModal({ open, onClose, target, onDone }: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(GREETING);
  const [view, setView] = useState<'write' | 'preview'>('write');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setView('write');
  }, [open]);

  const valid = subject.trim().length > 0 && body.replace(GREETING.trim(), '').trim().length > 0;

  const insertName = () => {
    const el = bodyRef.current;
    if (!el) return;
    const at = el.selectionStart ?? body.length;
    setBody(body.slice(0, at) + '{{name}}' + body.slice(el.selectionEnd ?? at));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at + 8, at + 8);
    });
  };

  const send = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const ids = target.ids ?? (await memberIdsFor(target.filter ?? {}));
      const { error } = await supabase.rpc('admin_create_campaign', {
        p_subject: subject.trim(),
        p_body_html: textToHtml(body),
        p_audience: target.label,
        p_member_ids: ids,
      });
      if (error) throw error;
      toast(`أُضيفت ${ids.length} رسالة إلى الطابور، وتبدأ في الوصول خلال 5 دقائق.`);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      setSubject('');
      setBody(GREETING);
      onDone?.();
      onClose();
    } catch (err) {
      toast(adminError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const count = target?.count ?? 0;
  return (
    <Modal
      open={open}
      wide
      icon="send"
      title="رسالة بريد جديدة"
      lead={<>إلى: <b>{target?.label}</b> ({count.toLocaleString('en-US')} عضو)</>}
      onClose={onClose}
      footer={
        <div className="ui-modal-actions">
          <span className="foot-note">
            <Icon name="info" />
            تُرسل عبر الطابور بحد 140 رسالة يوميًا.
          </span>
          {view === 'write' ? (
            <button type="button" className="btn btn-primary" onClick={() => setView('preview')} disabled={!valid}>
              <Icon name="eye" />
              معاينة
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={send} disabled={!valid || busy}>
              {busy ? <Spinner small /> : <><Icon name="send" />إرسال إلى {count.toLocaleString('en-US')} عضو</>}
            </button>
          )}
        </div>
      }
    >
      <div className="ui-form">
        <Tabs
          value={view}
          onChange={(v) => (v === 'preview' && !valid ? undefined : setView(v))}
          tabs={[
            { value: 'write', label: 'كتابة', icon: 'edit' },
            { value: 'preview', label: 'معاينة', icon: 'eye' },
          ]}
        />
        {view === 'write' ? (
          <>
            <TextField label="العنوان" icon="file" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} placeholder="مثال: خدمة جديدة لأعضاء النادي" />
            <div className="ui-field">
              <TextArea ref={bodyRef} label="نص الرسالة" rows={9} value={body} onChange={(e) => setBody(e.target.value)} hint="اترك سطرًا فارغًا بين الفقرات. الرسالة تصل بالعربي لكل الأعضاء." />
              <div className="var-chips">
                <span>إدراج:</span>
                <button type="button" className="var-chip" onClick={insertName}>اسم العضو</button>
              </div>
            </div>
          </>
        ) : (
          <div className="mail-preview">
            <div className="mail-preview-head">
              <span className="avatar">L</span>
              <span>
                <strong>The Luxury Club</strong>
                <small dir="ltr">info@the-luxury-club.com</small>
              </span>
            </div>
            <div className="mail-preview-subject">{subject}</div>
            <div className="mail-preview-body" dangerouslySetInnerHTML={{ __html: textToHtml(body).replace(/\{\{name\}\}/g, 'عبدالله') }} />
            <p className="ui-hint">المعاينة باسم تجريبي، وكل عضو يرى اسمه.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
