import { ArrowRight, FileCheck2 } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { STAGES } from '../types';
import type { ApplicationRecord } from '../types';
import { COHORT } from '../data/cohort';
import { ALL_FILTERS, filterRecords, summarise } from '../lib/analytics';
import { isoDate } from '../lib/audit';
import { Badge, Button, Card, DemoTag, EmptyState, PageHeader, StageBadge, deadlineLabel, formatDate } from '../components/ui';

const CLOSED: ApplicationRecord['stage'][] = ['Closed', 'Withdrawn'];

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="bg-white border border-line border-l-4 border-l-navy rounded p-4">
      <p className="m-0 text-sm font-semibold text-muted">{label}</p>
      <p className="m-0 text-3xl font-bold text-navy leading-tight">{value}</p>
      {note && <p className="m-0 text-xs text-muted mt-1">{note}</p>}
    </div>
  );
}

function StudentOverview() {
  const { applications, outcomes, checker, go } = useApp();
  const today = isoDate(new Date());
  const active = applications.filter((a) => !CLOSED.includes(a.stage));
  const upcoming = active
    .filter((a) => a.deadline && a.deadline >= today && !['Submitted', 'Assessment', 'Interview', 'Offer'].includes(a.stage))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const count = (s: ApplicationRecord['stage']) => applications.filter((a) => a.stage === s).length;
  const pipeline = STAGES.map((s) => ({ s, n: count(s) }));
  const max = Math.max(1, ...pipeline.map((p) => p.n));
  const audit = checker.audit;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Where your applications stand, what is due next, and what to do before you submit."
        actions={<DemoTag />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <Stat label="Active applications" value={active.length} note={`${applications.length} recorded in total`} />
        <Stat label="Deadlines to meet" value={upcoming.length} note="Not yet submitted" />
        <Stat label="Interviews and assessments" value={count('Interview') + count('Assessment')} />
        <Stat label="Offers received" value={count('Offer')} note={`${outcomes.length} outcome${outcomes.length === 1 ? '' : 's'} recorded`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3 mb-6">
        <Card className="xl:col-span-2" title="Deadlines to meet" actions={<Button small variant="ghost" onClick={() => go('applications')}>All applications <ArrowRight size={16} aria-hidden="true" /></Button>}>
          {upcoming.length === 0 ? (
            <p className="m-0 text-muted">No open deadlines. Add an application to start tracking one.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-left text-sm min-w-[32rem]">
                <caption className="sr-only">Applications with deadlines that have not yet been submitted</caption>
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th scope="col" className="py-2 pr-3 font-semibold">Opportunity</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Deadline</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Stage</th>
                    <th scope="col" className="py-2 font-semibold">Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((a) => {
                    const d = deadlineLabel(a.deadline, today);
                    return (
                      <tr key={a.id} className="border-b border-line last:border-0 align-top">
                        <th scope="row" className="py-3 pr-3 font-semibold">{a.opportunity}<span className="block font-normal text-muted">{a.organization}</span></th>
                        <td className="py-3 pr-3 whitespace-nowrap">{formatDate(a.deadline)}<br /><Badge tone={d.tone}>{d.text}</Badge></td>
                        <td className="py-3 pr-3"><StageBadge stage={a.stage} /></td>
                        <td className="py-3">{a.nextAction || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Before you submit">
          {audit ? (
            <>
              <p className="m-0 text-sm text-muted">Latest check ({audit.score.violations} to correct, {audit.score.reviews} to review)</p>
              <p className="m-0 text-3xl font-bold text-navy">{audit.score.score}<span className="text-base font-semibold text-muted"> / 100</span></p>
              <Button className="mt-3" variant="primary" onClick={() => go('report')}>Open report</Button>
            </>
          ) : (
            <EmptyState icon={<FileCheck2 size={22} />} title="No check run yet" action={<Button variant="primary" onClick={() => go('check')}>Start a check</Button>}>
              Compare your resume and documents with an advertisement before you apply.
            </EmptyState>
          )}
        </Card>
      </div>

      <Card title="Application pipeline">
        <ul className="list-none m-0 p-0 grid gap-2">
          {pipeline.map(({ s, n }) => (
            <li key={s} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-3 text-sm">
              <span>{s}</span>
              <span className="h-3 bg-surface border border-line rounded-sm overflow-hidden" aria-hidden="true"><span className="block h-full bg-brand" style={{ width: `${(n / max) * 100}%` }} /></span>
              <span className="font-semibold text-right">{n}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function PlacementOverview() {
  const { go } = useApp();
  const s = summarise(filterRecords(COHORT, ALL_FILTERS));
  const fmt = (n: number | null, pct = false) => (n === null ? '<10' : pct ? `${n}%` : n.toLocaleString('en-IN'));
  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Aggregate employability outcomes for the cohort. No individual student is identifiable in this view."
        actions={<DemoTag>Synthetic data</DemoTag>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <Stat label="Applications in cohort" value={fmt(s.total)} note="Synthetic records" />
        <Stat label="Interview rate" value={fmt(s.interviewRate, true)} />
        <Stat label="Offer rate" value={fmt(s.offerRate, true)} />
        <Stat label="Offers" value={fmt(s.offers)} />
      </div>
      <Card title="Placement Insights">
        <p className="mt-0 text-muted max-w-3xl">Filter by department, batch and opportunity type; see where applications stall and which readiness issues are most common. Any group smaller than 10 records is hidden to protect privacy.</p>
        <Button variant="primary" onClick={() => go('insights')}>Open Placement Insights <ArrowRight size={18} aria-hidden="true" /></Button>
      </Card>
    </>
  );
}

export default function Overview() {
  const { role } = useApp();
  return role === 'student' ? <StudentOverview /> : <PlacementOverview />;
}
