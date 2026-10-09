// Synthetic placement-cell cohort. Generated deterministically from a fixed seed so
// the numbers are repeatable. There are no names, IDs, resumes or histories here:
// each row is an anonymous application outcome used only for aggregation.
import type { CohortRecord, OpportunityType, Stage } from '../types';

export const DEPARTMENTS: { name: string; n: number }[] = [
  { name: 'Computer Engineering', n: 138 },
  { name: 'Information Technology', n: 84 },
  { name: 'Mechanical Engineering', n: 112 },
  { name: 'Electronics & Telecommunication', n: 91 },
  { name: 'Civil Engineering', n: 66 },
  { name: 'Chemical Engineering', n: 27 },
  { name: 'Biotechnology', n: 8 }, // deliberately below the privacy threshold
];
export const BATCHES = ['2024-25', '2025-26'] as const;

export const ISSUE_LABELS = [
  'Missing phone or email',
  'Name differs across documents',
  'Grade or CGPA differs across documents',
  'Supporting document missing',
  'No resume evidence for a stated requirement',
  'Cover letter not tailored to the organisation',
  'Resume structure or length',
  'Deadline very close or missed',
] as const;

const ISSUE_PROB = [0.14, 0.11, 0.09, 0.22, 0.38, 0.17, 0.26, 0.12];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: [T, number][]): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1][0];
}

export function generateCohort(): CohortRecord[] {
  const rand = mulberry32(20260509);
  const rows: CohortRecord[] = [];
  for (const dept of DEPARTMENTS) {
    for (let i = 0; i < dept.n; i++) {
      const batch = BATCHES[rand() < 0.45 ? 0 : 1];
      const type = pick<OpportunityType>(rand, [['Internship', 46], ['Graduate job', 24], ['Entry-level job', 18], ['Apprenticeship', 12]]);
      const stageReached = pick<Stage>(rand, [
        ['Preparing', 9], ['Ready for Submission', 7], ['Submitted', 22], ['Assessment', 18],
        ['Interview', 17], ['Offer', 13], ['Closed', 10], ['Withdrawn', 4],
      ]);
      const offered = stageReached === 'Offer';
      const interviewed = stageReached === 'Interview' || offered || (stageReached === 'Closed' && rand() < 0.3);
      const submitted = !['Preparing', 'Ready for Submission'].includes(stageReached);
      const internshipStatus: CohortRecord['internshipStatus'] =
        type !== 'Internship' ? 'Not applicable'
          : offered ? (rand() < 0.62 ? 'Completed' : 'In progress')
          : submitted ? (rand() < 0.18 ? 'Completed' : rand() < 0.4 ? 'In progress' : 'Not started')
          : 'Not started';
      const issues = ISSUE_LABELS.filter((_, k) => rand() < ISSUE_PROB[k]);
      rows.push({
        department: dept.name,
        batch,
        type,
        stageReached,
        interviewed,
        offered,
        internshipStatus,
        issues: [...issues],
        daysDraftToSubmit: Math.round(1 + rand() * 6 + (issues.length > 1 ? rand() * 6 : 0)),
        daysSubmitToInterview: interviewed ? Math.round(6 + rand() * 24) : null,
        daysInterviewToOffer: offered ? Math.round(3 + rand() * 18) : null,
      });
    }
  }
  return rows;
}

export const COHORT: CohortRecord[] = generateCohort();
