// Real text extraction in the browser. Files never leave the device, with one
// disclosed exception: Tesseract (image OCR) downloads its English language model
// from a public CDN the first time it is used. If extraction fails, an error is
// thrown and shown to the student; we never fabricate text.
import type { DocKind, ExtractionMethod } from '../types';
import { fileExtension } from './validation';

export class ExtractionError extends Error {}

export interface ExtractionResult {
  text: string;
  method: ExtractionMethod;
}

type Progress = (pct: number) => void;

const MIN_CHARS = 20;

function finish(text: string, method: ExtractionMethod, hint: string): ExtractionResult {
  const cleaned = text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (cleaned.replace(/\s/g, '').length < MIN_CHARS) throw new ExtractionError(hint);
  return { text: cleaned, method };
}

async function extractPdf(file: File, onProgress: Progress): Promise<ExtractionResult> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === 'PasswordException') throw new ExtractionError('This PDF is password-protected. Remove the password and upload it again.');
    throw new ExtractionError('This PDF could not be opened. It may be damaged. Try saving it again or upload a DOCX/TXT version.');
  }
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = '';
    let lastY: number | null = null;
    const lines: string[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = item.transform[5] as number;
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line);
        line = '';
      }
      line += (line && !line.endsWith(' ') && item.str && !item.str.startsWith(' ') ? ' ' : '') + item.str;
      lastY = y;
    }
    if (line) lines.push(line);
    pages.push(lines.join('\n'));
    onProgress(Math.round((i / doc.numPages) * 100));
  }
  await doc.destroy();
  return finish(pages.join('\n\n'), 'pdf-text', 'No selectable text was found in this PDF. It may be a scan. Upload a clear PNG/JPG photo of each page so OCR can be used, or a text-based version.');
}

async function extractDocx(file: File, onProgress: Progress): Promise<ExtractionResult> {
  const mod = await import('mammoth');
  // CommonJS package: depending on the bundler the API is on the namespace or on .default.
  const mammoth = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
  onProgress(30);
  try {
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    onProgress(100);
    return finish(value, 'docx', 'No text was found in this Word document.');
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    throw new ExtractionError('This DOCX could not be read. Old .doc files are not supported. Save as .docx and upload again.');
  }
}

async function extractTxt(file: File, onProgress: Progress): Promise<ExtractionResult> {
  onProgress(40);
  const text = await file.text();
  onProgress(100);
  if (/\u0000/.test(text.slice(0, 2000))) throw new ExtractionError('This file looks binary rather than plain text.');
  return finish(text, 'text', 'This text file is empty or too short to check.');
}

async function extractImage(file: File, onProgress: Progress): Promise<ExtractionResult> {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100));
      },
    });
    try {
      const { data } = await worker.recognize(file);
      return finish(data.text, 'ocr', 'OCR found almost no readable text. Use a sharper, well-lit, upright image, or upload the original PDF/DOCX.');
    } finally {
      await worker.terminate();
    }
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    throw new ExtractionError('OCR could not run. It needs a one-time download of the English language data, which may be blocked offline. Check your connection, or upload a PDF/DOCX/TXT instead.');
  }
}

export async function extractText(file: File, onProgress: Progress): Promise<ExtractionResult> {
  const ext = fileExtension(file.name);
  if (ext === 'pdf') return extractPdf(file, onProgress);
  if (ext === 'docx') return extractDocx(file, onProgress);
  if (ext === 'txt') return extractTxt(file, onProgress);
  return extractImage(file, onProgress);
}

/** Best-effort initial label. The student can always change it. */
export function guessKind(name: string, text: string, hasResume: boolean): DocKind {
  const n = name.toLowerCase();
  if (/resume|\bcv\b|curriculum/.test(n)) return 'resume';
  if (/cover/.test(n)) return 'cover-letter';
  if (/mark|transcript|grade|statement/.test(n)) return 'marksheet';
  if (/cert|degree|diploma|course/.test(n)) return 'certificate';
  const t = text.slice(0, 1500).toLowerCase();
  if (/this is to certify|certificate/.test(t)) return 'certificate';
  if (/statement of marks|marks obtained|cgpa|grade card/.test(t) && hasResume) return 'marksheet';
  if (/^\s*dear\b/m.test(t)) return 'cover-letter';
  return hasResume ? 'other' : 'resume';
}
