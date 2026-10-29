// Builds the Word version of the Phase 1 concept document.
// Diagrams come from docs/diagrams/*.png, produced by export_diagrams.py from the
// same drawing code as the PDF, so the two formats cannot drift.
// House style: no em dashes.

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, ExternalHyperlink,
} = require('docx');

const DIR = path.join(__dirname, 'diagrams');
const OUT = path.join(__dirname, '..', 'Uvere-Franca_92134098_WebProgramming_P1_S.docx');

const NAME = 'Franca Swittee Uvere';
const MATRIC = '92134098';
const COURSE = 'DLBITPEWP01_E, Project: Getting Started in Web Programming';
const REPO = 'https://github.com/SwitteeFranca2-0/declutter_ecommerce';

const INK = '1A1A1A', MUTED = '5A5A5A', ACCENT = '1E5F4B', LINK = '2C5F8A';
const FONT = 'Arial';
const CONTENT_PX = 642;               // 17cm of content width at 96dpi

const meta = (text) => new Paragraph({
  spacing: { after: 20 },
  children: [new TextRun({ text, font: FONT, size: 16, color: MUTED })],
});

const h = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 260, after: 110 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D4D4D4', space: 3 } },
  children: [new TextRun({ text, font: FONT, size: 21, bold: true, color: ACCENT })],
});

// runs: array of [text, bold?]
const p = (runs, opts = {}) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { after: opts.after === undefined ? 110 : opts.after, line: 250 },
  children: runs.map(([text, bold]) => new TextRun({
    text, bold: !!bold, font: FONT, size: opts.size || 19, color: opts.color || INK,
  })),
});

const img = (file, natW, natH) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 60, after: 60 },
  children: [new ImageRun({
    type: 'png',
    data: fs.readFileSync(path.join(DIR, file)),
    transformation: { width: CONTENT_PX, height: Math.round(CONTENT_PX * natH / natW) },
  })],
});

const caption = (text) => new Paragraph({
  spacing: { after: 140 },
  children: [new TextRun({ text, font: FONT, size: 15, color: MUTED, italics: true })],
});

// --- technology stack table --------------------------------------------------
const STACK = [
  ['Frontend', 'React 19 / Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui'],
  ['Client-side scripting', 'Fetch API against JSON route handlers: cart badge, category filter, thread polling'],
  ['Backend', 'Next.js route handlers, server-side role guards, Zod validation at every boundary'],
  ['Database', 'PostgreSQL (local instance), accessed through Prisma ORM with versioned migrations'],
  ['Authentication', 'NextAuth, credentials provider, bcrypt password hashing'],
  ['Libraries', 'Leaflet + OpenStreetMap (maps), Vitest (testing), bcrypt (PIN and password hashing)'],
];
const COLS = [2600, 7040];
const cell = (text, bold, w) => new TableCell({
  width: { size: w, type: WidthType.DXA },
  shading: bold ? { type: ShadingType.CLEAR, fill: 'F2F5F4' } : undefined,
  margins: { top: 60, bottom: 60, left: 90, right: 90 },
  children: [new Paragraph({
    children: [new TextRun({
      text, bold: !!bold, font: FONT, size: 17, color: bold ? ACCENT : INK,
    })],
  })],
});
const stackTable = new Table({
  columnWidths: COLS,
  width: { size: COLS[0] + COLS[1], type: WidthType.DXA },
  rows: STACK.map(([k, v]) => new TableRow({
    children: [cell(k, true, COLS[0]), cell(v, false, COLS[1])],
  })),
});

