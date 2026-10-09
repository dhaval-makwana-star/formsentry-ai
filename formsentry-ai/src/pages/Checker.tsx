import { useRef, useState } from 'react';
import { FileText, FlaskConical, Trash2, Upload } from 'lucide-react';
import { useApp, FRESH_CHECKER } from '../state/AppContext';
import type { CheckerState } from '../state/AppContext';
import { DOC_KINDS, DOC_KIND_LABEL, OPPORTUNITY_TYPES } from '../types';
import type { DocKind, Opportunity, UploadedDoc } from '../types';
import { ACCEPT_ATTR, detectSensitiveContent, formatBytes, validateFile, validateOpportunity } from '../lib/validation';
import { extractText, ExtractionError, guessKind } from '../lib/extract';
import { runAudit } from '../lib/audit';
import { sampleDocs, sampleOpportunity } from '../data/sample';
import { Alert, Badge, Button, Card, DemoTag, Modal, PageHeader, ProgressBar, SelectField, TextArea, TextField, cx, formatDate } from '../components/ui';

const STEPS = ['Opportunity details', 'Your documents', 'Review and run'];

function Stepper({ step, go }: { step: number; go: (n: 0 | 1 | 2) => void }) {
  return (
    <ol className="list-none m-0 p-0 mb-6 grid sm:grid-cols-3 border border-line bg-white rounded overflow-hidden" aria-label="Progress">
      {STEPS.map((label, i) => {
        const state = i === step ? 'current' : i < step ? 'done' : 'todo';
        return (
          <li key={label} className={cx('border-b sm:border-b-0 sm:border-r border-line last:border-0', state === 'current' && 'bg-info-bg')}>
            <button type="button" disabled={i > step} onClick={() => go(i as 0 | 1 | 2)} aria-current={state === 'current' ? 'step' : undefined} className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:cursor-default">
              <span className={cx('h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold border', state === 'todo' ? 'border-line text-muted bg-white' : 'bg-navy border-navy text-white')}>{i + 1}</span>
              <span className={cx('font-semibold', state === 'todo' && 'text-muted')}>{label}<span className="sr-only">{state === 'done' ? ' (completed)' : state === 'current' ? ' (current step)' : ''}</span></span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function TextModal({ doc, onSave, onClose }: { doc: UploadedDoc; onSave: (t: string) => void; onClose: () => void }) {
  const [text, setText] = useState(doc.text);
  return (
    <Modal wide title={`Extracted text: ${doc.name}`} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSave(text)}>Save corrections</Button></>}>
      <p className="mt-0 text-sm text-muted">This is the text the checker will read. Fix any words the reader got wrong. Corrections stay in memory only.</p>
      <TextArea label="Extracted text" rows={14} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-sm" />
    </Modal>
  );
}

export default function Checker() {
  const { checker, updateChecker, go, notify } = useApp();
  const live = useRef<CheckerState>(checker);
  live.current = checker;
  const [showErrors, setShowErrors] = useState(false);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState<UploadedDoc | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { opportunity: opp, docs, step } = checker;
  const errors = validateOpportunity(opp);
  const shown = showErrors ? errors : {};
  const errorCount = Object.keys(errors).length;
  const ready = docs.filter((d) => d.status === 'ready');
  const busy = docs.some((d) => d.status === 'extracting');

  const setOpp = (patch: Partial<Opportunity>) => updateChecker((c) => ({ ...c, opportunity: { ...c.opportunity, ...patch }, dirty: true }));
  const patchDoc = (id: string, patch: Partial<UploadedDoc>) => updateChecker((c) => ({ ...c, docs: c.docs.map((d) => (d.id === id ? { ...d, ...patch } : d)), dirty: true }));
  const setStep = (n: 0 | 1 | 2) => updateChecker((c) => ({ ...c, step: n }));

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const errs: string[] = [];
    let count = live.current.docs.length;
    for (const file of Array.from(files)) {
      const problem = validateFile(file, count);
      if (problem) { errs.push(`${file.name}: ${problem}`); continue; }
      count++;
      const id = `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const doc: UploadedDoc = { id, name: file.name, size: file.size, mime: file.type, kind: 'other', status: 'extracting', progress: 0, text: '', edited: false };
      updateChecker((c) => ({ ...c, docs: [...c.docs, doc], dirty: true }));
      extractText(file, (pct) => patchDoc(id, { progress: Math.round(pct) }))
        .then((r) => {
          const hasResume = live.current.docs.some((d) => d.id !== id && d.kind === 'resume');
          patchDoc(id, { status: 'ready', progress: 100, text: r.text, method: r.method, kind: guessKind(file.name, r.text, hasResume) });
        })
        .catch((e: unknown) => patchDoc(id, { status: 'error', error: e instanceof ExtractionError ? e.message : 'This file could not be read. Try a PDF, DOCX or TXT version.' }));
    }
    setFileErrors(errs);
    if (inputRef.current) inputRef.current.value = '';
  };

  const loadSample = () => {
    updateChecker((c) => ({ ...c, opportunity: sampleOpportunity(), docs: sampleDocs(), audit: c.audit, dirty: true, step: 0 }));
    setShowErrors(false);
    setFileErrors([]);
    notify('Demonstration sample loaded: fictional advertisement and four fictional documents.');
  };

  const next = () => {
    setShowErrors(true);
    if (errorCount === 0) { setShowErrors(false); setStep(1); }
    else document.getElementById('opp-errors')?.focus();
  };

  const run = () => {
    const audit = runAudit({ opportunity: opp, docs, previous: checker.audit, now: new Date() });
    updateChecker((c) => ({ ...c, audit, dirty: false, step: 2 }));
    go('report');
  };

  return (
    <>
      <PageHeader
        title="Application Checker"
        subtitle="Compare your documents with the advertisement and catch problems before you submit."
        actions={<>
          <Button icon={<FlaskConical size={18} aria-hidden="true" />} onClick={loadSample}>Load demonstration sample</Button>
          {(docs.length > 0 || checker.audit) && <Button variant="danger" icon={<Trash2 size={18} aria-hidden="true" />} onClick={() => { updateChecker(() => FRESH_CHECKER); setShowErrors(false); setFileErrors([]); }}>Clear check</Button>}
        </>}
      />
      <Stepper step={step} go={setStep} />

      {step === 0 && (
        <Card title="Step 1 · Opportunity details" actions={<span className="text-sm text-muted">Fields marked * are required</span>}>
          {showErrors && errorCount > 0 && (
            <div id="opp-errors" tabIndex={-1} className="outline-none">
              <Alert tone="bad" title={`Please fix ${errorCount} ${errorCount === 1 ? 'field' : 'fields'} before continuing`}>
                <ul className="m-0 pl-4">{Object.values(errors).map((m) => <li key={m}>{m}</li>)}</ul>
              </Alert>
            </div>
          )}
          <div className="grid gap-x-4 sm:grid-cols-2">
            <TextField required label="Opportunity title" value={opp.title} error={shown.title} onChange={(e) => setOpp({ title: e.target.value })} />
            <TextField required label="Organisation" value={opp.organization} error={shown.organization} onChange={(e) => setOpp({ organization: e.target.value })} />
            <SelectField required label="Type of opportunity" value={opp.type} error={shown.type} onChange={(e) => setOpp({ type: e.target.value as Opportunity['type'] })}>
              <option value="">Select a type</option>
              {OPPORTUNITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </SelectField>
            <TextField type="date" label="Application deadline" value={opp.deadline} error={shown.deadline} onChange={(e) => setOpp({ deadline: e.target.value })} />
          </div>
          <TextArea required rows={6} label="Description" hint="Paste the text of the advertisement." value={opp.description} error={shown.description} onChange={(e) => setOpp({ description: e.target.value })} />
          <TextArea required rows={5} label="Requirements" hint="One per line or separated by commas." value={opp.requirements} error={shown.requirements} onChange={(e) => setOpp({ requirements: e.target.value })} />
          <TextField type="url" label="Link to the advertisement" placeholder="https://" value={opp.url} error={shown.url} onChange={(e) => setOpp({ url: e.target.value })} />
          <div className="flex justify-end"><Button variant="primary" onClick={next}>Continue to documents</Button></div>
        </Card>
      )}

      {step === 1 && (
        <Card title="Step 2 · Your documents" actions={<span className="text-sm text-muted">Up to 6 files · 10 MB each</span>}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            className={cx('border-2 border-dashed rounded p-6 text-center mb-4', dragging ? 'border-brand bg-info-bg' : 'border-line bg-surface')}
          >
            <Upload size={28} className="mx-auto text-brand" aria-hidden="true" />
            <p className="m-0 mt-2 font-semibold">Drag files here, or choose from your device</p>
            <p className="m-0 text-sm text-muted mb-3">PDF, DOCX, TXT, or a PNG/JPG photo. Read on your device; never stored.</p>
            <input ref={inputRef} id="file-input" type="file" multiple accept={ACCEPT_ATTR} className="sr-only" onChange={(e) => addFiles(e.target.files)} />
            <Button variant="primary" onClick={() => inputRef.current?.click()}>Choose files</Button>
          </div>
          <Alert tone="info">Photos and scans use a text-reading tool that downloads its language data once from a public network. See Help &amp; Privacy.</Alert>
          {fileErrors.length > 0 && <Alert tone="bad" title="Some files were not added"><ul className="m-0 pl-4">{fileErrors.map((m) => <li key={m}>{m}</li>)}</ul></Alert>}

          {docs.length === 0 ? (
            <p className="text-muted">No documents yet. Add your resume to continue, or load the demonstration sample.</p>
          ) : (
            <ul className="list-none m-0 p-0 grid gap-3">
              {docs.map((d) => {
                const sensitive = d.status === 'ready' ? detectSensitiveContent(d.text) : [];
                return (
                  <li key={d.id} className="border border-line rounded p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <FileText size={22} className="text-brand mt-0.5 shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="m-0 font-semibold break-all">{d.name}</p>
                          <p className="m-0 text-sm text-muted">{formatBytes(d.size)}{d.method && ` · read as ${d.method}`}{d.edited && ' · corrected by you'}{d.isSample && ' · demonstration file'}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {d.status === 'ready' && (
                          <>
                            <select aria-label={`Document type for ${d.name}`} value={d.kind} onChange={(e) => patchDoc(d.id, { kind: e.target.value as DocKind })} className="min-h-9 rounded border border-line bg-white px-2 text-sm">
                              {DOC_KINDS.map((k) => <option key={k} value={k}>{DOC_KIND_LABEL[k]}</option>)}
                            </select>
                            <Button small onClick={() => setEditing(d)}>View / correct text</Button>
                          </>
                        )}
                        <Button small variant="danger" aria-label={`Remove ${d.name}`} icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => updateChecker((c) => ({ ...c, docs: c.docs.filter((x) => x.id !== d.id), dirty: true }))}>Remove</Button>
                      </div>
                    </div>
                    {d.status === 'extracting' && <div className="mt-3"><ProgressBar value={d.progress} label={`Reading ${d.name}`} /><p className="m-0 mt-1 text-sm text-muted">Reading… {d.progress}%</p></div>}
                    {d.status === 'error' && <Alert tone="bad" className="mt-3 mb-0" title="Could not read this file">{d.error}</Alert>}
                    {sensitive.length > 0 && <Alert tone="warn" className="mt-3 mb-0" title="Sensitive-looking information found">This file may contain {sensitive.join(' and ')}. FormSentry does not need it. Consider removing it from your document.</Alert>}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap justify-between gap-2 mt-6">
            <Button onClick={() => setStep(0)}>Back</Button>
            <Button variant="primary" disabled={ready.length === 0 || busy} onClick={() => setStep(2)}>{busy ? 'Reading files…' : 'Continue to review'}</Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card title="Step 3 · Review and run">
          <dl className="m-0 grid gap-x-6 gap-y-2 sm:grid-cols-[12rem_1fr] mb-4">
            <dt className="font-semibold text-muted">Opportunity</dt><dd className="m-0">{opp.title} <Badge>{opp.type}</Badge></dd>
            <dt className="font-semibold text-muted">Organisation</dt><dd className="m-0">{opp.organization}{opp.organization.includes('fictional') && <> <DemoTag /></>}</dd>
            <dt className="font-semibold text-muted">Deadline</dt><dd className="m-0">{formatDate(opp.deadline)}</dd>
            <dt className="font-semibold text-muted">Documents</dt>
            <dd className="m-0">{ready.map((d) => `${d.name} (${DOC_KIND_LABEL[d.kind]})`).join('; ') || 'None ready'}</dd>
          </dl>
          {ready.some((d) => d.kind === 'resume') ? null : <Alert tone="warn" title="No document is labelled as a resume">The checker compares requirements with your resume. Set a document type in the previous step for best results.</Alert>}
          {checker.audit && !checker.dirty && <Alert tone="info">This check has already been run. Open the report, or change inputs and run it again.</Alert>}
          <div className="flex flex-wrap justify-between gap-2 mt-4">
            <Button onClick={() => setStep(1)}>Back</Button>
            <div className="flex flex-wrap gap-2">
              {checker.audit && <Button onClick={() => go('report')}>Open last report</Button>}
              <Button variant="primary" disabled={ready.length === 0 || busy} onClick={run}>{checker.audit ? 'Run check again' : 'Run check'}</Button>
            </div>
          </div>
        </Card>
      )}

      {editing && <TextModal doc={editing} onClose={() => setEditing(null)} onSave={(t) => { patchDoc(editing.id, { text: t, edited: t !== editing.text || editing.edited }); setEditing(null); notify('Corrections saved. Run the check again to apply them.'); }} />}
    </>
  );
}
