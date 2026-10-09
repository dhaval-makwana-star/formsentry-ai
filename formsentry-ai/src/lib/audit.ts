// Deterministic audit engine. Every finding carries the rule or extracted passage
// that produced it. No AI output is generated or simulated in this module.
import type {
  AuditResult,
  CheckResult,
  Evidence,
  ExtractedFacts,
  Finding,
  FindingCategory,
  Opportunity,
  RequirementCoverage,
  ScoreBreakdown,
  UploadedDoc,
} from '../types';
import {
  compareNames,
  extractDegrees,
  extractFacts,
  institutionsOverlap,
  lineAt,
  normalizeDegree,
} from './facts';

export const SCORE_WEIGHTS = { violation: 15, review: 7, suggestion: 3 } as const;

export const DISCLAIMER =
  'This report is a self-check aid. Results do not guarantee selection and do not replace the official instructions of the organisation you are applying to. Findings can be wrong; always verify against your original documents.';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso + 'T00:00:00Z');
  const b = Date.parse(toIso + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

// ---------- Requirement parsing and matching ----------

const GENERIC = new Set(
  (
    'a an the of in to for on at and or with without using use knowledge understanding familiarity proficiency proficient good strong excellent ability able basic basics ' +
    'working experience experienced skills skill concepts fundamentals relevant currently pursuing degree candidate required preferred plus minimum must have has ' +
    'programming language languages tools technologies technology related it any be is are as well good written verbal oral'
  ).split(' '),
);

export function parseRequirements(text: string): string[] {
  const parts = text
    .split(/\r?\n|;|•|·|•|,(?![^()]*\))/)
    .map((p) => p.replace(/^[\s\-*•·\d.)]+/, '').trim())
    .filter((p) => p.length >= 2 && p.length <= 120);
  return Array.from(new Set(parts)).slice(0, 25);
}

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []).map((t) => t.replace(/^\.+|\.+$/g, '')).filter(Boolean);
}

function stem(t: string): string {
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith('ed')) return t.slice(0, -2);
  if (t.length > 4 && t.endsWith('es')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1);
  return t;
}

export function evaluateRequirements(requirements: string[], resumes: UploadedDoc[]): RequirementCoverage[] {
  const fullText = resumes.map((d) => d.text).join('\n');
  const lowerText = fullText.toLowerCase();
  const stemSet = new Set(tokenize(fullText).map(stem));
  const degreeHit = (() => {
    for (const doc of resumes) {
      for (const line of doc.text.split(/\r?\n/)) {
        if (extractDegrees(line).length) return { source: doc.name, passage: line.trim().replace(/\s+/g, ' ').slice(0, 180) };
      }
    }
    return undefined;
  })();
  return requirements.map((req) => {
    // Degree requirements: we can only confirm that a degree is stated, not that the field matches.
    if (/\b(b\.?e|b\.?tech|m\.?tech|bachelor|master|diploma|degree)\b/i.test(req)) {
      return degreeHit
        ? { requirement: req, checkable: true, found: true, evidence: degreeHit }
        : { requirement: req, checkable: true, found: false };
    }
    const distinctive = tokenize(req).filter((t) => !GENERIC.has(t));
    if (distinctive.length === 0) return { requirement: req, checkable: false, found: false };
    const phrase = req.toLowerCase().replace(/\s+/g, ' ').trim();
    const matched = distinctive.filter((t) => stemSet.has(stem(t)));
    const phraseHit = phrase.length > 3 && lowerText.includes(phrase);
    const found = phraseHit || matched.length / distinctive.length >= 0.67;
    if (!found) return { requirement: req, checkable: true, found: false };
    const matchedStems = new Set((phraseHit ? distinctive : matched).map(stem));
    for (const doc of resumes) {
      for (const line of doc.text.split(/\r?\n/)) {
        if (tokenize(line).some((t) => matchedStems.has(stem(t)))) {
          return { requirement: req, checkable: true, found: true, evidence: { source: doc.name, passage: line.trim().replace(/\s+/g, ' ').slice(0, 180) } };
        }
      }
    }
    return { requirement: req, checkable: true, found: true };
  });
}

