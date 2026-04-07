# Ward Sacrament Meeting Program Builder

A full-stack web application for LDS ward clerks and bishopric members to create, manage, and publish sacrament meeting programs. Members can view published programs online and submit announcement requests.

---

## Table of Contents

1. [Features](#features)
2. [Architecture Overview](#architecture-overview)
3. [Prerequisites](#prerequisites)
4. [Azure Resource Setup](#azure-resource-setup)
5. [Database Setup](#database-setup)
6. [API Setup](#api-setup)
7. [Frontend Setup](#frontend-setup)
8. [First-Time Setup](#first-time-setup-after-deployment)
9. [Project Structure](#project-structure)
10. [Tech Stack](#tech-stack)
11. [Key Notes for Future Developers](#key-notes-for-future-developers)

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
- Google Maps links for announcement locations (real addresses only)
- Submit announcement requests
- Contact Us form
- Member unlock system to reveal contact information with a ward password

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  React/Vite SPA  (Azure App Service — Frontend)         │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS + CSRF
┌───────────────────────▼─────────────────────────────────┐
│  Node.js/Express API  (Azure App Service — API)         │
│  JWT auth · Rate limiting · CSRF protection             │
└──────┬────────────────┬────────────────┬────────────────┘
       │                │                │
  Azure SQL         Azure Blob       Azure Communication
  Database          Storage          Services (email)
  Managed Identity  (cover images)   (announcement requests
  in production                       & contact us)
  SQL auth locally
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher (v24 recommended)
- [Git](https://git-scm.com/)
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (optional but helpful)
- [VS Code](https://code.visualstudio.com/) with the **Azure App Service** extension (for deployment)
- An active **Azure subscription**
- **SQL Server Management Studio (SSMS)** for running DB scripts

---

## Azure Resource Setup

All resources should be created in the same **region** to minimize latency. `East US` or `Central US` are good choices for a US ward.

### 1. Resource Group

Create a resource group to hold all resources:

```
Name:   ward-program-rg  (or your preference)
Region: East US
```

### 2. App Service Plan

Both App Services (API and frontend) share a single App Service Plan to reduce cost.

| Setting | Value |
|---------|-------|
| Name | ward-program-plan |
| Operating System | Linux |
| Pricing tier | B1 Basic |

### 3. Azure SQL Database

1. Create a new **SQL Server** then a **SQL Database** on that server.

| Setting | Value |
|---------|-------|
| Authentication | Both SQL authentication and Microsoft Entra authentication |
| Service tier | Basic or Standard S0 |

2. **Configure Microsoft Entra authentication** — required before Managed Identity will work:
   - Go to your SQL Server → **Settings → Microsoft Entra ID**
   - Click **Set admin** and select an Entra account to be the Entra admin for the server
   - Click **Save**

3. Under **Networking**, add your current IP to the firewall rules so you can run DB scripts from your machine. Also enable **Allow Azure services and resources to access this server**.

### 4. Azure Blob Storage

Used to store ward cover images.

1. Create a new **Storage Account** (Standard, LRS redundancy).
2. Create a container named `ward-images` with **Private** access.
3. Copy the **Connection string** from Security + networking → Access keys.

### 5. Azure Communication Services

Used to send emails for announcement requests and Contact Us messages.

1. Create a new **Azure Communication Services** resource.
2. Go to **Email → Domains** and provision a free `azurecomm.net` subdomain or connect a custom domain.
3. Copy the **Connection string** from Keys.
4. Note your verified **sender email address**.

### 6. App Service — API

| Setting | Value |
|---------|-------|
| Runtime stack | Node.js 24 LTS |
| Operating System | Linux |
| App Service Plan | ward-program-plan |

After creation, go to **Settings → Configuration** and set the **Startup Command** to:
```
node server.js
```

### 7. App Service — Frontend

| Setting | Value |
|---------|-------|
| Runtime stack | Node.js 24 LTS |
| Operating System | Linux |
| App Service Plan | ward-program-plan (same plan as API) |

### 8. Managed Identity — API to SQL

#### Enable Managed Identity on the API App Service

1. Go to your **API App Service** → **Security → Identity**.
2. Under **System assigned**, toggle **Status** to **On** and click **Save**.

#### Grant the Managed Identity access to the database

> **Important**: Connect to the database in SSMS **using your Entra account** (not SQL username/password) — go to Options → Authentication → Azure Active Directory - Universal with MFA.

```sql
-- Replace 'ward-program-api' with your actual API App Service name
CREATE USER [ward-program-api] FROM EXTERNAL PROVIDER;
ALTER ROLE [ward_programs_role] ADD MEMBER [ward-program-api];
```

The API's `db.js` detects whether it's running in production (Managed Identity) or locally (SQL auth) based on whether `DB_USER` is set. Do **not** set `DB_USER` or `DB_PASSWORD` in the Azure App Service configuration.

### 9. Custom Domain (Optional)

1. Purchase a domain from your preferred registrar.
2. In each App Service → **Custom domains**, add your domain and follow the verification steps.
3. Add a free **Azure managed SSL certificate**.
4. Update your `ALLOWED_ORIGINS` and frontend `VITE_API_URL` to use the custom domain.

---

## Database Setup

Run the scripts in `dbscripts/` against your Azure SQL database using SSMS. Connect as the SQL admin user.

### Step 1 — Create the role
```
ward_programs_role.Role.sql
```

### Step 2 — Create tables (run in this order)
```
dbo.users.Table.sql
dbo.ward_settings.Table.sql
dbo.ward_leadership.Table.sql
dbo.ward_schedules.Table.sql
dbo.WardImages.Table.sql
dbo.programs.Table.sql
dbo.program_cover_blocks.Table.sql
dbo.meeting_items.Table.sql
dbo.announcements.Table.sql
dbo.announcement_requests.Table.sql
dbo.leadership_entries.Table.sql
dbo.schedules.Table.sql
dbo.audit_log.Table.sql
```

### Step 3 — Create TVP types
```
dbo.CoverBlockList.UserDefinedTableType.sql
dbo.MeetingItemList.UserDefinedTableType.sql
dbo.AnnouncementList.UserDefinedTableType.sql
dbo.LeadershipEntryList.UserDefinedTableType.sql
dbo.ScheduleEntryList.UserDefinedTableType.sql
dbo.WardLeadershipList.UserDefinedTableType.sql
dbo.WardScheduleList.UserDefinedTableType.sql
```

### Step 4 — Create stored procedures

Run all `dbo.usp_*.StoredProcedure.sql` files. Order within this group does not matter.

### Step 5 — Create a local dev SQL user

For local development only — not used in production:

```sql
CREATE USER [ward_api_user] WITH PASSWORD = 'YourStrongPassword123!';
ALTER ROLE [ward_programs_role] ADD MEMBER [ward_api_user];
```

### Step 6 — Seed the ward_settings row

The app requires exactly one row in `ward_settings` (enforced by a CHECK constraint on `id = 1`):

```sql
INSERT INTO dbo.ward_settings (id, ward_name, announcement_enabled)
VALUES (1, 'Your Ward Name', 1);
```

---

## API Setup

### Local Development Environment Variables

Create `ward-program-api/.env` — this file is gitignored and never committed.

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_SERVER` | ✅ | Azure SQL server hostname |
| `DB_NAME` | ✅ | Database name |
| `DB_USER` | Local only | SQL username. Leave unset in Azure — Managed Identity is used instead |
| `DB_PASSWORD` | Local only | SQL password. Leave unset in Azure — Managed Identity is used instead |
| `JWT_SECRET` | ✅ | Random string, minimum 32 characters. Generate with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `AZURE_STORAGE_CONNECTION_STRING` | ✅ | Full connection string from Storage Account → Access keys |
| `ACS_CONNECTION_STRING` | ✅ | Full connection string from ACS resource → Keys |
| `ACS_SENDER_ADDRESS` | ✅ | Verified sender email address |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated list of allowed frontend origins for CORS |
| `NODE_ENV` | ✅ | `development` locally, `production` in Azure |
| `PORT` | Optional | Defaults to `3001` locally. Azure sets this automatically |

Example `.env`:

```env
DB_SERVER=yourserver.database.windows.net
DB_NAME=ward_programs
DB_USER=ward_api_user
DB_PASSWORD=YourStrongPassword123!
JWT_SECRET=your-64-character-random-hex-string-here
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
ACS_CONNECTION_STRING=endpoint=https://your-acs.communication.azure.com/;accesskey=...
ACS_SENDER_ADDRESS=donotreply@yourdomain.azurecomm.net
ALLOWED_ORIGINS=http://localhost:5173
NODE_ENV=development
```

### Azure App Service Environment Variables

Set these in **Azure Portal → API App Service → Settings → Environment variables**. Do **not** set `DB_USER` or `DB_PASSWORD`.

| Variable | Description |
|----------|-------------|
| `DB_SERVER` | Azure SQL server hostname |
| `DB_NAME` | Database name |
| `JWT_SECRET` | Must match what was used to issue existing tokens — changing this invalidates all sessions |
| `AZURE_STORAGE_CONNECTION_STRING` | Full connection string from Storage Account |
| `ACS_CONNECTION_STRING` | Full connection string from ACS resource |
| `ACS_SENDER_ADDRESS` | Verified sender email address |
| `ALLOWED_ORIGINS` | All frontend origins allowed to call the API (comma-separated) |
| `NODE_ENV` | `production` |
| `WEBSITE_NODE_DEFAULT_VERSION` | `~24` |

Example `ALLOWED_ORIGINS`:
```
https://ward.org,https://www.ward.org,https://api.ward.org,https://ward-web.azurewebsites.net,https://ward-api.azurewebsites.net
```

### API Local Development

```bash
cd ward-program-api
npm install
npm start
# or with auto-restart:
npx nodemon server.js
```

### Deploy API to Azure

1. In VS Code, open the **Azure App Service** extension.
2. Right-click your API App Service and choose **Deploy to Web App**.
3. Select the `ward-program-api` folder.

The `.deployignore` file excludes `.env`, `node_modules/`, and other dev artifacts.

---

## Frontend Setup

### Local Development Environment Variables

Create `ward-program-app/.env.local`:

```env
VITE_DEV_PROXY_TARGET=http://localhost:3001
```

When running locally, `VITE_API_URL` does not need to be set — the Vite dev server proxies all `/api` calls to your local API automatically.

### Production Environment Variables

Create `ward-program-app/.env.production` **before building**. This is baked into the compiled bundle at build time — it cannot be changed via Azure Portal settings after building.

```env
VITE_API_URL=https://api.ward.org/api
```

### Frontend Local Development

```bash
cd ward-program-app
npm install
npm run dev
```

### Deploy Frontend to Azure

1. Build the production bundle:
   ```bash
   cd ward-program-app
   npm run build
   ```

2. Ensure `ward-program-app/.vscode/settings.json` contains:
   ```json
   {
     "appService.deploySubpath": "dist"
   }
   ```
   This tells the VS Code extension to deploy only the `dist/` folder.

3. In VS Code, right-click your frontend App Service and choose **Deploy to Web App**.

> The `public/web.config` file is copied to `dist/` during build. It configures SPA routing so that refreshing the page or navigating directly to a URL like `/admin` returns the app instead of a 404.

---

## First-Time Setup (After Deployment)

### Creating the First Admin User

**Step 1 — Generate a bcrypt hash**

Run this in the `ward-program-api` folder:

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YourPasswordHere', 12).then(h => console.log(h));"
```

Copy the output hash — it will look like `$2b$12$...`

**Step 2 — Insert the user**

Run this in SSMS against your database:

```sql
INSERT INTO dbo.users (name, email, password_hash, role, is_active)
VALUES (
    'Bishop Smith',
    'bishop@example.com',
    '$2b$12$YOUR_HASH_HERE',
    'bishopric',
    1
);
```

**Step 3 — Log in and continue setup**

1. Go to `/login` and sign in with the credentials you just created
2. **Set ward name and stake name** — Ward Defaults → Settings
3. **Set member view password** — Ward Defaults → Settings → Member View Password
4. **Add ward leadership** — Ward Defaults → Ward Leadership
5. **Add meeting schedules** — Ward Defaults → Meeting Schedules
6. **Configure announcement requests** — Ward Defaults → Settings → Announcement Requests (add recipient emails)
7. **Configure Contact Us** — Ward Defaults → Settings → Contact Us (add recipient emails)
8. **Upload cover images** — Image Library
9. **Create your first program** — Program Dashboard → Create New Program
10. **Add additional users** — Manage Users (accessible from the nav menu)

---

## Project Structure

```
ward-program/
├── dbscripts/                              # All SQL scripts — run these to set up the DB
│   ├── dbo.*.Table.sql                     # Table definitions
│   ├── dbo.*.UserDefinedTableType.sql      # TVP type definitions
│   ├── dbo.usp_*.StoredProcedure.sql       # All stored procedures
│   └── ward_programs_role.Role.sql         # Database role
│
├── ward-program-api/                       # Node.js/Express REST API
│   ├── middleware/
│   │   ├── auth.js                         # JWT token verification
│   │   ├── optionalAuth.js                 # Auth that doesn't block unauthenticated requests
│   │   └── requireRole.js                  # Role-based access control
│   ├── routes/
│   │   ├── announcements.js                # Announcement requests (public submit + admin manage)
│   │   ├── auth.js                         # Login, logout, CSRF token, ward unlock
│   │   ├── contact.js                      # Contact Us (public submit)
│   │   ├── images.js                       # Image library (upload, serve, delete)
│   │   ├── programs.js                     # Full program CRUD + publish/archive
│   │   ├── proxy.js                        # Proxies external hymn image URLs
│   │   ├── users.js                        # User management
│   │   └── ward.js                         # Ward settings, leadership, schedules
│   ├── services/
│   │   └── emailService.js                 # Sends emails via Azure Communication Services
│   ├── utils/
│   │   └── blob.js                         # Azure Blob Storage helpers
│   ├── db.js                               # SQL connection pool (Managed Identity in prod)
│   └── server.js                           # Express app — middleware, routes, rate limiting
│
└── ward-program-app/                       # React/Vite frontend
    ├── public/
    │   ├── favicon.ico
    │   └── web.config                      # IIS SPA routing — required for Azure App Service
    └── src/
        ├── components/
        │   ├── AnnouncementRow.jsx          # Collapsible announcement editor row
        │   ├── CoverBlockEditor.jsx         # Cover block editor (image, quote, welcome, etc.)
        │   ├── CoverPreviewBlock.jsx        # Cover block preview renderer
        │   ├── DraggableList.jsx            # Drag-and-drop list wrapper (@dnd-kit)
        │   ├── ImportAnnouncementsModal.jsx # Import pending requests into a program
        │   ├── MeetingItemRow.jsx           # Collapsible meeting item editor row
        │   ├── PanelHealthBar.jsx           # PDF overflow indicator bar
        │   ├── StepEditorPanel.jsx          # 5-step program builder editor
        │   ├── StepPreviewPanel.jsx         # Live PDF preview panel
        │   ├── WardDisclaimer.jsx           # Reusable disclaimer footer component
        │   └── ...
        ├── constants/                       # App-wide constants (cover block types, builder steps)
        ├── context/                         # React context providers (Auth, Program, User, Error)
        ├── data/                            # Hymn and children's hymn data (local JSON)
        ├── hooks/
        │   ├── useDarkMode.jsx              # Dark mode toggle with localStorage persistence
        │   ├── useProgramForm.js            # All program builder state and save/publish logic
        │   └── useWardUnlock.js             # Member unlock session management
        ├── pages/
        │   ├── AdminDashboard.jsx           # Program list and management
        │   ├── AnnouncementRequests.jsx     # Admin view of member announcement requests
        │   ├── ImageLibrary.jsx             # Cover image management
        │   ├── ProgramBuilder.jsx           # Admin program builder (wraps StepEditorPanel)
        │   ├── ProgramHome.jsx              # Public-facing program viewer
        │   ├── ProgramViewer.jsx            # Admin program review + PDF generation
        │   ├── UserManager.jsx              # User account management
        │   └── WardDefaults.jsx             # Ward settings, leadership, schedules
        └── utils/
            ├── api.js                       # Fetch wrapper with CSRF token handling
            ├── formatters.js                # Date/time, phone, maps, calendar link formatters
            ├── panelHealth.js               # PDF overflow calculation engine
            ├── PDFGenerator.js              # Client-side PDF generation (jsPDF)
            └── printSettingsUtils.js        # Font size presets and line height helpers
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, @dnd-kit (drag and drop) |
| PDF Generation | jsPDF |
| API | Node.js, Express |
| Authentication | JWT (HttpOnly cookie), bcrypt, CSRF double-submit cookie pattern |
| Database | Azure SQL Server, mssql/tedious driver |
| DB Auth (production) | Azure Managed Identity (no passwords stored) |
| DB Auth (local dev) | SQL username + password |
| Image Storage | Azure Blob Storage |
| Email | Azure Communication Services |
| Hosting | Azure App Service (Linux, Node.js, shared B1 plan) |
| Deployment | VS Code Azure App Service extension |

---

## Key Design Decisions

- **Times stored as `nvarchar(8)`** — Avoids the `tedious` driver UTC timezone conversion bug that causes HH:MM drift when using SQL `time` columns. Stored as `HH:MM:SS` strings, sliced to `HH:MM` on read.

- **All DB writes go through stored procedures with TVPs** — Never raw SQL from API routes. If you need a new operation, add a stored proc and script it in `dbscripts/`. TVPs (Table-Valued Parameters) are used for all child row inserts. If you add a column to a table used by a TVP, you must update: the table, the TVP type (drop and recreate — SQL Server doesn't allow `ALTER TYPE`), and the stored proc that uses it.

- **JWT in HttpOnly cookie + CSRF double-submit** — Secure auth without exposing tokens to JavaScript.

- **Panel health engine** — Pure JavaScript calculation in `panelHealth.js` that mirrors the actual PDF rendering math in `PDFGenerator.js`. All measurements must be kept in sync between both files. When adding new meeting item types or announcement fields, update both files.

- **Announcement requests saved to DB + email** — Requests persist even if email fails. Admins can import directly into programs. Requests are marked "added" only after a successful program save — never optimistically.

- **`leadership_public` hardcoded to 0** — Leadership contact info is never shown on the public program page. This is enforced in all write operations.

- **PDF generated entirely client-side** — jsPDF runs in the browser. No temporary files are created on the server. No server round-trip for PDF generation.

- **`ward_settings` enforces exactly one row** — via a `CHECK CONSTRAINT` on `id = 1`. Use `usp_SaveWardSettings` to update it — never insert a second row.

- **Vite environment variables are baked at build time** — `VITE_*` variables are compiled into the JS bundle. Changing `VITE_API_URL` requires a rebuild and redeploy. They cannot be changed via Azure Portal settings after building.

- **The API uses `trust proxy: 1`** — So Express correctly reads the client IP from `X-Forwarded-For` set by Azure's load balancer. Rate limiting depends on this being set correctly.

- **Location-based maps links** — Announcement locations only show as clickable Google Maps links when the location looks like a real street address (contains a street number or zip code). Generic terms like "Chapel" or "Stake Center" display as plain text.

---

## Disclaimer

This application is not an official product of The Church of Jesus Christ of Latter-day Saints. It is an independent tool created to assist individual wards with sacrament meeting programs and is not sponsored, endorsed, or officially affiliated with the Church.
