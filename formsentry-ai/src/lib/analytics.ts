// Aggregation for the placement-cell view. Every figure that would describe fewer
// than K_MIN records is suppressed (returned as null) and shown as "<10".
import { STAGES } from '../types';
import type { CohortRecord, OpportunityType, Stage } from '../types';
import { ISSUE_LABELS } from '../data/cohort';

export const K_MIN = 10;

export interface Filters {
  department: string; // 'All' or a department name
  batch: string; // 'All' or a batch label
  type: OpportunityType | 'All';
}
export const ALL_FILTERS: Filters = { department: 'All', batch: 'All', type: 'All' };

export function filterRecords(rows: CohortRecord[], f: Filters): CohortRecord[] {
  return rows.filter(
    (r) => (f.department === 'All' || r.department === f.department) && (f.batch === 'All' || r.batch === f.batch) && (f.type === 'All' || r.type === f.type),
  );
}

/** Returns the count, or null when the group is too small to publish. */
export function safeCount(n: number): number | null {
  return n >= K_MIN ? n : null;
}

export function safePct(part: number, whole: number): number | null {
  if (whole < K_MIN || part < K_MIN) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export function median(values: number[]): number | null {
  if (values.length < K_MIN) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10;
}

export interface Summary {
  total: number | null;
  interviews: number | null;
  offers: number | null;
  interviewRate: number | null;
  offerRate: number | null;
}

export function summarise(rows: CohortRecord[]): Summary {
  const total = rows.length;
  const interviews = rows.filter((r) => r.interviewed).length;
  const offers = rows.filter((r) => r.offered).length;
  return {
    total: safeCount(total),
    interviews: safeCount(interviews),
    offers: safeCount(offers),
    interviewRate: safePct(interviews, total),
    offerRate: safePct(offers, total),
  };
}

export interface Bar {
  label: string;
  value: number | null; // null = suppressed
}

export function byStage(rows: CohortRecord[]): Bar[] {
  return STAGES.map((s: Stage) => ({ label: s, value: safeCount(rows.filter((r) => r.stageReached === s).length) }));
}

export interface DeptRow {
  department: string;
  applications: number | null;
  interviews: number | null;
  offers: number | null;
}

export function byDepartment(rows: CohortRecord[]): DeptRow[] {
  const names = Array.from(new Set(rows.map((r) => r.department))).sort();
  return names.map((d) => {
    const g = rows.filter((r) => r.department === d);
    const applications = safeCount(g.length);
    return {
      department: d,
      applications,
      interviews: applications === null ? null : safeCount(g.filter((r) => r.interviewed).length),
      offers: applications === null ? null : safeCount(g.filter((r) => r.offered).length),
    };
  });
}

export interface InternshipSummary {
  bars: Bar[];
  completionRate: number | null;
  base: number | null;
}

export function internshipCompletion(rows: CohortRecord[]): InternshipSummary {
  const g = rows.filter((r) => r.type === 'Internship');
  const count = (s: CohortRecord['internshipStatus']) => g.filter((r) => r.internshipStatus === s).length;
  const completed = count('Completed');
  return {
    bars: [
      { label: 'Completed', value: safeCount(completed) },
      { label: 'In progress', value: safeCount(count('In progress')) },
      { label: 'Not started', value: safeCount(count('Not started')) },
    ],
    completionRate: safePct(completed, g.length),
    base: safeCount(g.length),
  };
}

export function topIssues(rows: CohortRecord[]): Bar[] {
  return ISSUE_LABELS.map((label) => ({ label, value: safeCount(rows.filter((r) => r.issues.includes(label)).length) }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
}

export interface TimingRow {
  label: string;
  medianDays: number | null;
  n: number | null;
}

export function stageTiming(rows: CohortRecord[]): TimingRow[] {
  const d1 = rows.filter((r) => !['Preparing', 'Ready for Submission'].includes(r.stageReached)).map((r) => r.daysDraftToSubmit);
  const d2 = rows.flatMap((r) => (r.daysSubmitToInterview === null ? [] : [r.daysSubmitToInterview]));
  const d3 = rows.flatMap((r) => (r.daysInterviewToOffer === null ? [] : [r.daysInterviewToOffer]));
  return [
    { label: 'Draft to submission', medianDays: median(d1), n: safeCount(d1.length) },
    { label: 'Submission to interview', medianDays: median(d2), n: safeCount(d2.length) },
    { label: 'Interview to offer', medianDays: median(d3), n: safeCount(d3.length) },
  ];
}

// ---------- CSV ----------

/** Escapes a cell and neutralises spreadsheet formula injection. */
export function csvCell(v: string | number | null): string {
  if (v === null) return '"<10 (suppressed)"';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function buildExportRows(rows: CohortRecord[], f: Filters, generatedAt: Date): (string | number | null)[][] {
  const out: (string | number | null)[][] = [
    ['FormSentry AI - SYNTHETIC DEMONSTRATION DATA - aggregate only'],
    ['Generated', generatedAt.toISOString()],
    ['Filter: department', f.department],
    ['Filter: batch', f.batch],
    ['Filter: opportunity type', f.type],
    [`Groups with fewer than ${K_MIN} records are suppressed`],
    [],
    ['Applications by final stage'],
    ['Stage', 'Count'],
    ...byStage(rows).map((b) => [b.label, b.value]),
    [],
    ['By department'],
    ['Department', 'Applications', 'Interviews', 'Offers'],
    ...byDepartment(rows).map((d) => [d.department, d.applications, d.interviews, d.offers]),
    [],
    ['Internship completion'],
    ['Status', 'Count'],
    ...internshipCompletion(rows).bars.map((b) => [b.label, b.value]),
    [],
    ['Common application-readiness issues'],
    ['Issue', 'Applications affected'],
    ...topIssues(rows).map((b) => [b.label, b.value]),
    [],
    ['Median days between stages'],
    ['Transition', 'Median days', 'Records'],
    ...stageTiming(rows).map((t) => [t.label, t.medianDays, t.n]),
  ];
  return out;
}
