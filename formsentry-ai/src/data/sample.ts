// Synthetic demonstration data. All people, organisations and figures are invented.
import type { ApplicationRecord, Opportunity, OutcomeRecord, UploadedDoc } from '../types';
import { isoDate } from '../lib/audit';

export const EMPTY_OPPORTUNITY: Opportunity = {
  title: '',
  organization: '',
  type: '',
  description: '',
  requirements: '',
  deadline: '',
  url: '',
};

export function sampleOpportunity(now: Date = new Date()): Opportunity {
  const d = new Date(now);
  d.setDate(d.getDate() + 10);
  return {
    title: 'Software Development Intern',
    organization: 'Godavari Digital Systems Pvt. Ltd. (fictional)',
    type: 'Internship',
    description:
      'Godavari Digital Systems is looking for a software development intern to join our product team for a 3-month, on-site internship. You will help build and test web features, write SQL queries for reports, and take part in code reviews with senior engineers.',
    requirements: [
      'Pursuing B.E./B.Tech in Computer Science or related field',
      'Python programming',
      'Data structures and algorithms',
      'SQL or database fundamentals',
      'Git version control',
      'HTML, CSS and JavaScript',
      'Good written communication',
    ].join('\n'),
    deadline: isoDate(d),
    url: 'https://example.org/careers/software-development-intern',
  };
}

const SAMPLE_RESUME = `A. Kumar
Email: a.kumar@example.org
Pune, Maharashtra

Education
B.E. Computer Engineering, Western Ghats Institute of Technology, Pune
2022 - 2026   CGPA: 8.4/10
HSC (Science), Nashik Model Junior College, 2020 - 2022

Skills
Python, SQL, HTML, CSS, JavaScript, MySQL, Linux basics
Languages: English, Hindi, Marathi

Experience
Web Development Intern, Demo Labs (fictional), Jun 2024 - Aug 2024
Built a responsive dashboard page and wrote SQL queries to display monthly report data.

Projects
Library Management System (Python, MySQL), Jan 2025 - Apr 2025
Designed database tables and a Python command-line interface for issuing and returning books.
Campus Events Portal (HTML, CSS, JavaScript), Aug 2024 - Nov 2024
Created a static events listing page for the college technical festival.

Activities
Member, college coding club. Helped organise two beginner workshops on Python and spreadsheets for first-year students.
Volunteer, campus technical festival registration desk, 2024.`;

const SAMPLE_CERT = `WESTERN GHATS INSTITUTE OF TECHNOLOGY, PUNE
Degree Certificate (sample)

This is to certify that A. Kumaar has successfully completed the Bachelor of Engineering in Computer Engineering.
Session: 2022 - 2026
Date of issue: 30 June 2026`;

const SAMPLE_MARKSHEET = `Western Ghats Institute of Technology, Pune
Final Year Statement of Marks (sample)
Name of Candidate: A. Kumaar
Programme: B.E. Computer Engineering
Year of passing: 2026
CGPA: 8.2/10`;

const SAMPLE_COVER = `Dear Hiring Manager,

I am writing to apply for the Software Development Intern role at Pune Software Works. I enjoy building small database-backed applications in Python and would like to learn from your engineers.

Sincerely,
A. Kumar`;

let sampleCounter = 0;

export function sampleDocs(): UploadedDoc[] {
  const mk = (name: string, kind: UploadedDoc['kind'], text: string): UploadedDoc => ({
    id: `sample-${++sampleCounter}-${Date.now()}`,
    name,
    size: new Blob([text]).size,
    mime: 'text/plain',
    kind,
    status: 'ready',
    progress: 100,
    text,
    edited: false,
    method: 'sample',
    isSample: true,
  });
  return [
    mk('sample-resume.txt', 'resume', SAMPLE_RESUME),
    mk('sample-degree-certificate.txt', 'certificate', SAMPLE_CERT),
    mk('sample-marksheet.txt', 'marksheet', SAMPLE_MARKSHEET),
    mk('sample-cover-letter.txt', 'cover-letter', SAMPLE_COVER),
  ];
}

function offsetDate(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function seedApplications(now: Date = new Date()): ApplicationRecord[] {
  const u = now.toISOString();
  const rec = (
    id: string,
    organization: string,
    opportunity: string,
    type: ApplicationRecord['type'],
    deadline: number | null,
    submittedOn: number | null,
    stage: ApplicationRecord['stage'],
    nextAction: string,
    notes = '',
  ): ApplicationRecord => ({
    id,
    organization,
    opportunity,
    type,
    deadline: deadline === null ? '' : offsetDate(now, deadline),
    submittedOn: submittedOn === null ? '' : offsetDate(now, submittedOn),
    stage,
    nextAction,
    notes,
    updatedAt: u,
  });
  return [
    rec('demo-1', 'Godavari Digital Systems Pvt. Ltd. (fictional)', 'Software Development Intern', 'Internship', 10, null, 'Preparing', 'Run the application check and fix findings'),
    rec('demo-2', 'Sahyadri Manufacturing Works (fictional)', 'Apprentice – Mechanical Maintenance', 'Apprenticeship', 4, null, 'Ready for Submission', 'Submit on the official portal'),
    rec('demo-3', 'Konkan Analytics LLP (fictional)', 'Data Analyst Intern', 'Internship', -6, -9, 'Submitted', 'Wait for assessment link; check email on Friday'),
    rec('demo-4', 'Vidarbha Cloud Services (fictional)', 'Graduate Engineer Trainee', 'Graduate job', -20, -24, 'Assessment', 'Complete online aptitude test by the date in the email'),
    rec('demo-5', 'Marathwada Health Informatics (fictional)', 'Junior QA Engineer', 'Entry-level job', -35, -38, 'Interview', 'Prepare for the technical interview; confirm time slot'),
    rec('demo-6', 'Khandesh Textiles Training Centre (fictional)', 'Apprentice – Quality Control', 'Apprenticeship', -50, -55, 'Offer', 'Reply to the offer letter before the stated date'),
    rec('demo-7', 'Mumbai Harbour Software (fictional)', 'Backend Developer Intern', 'Internship', -40, -44, 'Closed', 'None – application closed by the organisation'),
    rec('demo-8', 'Pune Embedded Labs (fictional)', 'Firmware Intern', 'Internship', -15, -18, 'Withdrawn', 'None – withdrawn by me after accepting another offer'),
  ];
}

export function seedOutcomes(now: Date = new Date()): OutcomeRecord[] {
  return [
    { id: 'out-1', type: 'Interview', organization: 'Marathwada Health Informatics (fictional)', role: 'Junior QA Engineer', date: offsetDate(now, -5), applicationId: 'demo-5', selfReportedReason: '' },
    { id: 'out-2', type: 'Offer', organization: 'Khandesh Textiles Training Centre (fictional)', role: 'Apprentice – Quality Control', date: offsetDate(now, -12), applicationId: 'demo-6', selfReportedReason: 'Self-reported: the interviewer mentioned my workshop project.' },
    { id: 'out-3', type: 'Internship completed', organization: 'Demo Labs (fictional)', role: 'Web Development Intern', date: offsetDate(now, -400), selfReportedReason: '' },
  ];
}
