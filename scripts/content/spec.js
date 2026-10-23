// The editing kit's shape: fields, labels, row counts and length limits.
// Shared by the Drive reader (pull-drive.js), the simulated export used in tests (fake-drive.js)
// and the Apps Script setup kit (drive-kit/setup.gs is generated from this by build-kit.js).

const PROJECT = {
  // Tab "Page": one row per field. Column A label, column B text.
  page: [
    { key: "title", label: "Title", max: 60, required: true },
    { key: "format", label: "Format", max: 40, required: true, hint: "For example: Feature documentary, Docuseries, Short documentary" },
    { key: "status", label: "Status", max: 140, required: true, hint: "Where the project stands now" },
    { key: "logline", label: "Logline", max: 150, required: true, hint: "One sentence. Shown on the index cards." },
    { key: "summary", label: "Summary", max: 800, required: true, multiline: true, hint: "Up to two short paragraphs. Use a blank line between paragraphs." },
    { key: "contact", label: "Contact email", max: 80, type: "email" },
    { key: "onRequest", label: "Available on request", max: 80, hint: "For example: Deck and sizzle on request" }
  ],
  // List tabs: a header row, then a fixed number of rows.
  lists: [
    { key: "team", tab: "Team", rows: 10, cols: [
      { label: "Name", max: 50 }, { label: "Role", max: 50 }] },
    { key: "help", tab: "How to help", rows: 10, cols: [
      { label: "What the project needs", max: 120 }] },
    { key: "links", tab: "Links", rows: 6, cols: [
      { label: "Label", max: 30, hint: "Website, Donate, Instagram" }, { label: "Link", max: 300, type: "url", required: true }] },
    { key: "laurels", tab: "Laurels and awards", rows: 12, cols: [
      { label: "Festival or award", max: 60 }, { label: "Year", type: "year" }, { label: "Honor", max: 60, hint: "World Premiere, Official Selection, Winner" }, { label: "Source link", max: 300, type: "url" }] },
    { key: "updates", tab: "News", rows: 10, cols: [
      { label: "Date", max: 20, hint: "Oct 2026" }, { label: "What happened", max: 260 }, { label: "Source name", max: 60 }, { label: "Source link", max: 300, type: "url", required: true }] }
  ]
};

// Google Docs for the front pages. Each "## Section" heading in the doc maps to one field.
const DOCS = {
  cover: { title: "Cover", sections: [
    { key: "intro", heading: "Intro line", kind: "text", max: 160 },
    { key: "footerEmail", heading: "Footer email", kind: "text", max: 80 },
    { key: "footerNote", heading: "Footer note", kind: "text", max: 60 }] },
  welcome: { title: "Welcome", sections: [
    { key: "heading", heading: "Page heading", kind: "text", max: 50 },
    { key: "lede", heading: "Opening", kind: "paragraphs", maxItems: 3, max: 280 },
    { key: "invitation", heading: "Our invitation", kind: "paragraphs", maxItems: 3, max: 300 }] },
  about: { title: "About", sections: [
    { key: "heading", heading: "Page heading", kind: "text", max: 40 },
    { key: "why", heading: "Main text", kind: "paragraphs", maxItems: 3, max: 450 },
    { key: "criteria", heading: "Selection criteria", kind: "bullets", maxItems: 6, max: 30 },
    { key: "selection", heading: "Selection note", kind: "text", max: 300 },
    { key: "how", heading: "How to use this list", kind: "steps", maxItems: 4, max: 120, maxTitle: 20 },
    { key: "close", heading: "Closing line", kind: "text", max: 200 }] }
};

const ORDER = { tab: "Running order", perPage: 4, pages: 6 };

module.exports = { PROJECT, DOCS, ORDER };
