import { useState } from 'react';
import { Award, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp, newId } from '../state/AppContext';
import { OUTCOME_TYPES } from '../types';
import type { OutcomeRecord, OutcomeType } from '../types';
import { validateOutcome } from '../lib/validation';
import type { Errors } from '../lib/validation';
import { isoDate } from '../lib/audit';
import { Alert, Badge, Button, Card, DemoTag, EmptyState, Modal, PageHeader, SelectField, TextArea, TextField, formatDate } from '../components/ui';

type Draft = Omit<OutcomeRecord, 'id'>;
const blank = (): Draft => ({ type: 'Interview', organization: '', role: '', date: isoDate(new Date()), applicationId: undefined, selfReportedReason: '' });
const TONE: Record<OutcomeType, 'info' | 'warn' | 'ok' | 'neutral'> = { Interview: 'warn', Offer: 'ok', 'Internship completed': 'info', 'Employment start': 'ok' };

function OutcomeForm({ initial, onSave, onClose }: { initial?: OutcomeRecord; onSave: (o: OutcomeRecord) => void; onClose: () => void }) {
  const { applications } = useApp();
  const [d, setD] = useState<Draft>(initial ? { ...initial } : blank());
  const [errors, setErrors] = useState<Errors<OutcomeRecord>>({});
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const link = (id: string) => {
    const a = applications.find((x) => x.id === id);
    set(a ? { applicationId: id, organization: d.organization || a.organization, role: d.role || a.opportunity } : { applicationId: undefined });
  };
  const submit = () => {
    const e = validateOutcome(d);
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({ ...d, id: initial?.id ?? newId('out') });
  };
  return (
    <Modal wide title={initial ? 'Edit outcome' : 'Record an outcome'} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Save outcome</Button></>}>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <SelectField required label="Outcome" value={d.type} onChange={(e) => set({ type: e.target.value as OutcomeType })}>{OUTCOME_TYPES.map((t) => <option key={t}>{t}</option>)}</SelectField>
        <TextField required type="date" label="Date" value={d.date} error={errors.date} onChange={(e) => set({ date: e.target.value })} />
        <SelectField label="Linked application" value={d.applicationId ?? ''} onChange={(e) => link(e.target.value)}>
          <option value="">Not linked</option>
          {applications.map((a) => <option key={a.id} value={a.id}>{a.opportunity} · {a.organization}</option>)}
        </SelectField>
        <span />
        <TextField required label="Organisation" value={d.organization} error={errors.organization} onChange={(e) => set({ organization: e.target.value })} />
        <TextField required label="Role" value={d.role} error={errors.role} onChange={(e) => set({ role: e.target.value })} />
      </div>
      <TextArea label="Your own note" hint="Optional. What you think helped or held you back. Stored only in this browser." rows={3} value={d.selfReportedReason} error={errors.selfReportedReason} onChange={(e) => set({ selfReportedReason: e.target.value })} />
    </Modal>
  );
}

export default function Outcomes() {
  const { outcomes, applications, saveOutcome, deleteOutcome, notify } = useApp();
  const [form, setForm] = useState<{ rec?: OutcomeRecord } | null>(null);
  const [del, setDel] = useState<OutcomeRecord | null>(null);
  const n = (t: OutcomeType) => outcomes.filter((o) => o.type === t).length;
  const submitted = applications.filter((a) => !['Preparing', 'Ready for Submission'].includes(a.stage)).length;
  const sorted = [...outcomes].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHeader title="Employability Outcomes" subtitle="Record interviews, offers, completed internships and job starts so your progress is visible over time." actions={<><DemoTag /><Button variant="primary" icon={<Plus size={18} aria-hidden="true" />} onClick={() => setForm({})}>Record outcome</Button></>} />
      <Alert tone="warn" title="Self-reported and unverified">Every outcome here is entered by you and has not been verified by an employer or institution. Records stay in this browser only and are not shared in this prototype.</Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {OUTCOME_TYPES.map((t) => (
          <div key={t} className="bg-white border border-line border-l-4 border-l-navy rounded p-4">
            <p className="m-0 text-sm font-semibold text-muted">{t}</p>
            <p className="m-0 text-3xl font-bold text-navy">{n(t)}</p>
          </div>
        ))}
      </div>
      <p className="mt-0 mb-6 text-sm text-muted">{submitted} application{submitted === 1 ? '' : 's'} submitted so far, {n('Interview')} interview{n('Interview') === 1 ? '' : 's'} and {n('Offer')} offer{n('Offer') === 1 ? '' : 's'} recorded.</p>

      <Card title="Outcome history">
        {sorted.length === 0 ? (
          <EmptyState icon={<Award size={22} />} title="No outcomes recorded" action={<Button variant="primary" onClick={() => setForm({})}>Record outcome</Button>}>Add your first interview, offer or completed internship.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[36rem]">
              <caption className="sr-only">Recorded outcomes, newest first</caption>
              <thead><tr className="border-b-2 border-line text-muted"><th scope="col" className="py-2 pr-3">Date</th><th scope="col" className="py-2 pr-3">Outcome</th><th scope="col" className="py-2 pr-3">Role and organisation</th><th scope="col" className="py-2 pr-3">Your note</th><th scope="col" className="py-2"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {sorted.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0 align-top">
                    <td className="py-3 pr-3 whitespace-nowrap">{formatDate(o.date)}</td>
                    <td className="py-3 pr-3"><Badge tone={TONE[o.type]}>{o.type}</Badge><br /><Badge tone="warn" className="mt-1">Self-reported · unverified</Badge></td>
                    <th scope="row" className="py-3 pr-3 font-semibold">{o.role}<span className="block font-normal text-muted">{o.organization}</span></th>
                    <td className="py-3 pr-3 max-w-[18rem]">{o.selfReportedReason || <span className="text-muted">—</span>}</td>
                    <td className="py-3 whitespace-nowrap">
                      <Button small variant="ghost" aria-label={`Edit ${o.type} at ${o.organization}`} icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setForm({ rec: o })}>Edit</Button>
                      <Button small variant="ghost" aria-label={`Delete ${o.type} at ${o.organization}`} icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => setDel(o)}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {form && <OutcomeForm initial={form.rec} onClose={() => setForm(null)} onSave={(o) => { saveOutcome(o); setForm(null); notify('Outcome saved.'); }} />}
      {del && (
        <Modal title="Delete this outcome?" onClose={() => setDel(null)} footer={<><Button onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={() => { deleteOutcome(del.id); setDel(null); notify('Outcome deleted.'); }}>Delete</Button></>}>
          <p className="m-0">{del.type} at {del.organization} will be removed from this browser.</p>
        </Modal>
      )}
    </>
  );
}
