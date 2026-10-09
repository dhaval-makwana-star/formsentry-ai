import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp, newId } from '../state/AppContext';
import { OPPORTUNITY_TYPES, STAGES } from '../types';
import type { ApplicationRecord, Stage } from '../types';
import { validateApplication } from '../lib/validation';
import type { Errors } from '../lib/validation';
import { isoDate } from '../lib/audit';
import { Badge, Button, Card, DemoTag, EmptyState, Modal, PageHeader, SelectField, TextArea, TextField, deadlineLabel, formatDate } from '../components/ui';
import { ClipboardList } from 'lucide-react';

type Draft = Omit<ApplicationRecord, 'id' | 'updatedAt'>;
const BLANK: Draft = { organization: '', opportunity: '', type: 'Internship', deadline: '', submittedOn: '', stage: 'Preparing', nextAction: '', notes: '' };
const RANK: Record<Stage, number> = { Preparing: 0, 'Ready for Submission': 0, Submitted: 1, Assessment: 1, Interview: 1, Offer: 2, Closed: 3, Withdrawn: 3 };
const DONE: Stage[] = ['Closed', 'Withdrawn', 'Offer'];

function AppForm({ initial, onSave, onClose }: { initial?: ApplicationRecord; onSave: (a: ApplicationRecord) => void; onClose: () => void }) {
  const [d, setD] = useState<Draft>(initial ? { ...initial } : BLANK);
  const [errors, setErrors] = useState<Errors<ApplicationRecord>>({});
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const submit = () => {
    const e = validateApplication(d);
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({ ...d, id: initial?.id ?? newId('app'), updatedAt: new Date().toISOString() });
  };
  return (
    <Modal wide title={initial ? 'Edit application' : 'Add application'} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Save application</Button></>}>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <TextField required label="Organisation" value={d.organization} error={errors.organization} onChange={(e) => set({ organization: e.target.value })} />
        <TextField required label="Opportunity" value={d.opportunity} error={errors.opportunity} onChange={(e) => set({ opportunity: e.target.value })} />
        <SelectField required label="Type" value={d.type} error={errors.type} onChange={(e) => set({ type: e.target.value as ApplicationRecord['type'] })}>
          {OPPORTUNITY_TYPES.map((t) => <option key={t}>{t}</option>)}
        </SelectField>
        <SelectField required label="Stage" value={d.stage} error={errors.stage} onChange={(e) => set({ stage: e.target.value as Stage })}>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </SelectField>
        <TextField type="date" label="Deadline" value={d.deadline} error={errors.deadline} onChange={(e) => set({ deadline: e.target.value })} />
        <TextField type="date" label="Submitted on" value={d.submittedOn} error={errors.submittedOn} onChange={(e) => set({ submittedOn: e.target.value })} />
      </div>
      <TextField label="Next action" value={d.nextAction} error={errors.nextAction} onChange={(e) => set({ nextAction: e.target.value })} />
      <TextArea label="Notes" rows={3} value={d.notes} error={errors.notes} onChange={(e) => set({ notes: e.target.value })} />
    </Modal>
  );
}