const doc = new Document({
  creator: NAME,
  title: 'Declutter: Concept Document',
  description: 'Portfolio Phase 1 (Conception)',
  sections: [{
    properties: {
      page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } },
    },
    children: [
      new Paragraph({
        spacing: { after: 130 },
        children: [new TextRun({
          text: 'Declutter: Concept Document', font: FONT, size: 34, bold: true, color: INK,
        })],
      }),
      meta('Portfolio Phase 1 (Conception)  ·  ' + COURSE),
      meta('Project type: E-Commerce Site (Task 2)'),
      meta('Name: ' + NAME + '   ·   Matriculation number: ' + MATRIC),
      new Paragraph({
        spacing: { after: 220 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D4D4D4', space: 6 } },
        children: [
          new TextRun({ text: 'Repository: ', font: FONT, size: 16, color: MUTED }),
          new ExternalHyperlink({
            link: REPO,
            children: [new TextRun({ text: REPO, font: FONT, size: 16, color: LINK, underline: {} })],
          }),
        ],
      }),

      h('1.  Project goal and store type'),
      p([['Declutter', true], [' is an escrow-mediated peer-to-peer resale marketplace for used goods, spanning six categories: electronics, furniture, appliances, fashion, books and other. Every listing is a unique second-hand item rather than stock of a product line.']]),
      p([['Informal resale depends on strangers exchanging money and meeting in person with no intermediary, which produces a familiar set of failures: buyers pay for items that never materialise, sellers travel to meet buyers who never intended to purchase, and contact details are exposed early and cannot be withdrawn. Declutter inserts a verified, publicly identified intermediary between the two parties. Listings are curated before publication, payment passes through the platform rather than between the parties, communication is mediated, and physical handover is gated by a payment-proof PIN. The guiding principle is that '], ['neither party needs to trust the other, only the intermediary', true], ['.']]),
      p([['The model was chosen for its academic value as well as its product logic. It requires a non-trivial item state machine and role-based access control, exercising more of the full-stack syllabus than a conventional product catalogue would.']]),

      h('2.  Features to be implemented'),
      p([['Curated listings. ', true], ["Sellers submit an item and the amount they wish to receive. The admin reviews, edits the presentation, sets the public price, and publishes or rejects with a reason. The margin between the seller's payout and the listed price is the platform's revenue, and the two figures are stored independently so the payout obligation never drifts."]]),
      p([['Marketplace. ', true], ['Responsive product grid with category filtering and price sorting, product detail pages with an image gallery, and a cart that persists across pages and marks items unavailable once sold.']]),
      p([['Escrow checkout. ', true], ['A 10% deposit places an item on hold for 72 hours, and the balance is paid on-platform before travel. Payment is simulated, since the brief does not require real processing, but it drives the same state transitions a live gateway webhook would.']]),
      p([['Anonymised relay. ', true], ['Before a deposit the parties cannot reach each other. Buyers submit information requests that reach the seller as platform enquiries with no identity attached, and the admin relays or withholds responses. After a deposit a direct thread opens and contact details are disclosed.']]),
      p([['PIN handover. ', true], ['On full payment a single-use PIN is issued to the buyer and stored only as a hash. At the meeting the seller enters it, and valid entry proves funds cleared and releases the payout.']]),
      p([['Meetup agreement. ', true], ['Either party drops a pin on an embedded Leaflet map within the direct thread, biased toward public locations.']]),

      h('3.  Technology stack'),
      stackTable,
      new Paragraph({ spacing: { after: 60 }, children: [] }),
      p([['The stack requires no paid service, hosted provider or API key. The application runs from a clone against a local PostgreSQL instance, which keeps the submission reproducible by an assessor. Payment, SMS verification, seller payout and hold expiry are deliberately simulated for the same reason.']], { size: 17 }),

      h('4.  Architecture and data flow'),
      p([['A browser request reaches a Next.js route handler, which applies a server-side role guard, validates input with Zod, and queries PostgreSQL through Prisma. Pages are server-rendered, while the interactive elements (cart badge, category filter and message polling) exchange JSON with the same route handlers via the Fetch API. Prices and totals are always recalculated on the server and never accepted from the client, preventing price manipulation.']], { size: 17 }),
      img('architecture.png', 2122, 609),
      caption('Dashed components are external or stubbed. Payment, SMS verification and payout are simulated endpoints that drive the same state transitions a live gateway webhook would trigger.'),

      h('5.  Item lifecycle'),
      p([['Every listing moves through a single state machine that governs what each role may do with it. This is the core of the application logic and its main source of complexity.']], { size: 17 }),
      img('lifecycle.png', 2123, 378),
      caption('Only one active order may exist per item at any time, enforced by a partial unique index rather than by application code alone. Items in sold or completed are withdrawn from the public marketplace and display as unavailable in any cart still holding them.'),

      h('6.  Development approach'),
      p([['The application is built as '], ['vertical slices in the order of the acceptance criteria', true], [': register, submit, approve, enquire, deposit, converse, agree a meetup, pay the balance, redeem the PIN, record the payout. A working end-to-end demonstration therefore exists from the first slice onward rather than only at the end. Each slice is developed '], ['test-first with Vitest', true], [', writing a failing test, then the implementation, then refactoring. Tests concentrate on the invariants that are hard to verify by clicking: legal state transitions, one active order per item, single-use PIN redemption, server-side price authority, and role guards returning 403. The eleven-step operator walkthrough serves as the acceptance checklist. Each slice is developed on its own short-lived branch and merged non-fast-forward, so the commit history shows each feature as a discrete unit.']], { size: 17 }),
      p([['Simulated for this submission: ', true], ['payment authorisation, SMS verification codes, seller payouts, and hold expiry (evaluated on read rather than by a scheduled job). Each drives the same state transitions its real counterpart would. '], ['Deferred: ', true], ['dispute resolution, ratings and reputation, fraud detection, search ranking, and courier handover, all specified in the companion product document and reported as future work.']], { size: 17 }),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('wrote ' + path.basename(OUT) + ' (' + buf.length + ' bytes)');
});
