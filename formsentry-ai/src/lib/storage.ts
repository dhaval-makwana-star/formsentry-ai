// Local persistence. ONLY non-sensitive demo metadata is stored: role, application
// records and self-reported outcomes. Document contents, extracted text, findings
// and uploaded files are never written to localStorage.
import type { ApplicationRecord, OutcomeRecord, Role } from '../types';
import { OPPORTUNITY_TYPES, OUTCOME_TYPES, STAGES } from '../types';

export const STORAGE_KEY = 'formsentry.demo.v1';

export interface PersistedState {
  role: Role;
  applications: ApplicationRecord[];
  outcomes: OutcomeRecord[];
}

const isStr = (v: unknown): v is string => typeof v === 'string';

function validApplication(a: unknown): a is ApplicationRecord {
  if (!a || typeof a !== 'object') return false;
  const r = a as Record<string, unknown>;
  return isStr(r.id) && isStr(r.organization) && isStr(r.opportunity) && isStr(r.deadline) && isStr(r.submittedOn) && isStr(r.nextAction) && isStr(r.notes) && isStr(r.updatedAt) &&
    (STAGES as readonly string[]).includes(r.stage as string) && (OPPORTUNITY_TYPES as readonly string[]).includes(r.type as string);
}

function validOutcome(o: unknown): o is OutcomeRecord {
  if (!o || typeof o !== 'object') return false;
  const r = o as Record<string, unknown>;
  return isStr(r.id) && isStr(r.organization) && isStr(r.role) && isStr(r.date) && isStr(r.selfReportedReason) && (OUTCOME_TYPES as readonly string[]).includes(r.type as string);
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PersistedState>;
    if (!Array.isArray(p.applications) || !Array.isArray(p.outcomes)) return null;
    return {
      role: p.role === 'placement' ? 'placement' : 'student',
      applications: p.applications.filter(validApplication),
      outcomes: p.outcomes.filter(validOutcome),
    };
  } catch {
    return null;
  }
}

export function saveState(s: PersistedState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false; // private mode or quota: the app keeps working in memory
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
