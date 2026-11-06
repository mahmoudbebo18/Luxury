// Every kind of automatic email (email_queue.kind / email_templates.kind), in one place: the settings
// page lists the templates in this order, and the emails page labels its log with it. A new kind
// added in the database needs its line here too.
export type EmailKind = { kind: string; label: string; icon: string; when: string; toAdmin?: boolean };

export const EMAIL_KINDS: EmailKind[] = [
  { kind: 'payment_receipt', label: 'إيصال الدفع', icon: 'receipt', when: 'بعد كل دفعة ناجحة أو تحويل مسجّل' },
  { kind: 'renewal_reminder', label: 'تذكير التجديد', icon: 'clock', when: 'قبل انتهاء العضوية الفردية بأيام التذكير' },
  { kind: 'expired', label: 'انتهاء العضوية', icon: 'alert', when: 'بعد انتهاء العضوية الفردية' },
  { kind: 'unpaid_reminder', label: 'تذكير إكمال الدفع', icon: 'wallet', when: 'بعد يوم وثلاثة أيام من التسجيل بدون دفع' },
  { kind: 'invite', label: 'دعوة موظف', icon: 'send', when: 'عندما تدعو الشركة موظفًا' },
  { kind: 'seat_activated', label: 'تفعيل عضوية موظف', icon: 'check-circle', when: 'عندما يقبل الموظف الدعوة' },
  { kind: 'seat_released', label: 'إلغاء عضوية موظف', icon: 'x-circle', when: 'عندما تسحب الشركة المقعد' },
  { kind: 'company_renewal', label: 'تذكير تجديد الشركة', icon: 'building', when: 'لمسؤولي الشركة قبل الانتهاء بـ30 و7 أيام' },
  { kind: 'payment_link', label: 'رابط الدفع (عرض سعر)', icon: 'wallet', when: 'عندما ترسل الإدارة رابط دفع لشركة' },
  { kind: 'admin_payment', label: 'للإدارة: دفعة جديدة', icon: 'bell', when: 'لبريد التنبيهات مع كل دفعة', toAdmin: true },
  { kind: 'admin_quote', label: 'للإدارة: طلب عرض سعر', icon: 'bell', when: 'لبريد التنبيهات مع كل طلب عرض سعر', toAdmin: true },
];

const BY_KIND = new Map(EMAIL_KINDS.map((k) => [k.kind, k]));

export const emailKind = (kind: string): EmailKind =>
  kind === 'campaign' ? { kind, label: 'حملة', icon: 'send', when: '' } : BY_KIND.get(kind) ?? { kind, label: kind, icon: 'mail', when: '' };

/** Sort order for the templates list (unknown kinds go last). */
export const kindOrder = (kind: string) => {
  const i = EMAIL_KINDS.findIndex((k) => k.kind === kind);
  return i < 0 ? EMAIL_KINDS.length : i;
};
