import { Alert, Button, Card, PageHeader } from '../components/ui';
import { useApp } from '../state/AppContext';
import { K_MIN } from '../lib/analytics';
import { DISCLAIMER, SCORE_WEIGHTS } from '../lib/audit';
import { RotateCcw } from 'lucide-react';

export default function Help() {
  const { resetAll } = useApp();
  return (
    <>
      <PageHeader title="Help & Privacy" subtitle="How FormSentry AI works and exactly what happens to your information." />
      <Alert tone="warn" title="This is a demonstration prototype">
        Built by team VeriForge for the Seva First Innovation Challenge 2026 (Education and Employability). All organisations, people and figures shown are invented. It is not an official government service.
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="How the Application Checker works">
          <ol className="m-0 pl-5 grid gap-2">
            <li>Enter the opportunity details you copied from the advertisement.</li>
            <li>Add your resume and supporting documents. Text is read inside your browser.</li>
            <li>Review the extracted text and correct it if the reader got something wrong.</li>
            <li>Run the check. You get findings with the evidence behind each one and the action to take.</li>
          </ol>
          <p className="mb-0 mt-3 text-sm text-muted">{DISCLAIMER}</p>
        </Card>

        <Card title="Reading the findings">
          <dl className="m-0 grid gap-3">
            <div><dt className="font-semibold">Needs correction</dt><dd className="m-0 text-muted">A clear rule is broken, such as a missing email address. Costs {SCORE_WEIGHTS.violation} points.</dd></div>
            <div><dt className="font-semibold">Review</dt><dd className="m-0 text-muted">Something may be inconsistent, such as a slightly different name spelling. Only you can decide. Costs {SCORE_WEIGHTS.review} points.</dd></div>
            <div><dt className="font-semibold">Suggestion</dt><dd className="m-0 text-muted">An optional improvement. Costs {SCORE_WEIGHTS.suggestion} points.</dd></div>
          </dl>
          <p className="mb-0 mt-3 text-sm text-muted">The readiness score is a simple count of open findings. It is not a prediction of selection.</p>
        </Card>

        <Card title="What is stored, and where">
          <ul className="m-0 pl-5 grid gap-2">
            <li><strong>Stored in this browser only:</strong> your chosen view, application records and self-reported outcomes.</li>
            <li><strong>Never stored:</strong> uploaded files, extracted text, findings and reports. They disappear when you close or refresh the page.</li>
            <li>There is no server and no account. Nothing is sent to us.</li>
            <li>Please do not upload Aadhaar numbers, bank details or passwords. The checker warns you if it spots them.</li>
          </ul>
        </Card>

        <Card title="One network exception: image text reading">
          <p className="mt-0">PDF, DOCX and TXT files are read entirely on your device. For photos and scans (PNG, JPG), the text-reading tool downloads its English language data from a public content network the first time you use it. Your image itself is not uploaded.</p>
          <p className="mb-0 text-sm text-muted">Limits: up to 6 files per check, 10 MB each.</p>
        </Card>

        <Card title="Placement Cell view and privacy">
          <p className="mt-0">The Placement Cell view uses synthetic, anonymous records with no names or identifiers. Any figure describing fewer than {K_MIN} records is hidden and shown as “&lt;{K_MIN}”. CSV exports contain aggregates only.</p>
          <p className="mb-0 text-sm text-muted">The role switcher is a demonstration control, not a sign-in. A real deployment would require authenticated access and institutional consent.</p>
        </Card>

        <Card title="Accessibility and reset">
          <p className="mt-0">All pages work with a keyboard, show a visible focus outline, and use text labels alongside colour. Use “Skip to main content” at the top of any page.</p>
          <Button variant="danger" icon={<RotateCcw size={16} aria-hidden="true" />} onClick={resetAll}>Reset demo data and clear documents</Button>
        </Card>
      </div>
    </>
  );
}
