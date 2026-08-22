# Ticket QR Code Generator Worker
### Database Schema (ERD) & API Contracts

---

## 1. Database Schema (ERD)

The current app uses two entities: **Tickets** and (implicitly) **Staff/Assignees**. Below is the normalized schema for when this moves to a real database.

### 1.1 Entity: `tickets`

| Column        | Type            | Constraints                          | Notes                                      |
|---------------|-----------------|---------------------------------------|---------------------------------------------|
| `id`          | VARCHAR(20)     | PRIMARY KEY                          | e.g. `ENG-139001` (business-facing ID)     |
| `title`       | VARCHAR(255)    | NOT NULL, MIN LENGTH 3               | Short summary of the issue                 |
| `description` | TEXT            | NOT NULL                             | Full details of the ticket                 |
| `status`      | ENUM            | NOT NULL, DEFAULT `'Open'`           | `Open`, `In Progress`, `Blocked`, `Done`   |
| `assignee_id` | INT             | FOREIGN KEY → `staff(id)`, NOT NULL  | Who the ticket is assigned to              |
| `created_at`  | TIMESTAMP       | NOT NULL, DEFAULT `CURRENT_TIMESTAMP`| Auto-set on creation                       |
| `updated_at`  | TIMESTAMP       | NOT NULL, ON UPDATE `CURRENT_TIMESTAMP` | Auto-updated on every change            |

### 1.2 Entity: `staff`

| Column       | Type          | Constraints           | Notes                          |
|--------------|---------------|------------------------|----------------------------------|
| `id`         | INT           | PRIMARY KEY, AUTO_INCREMENT | Internal ID                |
| `name`       | VARCHAR(120)  | NOT NULL               | Floor staff / assignee name    |
| `created_at` | TIMESTAMP     | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | |

> Currently the app stores `assignee` as a free-text string for simplicity (matches the MVP scope). This `staff` table is the future-proofed version — it normalizes the relationship instead of repeating names as text, and lets a manager look up "all tickets assigned to X" reliably even if the name is typed differently across tickets.

### 1.3 Relationship (ERD summary)

```
staff (1) ────────< (many) tickets
   id                    assignee_id (FK)
```

One staff member can have many tickets assigned to them. Each ticket belongs to exactly one staff member.

### 1.4 Indexes

- `tickets.status` — indexed, since the UI filters by status constantly.
- `tickets.assignee_id` — indexed, for the "assigned to" lookups and search.
- `tickets.title` — full-text index (optional) if search needs to scale beyond simple substring matching.

---

## 2. API Contracts

Base path: `/api/tickets`
Format: JSON request/response. All list/create/update/delete operations map directly to the `ticketService` methods already used in the frontend (`list`, `create`, `update`, `remove`), so swapping the data layer later requires no UI changes.

### 2.1 `GET /api/tickets`
List all tickets (optionally filtered).

**Query params (optional):**
| Param      | Type   | Example       |
|------------|--------|----------------|
| `status`   | string | `Open`         |
| `q`        | string | `printer`      |

**Response `200 OK`:**
```json
{
  "tickets": [
    {
      "id": "ENG-139001",
      "title": "Printer not working - 3rd floor",
      "description": "Front desk printer stopped printing tickets",
      "status": "Open",
      "assignee": "Rakshi Mehta",
      "createdAt": "2026-08-22T07:15:00.000Z",
      "updatedAt": "2026-08-22T07:15:00.000Z"
    }
  ]
}
```

### 2.2 `POST /api/tickets`
Create a new ticket.

**Request body:**
```json
{
  "title": "Printer not working - 3rd floor",
  "description": "Front desk printer stopped printing tickets",
  "assignee": "Rakshi Mehta",
  "status": "Open"
}
```

**Validation rules (server-side, mirrors client-side validation already in the app):**
- `title`: required, min 3 characters
- `description`: required
- `assignee`: required
- `status`: must be one of `Open`, `In Progress`, `Blocked`, `Done`

**Response `201 Created`:**
```json
{
  "id": "ENG-139002",
  "title": "Printer not working - 3rd floor",
  "description": "Front desk printer stopped printing tickets",
  "assignee": "Rakshi Mehta",
  "status": "Open",
  "createdAt": "2026-08-22T07:20:00.000Z",
  "updatedAt": "2026-08-22T07:20:00.000Z"
}
```

**Response `400 Bad Request`** (validation failure):
```json
{
  "errors": {
    "title": "Title is required.",
    "assignee": "Assignee is required."
  }
}
```

### 2.3 `PATCH /api/tickets/:id`
Update an existing ticket (partial update — used for both full edits and quick status changes).

**Request body (example — status-only update):**
```json
{
  "status": "In Progress"
}
```

**Response `200 OK`:** same shape as `POST` response, with updated fields.

**Response `404 Not Found`:**
```json
{ "error": "Ticket ENG-139002 not found." }
```

### 2.4 `DELETE /api/tickets/:id`
Delete a ticket.

**Response `204 No Content`** on success.

**Response `404 Not Found`:**
```json
{ "error": "Ticket ENG-139002 not found." }
```

### 2.5 `GET /api/tickets/:id/qr`
Generate/fetch the QR code for a ticket (currently handled client-side via `api.qrserver.com`; this endpoint is the future server-side equivalent, useful if the QR payload needs to encode more than just the ticket ID — e.g. a signed URL).

**Response `200 OK`:**
```json
{
  "ticketId": "ENG-139002",
  "qrImageUrl": "https://cdn.example.com/qr/ENG-139002.png"
}
```

---

## 3. Notes on the current implementation vs. this contract

- The app currently talks to a `ticketService` object (`list`, `create`, `update`, `remove`) backed by `localStorage`.
- Every method already returns a `Promise`, matching the async nature of the API calls above.
- Migrating later means replacing `createLocalStorageTicketService()` with a `createApiTicketService(baseUrl)` that calls the endpoints above via `fetch()` — no changes needed to the React components, form validation, or UI.
