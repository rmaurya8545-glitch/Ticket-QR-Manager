# 🤖 AI Usage Log

This document logs how AI (Claude, by Anthropic) was used during development, in the interest of transparency.

---

## Tool Used

**Claude** (Anthropic) — chat-based assistance, no autonomous code execution against production systems.

## How AI Was Used

### 1. Environment setup
- Scaffolding the React + Vite + Tailwind project
- Debugging local setup issues: locked folders in PowerShell, a Tailwind `content` path typo, a missing Tailwind version pin, a missing JSX opening tag — all diagnosed from terminal/error screenshots

### 2. Core functionality (per the TRD's "Happy Path" user stories)
- Ticket create / edit / delete
- Status cycling (`Open → In Progress → Blocked → Done`)
- QR code generation per ticket
- Search and status filtering

### 3. Non-Functional Requirements (per the TRD)
- **Accessibility:** ARIA labels, keyboard navigation, skip-to-content link, live regions for screen-reader announcements, contrast-checked colors in both themes
- **Telemetry simulation:** `[Analytics] ...` console logging on primary actions
- **Security:** input sanitization against XSS before storing form data in state
- **Resilience:** empty states, loading indicators, and a slow-3G simulation toggle for the "Bad Connectivity" requirement

### 4. Enhancements requested during review
- Light/dark theme toggle, persisted in `localStorage`
- Responsive layout across mobile, tablet, and desktop
- A scrollable ticket list container so long lists don't push the page layout
- Migrating ticket storage from in-memory state to `localStorage`
- Adding `createdAt` / `updatedAt` timestamps, surfaced in the UI

### 5. Documentation (per the TRD's "architectural planning" requirement)
- Database schema (ERD) — `SCHEMA_AND_API.md`
- REST API contracts — `SCHEMA_AND_API.md`
- This file and `README.md`

---

## What Was Reviewed / Verified Manually

| Check | Result |
|---|---|
| XSS sanitization | Submitted `<script>alert('hack')</script>` as a ticket title — rendered as inert text, no script executed |
| Persistence | Confirmed tickets survive a full page refresh via `localStorage` |
| Theme toggle | Confirmed it switches correctly and persists across sessions |
| Build health | `npm run dev` runs with no console errors |
| Scope accuracy | Caught and removed fields that were mistakenly copied from the ticket's *own* metadata rather than being real product requirements — see below |

## Corrections Made During Review

Early drafts mistakenly treated parts of the assignment's own ticket metadata as product features. These were identified and removed:

- A `Priority` (P0–P3) field on tickets — this was actually describing the *priority of the assignment itself* (`P1 (High)`), not a requested app feature
- A header line displaying the internal ticket ID and epic (`ENG-139055 · Core Infrastructure Overhaul`) — assignment metadata, not user-facing product content

This log is intended to make the AI-assisted parts of this deliverable traceable, not to imply the output was used unreviewed — every generated change was checked against the TRD before being kept.
