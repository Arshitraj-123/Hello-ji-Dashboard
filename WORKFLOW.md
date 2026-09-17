# HelloJi Travel Booking Desk CRM — Complete Workflow & Architecture Guide

This document maps out the entire system architecture, module interconnections, and the complete business data flow for the HelloJi Travel Booking Desk CRM.

---

## 1. System Architecture & Module Interconnection Flowchart

```mermaid
flowchart TD
    %% Styling
    classDef auth fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#fff
    classDef core fill:#0f172a,stroke:#60a5fa,stroke-width:2px,color:#fff
    classDef action fill:#047857,stroke:#34d399,stroke-width:2px,color:#fff
    classDef finance fill:#7c2d12,stroke:#f97316,stroke-width:2px,color:#fff
    classDef output fill:#4c1d95,stroke:#a78bfa,stroke-width:2px,color:#fff
    classDef audit fill:#374151,stroke:#9ca3af,stroke-width:1px,color:#fff

    subgraph AUTH["1. Authentication & Security"]
        LOGIN["User Login (/auth/login)"]:::auth
        JWT["JWT Session & Permissions Token"]:::auth
        RBAC{"Role Check (Admin vs. Agent)"}:::auth
    end

    subgraph CORE_PIPELINE["2. Enquiry & Lead Lifecycle"]
        NEW_QUERY["New Enquiry Intake (/queries/new)"]:::core
        GEN_ID["Auto-Generate Reference (e.g. HHL0001)"]:::core
        QUERY_PIPELINE["Pipeline Management (/queries)"]:::core
        STAGES["Stage: New -> In Progress -> Quoted"]:::core
        CONVERT{"Convert to Booking?"}:::core
        ABORT["Aborted / Lost (/aborted)"]:::core
    end

    subgraph BOOKINGS["3. Bookings Desk & Operations"]
        BOOKING_RECORD["Confirmed Booking (/bookings)"]:::core
        CALENDAR["Operations Calendar (/calendar)"]:::core
        DOCS["Guest Document Repository"]:::core
    end

    subgraph VOUCHERS["4. Voucher & Brochure Engine"]
        VOUCHER_MODAL["Voucher Studio (/bookings/:id/voucher)"]:::output
        LAYOUT_SWITCH["Type: Hotel | Package | Ticket | Visa | Insurance"]:::output
        PDF_GEN["Puppeteer Headless PDF Generation"]:::output
        DELIVERY["Delivery: Email (SMTP) & WhatsApp (Pinbot)"]:::output
    end

    subgraph ACCOUNTS["5. Accounts & Financial Ledger"]
        ACCOUNTS_LEDGER["Accounts Ledger (/accounts)"]:::finance
        UNPAID["Unpaid / Partial Receivables"]:::finance
        PAID["Paid Settlements & Margin Tracking"]:::finance
    end

    subgraph REGISTRIES["6. Master Registries"]
        CUSTOMERS["Customer Directory (/customers)"]:::action
        HOTELS["Hotel & Supplier Registry (/hotels)"]:::action
    end

    subgraph GOVERNANCE["7. Governance & System Analytics"]
        DASHBOARD["Dashboard Analytics (/dashboard)"]:::audit
        ACTIVITY_LOGS["Audit Trails (/logs)"]:::audit
        TRASH["Recycle Bin (/trash)"]:::audit
        USER_MGMT["User & Role Permissions (/users, /roles)"]:::audit
    end

    %% Connections
    LOGIN --> JWT --> RBAC
    RBAC -->|Authorized| DASHBOARD
    RBAC -->|Filter by Assigned Agent| QUERY_PIPELINE

    NEW_QUERY --> GEN_ID --> QUERY_PIPELINE
    NEW_QUERY -.->|Auto-Create/Link| CUSTOMERS
    NEW_QUERY -.->|Select Supplier| HOTELS

    QUERY_PIPELINE --> STAGES
    STAGES -->|Deal Closed| CONVERT
    STAGES -->|Client Dropped| ABORT

    CONVERT -->|Generate Booking| BOOKING_RECORD
    BOOKING_RECORD --> CALENDAR
    BOOKING_RECORD --> DOCS
    BOOKING_RECORD --> VOUCHER_MODAL
    BOOKING_RECORD --> ACCOUNTS_LEDGER

    VOUCHER_MODAL --> LAYOUT_SWITCH
    LAYOUT_SWITCH --> PDF_GEN
    LAYOUT_SWITCH --> DELIVERY

    ACCOUNTS_LEDGER --> UNPAID
    ACCOUNTS_LEDGER --> PAID

    %% Global Audit and Feedback
    NEW_QUERY -.->|Log Action| ACTIVITY_LOGS
    CONVERT -.->|Log Conversion| ACTIVITY_LOGS
    VOUCHER_MODAL -.->|Log Voucher Event| ACTIVITY_LOGS
    BOOKING_RECORD -.->|Feeds KPI Metrics| DASHBOARD
```

