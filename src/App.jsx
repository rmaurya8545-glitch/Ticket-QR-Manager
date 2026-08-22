import { useState, useMemo, useCallback, useEffect } from "react";
import {
  QrCode,
  Plus,
  Search,
  X,
  AlertCircle,
  Loader2,
  Trash2,
  Pencil,
  Sun,
  Moon,
  Download,
  Printer,
} from "lucide-react";

const STORAGE_KEY = "ticket-qr-manager-tickets";
const SEQ_KEY = "ticket-qr-manager-seq";

function createLocalStorageTicketService() {
  function loadTickets() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveTickets(tickets) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  }

  function loadSeq() {
    const raw = window.localStorage.getItem(SEQ_KEY);
    const n = raw ? parseInt(raw, 10) : 1;
    return Number.isFinite(n) ? n : 1;
  }

  function saveSeq(seq) {
    window.localStorage.setItem(SEQ_KEY, String(seq));
  }

  function makeTicketId(seq) {
    return `ENG-${String(139000 + seq).padStart(6, "0")}`;
  }

  return {
    async list() {
      return loadTickets();
    },
    async create(data) {
      const tickets = loadTickets();
      const seq = loadSeq();
      const now = new Date().toISOString();
      const ticket = { id: makeTicketId(seq), createdAt: now, updatedAt: now, ...data };
      saveTickets([ticket, ...tickets]);
      saveSeq(seq + 1);
      return ticket;
    },
    async update(id, data) {
      const tickets = loadTickets();
      const next = tickets.map((t) =>
        t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t
      );
      saveTickets(next);
      return next.find((t) => t.id === id);
    },
    async remove(id) {
      const tickets = loadTickets();
      saveTickets(tickets.filter((t) => t.id !== id));
      return true;
    },
  };
}

function formatTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ticketService = createLocalStorageTicketService();

const STATUSES = ["Open", "In Progress", "Blocked", "Done"];

const STATUS_STYLES = {
  Open: "bg-slate-200 text-slate-800 border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600",
  "In Progress":
    "bg-slate-300 text-slate-900 border-slate-500 dark:bg-slate-600 dark:text-white dark:border-slate-500",
  Blocked:
    "bg-slate-100 text-slate-700 border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-500",
  Done: "bg-white text-slate-500 border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700",
};

const THEME_KEY = "ticket-qr-manager-theme";

function sanitize(input) {
  if (typeof input !== "string") return "";
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

function logAnalytics(action) {
  // eslint-disable-next-line no-console
  console.log(`[Analytics] User interacted with Ticket QR Code Generator Worker: ${action}`);
}

function qrUrl(payload) {
  const encoded = encodeURIComponent(payload);
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encoded}`;
}

async function downloadQr(ticket) {
  try {
    const response = await fetch(qrUrl(ticket.id));
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ticket.id}-qr.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    logAnalytics("qr-downloaded");
  } catch {
    window.open(qrUrl(ticket.id), "_blank");
  }
}

function printQr(ticket) {
  const win = window.open("", "_blank", "width=400,height=500");
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>${ticket.id}</title>
        <style>
          body { font-family: system-ui, sans-serif; text-align: center; padding: 24px; }
          img { width: 220px; height: 220px; }
          h1 { font-size: 16px; margin-top: 16px; }
          p { font-size: 13px; color: #555; }
        </style>
      </head>
      <body>
        <img src="${qrUrl(ticket.id)}" alt="QR code for ${ticket.id}" />
        <h1>${ticket.id}</h1>
        <p>${ticket.title}</p>
      </body>
    </html>
  `);
  win.document.close();
  win.onload = () => {
    win.print();
  };
  logAnalytics("qr-print-requested");
}

