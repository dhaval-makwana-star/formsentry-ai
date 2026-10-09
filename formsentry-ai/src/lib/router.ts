import { useCallback, useEffect, useState } from 'react';

export type RouteId = 'overview' | 'check' | 'report' | 'applications' | 'outcomes' | 'insights' | 'help';

const PATHS: Record<string, RouteId> = {
  '/overview': 'overview',
  '/check': 'check',
  '/check/report': 'report',
  '/applications': 'applications',
  '/outcomes': 'outcomes',
  '/insights': 'insights',
  '/help': 'help',
};

export const PATH_OF: Record<RouteId, string> = {
  overview: '/overview',
  check: '/check',
  report: '/check/report',
  applications: '/applications',
  outcomes: '/outcomes',
  insights: '/insights',
  help: '/help',
};

function read(): RouteId {
  const p = window.location.hash.replace(/^#/, '') || '/overview';
  return PATHS[p] ?? 'overview';
}

export function useRoute(): [RouteId, (r: RouteId) => void] {
  const [route, setRoute] = useState<RouteId>(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((r: RouteId) => {
    window.location.hash = '#' + PATH_OF[r];
  }, []);
  return [route, go];
}