// ---------- Finding construction ----------

type Draft = Omit<Finding, 'id' | 'status'> & { key?: string };

function finding(d: Draft): Finding {
  const { key, ...rest } = d;
  return { ...rest, id: `${d.ruleId}:${slug(key ?? '')}`, status: 'open' };
}

const OPP = 'Opportunity details';

// ---------- The audit ----------

export interface AuditInput {
  opportunity: Opportunity;
  docs: UploadedDoc[];
  previous?: AuditResult | null;
  now?: Date;
}

interface CheckSpec {
  id: string;
  name: string;
  category: FindingCategory;
  prefixes: string[];
  applicable: boolean;
  passed: string;
  attention: string;
  na: string;
}

export function runAudit({ opportunity, docs, previous = null, now = new Date() }: AuditInput): AuditResult {
  const ready = docs.filter((d) => d.status === 'ready');
  const facts: ExtractedFacts[] = ready.map((d) => extractFacts(d, now));
  const factOf = (d: UploadedDoc) => facts.find((f) => f.docId === d.id)!;
  const resumes = ready.filter((d) => d.kind === 'resume');
  const supporting = ready.filter((d) => d.kind === 'certificate' || d.kind === 'marksheet');
  const covers = ready.filter((d) => d.kind === 'cover-letter');
  const primary = resumes[0];
  const pf = primary ? factOf(primary) : undefined;
  const out: Finding[] = [];
  const today = isoDate(now);

  // 1. Required documents
  if (!primary) {
    out.push(finding({
      ruleId: 'MISSING_RESUME', category: 'Missing information', severity: 'violation', basis: 'Rule-based',
      title: 'No resume has been added',
      explanation: 'No document is marked as a resume or CV, so most checks cannot run.',
      evidence: [{ source: 'Uploaded documents', rule: 'At least one document of type "Resume / CV" is required.' }],
      why: 'Almost every internship and job application requires a resume. Without one, the application is usually treated as incomplete.',
      action: 'Add your resume in step 2, or change the document type if you uploaded it as something else.',
    }));
  }
  if (primary && supporting.length === 0) {
    out.push(finding({
      ruleId: 'MISSING_SUPPORTING', category: 'Missing information', severity: 'suggestion', basis: 'Rule-based',
      title: 'No certificate or marksheet added for cross-checking',
      explanation: 'Education details on your resume cannot be compared with a supporting document because none was added.',
      evidence: [{ source: 'Uploaded documents', rule: 'Cross-checks of name, institution, degree, grade and year need a certificate or marksheet.' }],
      why: 'Many applications ask for supporting documents. Mismatches between a resume and a certificate are a common reason for follow-up questions.',
      action: 'Check the official instructions. If supporting documents are requested, add them here to cross-check them before you submit.',
    }));
  }

  // 2. Contact information on the resume
  if (primary && pf) {
    if (pf.emails.length === 0) {
      out.push(finding({
        ruleId: 'MISSING_EMAIL', category: 'Missing information', severity: 'violation', basis: 'Rule-based', key: primary.name,
        title: 'No email address found on the resume',
        explanation: `No email address pattern was found in "${primary.name}".`,
        evidence: [{ source: primary.name, field: 'Email', rule: 'A resume must contain at least one email address (pattern name@domain.tld).' }],
        why: 'Recruiters usually reply by email. A missing address can mean you never receive interview or assessment invitations.',
        action: 'Add a professional email address that you check regularly near your name at the top of the resume.',
      }));
    }
    if (pf.phones.length === 0) {
      out.push(finding({
        ruleId: 'MISSING_PHONE', category: 'Missing information', severity: 'violation', basis: 'Rule-based', key: primary.name,
        title: 'No phone number found on the resume',
        explanation: `No 10-digit Indian mobile number (optionally with +91) was found in "${primary.name}".`,
        evidence: [{ source: primary.name, field: 'Phone', rule: 'A resume must contain a reachable mobile number (10 digits starting 6–9, optional +91).' }],
        why: 'Interview scheduling is often done by phone call or WhatsApp. A missing number can delay or lose a response.',
        action: 'Add a mobile number you can answer, next to your email address. If your number is already present in a different format, write it as +91 XXXXX XXXXX.',
      }));
    }
  }

  // 3. Placeholder text and sensitive identifiers in any document
  for (const d of ready) {
    const f = factOf(d);
    if (f.placeholders.length) {
      out.push(finding({
        ruleId: 'PLACEHOLDER_TEXT', category: 'Formatting and clarity', severity: 'violation', basis: 'Rule-based', key: d.name,
        title: 'Template placeholder text left in a document',
        explanation: `"${d.name}" contains text that looks like an unfilled template placeholder.`,
        evidence: f.placeholders.slice(0, 3).map<Evidence>((p) => ({ source: d.name, passage: p, rule: 'Placeholder patterns such as [Your Name], XXXX, Lorem ipsum, TODO.' })),
        why: 'Placeholder text signals that the document was not proofread and can look careless to a reviewer.',
        action: 'Replace each placeholder with your real information, or delete the line.',
      }));
    }
    if (f.sensitiveIdentifiers.length) {
      out.push(finding({
        ruleId: 'SENSITIVE_ID', category: 'Formatting and clarity', severity: 'suggestion', basis: 'Rule-based', key: d.name,
        title: 'A 12-digit identifier-style number appears in a document',
        explanation: `"${d.name}" contains a 12-digit number that resembles a government identifier. The number is masked here and is not stored.`,
        evidence: [{ source: d.name, passage: f.sensitiveIdentifiers[0], rule: 'Pattern: 12 digits in groups of four.' }],
        why: 'Resumes rarely need government ID numbers. Sharing them unnecessarily increases the risk of misuse.',
        action: 'If this is an identity number, remove it from the document unless the official instructions explicitly require it.',
      }));
    }
  }

  // 4. Cross-document name consistency
  if (primary && pf) {
    if (!pf.name) {
      out.push(finding({
        ruleId: 'NAME_NOT_FOUND', category: 'Consistency', severity: 'suggestion', basis: 'Rule-based', key: primary.name,
        title: 'Could not find your name on the resume',
        explanation: 'The first lines of the resume do not look like a person\'s name, so name consistency could not be checked.',
        evidence: [{ source: primary.name, field: 'Name', rule: 'The name is expected as the first short line of the resume or after "Name:".' }],
        why: 'A resume should start with your full name so a reviewer can match it to your other documents.',
        action: 'Put your full name as the first line of the resume.',
      }));
    }
    for (const d of [...supporting, ...covers]) {
      const f = factOf(d);
      if (!f.name) {
        if (d.kind !== 'cover-letter') {
          out.push(finding({
            ruleId: 'NAME_NOT_FOUND', category: 'Consistency', severity: 'suggestion', basis: 'Rule-based', key: d.name,
            title: `Could not read a name in "${d.name}"`,
            explanation: 'No name was found using "Name:" labels or certificate wording, so it could not be compared with your resume.',
            evidence: [{ source: d.name, field: 'Name', rule: 'Looked for "Name:", "This is to certify that …", "awarded to …".' }],
            why: 'If the extracted text is incomplete, a real mismatch could go unnoticed.',
            action: 'Compare the name on this document with your resume manually. If it is a scanned image, a clearer scan may improve text extraction.',
          }));
        }
        continue;
      }
      if (!pf.name) continue;
      const cmp = compareNames(pf.name, f.name);
      if (cmp === 'same') continue;
      out.push(finding({
        ruleId: 'NAME_MISMATCH', category: 'Consistency', severity: 'review', basis: 'Evidence-supported', key: d.name,
        title: cmp === 'similar' ? 'Names look similar but are not identical' : 'Names differ between documents',
        explanation: cmp === 'similar'
          ? `Your resume shows "${pf.name}" while "${d.name}" shows "${f.name}". This may be a spelling, initial or word-order difference.`
          : `Your resume shows "${pf.name}" while "${d.name}" shows "${f.name}". The names are substantially different.`,
        evidence: [
          { source: primary.name, field: 'Name', passage: pf.nameSource },
          { source: d.name, field: 'Name', passage: f.nameSource },
        ],
        why: 'Employers verify identity by matching names across documents. A mismatch can cause delays or a request for clarification.',
        action: 'Check which spelling matches your official ID. Do not change a certificate yourself; if the certificate itself has a spelling error, ask the issuing institution about a correction. FormSentry never changes names automatically.',
      }));
    }
  }

  // 5. Education consistency (institution, degree, grade, year)
  if (primary && pf) {
    for (const d of supporting) {
      const f = factOf(d);
      if (pf.institutions.length && f.institutions.length && !f.institutions.some((ci) => pf.institutions.some((ri) => institutionsOverlap(ri, ci)))) {
        out.push(finding({
          ruleId: 'INSTITUTION_MISMATCH', category: 'Consistency', severity: 'review', basis: 'Evidence-supported', key: d.name,
          title: 'Institution names do not overlap',
          explanation: `The institution lines in "${d.name}" share no significant words with those on your resume.`,
          evidence: [
            { source: primary.name, field: 'Institution', passage: pf.institutions[0] },
            { source: d.name, field: 'Institution', passage: f.institutions[0] },
          ],
          why: 'The institution on your resume should match the one that issued your certificate or marksheet.',
          action: 'Confirm both documents refer to the same institution. If the institution was renamed, a short note on the resume can help.',
        }));
      }
      const rd = new Set(pf.degrees.map(normalizeDegree));
      if (rd.size && f.degrees.length && !f.degrees.some((x) => rd.has(normalizeDegree(x)))) {
        out.push(finding({
          ruleId: 'DEGREE_MISMATCH', category: 'Consistency', severity: 'review', basis: 'Evidence-supported', key: d.name,
          title: 'Degree names differ between resume and document',
          explanation: `"${d.name}" mentions ${f.degrees.join(', ')}, which does not appear among the degrees on your resume (${pf.degrees.join(', ')}).`,
          evidence: [
            { source: primary.name, field: 'Degree', passage: pf.degrees.join(', ') },
            { source: d.name, field: 'Degree', passage: f.degrees.join(', ') },
          ],
          why: 'Degree titles are often used for eligibility screening.',
          action: 'Use the exact degree title from your certificate on the resume.',
        }));
      }
      for (const rg of pf.grades) {
        const dg = f.grades.find((g) => g.label === rg.label && g.scale === rg.scale);
        if (dg && Math.abs(dg.value - rg.value) > 0.05) {
          out.push(finding({
            ruleId: 'GRADE_MISMATCH', category: 'Consistency', severity: 'review', basis: 'Evidence-supported', key: `${d.name}-${rg.label}`,
            title: `${rg.label} differs between resume and "${d.name}"`,
            explanation: `Your resume states ${rg.label} ${rg.value}/${rg.scale}; "${d.name}" states ${dg.value}/${dg.scale}.`,
            evidence: [
              { source: primary.name, field: rg.label, passage: rg.passage },
              { source: d.name, field: rg.label, passage: dg.passage },
            ],
            why: 'Grades are frequently verified. Even an honest rounding difference can raise questions.',
            action: `Use the figure printed on your official document (${dg.value}/${dg.scale}). Do not round up. If the documents cover different semesters, label them clearly.`,
          }));
        }
      }
      const eduEnds = pf.yearRanges.filter((r) => r.education).map((r) => r.end);
      if (eduEnds.length && f.passingYears.length && !f.passingYears.some((p) => eduEnds.includes(p.year))) {
        out.push(finding({
          ruleId: 'YEAR_MISMATCH', category: 'Consistency', severity: 'review', basis: 'Evidence-supported', key: d.name,
          title: 'Completion year does not match the education dates',
          explanation: `"${d.name}" gives ${f.passingYears.map((p) => p.year).join(', ')} while the education dates on your resume end in ${Array.from(new Set(eduEnds)).join(', ')}.`,
          evidence: [
            { source: primary.name, field: 'Education dates', passage: pf.yearRanges.find((r) => r.education)?.passage },
            { source: d.name, field: 'Year', passage: f.passingYears[0].passage },
          ],
          why: 'Graduation year is used to check batch eligibility.',
          action: 'Make the resume dates agree with the official document. If you are still studying, state the expected completion year clearly.',
        }));
      }
    }
  }

  // 6. Date sanity inside each document
  for (const d of ready) {
    for (const r of factOf(d).yearRanges) {
      if (r.end < r.start) {
        out.push(finding({
          ruleId: 'DATE_RANGE_INVALID', category: 'Consistency', severity: 'violation', basis: 'Rule-based', key: `${d.name}-${r.start}-${r.end}`,
          title: 'A date range ends before it starts',
          explanation: `The range ${r.start}–${r.end} in "${d.name}" ends before it begins.`,
          evidence: [{ source: d.name, field: 'Date range', passage: r.passage, rule: 'End year must not be earlier than start year.' }],
          why: 'Impossible dates look like errors and can reduce trust in the rest of the document.',
          action: 'Correct the start or end year.',
        }));
      } else if (!r.education && r.end > now.getFullYear()) {
        out.push(finding({
          ruleId: 'FUTURE_EXPERIENCE', category: 'Consistency', severity: 'review', basis: 'Rule-based', key: `${d.name}-${r.start}-${r.end}`,
          title: 'Experience date is in the future',
          explanation: `The range ${r.start}–${r.end} in "${d.name}" ends after the current year and is not an education entry.`,
          evidence: [{ source: d.name, field: 'Date range', passage: r.passage, rule: `Experience should not end after ${now.getFullYear()} unless marked "Present".` }],
          why: 'Future dates on past experience are usually typing errors.',
          action: 'Check the year. If the role is ongoing, write "Present" instead of a future year.',
        }));
      }
    }
  }

  // 7. Cover letter addresses the right organisation
  const orgCore = opportunity.organization
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|inc|llp|corp|corporation|company|co)\b\.?/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (orgCore) {
    for (const d of covers) {
      const lower = d.text.toLowerCase();
      const orgTokens = orgCore.split(' ').filter((t) => t.length > 2);
      const hit = lower.includes(orgCore) || (orgTokens.length > 0 && orgTokens.filter((t) => lower.includes(t)).length / orgTokens.length >= 0.5);
      if (!hit) {
        const salutation = /dear[^\n]{0,80}/i.exec(d.text);
        out.push(finding({
          ruleId: 'COVER_ORG_MISSING', category: 'Consistency', severity: 'review', basis: 'Evidence-supported', key: d.name,
          title: 'Cover letter does not mention the organisation you are applying to',
          explanation: `"${opportunity.organization}" does not appear in "${d.name}".`,
          evidence: [
            { source: OPP, field: 'Organisation', passage: opportunity.organization },
            { source: d.name, passage: salutation ? lineAt(d.text, salutation.index) : d.text.trim().split('\n')[0].slice(0, 160), rule: 'Looked for the organisation name in the cover letter text.' },
          ],
          why: 'A cover letter reused from another application is an easy mistake and is quickly noticed by reviewers.',
          action: 'Check the organisation name, role title and salutation in the letter and update them for this application.',
        }));
      }
    }
  }

  // 8. Deadline
  if (opportunity.deadline) {
    const left = daysBetween(today, opportunity.deadline);
    if (left < 0) {
      out.push(finding({
        ruleId: 'DEADLINE_PASSED', category: 'Timing', severity: 'violation', basis: 'Rule-based',
        title: 'The stated deadline has passed',
        explanation: `The deadline you entered (${opportunity.deadline}) was ${-left} day(s) ago.`,
        evidence: [{ source: OPP, field: 'Deadline', passage: opportunity.deadline, rule: 'Deadline must be today or later.' }],
        why: 'Applications are usually not accepted after the closing date.',
        action: 'Check the official page for an extension, or correct the date if you entered it wrongly.',
      }));
    } else if (left <= 3) {
      out.push(finding({
        ruleId: 'DEADLINE_SOON', category: 'Timing', severity: 'suggestion', basis: 'Rule-based',
        title: left === 0 ? 'The deadline is today' : `Only ${left} day(s) left before the deadline`,
        explanation: `The deadline you entered is ${opportunity.deadline}.`,
        evidence: [{ source: OPP, field: 'Deadline', passage: opportunity.deadline, rule: 'Warn when 3 days or fewer remain.' }],
        why: 'Portals can be slow near closing time and late fixes may not be possible.',
        action: 'Plan to submit early and keep a copy of the confirmation.',
      }));
    }
  }

  // 9. Requirement evidence (resume only)
  const requirements = parseRequirements(opportunity.requirements);
  const coverage = primary ? evaluateRequirements(requirements, resumes) : requirements.map((r) => ({ requirement: r, checkable: false, found: false }));
  if (primary) {
    for (const c of coverage) {
      if (c.checkable && !c.found) {
        out.push(finding({
          ruleId: 'REQ_NOT_EVIDENCED', category: 'Requirement evidence', severity: 'suggestion', basis: 'Evidence-supported', key: c.requirement,
          title: `No resume evidence found for "${c.requirement}"`,
          explanation: 'The keywords from this requirement were not found in your resume text. This does not mean you lack the skill; the resume may use different wording.',
          evidence: [
            { source: OPP, field: 'Requirement', passage: c.requirement },
            { source: primary.name, rule: 'Keyword search of the resume for the distinctive words in this requirement.' },
          ],
          why: 'Reviewers often scan quickly for each stated requirement.',
          action: 'If you genuinely have this skill or experience, add it with a specific example (project, course or role). If you do not, leave it out. Never claim something you cannot support.',
        }));
      }
    }
  }

  // 10. Resume formatting and clarity
  if (primary && pf) {
    if (pf.wordCount < 120) {
      out.push(finding({
        ruleId: 'RESUME_SHORT', category: 'Formatting and clarity', severity: 'suggestion', basis: 'Rule-based', key: primary.name,
        title: 'Resume text is very short',
        explanation: `${pf.wordCount} words were extracted. If the resume is a scan, text extraction may be incomplete.`,
        evidence: [{ source: primary.name, rule: 'Fewer than 120 extracted words.' }],
        why: 'Very short resumes rarely give enough evidence of skills or projects.',
        action: 'Add project, coursework or activity details with concrete outcomes.',
      }));
    } else if (pf.wordCount > 1100) {
      out.push(finding({
        ruleId: 'RESUME_LONG', category: 'Formatting and clarity', severity: 'suggestion', basis: 'Rule-based', key: primary.name,
        title: 'Resume is long for an early-career application',
        explanation: `${pf.wordCount} words were extracted, which is more than about two pages.`,
        evidence: [{ source: primary.name, rule: 'More than 1100 extracted words.' }],
        why: 'Reviewers skim; long documents hide the most relevant evidence.',
        action: 'Trim to the experience most relevant to this opportunity.',
      }));
    }
    if (pf.sections.length < 2) {
      out.push(finding({
        ruleId: 'NO_SECTIONS', category: 'Formatting and clarity', severity: 'suggestion', basis: 'Rule-based', key: primary.name,
        title: 'Standard resume section headings not detected',
        explanation: `Headings found: ${pf.sections.length ? pf.sections.join(', ') : 'none'}. Expected at least two of Education, Skills, Experience, Projects.`,
        evidence: [{ source: primary.name, rule: 'Looked for headings on their own line: Education, Skills, Experience/Internships, Projects.' }],
        why: 'Clear headings help both people and screening software find information.',
        action: 'Put Education, Skills, Experience and Projects on separate headed lines.',
      }));
    }
    if (pf.dateFormats.length > 1) {
      out.push(finding({
        ruleId: 'DATE_FORMAT_MIX', category: 'Formatting and clarity', severity: 'suggestion', basis: 'Rule-based', key: primary.name,
        title: 'Mixed date formats',
        explanation: `Date styles detected: ${pf.dateFormats.join(', ')}.`,
        evidence: [{ source: primary.name, rule: 'More than one date format found in the same document.' }],
        why: 'Consistent dates look careful and are easier to read.',
        action: 'Pick one format (for example "Jun 2024") and use it everywhere.',
      }));
    }
  }

  // ---- Merge with previous run, so student decisions survive a recheck ----
  const merged = mergeWithPrevious(out, previous);
  const cleared = previous
    ? previous.findings.filter((p) => !out.some((f) => f.id === p.id)).length
    : 0;

  // ---- The list of checks that ran ----
  const specs: CheckSpec[] = [
    { id: 'docs', name: 'Required documents present', category: 'Missing information', prefixes: ['MISSING_RESUME', 'MISSING_SUPPORTING'], applicable: true, passed: 'Resume and at least one supporting document were provided.', attention: 'A document is missing. See findings.', na: '' },
    { id: 'contact', name: 'Contact details on resume', category: 'Missing information', prefixes: ['MISSING_EMAIL', 'MISSING_PHONE'], applicable: !!primary, passed: 'An email address and a phone number were found.', attention: 'A contact detail is missing. See findings.', na: 'Needs a resume.' },
    { id: 'placeholder', name: 'Placeholder text and unnecessary identifiers', category: 'Formatting and clarity', prefixes: ['PLACEHOLDER_TEXT', 'SENSITIVE_ID'], applicable: ready.length > 0, passed: 'No placeholder text or identifier-style numbers found.', attention: 'Something needs a look. See findings.', na: 'No documents.' },
    { id: 'names', name: 'Name consistency across documents', category: 'Consistency', prefixes: ['NAME_MISMATCH', 'NAME_NOT_FOUND'], applicable: !!primary && (supporting.length + covers.length > 0), passed: 'Names agree across all documents that contain a name.', attention: 'A name could not be matched. See findings.', na: 'Needs a resume plus another document.' },
    { id: 'education', name: 'Education consistency (institution, degree, grade, year)', category: 'Consistency', prefixes: ['INSTITUTION_MISMATCH', 'DEGREE_MISMATCH', 'GRADE_MISMATCH', 'YEAR_MISMATCH'], applicable: !!primary && supporting.length > 0, passed: 'Education details agree between resume and supporting documents.', attention: 'An education detail differs. See findings.', na: 'Needs a resume plus a certificate or marksheet.' },
    { id: 'dates', name: 'Date ranges are valid', category: 'Consistency', prefixes: ['DATE_RANGE_INVALID', 'FUTURE_EXPERIENCE'], applicable: ready.length > 0, passed: 'All detected date ranges are in a sensible order.', attention: 'A date range looks wrong. See findings.', na: 'No documents.' },
    { id: 'cover', name: 'Cover letter names the organisation', category: 'Consistency', prefixes: ['COVER_ORG_MISSING'], applicable: covers.length > 0 && !!orgCore, passed: 'The organisation name appears in the cover letter.', attention: 'Organisation name not found in cover letter.', na: 'No cover letter added.' },
    { id: 'deadline', name: 'Deadline', category: 'Timing', prefixes: ['DEADLINE_PASSED', 'DEADLINE_SOON'], applicable: !!opportunity.deadline, passed: 'The deadline has not passed and is more than 3 days away.', attention: 'Deadline needs attention. See findings.', na: 'No deadline entered.' },
    { id: 'requirements', name: 'Resume evidence for stated requirements', category: 'Requirement evidence', prefixes: ['REQ_NOT_EVIDENCED'], applicable: !!primary && coverage.some((c) => c.checkable), passed: 'Every checkable requirement has matching text in the resume.', attention: 'Some requirements have no matching text. See findings.', na: 'Needs a resume and requirements.' },
    { id: 'format', name: 'Resume length, headings and date style', category: 'Formatting and clarity', prefixes: ['RESUME_SHORT', 'RESUME_LONG', 'NO_SECTIONS', 'DATE_FORMAT_MIX'], applicable: !!primary, passed: 'Length, headings and date style look reasonable.', attention: 'Formatting suggestions available.', na: 'Needs a resume.' },
  ];
  const checks: CheckResult[] = specs.map((s) => {
    const hit = merged.some((f) => s.prefixes.includes(f.ruleId));
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      outcome: !s.applicable ? 'not-applicable' : hit ? 'attention' : 'passed',
      detail: !s.applicable ? s.na : hit ? s.attention : s.passed,
    };
  });

  return {
    runNumber: (previous?.runNumber ?? 0) + 1,
    ranAt: now.toISOString(),
    findings: merged,
    checks,
    coverage,
    facts,
    clearedSincePrevious: cleared,
    score: computeScore(merged),
  };
}

