// Deterministic fact extraction from document text. Nothing here guesses or
// invents values: if a pattern is not found, the field is left empty.
import type { DocKind, ExtractedFacts, UploadedDoc } from '../types';

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';

export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function lineAt(text: string, index: number, max = 180): string {
  const start = text.lastIndexOf('\n', index - 1) + 1;
  let end = text.indexOf('\n', index);
  if (end < 0) end = text.length;
  const line = text.slice(start, end).trim().replace(/\s+/g, ' ');
  return line.length > max ? line.slice(0, max - 1) + '…' : line;
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// ---------- Names ----------

const TITLE_WORDS = new Set(['mr', 'mrs', 'ms', 'miss', 'shri', 'smt', 'kumari', 'dr', 'prof']);

export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z\s.]/g, ' ')
    .replace(/\./g, ' ')
    .split(/\s+/)
    .filter((t) => t && !TITLE_WORDS.has(t))
    .join(' ');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export type NameComparison = 'same' | 'similar' | 'different';

/** Conservative comparison. 'similar' always means "a human should look", never "fix it". */
export function compareNames(a: string, b: string): NameComparison {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 'different';
  if (na === nb) return 'same';
  const ta = na.split(' ');
  const tb = nb.split(' ');
  if ([...ta].sort().join(' ') === [...tb].sort().join(' ')) return 'similar'; // word order differs
  // Initials vs full words, e.g. "A Kumar" vs "Anil Kumar"
  if (ta.length === tb.length) {
    let compatible = true;
    let differs = false;
    for (let i = 0; i < ta.length; i++) {
      if (ta[i] === tb[i]) continue;
      differs = true;
      const [s, l] = ta[i].length <= tb[i].length ? [ta[i], tb[i]] : [tb[i], ta[i]];
      if (!(s.length === 1 && l.startsWith(s))) {
        compatible = false;
        break;
      }
    }
    if (compatible && differs) return 'similar';
  }
  const ja = ta.join('');
  const jb = tb.join('');
  const dist = levenshtein(ja, jb);
  if (dist <= Math.max(2, Math.floor(Math.max(ja.length, jb.length) * 0.15))) return 'similar';
  return 'different';
}

const NAME_STOP = 'has|have|had|of|son|daughter|s\\/o|d\\/o|w\\/o|for|on|in|is|was|from|successfully|completed|passed|bearing|with|has been|roll|enrolment|enrollment|seat';

function cleanNameCandidate(s: string): string | undefined {
  const t = s.replace(/\s+/g, ' ').replace(/[,;:]+$/, '').trim();
  const words = t.split(' ');
  if (words.length < 1 || words.length > 5) return undefined;
  if (!/^[A-Za-z][A-Za-z.'\- ]+$/.test(t)) return undefined;
  if (normalizeName(t).replace(/\s/g, '').length < 3) return undefined;
  return t;
}

export function extractName(text: string, kind: DocKind): { name: string; source: string } | undefined {
  // 1) Explicit label: "Name: ...", "Student Name - ...", "Name of Candidate: ..."
  const labelled = /^\s*(?:full\s+name|student(?:'s)?\s+name|name\s+of\s+(?:the\s+)?(?:candidate|student)|candidate(?:'s)?\s+name|name)\s*[:\-–]\s*(.+)$/im.exec(text);
  if (labelled) {
    const n = cleanNameCandidate(labelled[1]);
    if (n) return { name: n, source: lineAt(text, labelled.index + labelled[0].indexOf(labelled[1])) };
  }
  // 2) Certificate phrasing: "This is to certify that Mr. A. Kumaar has ..."
  const cert = new RegExp(
    `(?:this is to certify that|certif(?:y|ies) that|awarded to|presented to|conferred (?:up)?on)\\s+(?:(?:mr|ms|mrs|miss|shri|smt|kumari|dr)\\.?\\s+)?([A-Za-z][A-Za-z.'\\- ]{1,60}?)(?=\\s+(?:${NAME_STOP})\\b|[,\\n\\r]|$)`,
    'i',
  ).exec(text);
  if (cert) {
    const n = cleanNameCandidate(cert[1]);
    if (n) return { name: n, source: lineAt(text, cert.index) };
  }
  // 3) Resume heading: first short line that looks like a person's name.
  if (kind === 'resume' || kind === 'cover-letter') {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6);
    for (const line of lines) {
      if (/[@\d:/|]|resume|curriculum|vitae|objective|summary|profile|email|phone|dear|cover letter/i.test(line)) continue;
      const n = cleanNameCandidate(line);
      if (n && n.split(' ').length >= 2) return { name: n, source: line };
    }
  }
  // 4) Cover letter sign-off
  if (kind === 'cover-letter') {
    const sign = /(?:sincerely|regards|yours faithfully|yours sincerely|thank you)[,.\s]*\n+\s*([A-Za-z][A-Za-z.'\- ]{2,50})\s*$/i.exec(text.trim());
    if (sign) {
      const n = cleanNameCandidate(sign[1]);
      if (n) return { name: n, source: lineAt(text, text.indexOf(sign[1])) };
    }
  }
  return undefined;
}

// ---------- Contact ----------

export function extractEmails(text: string): string[] {
  return unique(text.match(EMAIL_RE) ?? []);
}

export function extractPhones(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const squashed = line.replace(/[\s()-]/g, '');
    const m = /(?<!\d)(?:\+?91)?[6-9]\d{9}(?!\d)/.exec(squashed);
    if (m) out.push(m[0]);
  }
  return unique(out);
}

// ---------- Education ----------

const INSTITUTION_RE = /(university|college|institute|vidyalaya|vidyapeeth|polytechnic|school of|academy)/i;

export function extractInstitutions(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/\s+/g, ' ');
    if (line.length < 6 || line.length > 140) continue;
    if (INSTITUTION_RE.test(line) && !/@|www\.|http/i.test(line)) out.push(line);
  }
  return unique(out).slice(0, 6);
}

