import { useState } from 'react';
import { CheckCircle2, FileCheck2, Pencil, Printer, RefreshCw, Save } from 'lucide-react';
import { useApp, newId } from '../state/AppContext';
import type { Finding, FindingStatus, OpportunityType, Severity } from '../types';
import { DISCLAIMER, runAudit, setFindingStatus } from '../lib/audit';
import { Alert, Badge, Button, Card, EmptyState, PageHeader } from '../components/ui';
import type { Tone } from '../components/ui';

const SEV: Record<Severity, { label: string; tone: Tone }> = {
  violation: { label: 'Needs correction', tone: 'bad' },
  review: { label: 'Review', tone: 'warn' },
  suggestion: { label: 'Suggestion', tone: 'info' },
};
const ORDER: Severity[] = ['violation', 'review', 'suggestion'];

function FindingCard({ f, onStatus }: { f: Finding; onStatus: (s: FindingStatus) => void }) {
  const closed = f.status !== 'open';
  return (
    <li className="border border-line rounded bg-white p-4 avoid-break">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Badge tone={SEV[f.severity].tone}>{SEV[f.severity].label}</Badge>
        <Badge>{f.category}</Badge>
        <Badge tone="neutral">{f.basis === 'Rule-based' ? 'Rule-based check' : f.basis}</Badge>
        {closed && <Badge tone="ok">{f.status[0].toUpperCase() + f.status.slice(1)}</Badge>}
      </div>
      <h3 className="m-0 text-base font-semibold">{f.title}</h3>
      <p className="mt-1 mb-2">{f.explanation}</p>
      <p className="m-0 text-sm"><strong>What to do:</strong> {f.action}</p>
      {f.recheckNote && <p className="m-0 mt-1 text-sm text-amber-ink"><strong>Re-check:</strong> {f.recheckNote}</p>}
      <div className="mt-2 text-sm border-l-4 border-info-line bg-surface px-3 py-2">
        <p className="m-0 font-semibold">Evidence</p>
        <ul className="m-0 pl-5">
          {f.evidence.map((e, i) => (
            <li key={i}>{e.source}{e.field ? ` · ${e.field}` : ''}{e.passage ? <>: <q>{e.passage}</q></> : ''}{e.rule ? <> <span className="text-muted">(rule: {e.rule})</span></> : ''}</li>
          ))}
        </ul>
        <p className="m-0 mt-1"><strong>Why it matters:</strong> {f.why}</p>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 no-print">
        {closed ? (
          <Button small onClick={() => onStatus('open')}>Reopen</Button>
        ) : (
          <>
            <Button small onClick={() => onStatus('resolved')}>Mark as fixed</Button>
            <Button small onClick={() => onStatus('reviewed')}>Mark as reviewed</Button>
            <Button small variant="ghost" onClick={() => onStatus('dismissed')}>Dismiss</Button>
          </>
        )}
      </div>
    </li>
  );
}