export default function Applications() {
  const { applications, saveApplication, deleteApplication, notify } = useApp();
  const [filter, setFilter] = useState<'All' | Stage>('All');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<{ rec?: ApplicationRecord } | null>(null);
  const [del, setDel] = useState<ApplicationRecord | null>(null);
  const today = isoDate(new Date());
  const rows = applications
    .filter((a) => filter === 'All' || a.stage === filter)
    .filter((a) => !query.trim() || `${a.opportunity} ${a.organization} ${a.nextAction} ${a.notes}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => RANK[a.stage] - RANK[b.stage] || (a.deadline || '9999').localeCompare(b.deadline || '9999'));

  const actions = (a: ApplicationRecord) => (
    <div className="flex gap-1">
      <Button small variant="ghost" aria-label={`Edit ${a.opportunity}`} icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setForm({ rec: a })}>Edit</Button>
      <Button small variant="ghost" aria-label={`Delete ${a.opportunity}`} icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => setDel(a)}>Delete</Button>
    </div>
  );
  const stageSelect = (a: ApplicationRecord) => (
    <select
      aria-label={`Stage for ${a.opportunity}`}
      value={a.stage}
      onChange={(e) => {
        const stage = e.target.value as Stage;
        const needsDate = ['Submitted', 'Assessment', 'Interview', 'Offer'].includes(stage) && !a.submittedOn;
        saveApplication({ ...a, stage, submittedOn: needsDate ? today : a.submittedOn, updatedAt: new Date().toISOString() });
        notify(`Stage updated to ${stage}.${needsDate ? ' Submission date set to today; edit it if different.' : ''}`);
      }}
      className="min-h-9 rounded border border-line bg-white px-2 text-sm"
    >
      {STAGES.map((s) => <option key={s}>{s}</option>)}
    </select>
  );
  const dl = (a: ApplicationRecord) => {
    if (!a.deadline) return <span className="text-muted">No deadline</span>;
    const l = deadlineLabel(a.deadline, today);
    return <>{formatDate(a.deadline)} {!DONE.includes(a.stage) && RANK[a.stage] === 0 && <Badge tone={l.tone}>{l.text}</Badge>}</>;
  };

  return (
    <>
      <PageHeader title="My Applications" subtitle="Every application in one place, with its stage and the next thing to do." actions={<><DemoTag /><Button variant="primary" icon={<Plus size={18} aria-hidden="true" />} onClick={() => setForm({})}>Add application</Button></>} />
      <Card>
        <div className="grid gap-x-4 sm:grid-cols-2 max-w-2xl">
          <TextField type="search" label="Search" hint="Opportunity, organisation, next action or notes" value={query} onChange={(e) => setQuery(e.target.value)} />
          <SelectField label="Show stage" value={filter} onChange={(e) => setFilter(e.target.value as 'All' | Stage)}>
            <option>All</option>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </SelectField>
        </div>
        <p className="mt-0 text-sm text-muted" aria-live="polite">{rows.length} of {applications.length} shown</p>
        {rows.length === 0 ? (
          <EmptyState icon={<ClipboardList size={22} />} title="No applications to show" action={<Button variant="primary" onClick={() => setForm({})}>Add application</Button>}>
            {filter === 'All' && !query ? 'Add the first application you are working on.' : 'Nothing matches the current search or stage filter.'}
          </EmptyState>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <caption className="sr-only">Your applications, {rows.length} shown</caption>
                <thead><tr className="border-b-2 border-line text-muted">
                  <th scope="col" className="py-2 pr-3">Opportunity</th><th scope="col" className="py-2 pr-3">Type</th><th scope="col" className="py-2 pr-3">Deadline</th>
                  <th scope="col" className="py-2 pr-3">Stage</th><th scope="col" className="py-2 pr-3">Next action</th><th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
                </tr></thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-b border-line last:border-0 align-top">
                      <th scope="row" className="py-3 pr-3 font-semibold">{a.opportunity}<span className="block font-normal text-muted">{a.organization}</span></th>
                      <td className="py-3 pr-3">{a.type}</td>
                      <td className="py-3 pr-3">{dl(a)}</td>
                      <td className="py-3 pr-3">{stageSelect(a)}</td>
                      <td className="py-3 pr-3 max-w-[16rem]">{a.nextAction || '—'}</td>
                      <td className="py-3">{actions(a)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden list-none m-0 p-0 grid gap-3">
              {rows.map((a) => (
                <li key={a.id} className="border border-line rounded p-3">
                  <p className="m-0 font-semibold">{a.opportunity}</p>
                  <p className="m-0 text-sm text-muted">{a.organization}</p>
                  <p className="m-0 mt-2 text-sm">{a.type}</p><div className="mt-1">{stageSelect(a)}</div>
                  <p className="m-0 mt-1 text-sm">Deadline: {dl(a)}</p>
                  <p className="m-0 mt-1 text-sm">Next: {a.nextAction || '—'}</p>
                  <div className="mt-2">{actions(a)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {form && <AppForm initial={form.rec} onClose={() => setForm(null)} onSave={(a) => { saveApplication(a); setForm(null); notify('Application saved.'); }} />}
      {del && (
        <Modal title="Delete this application?" onClose={() => setDel(null)} footer={<><Button onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={() => { deleteApplication(del.id); setDel(null); notify('Application deleted.'); }}>Delete</Button></>}>
          <p className="m-0">“{del.opportunity}” at {del.organization} will be removed from this browser.</p>
        </Modal>
      )}
    </>
  );
}
