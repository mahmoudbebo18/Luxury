// Live password rules + strength meter under a new-password field.
import { useT } from '../i18n';
import { passwordChecks, passwordScore } from '../lib/options';
import { Icon } from './Icon';

export function PasswordStrength({ value }: { value: string }) {
  const { t } = useT();
  const checks = passwordChecks(value);
  const score = passwordScore(value);
  const labels = ['', t('pw.weak'), t('pw.fair'), t('pw.good'), t('pw.strong')];
  return (
    <div className="pw-meter" data-score={score}>
      <div className="pw-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={i <= score ? 'is-on' : undefined} />
        ))}
        {value && <em>{labels[score]}</em>}
      </div>
      <ul className="pw-rules">
        {(['length', 'letter', 'number'] as const).map((k) => (
          <li key={k} className={checks[k] ? 'is-ok' : undefined}>
            <Icon name={checks[k] ? 'check-circle' : 'info'} />
            {t(`pw.${k}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