---

## 2. Detailed Module Breakdown & Interconnections

### Module 1: Authentication & Role-Based Access Control (RBAC)
- **Role Isolation:**
  - **Super Admin:** Complete visibility across all team members, financial margins, role configurations, and audit logs.
  - **Agent / Operator:** Scoped strictly to enquiries and bookings assigned to their ID. Protected from viewing unassigned leads or unauthorized financial data.
- **Interconnection:**
  - The JWT token contains the user's role and granular permissions matrix (e.g. `queries:read`, `bookings:create`, `accounts:manage`). Every backend API route validates these claims before returning data.

---

### Module 2: Dashboard & Business Intelligence (`/dashboard`)
- **Key Metrics:** Real-time KPI counters for *New Enquiries*, *Active Bookings*, *Registered Customers*, and *Aborted Leads*.
- **Visual Trends:** Monthly lead volume line charts and revenue performance bar charts.
- **Interconnection:**
  - Pulls aggregated metrics directly from the `Booking` and `Customer` collections.
  - Acts as the central navigation launchpad to all operational sub-modules.

---

### Module 3: Enquiry & Lead Pipeline (`/queries` & `/queries/new`)
- **Intake Flow:**
  - Capture guest name, phone, email, destination, travel dates, passenger counts, and hotel preferences.
  - Generates standardized custom identifier formats (e.g., `HHL0001`).
- **Customer Auto-Linking:**
  - When an enquiry is created, the system checks if the customer's phone number exists in the database. If not, a new profile is automatically created in the **Customer Directory**.
- **Conversion Flow:**
  - With a single click (*Convert to Booking*), the enquiry is migrated to the active Bookings desk, preserving all notes, dates, and hotel details.

---

### Module 4: Bookings Operations Desk (`/bookings` & `/calendar`)
- **Management:** View confirmed travel dates, booking statuses (*Confirmed*, *Voucher Issued*, *In Transit*, *Completed*, *Cancelled*).
- **Operations Calendar (`/calendar`):** Month/week schedule view displaying check-ins, check-outs, and flight dates for active guests.
- **Interconnection:**
  - Direct bridge between the sales front (Queries) and fulfillment (Vouchers & Accounts).

---

### Module 5: Voucher & Brochure Studio (`/bookings/:id/voucher`)
- **Multi-Product Engine:** Supports 6 layout templates:
  1. **Hotel Voucher** (check-in/out, meal plan, room category, confirmation numbers)
  2. **Tour Package Brochure** (day-wise itinerary, inclusions, exclusions)
  3. **Flight / Transport Ticket** (departure/arrival, PNR, baggage)
  4. **Visa Document** (visa category, validity, nationality)
  5. **Travel Insurance** (policy numbers, emergency coverage)
  6. **Product Brochure** (general travel offerings)
- **Branding & Presentation:**
  - Official **HELLO Ji** and **Incredible India** logos and header badges.
  - *With Header* toggle enables downloading on plain paper or on pre-printed agency stationery.
- **Delivery Engine:**
  - **PDF Export:** Powered by server-side headless Chromium (Puppeteer) with high-fidelity client-side html2canvas fallback.
  - **Email & WhatsApp:** Direct client dispatch with structured 503 safeguards if third-party credentials are not configured.

---

### Module 6: Accounts & Financial Ledger (`/accounts`)
- **Split Receivables:**
  - **Unpaid / Partial Ledger:** Tracks outstanding balances, payment due dates, and client follow-ups.
  - **Paid Ledger:** Reconciles fully settled payments and reports realized profit margins.
- **Interconnection:**
  - Tightly coupled to every booking: updates billing state when bookings are modified.

---

### Module 7: Master Registries (`/customers` & `/hotels`)
- **Customer Directory:** Stores traveller history, passport copies, visa documents, and past booking records.
- **Hotel & Supplier Directory:** Stores contracted supplier contacts, star ratings, amenities, and location master data.
- **Interconnection:**
  - Supplies dropdown data to enquiries and bookings, preventing repetitive manual data entry.

---

### Module 8: Audit, Governance & Recovery (`/logs` & `/trash`)
- **Activity Logs:** Immutable compliance trail recording who performed which action (*User*, *Action*, *Target Entity*, *Timestamp*, *IP*).
- **Recycle Bin (`/trash`):** Two-tier deletion with soft-delete recovery protection to prevent accidental data loss.
