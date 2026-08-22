# 🎫 Ticket QR Code Generator Worker

A lightweight digital ticket management tool built for floor staff — replacing manual paper logs and Excel sheets with a searchable, shareable, QR-code-backed ticket system.

> **Ticket:** `ENG-139055` · **Epic:** Core Infrastructure Overhaul · **Priority:** P1

---

## 📖 The Problem

Client staff were tracking operational tickets on paper and in Excel — causing lost data and slow handoffs between shifts. This app gives floor staff a single, always-available screen to log an issue, assign it, track its status, and pull up a scannable QR code for quick reference on the floor.

## ✨ Features

| Category | What it does |
|---|---|
| **Ticket CRUD** | Create, edit, delete tickets; cycle status with one tap (`Open → In Progress → Blocked → Done`) |
| **QR codes** | Generate a scannable QR code for any ticket on demand |
| **Search & filter** | Instant search by title, ID, or assignee; filter by status |
| **Light / dark theme** | One-click toggle in the header; choice is remembered across visits |
| **Fully responsive** | Clean layout from small phones up to desktop |
| **Accessible by design** | Skip-to-content link, ARIA labels throughout, live announcements for screen readers, keyboard-navigable, contrast-checked in both themes |
| **Secure by default** | Every text input is sanitized against XSS before it's stored |
| **Resilient UX** | Empty states, loading spinners, and a slow-3G simulation toggle to test degraded connections |
| **Persistent** | Tickets survive a page refresh (saved to `localStorage`) |

## 🛠️ Tech Stack

- **React** (via Vite)
- **Tailwind CSS** — `darkMode: "class"` strategy for the theme toggle
- **[lucide-react](https://lucide.dev/)** — icon set

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Open the local URL printed in the terminal (usually `http://localhost:5173`).

## 📁 Project Structure

```
ticket-qr-manager/
├── src/
│   ├── App.jsx           # App component + swappable data-service layer
│   ├── index.css         # Tailwind entry point
│   └── main.jsx           # React entry point
├── tailwind.config.js
├── postcss.config.js
├── database-schema.md      # Database schema (ERD) + API contract design
├── PROMPT.md               # AI usage log
└── README.md               # You are here
```

## 🧱 Architecture Note — Built to Outgrow `localStorage`

All reads/writes go through a single `ticketService` object at the top of `App.jsx`, instead of the UI touching storage directly. Every method (`list`, `create`, `update`, `remove`) already returns a `Promise`, mirroring a real API call.

**Today:** `ticketService` → `localStorage`
**Tomorrow:** `ticketService` → `fetch()` calls against the REST endpoints defined in [`SCHEMA_AND_API.md`](./SCHEMA_AND_API.md)

Swapping the backend in later is a one-line change — no component, form, or UI logic needs to be touched.

## 🗺️ Roadmap

- [ ] Wire up a real backend + database per `database-shema.md`
- [ ] Multi-user support (today it's single-browser via `localStorage`)
- [ ] Role-based views (manager vs. floor staff)
- [ ] Server-side QR generation with signed URLs

## ✅ Definition of Done Checklist

- [x] Code compiles and runs without fatal errors
- [x] Matches happy-path and unhappy-path acceptance criteria from the TRD
- [x] No real API keys or PII hardcoded in the source
- [x] Accessibility, sanitization, and analytics-logging NFRs implemented