export default function Report() {
  const { checker, updateChecker, go, saveApplication, notify } = useApp();
  const [saved, setSaved] = useState(false);
  const audit = checker.audit;
  const opp = checker.opportunity;

  if (!audit) {
    return (
      <>
        <PageHeader title="Check report" />
        <EmptyState icon={<FileCheck2 size={22} />} title="No report yet" action={<Button variant="primary" onClick={() => go('check')}>Go to Application Checker</Button>}>
          Reports are kept in memory only, so they are cleared when you refresh the page. Run a new check to see one.
        </EmptyState>
      </>
    );
  }

  const open = audit.findings.filter((f) => f.status === 'open');
  const rerun = () => {
    const next = runAudit({ opportunity: opp, docs: checker.docs, previous: audit, now: new Date() });
    updateChecker((c) => ({ ...c, audit: next, dirty: false }));
    notify(`Check re-run. ${next.clearedSincePrevious} finding${next.clearedSincePrevious === 1 ? '' : 's'} cleared since the previous run.`);
  };
  const save = () => {
    saveApplication({
      id: newId('app'), organization: opp.organization, opportunity: opp.title, type: opp.type as OpportunityType,
      deadline: opp.deadline, submittedOn: '', stage: open.some((f) => f.severity === 'violation') ? 'Preparing' : 'Ready for Submission',
      nextAction: open.length ? 'Resolve open findings from the check report' : 'Submit on the official portal', notes: '', updatedAt: new Date().toISOString(),
    });
    setSaved(true);
    notify('Saved to My Applications.');
  };

  return (
    <>
      <PageHeader
        title="Check report"
        subtitle={<>{opp.title} · {opp.organization} · run #{audit.runNumber}</>}
        actions={<>
          <Button icon={<Printer size={18} aria-hidden="true" />} onClick={() => window.print()}>Print</Button>
          <Button icon={<Pencil size={18} aria-hidden="true" />} onClick={() => { updateChecker((c) => ({ ...c, step: 1 })); go('check'); }}>Correct details or documents</Button>
          <Button icon={<RefreshCw size={18} aria-hidden="true" />} onClick={rerun}>Re-run check</Button>
          <Button variant="primary" disabled={saved} icon={<Save size={18} aria-hidden="true" />} onClick={save}>{saved ? 'Saved' : 'Save to My Applications'}</Button>
        </>}
      />
      <div className="print-only mb-4 text-sm">
        <p className="m-0"><strong>FormSentry AI check report</strong> (demonstration prototype)</p>
        <p className="m-0">Generated {new Date(audit.ranAt).toLocaleString('en-IN')} · Documents checked: {checker.docs.filter((d) => d.status === 'ready').map((d) => d.name).join(', ')}</p>
      </div>
      {checker.dirty && <Alert tone="warn" title="Your inputs changed after this report">Re-run the check so the findings match your latest documents.</Alert>}

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="bg-white border border-line border-l-4 border-l-navy rounded p-4 md:col-span-1">
          <p className="m-0 text-sm font-semibold text-muted">Readiness score</p>
          <p className="m-0 text-4xl font-bold text-navy">{audit.score.score}<span className="text-base text-muted"> / 100</span></p>
          <p className="m-0 text-xs text-muted">A count of open findings, not a prediction.</p>
        </div>
        {ORDER.map((s) => (
          <div key={s} className="bg-white border border-line rounded p-4">
            <p className="m-0 text-sm font-semibold text-muted">{SEV[s].label}</p>
            <p className="m-0 text-3xl font-bold text-navy">{open.filter((f) => f.severity === s).length}</p>
            <p className="m-0 text-xs text-muted">open</p>
          </div>
        ))}
      </div>

      <Alert tone="info" title="How this report was produced">Every finding comes from fixed rules and text matching on the text extracted from your files. No AI model was used and nothing left your device. {DISCLAIMER}</Alert>

      <div className="grid gap-6 mb-6">
        {ORDER.map((s) => {
          const list = audit.findings.filter((f) => f.severity === s);
          if (!list.length) return null;
          return (
            <section key={s} aria-labelledby={`sec-${s}`}>
              <h2 id={`sec-${s}`} className="text-lg font-semibold mb-2">{SEV[s].label} ({list.length})</h2>
              <ul className="list-none m-0 p-0 grid gap-3">{list.map((f) => <FindingCard key={f.id} f={f} onStatus={(st) => updateChecker((c) => ({ ...c, audit: c.audit ? setFindingStatus(c.audit, f.id, st) : c.audit }))} />)}</ul>
            </section>
          );
        })}
        {audit.findings.length === 0 && <Alert tone="ok" title="No findings">All checks passed. Still read your documents once more before submitting.</Alert>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Requirement coverage">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[24rem]">
              <caption className="sr-only">Each stated requirement and whether evidence was found in your resume</caption>
              <thead><tr className="border-b border-line text-muted"><th scope="col" className="py-2 pr-3">Requirement</th><th scope="col" className="py-2">Result</th></tr></thead>
              <tbody>
                {audit.coverage.map((c) => (
                  <tr key={c.requirement} className="border-b border-line last:border-0 align-top">
                    <th scope="row" className="py-2 pr-3 font-normal">{c.requirement}</th>
                    <td className="py-2">{c.found ? <Badge tone="ok">Evidence found</Badge> : c.checkable ? <Badge tone="warn">No evidence found</Badge> : <Badge>Cannot be checked</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="All checks performed">
          <ul className="list-none m-0 p-0 grid gap-2 text-sm">
            {audit.checks.map((c) => (
              <li key={c.id} className="flex gap-2 items-start">
                {c.outcome === 'passed' ? <CheckCircle2 size={18} className="text-ok-ink shrink-0 mt-0.5" aria-hidden="true" /> : <span className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />}
                <span><strong>{c.name}</strong> <span className="text-muted">({c.outcome === 'passed' ? 'passed' : c.outcome === 'attention' ? 'needs attention' : 'not applicable'})</span><br /><span className="text-muted">{c.detail}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
