# prerequisites.readme — PermissionSync
### System Requirements & Salesforce Connected App Configuration Guide

> **Important:** Review and complete every section of this document before running the installation or deployment steps.

---

## 1. System & Runtime Requirements

PermissionSync runs locally on any standard developer workstation (Windows, macOS, or Linux).

| Software | Minimum Version | Recommended | Purpose |
|---|---|---|---|
| **Python** | `3.10.x` | `3.11.x` or `3.12.x` | Backend API server, Salesforce SOQL engine, and diff processor |
| **pip** | `22.0+` | Latest | Python package manager (included with Python) |
| **Node.js** | `18.0.0+` | `20.x LTS` | Frontend runtime and Vite development server |
| **npm** | `9.0.0+` | `10.x+` | JavaScript package manager (included with Node.js) |
| **Git** | `2.30+` | Latest | Source code management and cloning |

### Verification Commands
Open your terminal (PowerShell / Command Prompt on Windows, Terminal on macOS/Linux) and verify your installations:

```bash
python --version
node --version
npm --version
git --version
```

If any command is not recognized, download and install:
* **Python:** [https://www.python.org/downloads/](https://www.python.org/downloads/) *(Ensure "Add Python to PATH" is checked during installation)*
* **Node.js:** [https://nodejs.org/](https://nodejs.org/) *(Download the LTS version)*
* **Git:** [https://git-scm.com/downloads](https://git-scm.com/downloads)

---

## 2. Salesforce Connected App Setup (Step-by-Step)

PermissionSync connects securely to Salesforce using the **OAuth 2.0 Client Credentials Flow**.  
This modern, enterprise-grade authentication standard:
* Does **not** require hardcoding individual user usernames or passwords.
* Does **not** break when user passwords expire or MFA prompts trigger.
* Authenticates directly against the org using an encrypted Client ID and Secret.

> **Note:** A Connected App must be configured in **each Salesforce environment** you plan to connect (e.g., DEV, UAT, and PROD). Follow these steps in each org:

### Step 2.1: Create the Connected App
1. Log in to your Salesforce org as a **System Administrator**.
2. Navigate to **Setup** (gear icon in the top right).
3. In the Quick Find search box, enter **App Manager** and select it.
4. In the top-right corner of the App Manager page, click **New Connected App**.

### Step 2.2: Enter Basic Information
* **Connected App Name:** `PermissionSync`
* **API Name:** `PermissionSync` (auto-populates)
* **Contact Email:** Enter your company or project email (e.g., `admin@thinqloud.com`)

### Step 2.3: Enable and Configure OAuth Settings
1. Check the box **Enable OAuth Settings**.
2. **Callback URL:** Enter `https://localhost` *(required by Salesforce validation, not used by Client Credentials)*.
3. In **Selected OAuth Scopes**, move the following two scopes from *Available* to *Selected*:
   * `Manage user data via APIs (api)`
   * `Perform requests at any time (refresh_token, offline_access)`
4. Leave all other OAuth checkboxes at default.
5. Click **Save** at the bottom of the page.
6. Click **Continue** when prompted about waiting 2–10 minutes for changes to replicate.

### Step 2.4: Configure OAuth Policies & Client Credentials Flow
1. On the Connected App detail page, click the **Manage** button at the top.
2. Click **Edit Policies**.
3. Under **OAuth Policies**:
   * **Permitted Users:** Select `All users may self-authorize` (or `Admin-approved users are pre-authorized`).
   * **IP Relaxation:** Select `Relax IP restrictions`.
4. Under **Client Credentials Flow**:
   * **Enable Client Credentials Flow:** Check this box (if visible).
   * **Run As:** Click the magnifying glass icon and select an active **System Administrator** user in this org.
5. Click **Save**.

### Step 2.5: Retrieve Consumer Key and Consumer Secret
1. Go back to **Setup → App Manager**.
2. Find **PermissionSync** in the list, click the dropdown arrow on the right side, and select **View**.
3. In the **API (Enable OAuth Settings)** section, click **Manage Consumer Details**.
4. You will be prompted to enter a verification code sent to your email or authenticator.
5. Copy and save securely:
   * **Consumer Key** $\longrightarrow$ This is your `Client ID`.
   * **Consumer Secret** $\longrightarrow$ This is your `Client Secret`.

### Step 2.6: Note Your Org Domain URL
Note your Salesforce org's My Domain URL (found in your browser's address bar):
* Format: `https://<your-subdomain>.my.salesforce.com`  
*(Example: `https://thinqloud-dev-ed.develop.my.salesforce.com`)*

---

## 3. Network & Port Requirements

Ensure the following network requirements are met on the host machine:

| Port | Service | Direction | Requirement |
|---|---|---|---|
| **8000** | FastAPI Backend Server | Inbound (Localhost) | Must be free and available |
| **5173** | Vite React Frontend Server | Inbound (Localhost) | Must be free and available |
| **443** | Salesforce APIs (`*.salesforce.com`) | Outbound (HTTPS) | Open egress to Salesforce login & instance servers |

---

## 4. Summary of Dependencies (Pre-Configured)

All application dependencies are fully declared in the project files and install automatically via standard package managers:

### Backend (`backend/requirements.txt`)
* `fastapi` — Asynchronous high-performance REST API framework
* `uvicorn` — ASGI server for production-grade local execution
* `simple-salesforce` — Official Salesforce REST, Tooling, and Metadata API client
* `deepdiff` — Deep recursive permission structure comparison engine
* `pandas` & `openpyxl` — Spreadsheet engine for Excel (`.xlsx`) export
* `pydantic` — Strict request/response schema validation

### Frontend (`frontend/package.json`)
* `react` & `react-dom` (v19) — UI component architecture
* `vite` — Next-generation frontend build engine and hot-reload dev server
* `lucide-react` — Comprehensive icon library
* `framer-motion` — Micro-interactions and animated workflow transitions
* `xlsx` — Client-side Excel parsing and export engine
* `axios` — HTTP client with automated proxy to backend

---

## 5. What You Do NOT Need
* ❌ **No Salesforce CLI (SFDX) installation required.**
* ❌ **No Git integration inside Salesforce required.**
* ❌ **No third-party SaaS accounts (e.g., Copado, Gearset).**
* ❌ **No cloud hosting required** — runs completely on your secure local machine.
