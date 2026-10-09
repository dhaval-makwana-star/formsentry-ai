import { useEffect, useId, useRef } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, OctagonAlert, X } from 'lucide-react';
import type { Stage } from '../types';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ---------- Buttons ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  loading?: boolean;
  small?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white border border-brand hover:bg-navy hover:border-navy',
  secondary: 'bg-white text-brand border border-brand hover:bg-info-bg',
  ghost: 'bg-transparent text-brand border border-transparent hover:bg-info-bg',
  danger: 'bg-white text-bad-ink border border-bad-ink hover:bg-bad-bg',
};

export function Button({ variant = 'secondary', icon, loading, small, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        small ? 'min-h-9 px-3 py-1 text-sm' : 'min-h-11 px-4 py-2 text-base',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="fs-spin" size={18} aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

// ---------- Form fields ----------

interface ShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, required, children }: ShellProps) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block font-semibold text-ink mb-1">
        {label}
        {required ? <span className="text-bad-ink" aria-hidden="true"> *</span> : <span className="font-normal text-muted"> (optional)</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {hint && <p id={`${id}-hint`} className="text-sm text-muted mb-1">{hint}</p>}
      {children}
      {error && (
        <p id={`${id}-err`} className="mt-1 text-sm font-semibold text-bad-ink flex gap-1 items-start">
          <OctagonAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span><span className="sr-only">Error: </span>{error}</span>
        </p>
      )}
    </div>
  );
}

const CONTROL = 'block w-full rounded border bg-white px-3 py-2 text-base text-ink min-h-11';

function describedBy(id: string, hint?: string, error?: string) {
  return [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
}

type CommonProps = { label: string; hint?: string; error?: string; required?: boolean };

export function TextField({ label, hint, error, required, className, ...rest }: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <input id={id} aria-invalid={!!error} aria-describedby={describedBy(id, hint, error)} aria-required={required} className={cx(CONTROL, error ? 'border-bad-ink border-2' : 'border-line', className)} {...rest} />
    </FieldShell>
  );
}

export function TextArea({ label, hint, error, required, className, ...rest }: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <textarea id={id} aria-invalid={!!error} aria-describedby={describedBy(id, hint, error)} aria-required={required} className={cx(CONTROL, error ? 'border-bad-ink border-2' : 'border-line', className)} {...rest} />
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, required, className, children, ...rest }: CommonProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <select id={id} aria-invalid={!!error} aria-describedby={describedBy(id, hint, error)} aria-required={required} className={cx(CONTROL, error ? 'border-bad-ink border-2' : 'border-line', className)} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

// ---------- Surfaces ----------

export function Card({ title, actions, children, className, id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx('bg-white border border-line rounded shadow-sm', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-line">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export type Tone = 'neutral' | 'info' | 'warn' | 'ok' | 'bad';
const TONES: Record<Tone, string> = {
  neutral: 'bg-surface text-ink border-line',
  info: 'bg-info-bg text-info-ink border-info-line',
  warn: 'bg-amber-bg text-amber-ink border-amber-line',
  ok: 'bg-ok-bg text-ok-ink border-ok-line',
  bad: 'bg-bad-bg text-bad-ink border-bad-line',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 border rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap', TONES[tone], className)}>{children}</span>;
}

const STAGE_TONE: Record<Stage, Tone> = {
  Preparing: 'neutral',
  'Ready for Submission': 'info',
  Submitted: 'info',
  Assessment: 'warn',
  Interview: 'warn',
  Offer: 'ok',
  Closed: 'neutral',
  Withdrawn: 'neutral',
};

export function StageBadge({ stage }: { stage: Stage }) {
  return <Badge tone={STAGE_TONE[stage]}>{stage}</Badge>;
}

export function DemoTag({ children = 'Demonstration data' }: { children?: ReactNode }) {
  return <Badge tone="warn">{children}</Badge>;
}

const ALERT_ICON = { info: Info, warn: AlertTriangle, ok: CheckCircle2, bad: OctagonAlert, neutral: Info } as const;

export function Alert({ tone = 'info', title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  const Icon = ALERT_ICON[tone];
  return (
    <div role={tone === 'bad' || tone === 'warn' ? 'alert' : 'status'} className={cx('flex gap-3 border rounded p-3 mb-4', TONES[tone], className)}>
      <Icon size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-sm break-words">{children}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="h-2 w-full bg-surface border border-line rounded overflow-hidden">
      <div className="h-full bg-brand" style={{ width: `${value}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="mx-auto mb-3 h-12 w-12 flex items-center justify-center rounded-full bg-surface text-brand" aria-hidden="true">{icon}</div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {children && <p className="text-muted max-w-md mx-auto mb-4">{children}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-muted py-6 justify-center">
      <Loader2 className="fs-spin" size={20} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} — FormSentry AI`;
  }, [title]);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted mt-1 max-w-3xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

// ---------- Modal ----------

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input,textarea,select') ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab' && ref.current) {
        const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const a = items[0];
        const z = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy/60 p-0 sm:p-4 no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx('bg-white w-full max-h-[92vh] overflow-y-auto rounded-t sm:rounded shadow-lg border border-line', wide ? 'sm:max-w-3xl' : 'sm:max-w-xl')}>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line sticky top-0 bg-white">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="p-2 rounded hover:bg-surface"><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-4 py-3 border-t border-line bg-surface sticky bottom-0">{footer}</div>}
      </div>
    </div>
  );
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function deadlineLabel(iso: string, today: string): { text: string; tone: Tone } {
  if (!iso) return { text: 'No deadline', tone: 'neutral' };
  const diff = Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
  if (diff < 0) return { text: `${-diff} day${diff === -1 ? '' : 's'} ago`, tone: 'neutral' };
  if (diff === 0) return { text: 'Due today', tone: 'bad' };
  if (diff <= 3) return { text: `In ${diff} day${diff === 1 ? '' : 's'}`, tone: 'warn' };
  return { text: `In ${diff} days`, tone: 'neutral' };
}
