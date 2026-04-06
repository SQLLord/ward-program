# Ward Sacrament Meeting Program Builder

A full-stack web application for LDS ward clerks and bishopric members to create, manage, and publish sacrament meeting programs. Members can view published programs online and submit announcement requests.

---

## Features

### For Administrators (Bishopric / Editors)
- **5-Step Program Builder** — Cover, Announcements, Meeting Order, Leadership & Schedules, Publish
- **Live PDF Preview** — Panel health engine detects overflow before publishing
- **PDF Generation** — Landscape letter format, two-column layout, per-panel font size control
- **Cover Block System** — Date, image, quote, welcome text, and custom text blocks with drag-to-reorder
- **Image Library** — Upload and manage cover images via Azure Blob Storage
- **Announcement Requests** — Members submit requests from the public page; admins import directly into programs
- **Contact Us** — Members can send messages to configured ward email addresses
- **Program Dashboard** — Publish, unpublish, archive, duplicate, and delete programs
- **Conflict Detection** — Warns when publishing a program on a date that already has a published program
- **Ward Defaults** — Shared leadership and schedule entries reused across programs
- **Dark Mode** — Full dark mode support throughout

### For Members (Public)
- View published programs by date with Sunday quick-jump buttons
- Swipe between multiple programs for the same day
- Google Calendar and Apple/Outlook (.ics) calendar links for announcements
- Google Maps links for announcement locations
- Submit announcement requests
- Contact Us form
- Member unlock system to reveal contact information with a ward password

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | Azure SQL (SQL Server) |
| File Storage | Azure Blob Storage |
| Email | Azure Communication Services |
| Auth | JWT (HttpOnly cookie) + CSRF double-submit |
| Hosting | Azure App Service (B1 shared plan) |

---

## Project Structure

```
ward-program/
├── ward-program-app/          # React/Vite frontend
│   └── src/
│       ├── components/        # Reusable UI components
│       ├── context/           # React context (Auth, Program, User, Error)
│       ├── hooks/             # Custom hooks (useProgramForm, useWardUnlock, etc.)
│       ├── pages/             # Page components
│       └── utils/             # API client, formatters, PDF generator, panel health
│
└── ward-program-api/          # Express API
    ├── middleware/            # Auth, CSRF, role checks
    ├── routes/                # API route handlers
    ├── services/              # Email service (ACS)
    └── utils/                 # Azure Blob Storage helpers
```

---

## Database Schema

### Core Tables
| Table | Purpose |
|---|---|
| `programs` | Program header — date, status, print settings |
| `program_cover_blocks` | Cover layout blocks (date, image, quote, welcome, custom) |
| `meeting_items` | Ordered meeting items (hymns, prayers, speakers, etc.) |
| `announcements` | Program announcements with date/time/location |
| `announcement_requests` | Member-submitted announcement requests |
| `leadership_entries` | Per-program leadership overrides |
| `schedules` | Per-program schedule overrides |
| `ward_settings` | Singleton row — ward name, passwords, email config |
| `ward_leadership` | Default ward leadership |
| `ward_schedules` | Default ward meeting schedules |
| `WardImages` | Image library metadata |
| `users` | Admin users with role-based access |
| `audit_log` | Publish/unpublish audit trail |

### User Roles
| Role | Permissions |
|---|---|
| `bishopric` | Full access including user management and ward settings |
| `editor` | Create/edit programs, manage announcements, image library |

---

## Local Development Setup

