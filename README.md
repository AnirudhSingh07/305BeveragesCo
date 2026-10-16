# 305 Beverages Co. — Business Management & POS

A production-quality internal web app to run a beverage business day to day:
fast point-of-sale order entry, order history, menu management, expense tracking,
analytics, accurate Profit & Loss, and end-of-day closing.

Built with **Next.js (App Router) · TypeScript · Tailwind · shadcn-style UI ·
Supabase (Postgres + Auth + RLS) · Recharts · Zod · Vitest**.

- 💰 All money is **integer paise** end-to-end (no floating-point errors), shown
  in the Indian numbering system (e.g. `₹1,25,000`).
- 🕐 All business dates use the **Asia/Kolkata** timezone, even on a UTC server.
- 🔒 Order totals, discounts, refunds and payments are computed **server-side**
  in Postgres transactions — the browser never writes authoritative money.
- 🧾 Historical orders snapshot the selling **price and unit cost**, so changing
  the menu later never alters past sales or reports.

---

## 1. Tech stack & key decisions

| Concern | Choice |
|---|---|
| Framework | Next.js 14 App Router, React Server Components |
| Money unit | Integer **paise** (`₹60` → `6000`) everywhere |
| Financial integrity | Postgres functions (`create_order`, `refund_order`, …) run in a transaction |
| Reporting | Pure, unit-tested TS (`lib/finance.ts`) over stored columns |
| Auth / tenancy | Supabase Auth + Row Level Security, `business_id` on every table |
| Timezone | `Asia/Kolkata` business dates via `date-fns-tz` |

---

## 2. Prerequisites

- Node.js 20+ and npm
- A free [Supabase](https://supabase.com) project

---

## 3. Local setup

```bash
# 1. Install dependencies
npm install          # if peer-dep warnings block it: npm install --legacy-peer-deps

# 2. Configure environment
cp .env.example .env.local
#   then edit .env.local with your Supabase keys (see section 5)

# 3. Run the database migrations (see section 4)

# 4. Start the dev server
npm run dev
# open http://localhost:3000  → you'll be sent to /login
```

Create an account on the login screen (email + password). On first sign-in the
app calls the `ensure_business()` function, which creates your business and
**seeds the full menu + default expense categories automatically** (idempotent).

### Useful scripts

```bash
npm run dev         # start dev server
npm run build       # production build
npm run start       # run the production build
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run test        # run the Vitest business-logic suite
```

---

## 4. Database migrations (Supabase)

The schema, RLS policies, transactional functions, and idempotent seed live in
`supabase/migrations/`:

| File | Contents |
|---|---|
| `0001_init.sql` | Tables, indexes, RLS, `seed_business()`, `ensure_business()` |
| `0002_order_functions.sql` | `create_order`, `record_payment`, `refund_order`, `cancel_order` |
| `0003_closing.sql` | `record_daily_closing` |

**Apply them (easiest — SQL editor):**

1. Open your project → **SQL Editor**.
2. Paste and run each file **in order** (`0001`, then `0002`, then `0003`).

**Or with the Supabase CLI:**

```bash
npm i -g supabase
supabase link --project-ref YOUR_PROJECT_REF
supabase db push          # applies everything in supabase/migrations
```

The menu seed is driven by `seed_business()` and runs automatically via
`ensure_business()` on first login — rerunning never creates duplicates
(natural keys + `ON CONFLICT DO NOTHING`).

---

## 5. Environment variables

Copy `.env.example` → `.env.local` and fill in:

| Variable | Where to find it | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | ✅ yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon public key | ✅ yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role key | ❌ **never** — server only |

The service-role key is only used by `lib/supabase/admin.ts`, which is guarded
by `import "server-only"` so it can never be bundled into client code.

---

## 6. Features

- **New Order / POS** — category tabs + search, click-to-add, quantity ±,
  order-level % or ₹ discount, payment method, full/partial/unpaid, optional
  customer & notes, duplicate-submission protection, printable receipt.
- **Dashboard** — KPIs (gross/net sales, orders, AOV, items, expenses, est.
  profit, outstanding) and 8 charts, all driven by real records and the date
  range (Today / Yesterday / 7d / 30d / This Month / Custom).
- **Orders** — search by order no. or product; filter by date, category,
  payment method, payment status, order status; sort; detail view with itemised
  bill, price/cost snapshots, payments, refunds, notes; refund / cancel / record
  payment / reprint receipt.
- **Menu Management** — add/edit products, price, **unit cost (COGS)**, category,
  availability, add/edit categories, search & sort (incl. popularity).
- **Expenses** — full CRUD (soft-delete with audit), default categories,
  recurring flag, search/filter, charts, CSV export.
- **Analytics & Reports** — Profit & Loss statement (gross sales → discounts →
  refunds → net sales → COGS → gross profit → operating expenses → operating
  profit → outstanding), with incomplete-COGS flagging; CSV exports.
- **Daily Closing** — per-date summary incl. cash/UPI/card/other collected,
  best sellers, expense breakdown; generate + record the closing; print + CSV.
- **Settings** — business name, receipt header/footer; currency (₹) & timezone
  (Asia/Kolkata) are fixed this release.

### Financial definitions used everywhere

```
Gross Sales   = Σ line totals of valid (non-cancelled) orders, before discount/refund
Net Sales     = Gross Sales − Discounts − Refunds
COGS          = Σ (unit_cost_snapshot × qty) over valid order items
Gross Profit  = Net Sales − COGS
Operating Profit (est.) = Gross Profit − Operating Expenses
Outstanding   = Σ (net − refunds − amount paid) per valid order, floored at 0
```

Cancelled orders are excluded from all revenue. Unpaid orders **are** sales but
are **not** counted as cash collected. If any sold item has no unit cost, COGS
and profit are clearly flagged as incomplete estimates.

---

## 7. Tests

Critical business logic is covered by a pure Vitest suite (no database needed):

```bash
npm run test
```

Covers: cart totals, quantity changes, flat/percent discounts, net sales,
cancelled-order exclusion, refunds, outstanding, COGS incompleteness flagging,
no double-counting of expenses, cash-vs-sales distinction, Asia/Kolkata date
filtering, duplicate-submission guard, CSV quoting/totals, and a **seed-integrity
test** asserting the SQL menu seed exactly matches the canonical price list.

---

## 8. Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel → **New Project** → import the repo.
3. Add the three env vars from section 5 (Production + Preview).
4. Deploy. The build command is `next build` (default).
5. In Supabase → **Authentication → URL Configuration**, add your Vercel domain
   to the allowed redirect/site URLs.

---

## 9. Backups

This project does **not** ship its own backup mechanism. Use Supabase's built-in
backups: Project → **Database → Backups** (daily automatic backups on paid
plans; Point-in-Time Recovery available). For manual dumps:

```bash
supabase db dump -f backup.sql           # schema + data via CLI
# or: pg_dump "$SUPABASE_DB_URL" > backup.sql
```

---

## 10. Known limitations

- Receipt/invoice attachments are stored as a **URL** field; wiring Supabase
  Storage uploads is left as a follow-up.
- Recurring expenses store a flag/recurrence only — records are **not**
  auto-generated (by design, to stay idempotent); generate them manually.
- Staff roles exist on `profiles` (`owner`/`staff`) but a full invite flow is
  not built; the first user becomes the owner.
- Daily Closing records a snapshot and warns when a day is closed, but does not
  hard-lock historical edits — corrections remain possible and are audit-logged.
```

No Supabase project connected? The app still builds and runs; it shows a setup
screen until the keys and migrations are in place. Nothing here pretends a
remote database or deployment has been configured.