export function mergeWithPrevious(fresh: Finding[], previous: AuditResult | null): Finding[] {
  if (!previous) return fresh;
  return fresh.map((f) => {
    const p = previous.findings.find((x) => x.id === f.id);
    if (!p) return f;
    if (p.status === 'dismissed' || p.status === 'reviewed') return { ...f, status: p.status };
    if (p.status === 'resolved') {
      return { ...f, status: 'open', recheckNote: 'You marked this as resolved, but the rule still detects it in the current documents. Please look at the evidence again.' };
    }
    return f;
  });
}

/**
 * Readiness score = 100 minus a fixed deduction per OPEN or REVIEWED finding
 * (resolved and dismissed findings do not count). Floor 0.
 * It is a checklist-completeness indicator for this one application only.
 * It is NOT a probability of selection or rejection.
 */
export function computeScore(findings: Finding[]): ScoreBreakdown {
  const active = findings.filter((f) => f.status === 'open' || f.status === 'reviewed');
  const violations = active.filter((f) => f.severity === 'violation').length;
  const reviews = active.filter((f) => f.severity === 'review').length;
  const suggestions = active.filter((f) => f.severity === 'suggestion').length;
  const deductions = [
    { label: 'Rule violations', count: violations, each: SCORE_WEIGHTS.violation, total: violations * SCORE_WEIGHTS.violation },
    { label: 'Potential inconsistencies', count: reviews, each: SCORE_WEIGHTS.review, total: reviews * SCORE_WEIGHTS.review },
    { label: 'Suggestions', count: suggestions, each: SCORE_WEIGHTS.suggestion, total: suggestions * SCORE_WEIGHTS.suggestion },
  ];
  const score = Math.max(0, 100 - deductions.reduce((a, d) => a + d.total, 0));
  return { score, violations, reviews, suggestions, deductions };
}

export function setFindingStatus(result: AuditResult, id: string, status: Finding['status']): AuditResult {
  const findings = result.findings.map((f) => (f.id === id ? { ...f, status, recheckNote: status === 'open' ? f.recheckNote : undefined } : f));
  return { ...result, findings, score: computeScore(findings) };
}
