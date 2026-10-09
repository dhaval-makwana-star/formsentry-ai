import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { OPPORTUNITY_TYPES } from '../types';
import { BATCHES, COHORT, DEPARTMENTS } from '../data/cohort';
import { ALL_FILTERS, K_MIN, buildExportRows, byDepartment, byStage, filterRecords, internshipCompletion, stageTiming, summarise, toCsv, topIssues } from '../lib/analytics';
import type { Bar, Filters } from '../lib/analytics';
import { Alert, Button, Card, DemoTag, PageHeader, SelectField } from '../components/ui';

const SUPP = `<${K_MIN}`;
const num = (n: number | null) => (n === null ? SUPP : n.toLocaleString('en-IN'));

function Bars({ bars, label }: { bars: Bar[]; label: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value ?? 0));
  return (
    <ul className="list-none m-0 p-0 grid gap-2" aria-label={label}>
      {bars.map((b) => (
        <li key={b.label} className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] sm:grid-cols-[14rem_1fr_3rem] items-center gap-3 text-sm">
          <span>{b.label}</span>
          <span className={`h-3 border border-line rounded-sm overflow-hidden ${b.value === null ? 'hatched' : 'bg-surface'}`} aria-hidden="true">
            {b.value !== null && <span className="block h-full bg-brand" style={{ width: `${(b.value / max) * 100}%` }} />}
          </span>
          <span className="font-semibold text-right">{num(b.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-line border-l-4 border-l-navy rounded p-4">
      <p className="m-0 text-sm font-semibold text-muted">{label}</p>
      <p className="m-0 text-3xl font-bold text-navy">{value}</p>
    </div>
  );
}

export default function Insights() {
  const { notify } = useApp();
  const [f, setF] = useState<Filters>(ALL_FILTERS);
  const rows = useMemo(() => filterRecords(COHORT, f), [f]);
  const s = summarise(rows);
  const intern = internshipCompletion(rows);
  const pct = (n: number | null) => (n === null ? SUPP : `${n}%`);

  const exportCsv = () => {
    const blob = new Blob([toCsv(buildExportRows(rows, f, new Date()))], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formsentry-synthetic-aggregate.csv';
    a.click();
    URL.revokeObjectURL(url);
    notify('Aggregate CSV downloaded (synthetic data, small groups hidden).');
  };

  return (
    <>
      <PageHeader title="Placement Insights" subtitle="Where applications progress or stall across the cohort." actions={<><DemoTag>Synthetic data</DemoTag><Button icon={<Download size={18} aria-hidden="true" />} onClick={exportCsv}>Export aggregate CSV</Button></>} />
      <Alert tone="warn" title="Synthetic, anonymous, aggregate-only">These figures are generated for demonstration. Groups of fewer than {K_MIN} records are hidden and shown as “{SUPP}”. No individual is identifiable.</Alert>

      <Card className="mb-6" title="Filters">
        <div className="grid gap-x-4 sm:grid-cols-3">
          <SelectField label="Department" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>
            <option>All</option>{DEPARTMENTS.map((d) => <option key={d.name}>{d.name}</option>)}
          </SelectField>
          <SelectField label="Batch" value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })}>
            <option>All</option>{BATCHES.map((b) => <option key={b}>{b}</option>)}
          </SelectField>
          <SelectField label="Opportunity type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Filters['type'] })}>
            <option>All</option>{OPPORTUNITY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </SelectField>
        </div>
        <Button small onClick={() => setF(ALL_FILTERS)}>Clear filters</Button>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6" aria-live="polite">
        <Stat label="Applications" value={num(s.total)} />
        <Stat label="Interview rate" value={pct(s.interviewRate)} />
        <Stat label="Offer rate" value={pct(s.offerRate)} />
        <Stat label="Internship completion" value={pct(intern.completionRate)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card title="Applications by final stage"><Bars bars={byStage(rows)} label="Applications by final stage" /></Card>
        <Card title="Common readiness issues"><Bars bars={topIssues(rows)} label="Applications affected by each issue" /></Card>
        <Card title="Internship status"><Bars bars={intern.bars} label="Internship status" /></Card>
        <Card title="Median days between stages">
          <table className="w-full text-sm text-left">
            <caption className="sr-only">Median days between stages</caption>
            <thead><tr className="border-b border-line text-muted"><th scope="col" className="py-2">Transition</th><th scope="col" className="py-2 text-right">Median days</th><th scope="col" className="py-2 text-right">Records</th></tr></thead>
            <tbody>{stageTiming(rows).map((t) => (
              <tr key={t.label} className="border-b border-line last:border-0"><th scope="row" className="py-2 font-normal">{t.label}</th><td className="py-2 text-right font-semibold">{t.medianDays === null ? SUPP : t.medianDays}</td><td className="py-2 text-right">{num(t.n)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      </div>

      <Card title="By department">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[28rem]">
            <caption className="sr-only">Applications, interviews and offers by department</caption>
            <thead><tr className="border-b-2 border-line text-muted"><th scope="col" className="py-2">Department</th><th scope="col" className="py-2 text-right">Applications</th><th scope="col" className="py-2 text-right">Interviews</th><th scope="col" className="py-2 text-right">Offers</th></tr></thead>
            <tbody>{byDepartment(rows).map((d) => (
              <tr key={d.department} className="border-b border-line last:border-0"><th scope="row" className="py-2 font-normal">{d.department}</th><td className="py-2 text-right">{num(d.applications)}</td><td className="py-2 text-right">{num(d.interviews)}</td><td className="py-2 text-right">{num(d.offers)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="text-muted mb-0">No records match these filters.</p>}
      </Card>
    </>
  );
}
