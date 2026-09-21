# deployment.readme — PermissionSync

### Step-by-Step Installation, Setup & Local Deployment Guide

> Follow this guide to set up a clean, working installation of PermissionSync from source on your local machine.

---

## 1. Project Directory Structure

Once cloned, the project contains the following structure:

```
Salesforce PermissionSync/
├── backend/                  # FastAPI Python backend server
│   ├── app/
│   │   ├── api/              # REST route handlers (auth, compare, sync)
│   │   ├── models/           # Pydantic data models & request schemas
│   │   ├── services/         # Core engines (salesforce_service, comparison_service, sync_service)
│   │   └── main.py           # Application entrypoint & CORS middleware
│   ├── requirements.txt      # Python dependencies list
│   └── connect_ui.py         # Terminal utility for quick org connection
├── frontend/                 # React + Vite web user interface
│   ├── src/
│   │   ├── components/       # Reusable UI cards, tables, headers, sidebars
│   │   ├── pages/            # Workflow views (Dashboard, Connections, CompareWorkflow)
│   │   ├── services/         # Axios API client bindings
│   │   ├── App.jsx           # Main router and layout
│   │   └── index.css         # Global design tokens and styling
│   ├── package.json          # Node.js dependencies list
│   └── vite.config.js        # Vite build config with automatic /api proxy
├── PermissionSync_OnePager.md # Business case, ROI & architectural summary
├── prerequisites.readme.md    # System requirements & Connected App setup guide
├── howtouse.readme.md         # Operational manual & user guide
└── deployment.readme.md       # This deployment guide
```

---

## 2. Step 1: Clone the Repository

Open your terminal and clone the repository from GitHub:

```bash
git clone https://github.com/Thinqloud/<repository-name>.git
cd "Salesforce PermissionSync"
```

---

## 3. Step 2: Configure & Start the Backend (Python)

### 3.1 Navigate to Backend Directory

```bash
cd backend
```

### 3.2 Create and Activate a Python Virtual Environment

Creating a virtual environment ensures dependencies do not conflict with your global Python setup:

- **On Windows (PowerShell):**

  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```

  _(If you get a script execution policy restriction on Windows, run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` first)._

- **On Windows (Command Prompt):**

  ```cmd
  python -m venv venv
  venv\Scripts\activate.bat
  ```

- **On macOS / Linux:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

Once activated, your terminal prompt will show `(venv)`.

### 3.3 Install Backend Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

_Wait for pip to finish downloading and compiling packages (approx. 1 minute)._

### 3.4 Start the Backend Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:

```text
🚀 Starting Salesforce PermissionSync Platform...
  ✓ Ensured storage directories
✅ Platform ready.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### 3.5 Verify Backend Health

Open a browser tab and verify:

- **Health Endpoint:** [http://localhost:8000/api/health](http://localhost:8000/api/health) $\longrightarrow$ Returns `{"status": "healthy"}`
- **Interactive Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs) $\longrightarrow$ Displays full API documentation

> **Keep this terminal window running.** Do not close it.

---

## 4. Step 3: Configure & Start the Frontend (Node.js)

Open a **second, separate terminal window**.

### 4.1 Navigate to Frontend Directory

```bash
cd "Salesforce PermissionSync"
cd frontend
```

### 4.2 Install Node.js Dependencies

```bash
npm install
```

_Installs React, Vite, Framer Motion, Lucide icons, and the XLSX library._

### 4.3 Start the Frontend Dev Server

```bash
npm run dev
```

You should see:

```text
  VITE v6.x.x  ready in 350 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

> **Keep this terminal window running as well.**

---

## 5. Step 4: Open and Use PermissionSync

1. Open your web browser and navigate to:  
   👉 **`http://localhost:5173`**
2. The frontend automatically proxies all API requests (`/api/*`) to the backend server on port 8000 (defined in `frontend/vite.config.js`).
3. Follow the steps in [`howtouse.readme.md`](file:///d:/Salesforce%20PermissionSync/howtouse.readme.md) to connect your orgs and perform your first comparison and synchronization.

---

## 6. Troubleshooting & Frequently Asked Questions

### Issue 1: Port Already in Use (`Error: listen EADDRINUSE: address already in use :::8000`)

- **Cause:** Another process or a previous instance of uvicorn is occupying port 8000 or 5173.
- **Solution (Windows PowerShell):**
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
  ```
- **Solution (macOS / Linux):**
  ```bash
  lsof -ti:8000 | xargs kill -9
  ```

### Issue 2: OAuth Authentication Fails (`invalid_client` or `invalid_client_id`)

- **Cause:** The Connected App was recently created in Salesforce and metadata has not fully synchronized, or the Client Secret was truncated.
- **Solution:**
  1. Salesforce Connected Apps often take **5–10 minutes** to become active across all login clusters after initial creation.
  2. Verify that **Enable Client Credentials Flow** is checked under **Manage Connected Apps → Edit Policies**, and that an active System Administrator is assigned as the **Run As** user.
  3. Ensure there are no leading or trailing whitespace characters copied with your Consumer Key or Secret.

### Issue 3: "Component Does Not Exist in Target Org" During Sync

- **Cause:** PermissionSync safely validates component existence before applying permissions. If you deployed a permission for a new Custom Field or Apex Class that has not yet been deployed to the target org, Salesforce will reject the permission record.
- **Solution:** Deploy the underlying metadata component (e.g., Apex Class or Field definition) to the target org first, then use PermissionSync to apply the profile permissions.

---
