# Ward Sacrament Meeting Program Builder

A full-stack web application for creating, managing, and publishing LDS sacrament meeting programs. Built with React/Vite (frontend), Node.js/Express (API), and Azure SQL Database.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Azure Resource Setup](#azure-resource-setup)
   - [Resource Group](#1-resource-group)
   - [App Service Plan](#2-app-service-plan)
   - [Azure SQL Database](#3-azure-sql-database)
   - [Azure Blob Storage](#4-azure-blob-storage)
   - [Azure Communication Services](#5-azure-communication-services)
   - [App Service — API](#6-app-service--api)
   - [App Service — Frontend](#7-app-service--frontend)
   - [Managed Identity — API to SQL](#8-managed-identity--api-to-sql)
   - [Custom Domain (Optional)](#9-custom-domain-optional)
4. [Database Setup](#database-setup)
5. [API Setup](#api-setup)
   - [Local Development Environment Variables](#local-development-environment-variables)
   - [Azure App Service Environment Variables](#azure-app-service-environment-variables)
   - [Local Development](#api-local-development)
   - [Deploy to Azure](#deploy-api-to-azure)
6. [Frontend Setup](#frontend-setup)
   - [Local Development Environment Variables](#frontend-local-development-environment-variables)
   - [Azure App Service Environment Variables](#frontend-azure-app-service-environment-variables)
   - [Local Development](#frontend-local-development)
   - [Deploy to Azure](#deploy-frontend-to-azure)
7. [First-Run Configuration](#first-run-configuration)
8. [Project Structure](#project-structure)
9. [Tech Stack](#tech-stack)
10. [Key Notes for Future Developers](#key-notes-for-future-developers)

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
  Managed Identity  (cover images)   (announcement
  in production                       requests)
  SQL auth locally
```

---

## Prerequisites

Install these tools before starting:

- [Node.js](https://nodejs.org/) v18 or higher (v24 recommended)
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

1. In the Azure Portal, search for **App Service Plan** and create one.
2. Recommended settings:

| Setting | Value |
|---------|-------|
| Resource Group | ward-program-rg |
| Name | ward-program-plan |
| Operating System | Linux |
| Region | Same as resource group |
| Pricing tier | B1 Basic (sufficient for a ward) |

> **Note**: Both App Services created in steps 6 and 7 will be assigned to this plan. You do not need to create a separate plan for each.

### 3. Azure SQL Database

1. In the Azure Portal, create a new **SQL Server** then a **SQL Database** on that server.
2. Recommended settings:

| Setting | Value |
|---------|-------|
| Server name | ward-programs-sql (becomes `ward-programs-sql.database.windows.net`) |
| Authentication | Both SQL authentication and Microsoft Entra authentication |
| Database name | ward_programs |
| Service tier | Basic or Standard S0 |

3. **Configure Microsoft Entra authentication** — this is required before Managed Identity will work:
   - Go to your SQL Server → **Settings → Microsoft Entra ID**
   - Click **Set admin** and select an Entra account (a user or group from your Azure AD tenant) to be the Entra admin for the server
   - Click **Save**
   - This binds the SQL Server to your Entra tenant and enables `FROM EXTERNAL PROVIDER` user creation

4. Under **Networking**, add your current IP to the firewall rules so you can run DB scripts from your machine. Also enable **Allow Azure services and resources to access this server** so the App Service can connect.

5. Note the **server name**, **database name**, **SQL admin username**, and **SQL admin password** — needed for local development.

### 4. Azure Blob Storage

Used to store ward cover images uploaded through the Image Library.

1. Create a new **Storage Account**.
2. Recommended settings:

| Setting | Value |
|---------|-------|
| Name | wardprogramstorage (must be globally unique) |
| Performance | Standard |
| Redundancy | LRS (Locally Redundant Storage) |

3. After creation, go to **Data storage → Containers** and create a container:

| Setting | Value |
|---------|-------|
| Name | ward-images |
| Public access level | Private |

4. Go to **Security + networking → Access keys** and copy **Connection string** — needed for the API environment variables.

### 5. Azure Communication Services

Used to send announcement request emails to ward leadership.

1. Create a new **Azure Communication Services** resource.
2. After creation, go to **Email → Domains** and provision a free `azurecomm.net` subdomain, or connect a custom domain if you have one.
3. Go to **Keys** and copy the **Connection string** — needed for the API environment variables.
4. Note your verified **sender email address** (e.g., `donotreply@yourdomain.azurecomm.net`).

### 6. App Service — API

1. Create a new **App Service** for the Node.js API.
2. Recommended settings:

| Setting | Value |
|---------|-------|
| Name | ward-program-api (becomes `ward-program-api.azurewebsites.net`) |
| Runtime stack | Node.js 24 LTS |
| Operating System | Linux |
| App Service Plan | ward-program-plan (created in step 2) |

3. After creation, go to **Settings → Configuration** and set the **Startup Command** to:
   ```
   node server.js
   ```

### 7. App Service — Frontend

1. Create a second **App Service** for the React frontend.
2. Recommended settings:

| Setting | Value |
|---------|-------|
| Name | ward-program-web (becomes `ward-program-web.azurewebsites.net`) |
| Runtime stack | Node.js 24 LTS |
| Operating System | Linux |
| App Service Plan | ward-program-plan (same plan as API) |

> The frontend is a pre-built static site. The Node.js runtime is only needed to serve static files via the `web.config` SPA fallback routing.

### 8. Managed Identity — API to SQL

In production the API connects to Azure SQL using **System-assigned Managed Identity** — no password is stored anywhere. This is more secure than SQL authentication.

#### Enable Managed Identity on the API App Service

1. Go to your **API App Service** → **Security → Identity**.
2. Under **System assigned**, toggle **Status** to **On** and click **Save**.
3. Note the **API App Service Name** — you'll need it for the SQL step.

#### Grant the Managed Identity access to the database

> **Important**: You must complete these two prerequisites before running the SQL below, or the `FROM EXTERNAL PROVIDER` command will fail:
> 1. Your SQL Server must have a **Microsoft Entra admin set** (configured in step 3 above)
> 2. You must connect to the database in SSMS **using your Entra account** (not SQL username/password) — go to **Options → Authentication → Azure Active Directory - Universal with MFA** and sign in with the same account you set as Entra admin

Once connected with your Entra account, run:
```sql
-- Replace 'ward-program-api' with your actual App Service name
CREATE USER [ward-program-api] FROM EXTERNAL PROVIDER;
ALTER ROLE [ward_programs_role] ADD MEMBER [ward-program-api];
```

> The user name must exactly match your App Service name as it appears in Azure. If SSMS gives an error about the provider, verify you are connected via Entra authentication and that the Entra admin is set on the SQL Server.

#### How the connection works

The API's `db.js` detects whether it's running in production (Managed Identity) or locally (SQL auth) based on the `DB_USER` environment variable:

- **Production** (Azure): `DB_USER` and `DB_PASSWORD` are left unset. The driver uses the Managed Identity token automatically.
- **Local development**: `DB_USER` and `DB_PASSWORD` are set in `.env` to your SQL admin credentials.

You do **not** need to set `DB_USER` or `DB_PASSWORD` in the Azure App Service configuration — leave them absent and Managed Identity takes over.

### 9. Custom Domain (Optional)

If you want a custom domain (e.g., `programs.yourward.org`):

1. Purchase a domain from your preferred registrar.
2. In each App Service → **Custom domains**, add your domain and follow the verification steps.
3. Add an **SSL/TLS certificate** (Azure provides a free managed certificate).
4. Update your CORS allowed origins and frontend `VITE_API_URL` to use the custom domain.

---

## Database Setup

Run the scripts in `dbscripts/` against your Azure SQL database using SSMS. Connect as the SQL admin user.

### Step 1 — Create the role

```
ward_programs_role.Role.sql
```

### Step 2 — Create tables

Run in this order (foreign key dependencies):

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

For local development only — this user is not used in production (Managed Identity is used instead):

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

Create `ward-program-api/.env` for local development. This file is gitignored and never committed.

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_SERVER` | ✅ | Azure SQL server hostname, e.g. `yourserver.database.windows.net` |
| `DB_NAME` | ✅ | Database name, e.g. `ward_programs` |
| `DB_USER` | Local only | SQL username for local dev. Leave unset in Azure — Managed Identity is used instead |
| `DB_PASSWORD` | Local only | SQL password for local dev. Leave unset in Azure — Managed Identity is used instead |
| `JWT_SECRET` | ✅ | Random string, minimum 32 characters. Used to sign auth tokens. Generate with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `AZURE_STORAGE_CONNECTION_STRING` | ✅ | Full connection string from your Storage Account → Access keys |
| `ACS_CONNECTION_STRING` | ✅ | Full connection string from your Azure Communication Services resource → Keys |
| `ACS_SENDER_ADDRESS` | ✅ | Verified sender email address, e.g. `donotreply@yourdomain.azurecomm.net` |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated list of allowed frontend origins for CORS, e.g. `https://ward-program-web.azurewebsites.net,https://yourward.org` |
| `NODE_ENV` | ✅ | Set to `development` locally, `production` in Azure |
| `PORT` | Optional | Port the API listens on. Defaults to `3001` locally. Azure sets this automatically to `8080` |

Example `.env` file:

```env
DB_SERVER=yourserver.database.windows.net
DB_NAME=ward_programs
DB_USER=ward_api_user
DB_PASSWORD=YourStrongPassword123!
JWT_SECRET=your-64-character-random-hex-string-here
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=wardprogramstorage;AccountKey=...;EndpointSuffix=core.windows.net
ACS_CONNECTION_STRING=endpoint=https://your-acs-resource.unitedstates.communication.azure.com/;accesskey=...
ACS_SENDER_ADDRESS=donotreply@yourdomain.azurecomm.net
ALLOWED_ORIGINS=http://localhost:5173
NODE_ENV=development
```

### Azure App Service Environment Variables

Set these in **Azure Portal → API App Service → Settings → Environment variables**. Do **not** set `DB_USER` or `DB_PASSWORD` — Managed Identity handles authentication automatically.

| Variable | Value | Notes |
|----------|-------|-------|
| `DB_SERVER` | `yourserver.database.windows.net` | Your Azure SQL server hostname |
| `DB_NAME` | `ward_programs` | Your database name |
| `JWT_SECRET` | 64-char random hex string | Must match exactly what you used to issue existing tokens. Changing this invalidates all active sessions |
| `AZURE_STORAGE_CONNECTION_STRING` | Full connection string | From Storage Account → Access keys |
| `ACS_CONNECTION_STRING` | Full connection string | From ACS resource → Keys |
| `ACS_SENDER_ADDRESS` | `donotreply@yourdomain.azurecomm.net` | Your verified ACS sender address |
| `ALLOWED_ORIGINS` | `https://ward-program-web.azurewebsites.net,https://yourward.org` | All frontend origins that should be allowed to call the API |
| `NODE_ENV` | `production` | Enables HTTPS redirect, strict CSRF, production error messages |
| `WEBSITE_NODE_DEFAULT_VERSION` | `~20` | Tells Azure which Node.js version to use |

> **Important**: After setting environment variables in the Azure Portal, click **Save** and then **Restart** the App Service for changes to take effect.

### API Local Development

```bash
cd ward-program-api
npm install
npm start
```

The API starts on `http://localhost:3001`. Ensure your `.env` is populated and your local machine IP is in the Azure SQL firewall rules.

### Deploy API to Azure

1. In VS Code, open the **Azure App Service** extension (left sidebar).
2. Sign in to your Azure account if prompted.
3. Right-click your API App Service and choose **Deploy to Web App**.
4. Select the `ward-program-api` folder as the source.
5. Confirm the deployment when prompted.
6. Monitor the output panel — deployment typically takes 2–3 minutes.

> **Note**: Do not deploy the `node_modules` folder — Azure installs dependencies automatically during deployment via Oryx.

---

## Frontend Setup

### Frontend Local Development Environment Variables

Create `ward-program-app/.env.local` for local development:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_DEV_PROXY_TARGET` | Optional | The local API URL the Vite dev server proxies `/api` requests to. Defaults to `http://localhost:3001` if not set |

> When running locally, `VITE_API_URL` does not need to be set — the Vite dev server proxies all `/api` calls to your local API automatically via `vite.config.js`.

Example `.env.local`:

```env
VITE_DEV_PROXY_TARGET=http://localhost:3001
```

### Frontend Azure App Service Environment Variables

Create `ward-program-app/.env.production` before building. This is baked into the compiled bundle at build time — it is **not** set in the Azure Portal.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ | The full base URL of your deployed API, e.g. `https://ward-program-api.azurewebsites.net/api`. This is embedded in the compiled JS bundle during `npm run build` |

Example `.env.production`:

```env
VITE_API_URL=https://ward-program-api.azurewebsites.net/api
```

> **Note**: Vite environment variables are compile-time constants baked into the bundle. If you change `VITE_API_URL` you must rebuild and redeploy the frontend. They cannot be changed via Azure Portal environment variables.

The frontend App Service itself does not need any environment variables set in the Azure Portal — it only serves static files.

### Frontend Local Development

```bash
cd ward-program-app
npm install
npm run dev -- --host
```

The app starts at `http://localhost:5173`. Make sure the API is also running locally.

### Deploy Frontend to Azure

1. Build the production bundle (always do this before deploying):
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
   This tells the VS Code extension to deploy only the `dist/` folder, not the entire source tree.

3. In VS Code, open the **Azure App Service** extension.
4. Right-click your frontend App Service and choose **Deploy to Web App**.
5. Select the `ward-program-app` folder — the extension will automatically deploy only `dist/` due to the settings above.

> **Important**: The `public/web.config` file in the source is copied to `dist/` during build. It configures IIS-style SPA routing so that refreshing the page or navigating directly to a URL like `/admin` works correctly instead of returning a 404.

---

## First-Run Configuration

After both services are deployed and the database is seeded:

### 1. Create the first admin user

The app has no self-registration. Add the first user directly to the database. Generate a bcrypt hash of the password first:

```bash
# Run from the ward-program-api folder
node -e "require('bcrypt').hash('YourPassword123!', 12, (e,h) => console.log(h))"
```

Then insert the user:

```sql
INSERT INTO dbo.users (name, email, password_hash, role, status)
VALUES (
  'Admin Name',
  'admin@yourward.org',
  '$2b$12$...paste-hash-here...',
  'bishopric',
  'active'
);
```

### 2. Log in

Navigate to your frontend URL and log in with the credentials you just created.

### 3. Configure Ward Settings

Go to **Admin → Ward Defaults → Settings tab** and configure:

- **Ward name** — displayed in the app header and emails
- **Stake name** — displayed alongside ward name
- **Ward website URL** — shown as a button on the public program page
- **View password** — protects member contact info and descriptions on the public page. Members enter this to unlock full details
- **Announcement request emails** — comma-separated list of email addresses that receive public announcement requests
- **Enable announcement requests** — toggle whether the public Submit Announcement button is shown

### 4. Set up Ward Leadership and Schedules

Go to **Admin → Ward Defaults → Leadership tab** and add bishopric and other ward leadership. These appear on every program by default unless overridden per program.

Go to **Admin → Ward Defaults → Schedules tab** and add regular meeting times. These also appear on every program by default.

### 5. Upload cover images

Go to **Admin → Image Library** and upload images for program covers (JPEG only, max 5MB).

### 6. Create your first program

Go to **Admin Dashboard → New Program** and work through the 5-step wizard:
1. Cover
2. Announcements
3. Meeting Order
4. Leadership & Schedules
5. Preview & Publish

---

## Project Structure

```
ward-program/
├── dbscripts/                        # All SQL scripts — run these to set up the DB
│   ├── dbo.*.Table.sql               # Table definitions
│   ├── dbo.*.UserDefinedTableType.sql # TVP type definitions
│   ├── dbo.usp_*.StoredProcedure.sql # All stored procedures
│   └── ward_programs_role.Role.sql   # Database role
│
├── ward-program-api/                 # Node.js/Express REST API
│   ├── middleware/
│   │   ├── auth.js                   # JWT token verification
│   │   ├── optionalAuth.js           # Auth that doesn't block unauthenticated requests
│   │   └── requireRole.js            # Role-based access control
│   ├── routes/
│   │   ├── announcements.js          # Public announcement request endpoint
│   │   ├── auth.js                   # Login, logout, CSRF token, ward unlock
│   │   ├── images.js                 # Image library (upload, serve, delete)
│   │   ├── programs.js               # Full program CRUD + publish/archive
│   │   ├── proxy.js                  # Proxies external hymn image URLs
│   │   ├── users.js                  # User management
│   │   └── ward.js                   # Ward settings, leadership, schedules
│   ├── services/
│   │   └── emailService.js           # Sends emails via Azure Communication Services
│   ├── utils/
│   │   └── blob.js                   # Azure Blob Storage helpers
│   ├── db.js                         # SQL connection pool (Managed Identity in prod)
│   └── server.js                     # Express app — middleware, routes, rate limiting
│
└── ward-program-app/                 # React/Vite frontend
    ├── public/
    │   ├── favicon.ico
    │   └── web.config                # IIS SPA routing — required for Azure App Service
    └── src/
        ├── components/               # Reusable UI components
        │   ├── StepEditorPanel.jsx   # 5-step program builder editor
        │   ├── StepPreviewPanel.jsx  # Live PDF preview panel
        │   └── ...
        ├── constants/                # App-wide constants (cover block types, etc.)
        ├── context/                  # React context providers (Auth, Program, User, Error)
        ├── data/                     # Hymn and children's hymn data (local JSON)
        ├── hooks/                    # Custom hooks (dark mode, ward unlock, program form)
        ├── pages/                    # Page-level components
        │   ├── ProgramHome.jsx       # Public-facing program viewer
        │   ├── ProgramBuilder.jsx    # Admin program builder
        │   ├── ProgramViewer.jsx     # Admin program review + PDF generation
        │   ├── AdminDashboard.jsx    # Program list and management
        │   ├── WardDefaults.jsx      # Ward settings, leadership, schedules
        │   ├── ImageLibrary.jsx      # Cover image management
        │   └── UserManager.jsx       # User account management
        ├── styles/
        │   └── index.css             # Global CSS + Tailwind utilities
        └── utils/
            ├── PDFGenerator.js       # Client-side PDF generation (jsPDF)
            ├── panelHealth.js        # PDF overflow calculation engine
            ├── printSettingsUtils.js # Font size presets and line height helpers
            ├── api.js                # Fetch wrapper with CSRF token handling
            └── ...
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, @dnd-kit (drag and drop) |
| PDF Generation | jsPDF, jspdf-autotable |
| API | Node.js, Express |
| Authentication | JWT (HttpOnly cookie), bcrypt, CSRF double-submit cookie pattern |
| Database | Azure SQL Server 2022, mssql/tedious driver |
| DB Auth (production) | Azure Managed Identity (no passwords stored) |
| DB Auth (local dev) | SQL username + password |
| Image Storage | Azure Blob Storage |
| Email | Azure Communication Services |
| Hosting | Azure App Service (Linux, Node.js, shared B1 plan) |
| Deployment | VS Code Azure App Service extension |

---

## Key Notes for Future Developers

- **All database writes go through stored procedures** — never raw SQL from API routes. If you need a new operation, add a stored proc and script it in `dbscripts/`.

- **TVPs (Table-Valued Parameters)** are used for all child row inserts (announcements, meeting items, cover blocks, etc.). If you add a column to a table used by a TVP, you must update: the table, the TVP type (drop and recreate — SQL Server doesn't allow `ALTER TYPE`), and the stored proc that uses it.

- **Times are stored as `nvarchar(8)`** (`HH:MM:SS`) in the announcements table. This was a deliberate decision to avoid timezone conversion issues with the mssql/tedious driver, which converts `time(0)` columns through UTC based on the server's local timezone.

- **The `ward_settings` table enforces exactly one row** via a `CHECK CONSTRAINT` on `id = 1`. Use `usp_SaveWardSettings` to update it — never insert a second row.

- **Leadership is never shown publicly** — `leadership_public` is hardcoded to `0` in all write operations (`usp_CreateProgram`, `usp_SaveProgram`). This is intentional.

- **The PDF is generated entirely client-side** using jsPDF — it never touches the server. No temporary files are created.

- **Panel health** (`panelHealth.js`) estimates PDF content height before publish to warn when content will overflow the page. All measurements in `panelHealth.js` must be kept in sync with the actual rendering values in `PDFGenerator.js`. When adding new meeting item types or announcement fields, update both files.

- **Vite environment variables** (`VITE_*`) are baked into the compiled bundle at build time. Changing them requires a rebuild and redeploy of the frontend — they cannot be hot-swapped via Azure Portal settings.

- **The API uses `trust proxy: 1`** in production so Express correctly reads the client IP from the `X-Forwarded-For` header set by Azure's load balancer. Rate limiting depends on this being set correctly.
