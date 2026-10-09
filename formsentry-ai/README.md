# FormSentry AI — Check Before You Submit

Team VeriForge · Seva First Innovation Challenge 2026 · Education and Employability
(sub-theme: apprenticeship, internship, placement and employability outcome tracking)

**Demonstration prototype.** All organisations, people and figures are synthetic. It is not an official government service.

## What it does
- **Application Checker:** compare a resume and supporting documents with an advertisement. Text is extracted in the browser (PDF, DOCX, TXT, or PNG/JPG via OCR) and shown honestly, including failures. Findings come from **fixed rules and text matching, not an AI model**, and each shows its evidence or rule. Review, dismiss or resolve each one, correct the extracted text, re-run, and print the report.
- **My Applications / Employability Outcomes:** track stages, deadlines, next actions, interviews, offers and internships. Outcomes are labelled self-reported and unverified.
- **Placement Insights (Placement Cell view):** synthetic, anonymous, aggregate-only. Any group under 10 records is hidden as "<10". CSV export contains aggregates only.

## Setup and run
Requires Node.js 18+.
```
npm install
npm test            # logic tests (audit, analytics, CSV)
npm run typecheck
npm run dev         # http://localhost:5173
npm run build       # output in dist/
npm run preview
```
No API key or backend is needed.

## Deployment
`npm run build` produces a static site in `dist/` (hash routing, so no server rewrites are needed). Upload `dist/` to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3). Not yet deployed by the team.

## Privacy and network notes
- Only the chosen view, application records and self-reported outcomes are saved to `localStorage`. Uploaded files, extracted text and reports are never stored.
- Two optional network fetches: Google Fonts (cosmetic, falls back to system fonts) and, on first image OCR only, Tesseract's English language data from a public CDN. Images themselves are not uploaded.
- Use **Reset demo data** (footer or Help & Privacy) to restore the seed data and clear documents.

## Two-minute judge demonstration
1. **(0:00)** Open Overview. Point to the amber "Demonstration prototype" banner, the deadlines table and the pipeline.
2. **(0:20)** Application Checker → **Load demonstration sample** → Continue. Show the four fictional documents; open "View / correct text" on one.
3. **(0:40)** Continue → **Run check**. In the report, show the score, the "Rule-based, no AI" note, and a finding with its quoted evidence (for example the missing phone number and the name spelled differently across documents).
4. **(1:00)** Correct details or documents → add a phone line to the resume text → Run check again. The finding clears. Dismiss one suggestion. Click **Save to My Applications**.
5. **(1:15)** My Applications: search "Konkan", change a stage from the list, then Employability Outcomes: note the "Self-reported · unverified" badges.
6. **(1:30)** Switch **View as → Placement Cell**. Open Placement Insights: stages, issue categories, median days. Choose Department = Biotechnology to show "<10" suppression. Click **Export aggregate CSV**.
7. **(1:50)** Help & Privacy: what is and isn't stored. Reset demo data.
