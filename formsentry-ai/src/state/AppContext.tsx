import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ApplicationRecord, AuditResult, Opportunity, OutcomeRecord, Role, UploadedDoc } from '../types';
import { EMPTY_OPPORTUNITY, seedApplications, seedOutcomes } from '../data/sample';
import { clearState, loadState, saveState } from '../lib/storage';
import { useRoute } from '../lib/router';
import type { RouteId } from '../lib/router';

export interface CheckerState {
  step: 0 | 1 | 2;
  opportunity: Opportunity;
  docs: UploadedDoc[]; // extracted text lives here, in memory only
  audit: AuditResult | null;
  dirty: boolean; // inputs changed since the last audit run
}

export const FRESH_CHECKER: CheckerState = { step: 0, opportunity: EMPTY_OPPORTUNITY, docs: [], audit: null, dirty: false };

interface Ctx {
  route: RouteId;
  go: (r: RouteId) => void;
  role: Role;
  setRole: (r: Role) => void;
  applications: ApplicationRecord[];
  saveApplication: (a: ApplicationRecord) => void;
  deleteApplication: (id: string) => void;
  outcomes: OutcomeRecord[];
  saveOutcome: (o: OutcomeRecord) => void;
  deleteOutcome: (id: string) => void;
  checker: CheckerState;
  updateChecker: (fn: (c: CheckerState) => CheckerState) => void;
  resetAll: () => void;
  notice: string | null;
  notify: (msg: string) => void;
  persistFailed: boolean;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}

export function newId(prefix: string): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rnd}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [route, go] = useRoute();
  const initial = useMemo(() => loadState(), []);
  const [role, setRoleState] = useState<Role>(initial?.role ?? 'student');
  const [applications, setApplications] = useState<ApplicationRecord[]>(() => initial?.applications ?? seedApplications());
  const [outcomes, setOutcomes] = useState<OutcomeRecord[]>(() => initial?.outcomes ?? seedOutcomes());
  const [checker, setChecker] = useState<CheckerState>(FRESH_CHECKER);
  const [notice, setNotice] = useState<string | null>(null);
  const [persistFailed, setPersistFailed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setPersistFailed(!saveState({ role, applications, outcomes }));
  }, [role, applications, outcomes]);

  const notify = useCallback((msg: string) => {
    setNotice(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(null), 5000);
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    notify(r === 'student' ? 'Switched to Student View.' : 'Switched to Placement Cell View (synthetic aggregate data).');
  }, [notify]);

  const saveApplication = useCallback((a: ApplicationRecord) => {
    setApplications((list) => (list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [a, ...list]));
  }, []);
  const deleteApplication = useCallback((id: string) => setApplications((l) => l.filter((x) => x.id !== id)), []);
  const saveOutcome = useCallback((o: OutcomeRecord) => {
    setOutcomes((list) => (list.some((x) => x.id === o.id) ? list.map((x) => (x.id === o.id ? o : x)) : [o, ...list]));
  }, []);
  const deleteOutcome = useCallback((id: string) => setOutcomes((l) => l.filter((x) => x.id !== id)), []);
  const updateChecker = useCallback((fn: (c: CheckerState) => CheckerState) => setChecker(fn), []);

  const resetAll = useCallback(() => {
    clearState();
    setApplications(seedApplications());
    setOutcomes(seedOutcomes());
    setChecker(FRESH_CHECKER); // drops every uploaded file's extracted text from memory
    setRoleState('student');
    notify('Demo data reset. Saved records, uploaded documents and extracted text were cleared.');
  }, [notify]);

  const value: Ctx = {
    route, go, role, setRole, applications, saveApplication, deleteApplication, outcomes, saveOutcome, deleteOutcome,
    checker, updateChecker, resetAll, notice, notify, persistFailed,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