const INSTITUTION_STOPWORDS = new Set(['of', 'the', 'and', 'for', 'in', 'at', 'a', 'an', '&', 'college', 'university', 'institute', 'school', 'technology']);

export function institutionTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !INSTITUTION_STOPWORDS.has(t));
}

export function institutionsOverlap(a: string, b: string): boolean {
  const ta = new Set(institutionTokens(a));
  const tb = new Set(institutionTokens(b));
  if (!ta.size || !tb.size) return true; // not enough evidence to claim a mismatch
  let shared = 0;
  ta.forEach((t) => {
    if (tb.has(t)) shared++;
  });
  return shared / Math.min(ta.size, tb.size) >= 0.5;
}

const DEGREE_RE = /\b(B\.?\s?Tech|B\.E\b\.?|BE\b|B\.?\s?Sc|B\.?\s?Com|B\.?\s?C\.?A|BBA|B\.?\s?Pharm|M\.?\s?Tech|M\.?\s?Sc|M\.?\s?Com|MBA|MCA|Diploma|Bachelor of [A-Z][a-z]+|Master of [A-Z][a-z]+)\b/g;

const DEGREE_ALIASES: Record<string, string> = {
  bachelorofengineering: 'be',
  bachelorofscience: 'bsc',
  bachelorofcommerce: 'bcom',
  bachelorofpharmacy: 'bpharm',
  bacheloroftechnology: 'btech',
  masteroftechnology: 'mtech',
  masterofscience: 'msc',
  masterofcommerce: 'mcom',
};

export function normalizeDegree(d: string): string {
  const k = d.toLowerCase().replace(/[.\s]/g, '');
  return DEGREE_ALIASES[k] ?? k;
}

export function extractDegrees(text: string): string[] {
  return unique((text.match(DEGREE_RE) ?? []).map((d) => d.trim()));
}

export function extractGrades(text: string): ExtractedFacts['grades'] {
  const out: ExtractedFacts['grades'] = [];
  const re = /\b(CGPA|GPA|CPI)\b[^\d\n]{0,15}(\d{1,2}(?:\.\d{1,2})?)(?:\s*\/\s*(10|4|5))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const value = parseFloat(m[2]);
    const scale = m[3] ? parseInt(m[3], 10) : value <= 4 ? 4 : 10;
    if (value > 0 && value <= scale) out.push({ label: m[1].toUpperCase(), value, scale, passage: lineAt(text, m.index) });
  }
  return out;
}

// ---------- Dates ----------

const EDU_LINE_RE = /b\.?\s?tech|b\.?\s?e\b|bachelor|master|diploma|university|college|institute|b\.?\s?sc|m\.?\s?sc|mba|mca|b\.?\s?com|degree|hsc|ssc|polytechnic|school/i;

