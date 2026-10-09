import { useApp } from './state/AppContext';
import { itemFor } from './lib/nav';
import Shell from './components/Shell';
import { Button, EmptyState, PageHeader } from './components/ui';
import { Lock } from 'lucide-react';
import Overview from './pages/Overview';
import Checker from './pages/Checker';
import Report from './pages/Report';
import Applications from './pages/Applications';
import Outcomes from './pages/Outcomes';
import Insights from './pages/Insights';
import Help from './pages/Help';

function RoleGate() {
  const { route, role, setRole } = useApp();
  const item = itemFor(route);
  const needed = item.roles[0];
  return (
    <>
      <PageHeader title={item.label} />
      <EmptyState
        icon={<Lock size={22} />}
        title={`This page is part of the ${needed === 'student' ? 'Student' : 'Placement Cell'} view`}
        action={<Button variant="primary" onClick={() => setRole(needed)}>Switch to {needed === 'student' ? 'Student' : 'Placement Cell'} view</Button>}
      >
        You are currently in the {role === 'student' ? 'Student' : 'Placement Cell'} view. Switching only changes what is shown; it does not sign you in or out.
      </EmptyState>
    </>
  );
}

export default function App() {
  const { route, role } = useApp();
  const allowed = itemFor(route).roles.includes(role);
  let page;
  if (!allowed) page = <RoleGate />;
  else if (route === 'check') page = <Checker />;
  else if (route === 'report') page = <Report />;
  else if (route === 'applications') page = <Applications />;
  else if (route === 'outcomes') page = <Outcomes />;
  else if (route === 'insights') page = <Insights />;
  else if (route === 'help') page = <Help />;
  else page = <Overview />;
  return <Shell>{page}</Shell>;
}
