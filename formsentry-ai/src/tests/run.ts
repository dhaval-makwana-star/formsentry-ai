import { runAudit, parseRequirements } from '../lib/audit';
import { sampleDocs, sampleOpportunity } from '../data/sample';
import { compareNames } from '../lib/facts';

const now = new Date('2026-10-09T12:00:00');
const opp = sampleOpportunity(now);
const docs = sampleDocs();
const r = runAudit({ opportunity: opp, docs, now });
console.log('score', r.score.score, r.score.violations, r.score.reviews, r.score.suggestions);
for (const f of r.findings) console.log(f.severity.padEnd(10), f.basis.padEnd(20), f.id, '|', f.title);
console.log(r.coverage.map((c) => `${c.found ? 'Y' : c.checkable ? 'N' : '-'} ${c.requirement}`).join('\n'));
console.log(r.checks.map((c) => `${c.outcome} ${c.name}`).join('\n'));
console.log(compareNames('A. Kumar', 'A. Kumaar'), compareNames('A. Kumar', 'Anil Kumar'), compareNames('Anil Kumar', 'Sunita Patil'));
console.log(parseRequirements('Pursuing B.E./B.Tech in CS, IT or related\n- Python'));

import { COHORT } from '../data/cohort';
import { ALL_FILTERS, byDepartment, filterRecords, summarise, toCsv, buildExportRows, csvCell, topIssues } from '../lib/analytics';
console.log('cohort', COHORT.length, summarise(COHORT));
console.log(byDepartment(COHORT));
console.log(summarise(filterRecords(COHORT, { ...ALL_FILTERS, department: 'Biotechnology' })));
console.log(topIssues(COHORT).slice(0, 3));
console.log(csvCell('=SUM(A1)'), csvCell('a,b'), csvCell(null));
console.log(toCsv(buildExportRows(COHORT, ALL_FILTERS, new Date('2026-10-09'))).split('\n').slice(0, 14).join('\n'));