function getInitialTheme() {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

const emptyForm = { title: "", description: "", status: "Open", assignee: "" };

export default function TicketQRManager() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [qrTicket, setQrTicket] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [simulateSlowNet, setSimulateSlowNet] = useState(true);
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadingTickets(true);
    ticketService.list().then((data) => {
      if (!cancelled) {
        setTickets(data);
        setLoadingTickets(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      logAnalytics(`theme-switched-to-${next}`);
      return next;
    });
  }  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchesQuery =
        query.trim() === "" ||
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.id.toLowerCase().includes(query.toLowerCase()) ||
        t.assignee.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "All" || t.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [tickets, query, statusFilter]);

  function validate(f) {
    const e = {};
    if (!f.title.trim()) e.title = "Title is required.";
    else if (f.title.trim().length < 3) e.title = "Title must be at least 3 characters.";
    if (!f.assignee.trim()) e.assignee = "Assignee is required.";
    if (!f.description.trim()) e.description = "Description is required.";
    return e;
  }

  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setErrors({});
    setEditingId(null);
    setShowForm(false);
  }, []);

  async function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length > 0) {
      logAnalytics("form-validation-failed");
      setLiveMessage("There are errors in the form. Please review the highlighted fields.");
      return;
    }

    const clean = {
      title: sanitize(form.title),
      description: sanitize(form.description),
      assignee: sanitize(form.assignee),
      status: form.status,
    };

    if (editingId) {
      const updated = await ticketService.update(editingId, clean);
      setTickets((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
      logAnalytics("ticket-updated");
      setLiveMessage(`Ticket ${editingId} updated.`);
    } else {
      const created = await ticketService.create(clean);
      setTickets((prev) => [created, ...prev]);
      logAnalytics("ticket-created");
      setLiveMessage(`Ticket ${created.id} created.`);
    }
    resetForm();
  }

  function startEdit(ticket) {
    setForm({
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      assignee: ticket.assignee,
    });
    setEditingId(ticket.id);
    setErrors({});
    setShowForm(true);
    logAnalytics("edit-opened");
  }

  async function deleteTicket(id) {
    await ticketService.remove(id);
    setTickets((prev) => prev.filter((t) => t.id !== id));
    logAnalytics("ticket-deleted");
    setLiveMessage(`Ticket ${id} deleted.`);
  }

  async function cycleStatus(ticket) {
    const idx = STATUSES.indexOf(ticket.status);
    const next = STATUSES[(idx + 1) % STATUSES.length];
    const updated = await ticketService.update(ticket.id, { status: next });
    setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)));
    logAnalytics("status-changed");
    setLiveMessage(`Ticket ${ticket.id} status changed to ${next}.`);
  }

  function openQr(ticket) {
    setQrTicket(ticket);
    setQrLoading(true);
    setQrError(false);
    logAnalytics("qr-generate-requested");
    const delay = simulateSlowNet ? 900 + Math.random() * 700 : 150;
    window.setTimeout(() => {
      setQrLoading(false);
    }, delay);
  }

  function closeQr() {
    setQrTicket(null);
    setQrLoading(false);
    setQrError(false);
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans transition-colors">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-slate-900 focus:text-white dark:focus:bg-slate-100 dark:focus:text-slate-900"
      >
        Skip to main content
      </a>

      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 sm:px-6 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Ticket QR Code Generator Worker
          </h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 bg-slate-50 dark:bg-slate-900">
              <QrCode className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <span className="text-sm text-slate-600 dark:text-slate-400">{tickets.length} tickets</span>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-pressed={theme === "light"}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              className="p-2 border border-slate-300 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400 transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        <main id="main-content">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1 min-w-0">
              <Search
                className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <label htmlFor="ticket-search" className="sr-only">
                Search tickets
              </label>
              <input
                id="ticket-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, ID, or assignee"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 sm:flex-none">
                <label htmlFor="status-filter" className="sr-only">
                  Filter by status
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400"
                >
                  <option value="All">All statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForm((v) => !v);
                  if (showForm) resetForm();
                  logAnalytics("new-ticket-form-toggled");
                }}
                aria-expanded={showForm}
                aria-controls="ticket-form"
                className="flex items-center justify-center gap-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md px-4 py-2 text-sm font-medium hover:bg-slate-800 dark:hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span className="hidden xs:inline sm:inline">New ticket</span>
                <span className="sm:hidden">New</span>
              </button>
            </div>
          </div>

          {showForm && (
            <form
              id="ticket-form"
              onSubmit={handleSubmit}
              noValidate
              className="mb-8 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 sm:p-6 space-y-4"
              aria-label={editingId ? "Edit ticket" : "Create ticket"}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  {editingId ? "Edit ticket" : "Create ticket"}
                </h2>
                <button
                  type="button"
                  onClick={resetForm}
                  aria-label="Close form"
                  className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400 rounded"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <Field label="Title" error={errors.title} htmlFor="title">
                <input
                  id="title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? "title-error" : undefined}
                  className={inputClass(errors.title)}
                />
              </Field>

              <Field label="Description" error={errors.description} htmlFor="description">
                <textarea
                  id="description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  aria-invalid={!!errors.description}
                  aria-describedby={errors.description ? "description-error" : undefined}
                  className={inputClass(errors.description)}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Assignee" error={errors.assignee} htmlFor="assignee">
                  <input
                    id="assignee"
                    type="text"
                    value={form.assignee}
                    onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                    aria-invalid={!!errors.assignee}
                    aria-describedby={errors.assignee ? "assignee-error" : undefined}
                    className={inputClass(errors.assignee)}
                  />
                </Field>

                <Field label="Status" htmlFor="status">
                  <select
                    id="status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className={inputClass()}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  className="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md px-4 py-2 text-sm font-medium hover:bg-slate-800 dark:hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400 transition-colors"
                >
                  {editingId ? "Save changes" : "Create ticket"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}          <section aria-label="Ticket list">
            {loadingTickets ? (
              <div
                role="status"
                className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg py-16 px-6 text-center"
              >
                <Loader2
                  className="w-6 h-6 text-slate-400 dark:text-slate-600 mx-auto mb-3 animate-spin"
                  aria-hidden="true"
                />
                <p className="text-slate-500 dark:text-slate-500 text-sm">Loading tickets…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div
                role="status"
                className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg py-16 px-6 text-center"
              >
                <QrCode className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-3" aria-hidden="true" />
                <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">No data found</p>
                <p className="text-slate-500 dark:text-slate-500 text-sm">
                  {tickets.length === 0
                    ? "Create your first ticket to get started."
                    : "No tickets match your search or filter."}
                </p>
              </div>
            ) : (
              <ul className="space-y-3 max-h-[28rem] overflow-y-auto pr-1 border border-slate-200 dark:border-slate-800 rounded-md p-3 bg-slate-50/50 dark:bg-slate-900/30">
                {filtered.map((t) => (
                  <li
                    key={t.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-500">{t.id}</span>
                        <button
                          type="button"
                          onClick={() => cycleStatus(t)}
                          aria-label={`Status: ${t.status}. Activate to advance to the next status.`}
                          className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[t.status]} focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400`}
                        >
                          {t.status}
                        </button>
                      </div>
                      <h3 className="text-slate-900 dark:text-slate-100 font-medium break-words">{t.title}</h3>
                      <p className="text-slate-500 dark:text-slate-500 text-sm break-words">{t.description}</p>
                      <p className="text-slate-500 dark:text-slate-600 text-xs mt-1">Assigned to {t.assignee}</p>
                      <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">
                        Created {formatTimestamp(t.createdAt)}
                        {t.updatedAt && t.updatedAt !== t.createdAt && (
                          <> · Updated {formatTimestamp(t.updatedAt)}</>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => openQr(t)}
                        aria-label={`Generate QR code for ${t.id}`}
                        className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400 transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                        QR
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        aria-label={`Edit ${t.id}`}
                        className="p-1.5 border border-slate-300 dark:border-slate-700 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTicket(t.id)}
                        aria-label={`Delete ${t.id}`}
                        className="p-1.5 border border-slate-300 dark:border-slate-700 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <label className="flex items-center gap-2 mt-6 text-xs text-slate-500 dark:text-slate-600">
            <input
              type="checkbox"
              checked={simulateSlowNet}
              onChange={(e) => setSimulateSlowNet(e.target.checked)}
              className="accent-slate-600 dark:accent-slate-400"
            />
            Simulate slow 3G on QR generation
          </label>
        </main>
      </div>

      {qrTicket && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`QR code for ${qrTicket.id}`}
          className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 flex items-center justify-center p-4 z-50"
          onClick={closeQr}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{qrTicket.id}</h2>
              <button
                type="button"
                onClick={closeQr}
                aria-label="Close QR code dialog"
                className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400 rounded"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md aspect-square flex items-center justify-center overflow-hidden">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-500" role="status">
                  <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                  <span className="text-xs">Generating QR code…</span>
                </div>
              ) : qrError ? (
                <div className="flex flex-col items-center gap-2 text-slate-500 px-4 text-center" role="alert">
                  <AlertCircle className="w-6 h-6" aria-hidden="true" />
                  <span className="text-xs">Couldn't load QR code. Check your connection and retry.</span>
                </div>
              ) : (
                <img
                  src={qrUrl(qrTicket.id)}
                  alt={`QR code encoding ticket ${qrTicket.id}`}
                  width={180}
                  height={180}
                  onError={() => setQrError(true)}
                  className="rounded max-w-full h-auto"
                />
              )}
            </div>
            <p className="text-slate-500 text-xs mt-3 text-center">{qrTicket.title}</p>

            {!qrLoading && !qrError && (
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => downloadQr(qrTicket)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => printQr(qrTicket)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  Print
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, error, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
      {error && (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1"
        >
          <AlertCircle className="w-3 h-3" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

function inputClass(error) {
  return `w-full bg-white dark:bg-slate-950 border rounded-md px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400 ${
    error ? "border-red-500" : "border-slate-300 dark:border-slate-700"
  }`;
}
