# Helloji — Booking Desk CRM

A modern, fast, full-featured Travel Agency Booking & CRM Desk built with React 19, TypeScript, TanStack Start, and Tailwind CSS v4.

Helloji Booking Desk streamlines agency operations across the entire inquiry-to-booking lifecycle: handling customer leads, managing flight/hotel/package/visa/insurance bookings, dispatching customer-facing vouchers and PDF brochures, tracking accounts and receivables, managing team permissions, and auditing activity.

---

## Tech Stack

- **Framework**: [React 19](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/)
- **Routing & SSR**: [TanStack Start](https://tanstack.com/start) & [TanStack Router](https://tanstack.com/router) (file-based routing)
- **Server Engine**: [Nitro](https://nitro.unjs.io/) & [Vite](https://vitejs.dev/)
- **State & Data Fetching**: [TanStack Query v5](https://tanstack.com/query)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with custom OKLCH color tokens, dark mode, and responsive layout
- **UI Primitives**: [Radix UI](https://www.radix-ui.com/) accessible primitives
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts & Data Viz**: [Recharts](https://recharts.org/)
- **Notifications**: [Sonner](https://sonner.emilkowal.ski/) toast notifications
- **Document Generation**: [jsPDF](https://github.com/parallax/jsPDF) for client-side voucher PDF generation and print stylesheets

---

## Feature Overview & Status

| Module | Features & Capabilities | Status |
| :--- | :--- | :--- |
| **Authentication** | Branded login page, demo credentials, protected dashboard routing | Complete |
| **Dashboard** | KPI metric cards, revenue/inquiry trends (Recharts), urgent task alerts, recent booking feeds | Complete |
| **Queries Engine** | New query intake (Hotel, Flight, Package, Visa, Insurance), filterable table, query detail view, status updates | Complete |
| **Booking Desk** | All bookings table, status badges, payment state indicators, voucher generation actions | Complete |
| **Booking Calendar** | Visual operational calendar with month/week views and booked-only filtering | Complete |
| **Stationery & Vouchers** | Dedicated print-ready vouchers (`/voucher`) for all 5 product types, auto-print triggers, jsPDF export, WhatsApp/Email share links | Complete |
| **Hotel Directory** | Hotel supplier repository with room categories, contact details, ratings, and soft-delete | Complete |
| **Accounts & Finance** | Unpaid and paid transaction tracking, invoice number assignment, and payment remarks | Complete |
| **Visa Customers** | Customer list with passport/visa status tracking and document attachments | Complete |
| **Roles & Permissions** | Dedicated roles list, custom role creator with granular matrix across 8 functional modules | Complete |
| **User Management** | Team member directory, role assignment, direct permission overrides, account active/inactive toggles | Complete |
| **Split Recycle Bins** | Separate tabs for Bookings, Hotels, and Customers with row-level Restore and Force Delete confirmations | Complete |
| **Backend & DB** | REST/GraphQL API integration, cloud database, persistent auth session | Pending Backend |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 20 or higher recommended)
- `npm` (or `bun` / `pnpm`)

### Installation

1. Clone the repository:
   ```sh
   git clone <repository-url>
   cd helloji-booking-desk
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Start the local development server:
   ```sh
   npm run dev
   ```
   The application will be accessible at `http://localhost:8080`.

4. Build for production:
   ```sh
   npm run build
   ```

5. Preview production build:
   ```sh
   npm run preview
   ```

---

## Project Structure

```
├── public/                # Static assets, brand airplane favicons, web manifest
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── layout/        # DashboardShell, Sidebar, Header, Navigation
│   │   ├── ui/            # Radix UI primitives & styled components
│   │   └── vouchers/      # Brochure layout, voucher templates & PDF exporter
│   ├── lib/               # Utility functions, stores, and mock data
│   │   ├── admin-store.ts # Roles & users state store
│   │   ├── mock-data.ts   # Realistic seed data for queries, bookings, hotels
│   │   ├── pdf-export.ts  # jsPDF document generator
│   │   └── utils.ts       # Tailwind class mergers and formatters
│   ├── routes/            # File-based routes (TanStack Start / Router)
│   │   ├── __root.tsx     # Root document layout, metadata, and font definitions
│   │   ├── index.tsx      # Login page
│   │   ├── dashboard.tsx  # Dashboard overview
│   │   ├── queries.tsx    # Query intake & management
│   │   ├── bookings.tsx   # Bookings list
│   │   ├── calendar.tsx   # Operational calendar
│   │   ├── voucher.tsx    # Customer voucher & print page
│   │   ├── hotels.tsx     # Hotel directory
│   │   ├── accounts.tsx   # Accounts & invoices
│   │   ├── customers.tsx  # Customer & visa documents
│   │   ├── roles.tsx      # Dedicated roles & permissions screen
│   │   ├── users.tsx      # User management
│   │   └── trash.tsx      # Split recycle bins
│   ├── styles.css         # Tailwind CSS v4 styles & OKLCH color theme
│   └── router.tsx         # TanStack Router configuration
├── vite.config.ts         # Vite build configuration with TanStack Start & Nitro
└── package.json           # Project manifest and dependencies
```

---

## Backend API (Auth & User Management)

The REST API lives in the `server/` directory — a standalone Express + MongoDB application, separate from the frontend's TanStack Start/Nitro server.

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [MongoDB](https://www.mongodb.com/) — local instance or Atlas connection string

### Setup

1. **Create your environment file** from the template:
   ```sh
   cd server
   cp .env.example .env
   ```

2. **Edit `server/.env`** — set at minimum:
   | Variable | Purpose |
   | :--- | :--- |
   | `MONGODB_URI` | MongoDB connection string |
   | `JWT_SECRET` | Long random string for signing tokens |
   | `SEED_ADMIN_EMAIL` | Bootstrap admin email |
   | `SEED_ADMIN_PHONE` | Bootstrap admin phone |
   | `SEED_ADMIN_PASSWORD` | Initial admin password (change after first login!) |
   | `CORS_ORIGIN` | Frontend origin (default `http://localhost:8080`) |

3. **Install dependencies and start:**
   ```sh
   cd server
   npm install
   npm run dev
   ```
   The API will be available at `http://localhost:5000/api`.

4. **First login** — use the seeded admin credentials to sign in, then **change the default password immediately** via the Profile → Change Password screen.

### API Endpoints

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Login with email/phone + password |
| `POST` | `/api/auth/change-password` | JWT | Change own password |
| `GET` | `/api/auth/me` | JWT | Get current user profile |
| `POST` | `/api/admin/users` | Admin | Create a new user |
| `GET` | `/api/admin/users` | Admin | List all users |
| `PUT` | `/api/admin/users/:id` | Admin | Update user fields (no password) |
| `DELETE` | `/api/admin/users/:id` | Admin | Delete user |
| `GET` | `/api/health` | Public | Health check |

---

## License

Private and proprietary. All rights reserved.