export function extractYearRanges(text: string, now: Date): ExtractedFacts['yearRanges'] {
  const out: ExtractedFacts['yearRanges'] = [];
  const re = new RegExp(`\\b((?:19|20)\\d{2})\\s*(?:-|–|—|to)\\s*(?:(?:${MONTHS})\\.?\\s+)?((?:19|20)\\d{2}|present|current|ongoing)\\b`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = parseInt(m[1], 10);
    const endRaw = m[2].toLowerCase();
    const end = /^\d{4}$/.test(endRaw) ? parseInt(endRaw, 10) : now.getFullYear();
    const passage = lineAt(text, m.index);
    out.push({ start, end, passage, education: EDU_LINE_RE.test(passage) || /education|academic/i.test(precedingHeading(text, m.index)) });
  }
  return out;
}

function precedingHeading(text: string, index: number): string {
  const before = text.slice(0, index).split(/\r?\n/).reverse();
  for (const l of before.slice(0, 8)) {
    const t = l.trim();
    if (t && t.length < 40 && /^[A-Za-z &/]+:?$/.test(t)) return t;
  }
  return '';
}

export function extractPassingYears(text: string): ExtractedFacts['passingYears'] {
  const out: ExtractedFacts['passingYears'] = [];
  const re = /(?:year of passing|passing year|graduat(?:ed|ion)(?: year)?|passed in|session|batch|convocation|year of completion|completed in)[^\d\n]{0,25}((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ year: parseInt(m[2] ?? m[1], 10), passage: lineAt(text, m.index) });
  }
  return out;
}

export function detectDateFormats(text: string): string[] {
  const formats: string[] = [];
  if (new RegExp(`\\b(?:${MONTHS})\\.?\\s+(?:19|20)\\d{2}\\b`, 'i').test(text)) formats.push('Month YYYY');
  if (/\b\d{1,2}([/.-])\d{1,2}\1(?:19|20)\d{2}\b/.test(text)) formats.push('DD/MM/YYYY');
  if (/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/.test(text)) formats.push('YYYY-MM-DD');
  return formats;
}

// ---------- Resume structure ----------

const SECTION_NAMES: [string, RegExp][] = [
  ['Education', /^\s*(education|academic(?:s| background| qualifications?)?)\s*:?\s*$/im],
  ['Skills', /^\s*((?:technical |key )?skills|technologies|competencies)\s*:?\s*$/im],
  ['Experience', /^\s*((?:work |professional )?experience|internships?|employment|training)\s*:?\s*$/im],
  ['Projects', /^\s*(projects?|academic projects?|personal projects?)\s*:?\s*$/im],
];

export function detectSections(text: string): string[] {
  return SECTION_NAMES.filter(([, re]) => re.test(text)).map(([n]) => n);
}

export function detectPlaceholders(text: string): string[] {
  const out: string[] = [];
  const re = /\[(?:your|name|email|phone|insert|company|date)[^\]]{0,30}\]|lorem ipsum|x{4,}|\bTODO\b|<your[^>]{0,20}>|\byour name here\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(lineAt(text, m.index));
  return unique(out);
}

export function detectSensitiveIdentifiers(text: string): string[] {
  const out: string[] = [];
  const re = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    // Mask before it can ever be shown.
    out.push(lineAt(text, m.index).replace(/\d{4}\s?\d{4}\s?\d{4}/g, '•••• •••• ••••'));
  }
  return unique(out);
}

export function wordCount(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length;
}

// ---------- Entry point ----------

export function extractFacts(doc: UploadedDoc, now: Date = new Date()): ExtractedFacts {
  const text = doc.text;
  const nm = extractName(text, doc.kind);
  return {
    docId: doc.id,
    docName: doc.name,
    kind: doc.kind,
    name: nm?.name,
    nameSource: nm?.source,
    emails: extractEmails(text),
    phones: extractPhones(text),
    institutions: extractInstitutions(text),
    degrees: extractDegrees(text),
    grades: extractGrades(text),
    yearRanges: extractYearRanges(text, now),
    passingYears: extractPassingYears(text),
    placeholders: detectPlaceholders(text),
    sections: detectSections(text),
    sensitiveIdentifiers: detectSensitiveIdentifiers(text),
    dateFormats: detectDateFormats(text),
    wordCount: wordCount(text),
  };
}
