import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, GraduationCap, Landmark, Menu, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { NAV, crumbsFor, navIdFor } from '../lib/nav';
import type { Role } from '../types';
import type { RouteId } from '../lib/router';
import { PATH_OF } from '../lib/router';
import { Alert, Badge, Button, Modal, cx } from './ui';

function NavLink({ id, label, hint, Icon, active, onNavigate }: { id: RouteId; label: string; hint: string; Icon: (typeof NAV)[number]['icon']; active: boolean; onNavigate?: () => void }) {
  return (
    <a
      href={'#' + PATH_OF[id]}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex items-start gap-3 px-4 py-3 border-l-4 text-ink no-underline',
        active ? 'border-brand bg-info-bg font-semibold text-navy' : 'border-transparent hover:bg-surface',
      )}
    >
      <Icon size={20} className={cx('mt-0.5 shrink-0', active ? 'text-brand' : 'text-muted')} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block leading-snug">{label}</span>
        <span className="block text-xs font-normal text-muted">{hint}</span>
      </span>
    </a>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { route, role } = useApp();
  const active = navIdFor(route);
  return (
    <nav aria-label="Main navigation">
      <ul className="list-none m-0 p-0">
        {NAV.filter((n) => n.roles.includes(role)).map((n) => (
          <li key={n.id}>
            <NavLink id={n.id} label={n.label} hint={n.hint} Icon={n.icon} active={active === n.id} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

const ROLE_OPTIONS: { id: Role; label: string; icon: typeof GraduationCap }[] = [
  { id: 'student', label: 'Student', icon: GraduationCap },
  { id: 'placement', label: 'Placement Cell', icon: Landmark },
];

export function RoleSwitcher({ className }: { className?: string }) {
  const { role, setRole } = useApp();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const next = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : ROLE_OPTIONS.length - 1)) % ROLE_OPTIONS.length;
    setRole(ROLE_OPTIONS[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <span id="role-label" className="text-sm font-semibold text-muted">View as</span>
      <div role="radiogroup" aria-labelledby="role-label" className="inline-flex border border-brand rounded overflow-hidden bg-white">
        {ROLE_OPTIONS.map((o, i) => {
          const on = role === o.id;
          return (
            <button
              key={o.id}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => !on && setRole(o.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cx('inline-flex items-center gap-1.5 min-h-10 px-3 text-sm font-semibold', on ? 'bg-brand text-white' : 'text-brand hover:bg-info-bg')}
            >
              <o.icon size={16} aria-hidden="true" />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Breadcrumbs() {
  const { route, go } = useApp();
  const crumbs = crumbsFor(route);
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-1 list-none m-0 p-0 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.id + i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="text-muted" aria-hidden="true" />}
              {last ? (
                <span aria-current="page" className="font-semibold text-navy">{c.label}</span>
              ) : (
                <a href={'#' + PATH_OF[c.id]} onClick={(e) => { e.preventDefault(); go(c.id); }} className="text-brand underline underline-offset-2">{c.label}</a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('a,button')?.focus();
    const sel = 'a[href],button:not([disabled])';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && ref.current) {
        const items = Array.from(ref.current.querySelectorAll<HTMLElement>(sel));
        const a = items[0];
        const z = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-40 lg:hidden no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-navy/60" aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Site menu" className="relative h-full w-[min(20rem,88vw)] bg-white shadow-lg flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between bg-navy text-white px-4 py-3">
          <span className="font-semibold">Menu</span>
          <button type="button" onClick={onClose} aria-label="Close menu" className="p-2 rounded hover:bg-brand"><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="p-4 border-b border-line"><RoleSwitcher className="flex-wrap" /></div>
        <NavList onNavigate={onClose} />
      </div>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const { route, role, notice, persistFailed, resetAll } = useApp();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  // Move focus to the page content on navigation so keyboard and screen-reader users land in the right place.
  useEffect(() => {
    setOpen(false);
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [route]);

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="skip-link">Skip to main content</a>

      <div className="bg-amber-bg border-b border-amber-line text-amber-ink text-sm no-print">
        <p className="max-w-7xl mx-auto px-4 py-1.5 m-0">
          <strong>Demonstration prototype.</strong> All records are synthetic. This is a student-built project and is not an official government service.
        </p>
      </div>

      <header className="bg-navy text-white no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <a href={'#' + PATH_OF.overview} className="flex items-center gap-3 text-white no-underline min-w-0">
            <span className="h-10 w-10 shrink-0 bg-white text-navy flex items-center justify-center rounded" aria-hidden="true"><ShieldCheck size={24} /></span>
            <span className="min-w-0 leading-tight">
              <span className="block text-lg font-bold">FormSentry AI</span>
              <span className="block text-xs text-info-line truncate">Check before you submit · Education &amp; Employability</span>
            </span>
          </a>
          <div className="hidden sm:flex items-center gap-2 text-sm text-info-line">
            <span>Team VeriForge</span>
            <span aria-hidden="true">·</span>
            <span>Seva First Innovation Challenge 2026</span>
          </div>
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-haspopup="dialog" className="lg:hidden inline-flex items-center gap-2 min-h-11 px-3 border border-info-line rounded hover:bg-brand">
            <Menu size={20} aria-hidden="true" /> <span className="text-sm font-semibold">Menu</span>
          </button>
        </div>
      </header>

      <div className="bg-white border-b border-line no-print">
        <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <Breadcrumbs />
          <RoleSwitcher className="hidden lg:flex" />
        </div>
      </div>

      {open && <MobileMenu onClose={() => setOpen(false)} />}

      <div className="flex-1 w-full max-w-7xl mx-auto lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="hidden lg:block border-r border-line bg-white no-print">
          <div className="sticky top-0 py-4">
            <p className="px-4 pb-2 text-xs font-bold uppercase tracking-wide text-muted">
              {role === 'student' ? 'Student view' : 'Placement Cell view'}
            </p>
            <NavList />
          </div>
        </aside>

        <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 px-4 py-6 lg:px-8 outline-none">
          <div className="sm:hidden mb-4 no-print"><Badge tone="warn">Demonstration data</Badge></div>
          {persistFailed && (
            <Alert tone="warn" title="Changes are not being saved">
              Your browser blocked local storage (private mode or full storage). The app still works, but your records will be lost when you close this tab.
            </Alert>
          )}
          {children}
        </main>
      </div>

      <footer className="bg-white border-t border-line no-print">
        <div className="max-w-7xl mx-auto px-4 py-4 text-sm text-muted flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 max-w-3xl">
            FormSentry AI is a self-check aid. It does not guarantee selection and does not replace an organisation’s official instructions. Documents are read in your browser and are not stored.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a href={'#' + PATH_OF.help} className="text-brand underline underline-offset-2">Help &amp; Privacy</a>
            <Button small variant="secondary" icon={<RotateCcw size={16} aria-hidden="true" />} onClick={() => setConfirmReset(true)}>Reset demo data</Button>
          </div>
        </div>
      </footer>

      {confirmReset && <ResetDialog onClose={() => setConfirmReset(false)} onConfirm={() => { resetAll(); setConfirmReset(false); }} />}

      <div aria-live="polite" role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(32rem,92vw)] no-print">
        {notice && <div className="bg-navy text-white border border-navy rounded shadow-lg px-4 py-3 text-sm">{notice}</div>}
      </div>
    </div>
  );
}

function ResetDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal
      title="Reset demo data?"
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" onClick={onConfirm}>Reset everything</Button></>}
    >
      <p className="m-0">This restores the original demonstration applications and outcomes, and clears any uploaded documents and extracted text from this session. Records you added will be deleted.</p>
    </Modal>
  );
}