### Prerequisites
- Node.js 20+
- SQL Server (local) or Azure SQL
- Azure Storage Account (optional for local — images won't work without it)
- Azure Communication Services (optional for local — emails log to console)

### 1. Clone the repository

```bash
git clone https://github.com/your-org/ward-program.git
cd ward-program
```

### 2. API setup

```bash
cd ward-program-api
npm install
```

Create `.env` in `ward-program-api/`:

```env
DB_SERVER=localhost
DB_NAME=WardPrograms
DB_USER=your_sql_user
DB_PASSWORD=your_sql_password
JWT_SECRET=your_jwt_secret_min_32_chars
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
ACS_CONNECTION_STRING=endpoint=https://...
ACS_SENDER_ADDRESS=donotreply@yourdomain.com
ALLOWED_ORIGINS=http://localhost:5173
NODE_ENV=development
```

> **Note:** `DB_USER` and `DB_PASSWORD` are only used locally. Azure production uses Managed Identity — no credentials needed.

Start the API:

```bash
npm start
# or for development with auto-restart:
npx nodemon server.js
```

### 3. Frontend setup

```bash
cd ward-program-app
npm install
```

Create `.env.local` in `ward-program-app/`:

```env
VITE_DEV_PROXY_TARGET=http://localhost:3001
```

Start the dev server:

```bash
npm run dev
```

### 4. Database setup

Run the SQL scripts in `ward-program-api/sql/` against your local SQL Server instance to create all tables, stored procedures, TVP types, and seed data.

---

## Azure Deployment

### Architecture

```
ward.org (DNS)
├── ward-web.azurewebsites.net   — Frontend (React/Vite build)
└── ward-api.azurewebsites.net   — API (Node/Express)
    ├── Azure SQL Database
    ├── Azure Blob Storage (images)
    └── Azure Communication Services (email)
```

### App Service Plan
Both apps share a single B1 App Service Plan to minimize cost.

### Managed Identity
The API uses Azure Managed Identity to connect to Azure SQL in production — no database credentials in environment variables.

```sql
-- Grant access to the API's managed identity:
CREATE USER [ward-api] FROM EXTERNAL PROVIDER;
ALTER ROLE ward_programs_role ADD MEMBER [ward-api];
```

### Environment Variables (Azure App Service — API)

Set these in **Configuration → Application Settings**:

| Variable | Description |
|---|---|
| `DB_SERVER` | Azure SQL server hostname |
| `DB_NAME` | Database name |
| `JWT_SECRET` | Random string, min 32 characters |
| `AZURE_STORAGE_CONNECTION_STRING` | Full connection string from Azure Storage |
| `ACS_CONNECTION_STRING` | Azure Communication Services connection string |
| `ACS_SENDER_ADDRESS` | Verified sender email address |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |
| `NODE_ENV` | `production` |
| `WEBSITE_NODE_DEFAULT_VERSION` | `~24` |

Example `ALLOWED_ORIGINS`:
```
https://ward.org,https://www.ward.org,https://api.ward.org,https://ward-web.azurewebsites.net,https://ward-api.azurewebsites.net
```

### Frontend Build & Deploy

```bash
cd ward-program-app
npm run build
```

Then deploy the `dist/` folder to the frontend App Service via VS Code Azure extension or Azure CLI.

Create `.env.production` in `ward-program-app/` before building:

```env
VITE_API_URL=https://api.ward.org/api
```

### API Deploy

Deploy `ward-program-api/` to the API App Service via VS Code Azure extension.

The `.deployignore` file excludes `.env`, `node_modules/`, and other dev artifacts from deployment.

---

## First-Time Setup (After Deployment)

1. **Create first admin user** — Use the SQL script to insert the first `bishopric` user with a bcrypt-hashed password
2. **Log in** at `/login`
3. **Set ward name and stake name** — Ward Defaults → Settings
4. **Set member view password** — Ward Defaults → Settings → Member View Password
5. **Add ward leadership** — Ward Defaults → Ward Leadership
6. **Add meeting schedules** — Ward Defaults → Meeting Schedules
7. **Configure announcement requests** — Ward Defaults → Settings → Announcement Requests (add recipient emails)
8. **Configure Contact Us** — Ward Defaults → Settings → Contact Us (add recipient emails)
9. **Upload cover images** — Image Library
10. **Create your first program** — Program Dashboard → Create New Program

---

## Key Design Decisions

- **Times stored as `nvarchar(8)`** — Avoids the `tedious` driver UTC timezone conversion bug that causes HH:MM drift when using SQL `time` columns
- **All DB writes via stored procedures with TVPs** — Consistent, atomic saves with proper type enforcement
- **JWT in HttpOnly cookie + CSRF double-submit** — Secure auth without exposing tokens to JavaScript
- **Panel health engine** — Pure JavaScript calculation that mirrors PDF layout math, preventing overflow before publishing
- **Announcement requests saved to DB + email** — Requests persist even if email fails; admins can import directly into programs after a successful save
- **`leadership_public` hardcoded to 0** — Leadership contact info never shown on the public program page

---

## Disclaimer

This application is not an official product of The Church of Jesus Christ of Latter-day Saints. It is an independent tool created to assist individual wards with sacrament meeting programs and is not sponsored, endorsed, or officially affiliated with the Church.