// Central typed data models for FormSentry AI.

export type Role = 'student' | 'placement';

export const OPPORTUNITY_TYPES = ['Internship', 'Apprenticeship', 'Graduate job', 'Entry-level job'] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export interface Opportunity {
  title: string;
  organization: string;
  type: OpportunityType | '';
  description: string;
  requirements: string;
  deadline: string; // ISO yyyy-mm-dd or ''
  url: string;
}

export const DOC_KINDS = ['resume', 'certificate', 'marksheet', 'cover-letter', 'other'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_KIND_LABEL: Record<DocKind, string> = {
  resume: 'Resume / CV',
  certificate: 'Degree or course certificate',
  marksheet: 'Marksheet / transcript',
  'cover-letter': 'Cover letter',
  other: 'Other supporting document',
};

export type ExtractionMethod = 'text' | 'pdf-text' | 'docx' | 'ocr' | 'sample';

export interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  mime: string;
  kind: DocKind;
  status: 'extracting' | 'ready' | 'error';
  progress: number; // 0..100
  text: string; // extracted text, held in memory only, never persisted
  edited: boolean; // student corrected the extracted text in-session
  method?: ExtractionMethod;
  error?: string;
  isSample?: boolean;
}

// ---- Audit ----

/** definite = a rule violation; review = potential inconsistency; suggestion = optional improvement */
export type Severity = 'violation' | 'review' | 'suggestion';
export type Basis = 'Rule-based' | 'Evidence-supported' | 'AI-assisted—review required';
export type FindingStatus = 'open' | 'reviewed' | 'resolved' | 'dismissed';
export type FindingCategory = 'Missing information' | 'Consistency' | 'Requirement evidence' | 'Formatting and clarity' | 'Timing';

export interface Evidence {
  source: string; // document name or "Opportunity details"
  field?: string; // e.g. "Name", "Email"
  passage?: string; // extracted passage, verbatim from the document text
  rule?: string; // validation rule applied
}

export interface Finding {
  id: string; // stable across reruns: ruleId + key
  ruleId: string;
  category: FindingCategory;
  severity: Severity;
  basis: Basis;
  title: string;
  explanation: string;
  evidence: Evidence[];
  why: string;
  action: string;
  status: FindingStatus;
  recheckNote?: string;
}

export interface CheckResult {
  id: string;
  name: string;
  category: FindingCategory;
  outcome: 'passed' | 'attention' | 'not-applicable';
  detail: string;
}

export interface RequirementCoverage {
  requirement: string;
  checkable: boolean; // false when the text has no distinctive keyword to look for
  found: boolean;
  evidence?: { source: string; passage: string };
}

export interface ExtractedFacts {
  docId: string;
  docName: string;
  kind: DocKind;
  name?: string;
  nameSource?: string;
  emails: string[];
  phones: string[];
  institutions: string[];
  degrees: string[];
  grades: { label: string; value: number; scale: number; passage: string }[];
  yearRanges: { start: number; end: number; passage: string; education: boolean }[];
  passingYears: { year: number; passage: string }[];
  placeholders: string[];
  sections: string[];
  sensitiveIdentifiers: string[];
  dateFormats: string[];
  wordCount: number;
}

export interface ScoreBreakdown {
  score: number;
  violations: number;
  reviews: number;
  suggestions: number;
  deductions: { label: string; count: number; each: number; total: number }[];
}

export interface AuditResult {
  runNumber: number;
  ranAt: string; // ISO timestamp
  findings: Finding[];
  checks: CheckResult[];
  coverage: RequirementCoverage[];
  facts: ExtractedFacts[];
  clearedSincePrevious: number;
  score: ScoreBreakdown;
}

// ---- Tracking ----

export const STAGES = [
  'Preparing',
  'Ready for Submission',
  'Submitted',
  'Assessment',
  'Interview',
  'Offer',
  'Closed',
  'Withdrawn',
] as const;
export type Stage = (typeof STAGES)[number];

export interface ApplicationRecord {
  id: string;
  organization: string;
  opportunity: string;
  type: OpportunityType;
  deadline: string; // ISO date or ''
  submittedOn: string; // ISO date or ''
  stage: Stage;
  nextAction: string;
  notes: string;
  updatedAt: string;
}

export const OUTCOME_TYPES = ['Interview', 'Internship completed', 'Offer', 'Employment start'] as const;
export type OutcomeType = (typeof OUTCOME_TYPES)[number];

export interface OutcomeRecord {
  id: string;
  type: OutcomeType;
  organization: string;
  role: string;
  date: string;
  applicationId?: string;
  selfReportedReason: string; // optional, free text written by the student
}

// ---- Placement-cell synthetic cohort ----

export interface CohortRecord {
  // Synthetic, anonymous, no names or identifiers. Used only for aggregation.
  department: string;
  batch: string;
  type: OpportunityType;
  stageReached: Stage;
  interviewed: boolean;
  offered: boolean;
  internshipStatus: 'Completed' | 'In progress' | 'Not started' | 'Not applicable';
  issues: string[];
  daysDraftToSubmit: number;
  daysSubmitToInterview: number | null;
  daysInterviewToOffer: number | null;
}
