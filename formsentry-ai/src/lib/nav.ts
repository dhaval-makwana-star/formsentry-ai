import { CircleHelp, ClipboardList, FileCheck2, LayoutDashboard, LineChart, Sprout } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role } from '../types';
import type { RouteId } from './router';

export interface NavItem {
  id: RouteId;
  label: string;
  hint: string;
  icon: LucideIcon;
  roles: Role[];
}

/** Single source of truth for the sidebar, mobile menu, breadcrumbs and route access. */
export const NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', hint: 'Your dashboard', icon: LayoutDashboard, roles: ['student', 'placement'] },
  { id: 'check', label: 'Application Checker', hint: 'Check before you submit', icon: FileCheck2, roles: ['student'] },
  { id: 'applications', label: 'My Applications', hint: 'Track every application', icon: ClipboardList, roles: ['student'] },
  { id: 'outcomes', label: 'Employability Outcomes', hint: 'Interviews, offers, internships', icon: Sprout, roles: ['student'] },
  { id: 'insights', label: 'Placement Insights', hint: 'Aggregate cohort view', icon: LineChart, roles: ['placement'] },
  { id: 'help', label: 'Help & Privacy', hint: 'How your data is handled', icon: CircleHelp, roles: ['student', 'placement'] },
];

/** The report is a child page of the checker for navigation purposes. */
export function navIdFor(route: RouteId): RouteId {
  return route === 'report' ? 'check' : route;
}

export function itemFor(route: RouteId): NavItem {
  return NAV.find((n) => n.id === navIdFor(route)) ?? NAV[0];
}

export function crumbsFor(route: RouteId): { id: RouteId; label: string }[] {
  const home = { id: 'overview' as RouteId, label: 'Home' };
  if (route === 'overview') return [{ id: 'overview', label: 'Overview' }];
  if (route === 'report') return [home, { id: 'check', label: 'Application Checker' }, { id: 'report', label: 'Check report' }];
  return [home, { id: route, label: itemFor(route).label }];
}
