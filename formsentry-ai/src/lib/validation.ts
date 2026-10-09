// Centralised validation. Every form in the app calls into this module so error
// messages stay consistent and testable.
import { OPPORTUNITY_TYPES, STAGES } from '../types';
import type { ApplicationRecord, Opportunity, OutcomeRecord } from '../types';

export type Errors<T> = Partial<Record<keyof T, string>>;

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES = 6;
export const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg', 'webp', 'bmp'];
export const ACCEPT_ATTR = '.pdf,.docx,.txt,.png,.jpg,.jpeg,.webp,.bmp';

const FIELD_LIMITS = { title: 120, organization: 120, description: 8000, requirements: 4000, notes: 1000, nextAction: 200 };

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function validateOpportunity(o: Opportunity): Errors<Opportunity> {
  const e: Errors<Opportunity> = {};
  if (!o.title.trim()) e.title = 'Enter the opportunity title, for example "Software Engineering Intern".';
  else if (o.title.length > FIELD_LIMITS.title) e.title = `Keep the title under ${FIELD_LIMITS.title} characters.`;
  if (!o.organization.trim()) e.organization = 'Enter the organisation name exactly as it appears in the advertisement.';
  else if (o.organization.length > FIELD_LIMITS.organization) e.organization = `Keep the organisation name under ${FIELD_LIMITS.organization} characters.`;
  if (!o.type || !(OPPORTUNITY_TYPES as readonly string[]).includes(o.type)) e.type = 'Select the type of opportunity.';
  if (!o.description.trim()) e.description = 'Paste the job or internship description so the requirements can be compared with your resume.';
  else if (o.description.trim().length < 40) e.description = 'The description looks too short to compare against. Paste the full text (at least 40 characters).';
  else if (o.description.length > FIELD_LIMITS.description) e.description = `Keep the description under ${FIELD_LIMITS.description} characters.`;
  if (!o.requirements.trim()) e.requirements = 'List the required qualifications or skills, one per line or separated by commas.';
  else if (o.requirements.length > FIELD_LIMITS.requirements) e.requirements = `Keep the requirements under ${FIELD_LIMITS.requirements} characters.`;
  if (o.deadline && !isValidIsoDate(o.deadline)) e.deadline = 'Enter a valid date.';
  if (o.url.trim() && !isValidHttpUrl(o.url.trim())) e.url = 'Enter a full web address starting with http:// or https://.';
  return e;
}

export function validateApplication(a: Omit<ApplicationRecord, 'id' | 'updatedAt'>): Errors<ApplicationRecord> {
  const e: Errors<ApplicationRecord> = {};
  if (!a.organization.trim()) e.organization = 'Enter the organisation name.';
  else if (a.organization.length > FIELD_LIMITS.organization) e.organization = 'Organisation name is too long.';
  if (!a.opportunity.trim()) e.opportunity = 'Enter the opportunity title.';
  else if (a.opportunity.length > FIELD_LIMITS.title) e.opportunity = 'Opportunity title is too long.';
  if (!(OPPORTUNITY_TYPES as readonly string[]).includes(a.type)) e.type = 'Select the type of opportunity.';
  if (!(STAGES as readonly string[]).includes(a.stage)) e.stage = 'Select a stage.';
  if (a.deadline && !isValidIsoDate(a.deadline)) e.deadline = 'Enter a valid deadline date.';
  if (a.submittedOn && !isValidIsoDate(a.submittedOn)) e.submittedOn = 'Enter a valid submission date.';
  const submittedStages = ['Submitted', 'Assessment', 'Interview', 'Offer'];
  if (submittedStages.includes(a.stage) && !a.submittedOn) e.submittedOn = 'Enter the date you submitted this application.';
  if (a.submittedOn && a.deadline && a.submittedOn > a.deadline) {
    e.submittedOn = 'The submission date is after the deadline. Check both dates.';
  }
  if (a.nextAction.length > FIELD_LIMITS.nextAction) e.nextAction = 'Keep the next action under 200 characters.';
  if (a.notes.length > FIELD_LIMITS.notes) e.notes = 'Keep notes under 1000 characters.';
  return e;
}

export function validateOutcome(o: Omit<OutcomeRecord, 'id'>): Errors<OutcomeRecord> {
  const e: Errors<OutcomeRecord> = {};
  if (!o.organization.trim()) e.organization = 'Enter the organisation name.';
  if (!o.role.trim()) e.role = 'Enter the role or opportunity title.';
  if (!o.date) e.date = 'Enter the date.';
  else if (!isValidIsoDate(o.date)) e.date = 'Enter a valid date.';
  if (o.selfReportedReason.length > 500) e.selfReportedReason = 'Keep this under 500 characters.';
  return e;
}

export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

/** Returns an error message, or null if the file may be processed. */
export function validateFile(file: { name: string; size: number }, existingCount: number): string | null {
  if (existingCount >= MAX_FILES) return `You can add at most ${MAX_FILES} documents per check.`;
  const ext = fileExtension(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `".${ext || 'unknown'}" files are not supported. Use PDF, DOCX, TXT, or a PNG/JPG image.`;
  }
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_FILE_BYTES) return `This file is ${(file.size / 1048576).toFixed(1)} MB. The limit is 10 MB.`;
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/** Strings that look like data this app must never ask for or hold. */
const SENSITIVE_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'an Aadhaar-style 12-digit number', re: /\b\d{4}\s?\d{4}\s?\d{4}\b/ },
  { label: 'a bank account or card-style number', re: /\b\d{15,19}\b/ },
  { label: 'a password', re: /\bpassword\s*[:=]/i },
];

export function detectSensitiveContent(text: string): string[] {
  return SENSITIVE_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
}
