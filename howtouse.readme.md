# howtouse.readme — PermissionSync
### Comprehensive Operational Guide & Local Execution Instructions

> This guide provides step-by-step instructions to configure, run locally, and use PermissionSync across implementation and ongoing client support projects.

---

## 1. Running the Platform Locally (Terminal Commands)

To run PermissionSync on your local machine, open **two separate terminal windows**:

### Terminal 1: Start the Backend Server

```bash
# 1. Navigate to the project directory
cd "Salesforce PermissionSync"

# 2. Enter the backend folder
cd backend

# 3. Activate the virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# (Or Command Prompt: venv\Scripts\activate.bat)
# On macOS / Linux:
# source venv/bin/activate

# 4. Start the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
> **Backend URL:** `http://localhost:8000`  
> **Interactive API Docs:** `http://localhost:8000/docs`  
> **Health Check:** `http://localhost:8000/api/health`

---

### Terminal 2: Start the Frontend Application

```bash
# 1. Navigate to the frontend directory
cd "Salesforce PermissionSync"
cd frontend

# 2. Start the Vite dev server
npm run dev
```
> **Frontend Application URL:** Open your browser and navigate to:  
> 👉 **`http://localhost:5173`**

---

## 2. Navigating the User Interface

The left sidebar gives you quick access to the core modules:
* 📊 **Dashboard (`/`):** High-level overview of connected Salesforce environments and quick-start actions.
* 🔌 **Org Connections (`/connections`):** Manage OAuth 2.0 Connected App links for DEV, UAT, and PROD.
* 🔀 **Compare & Sync (`/agent`):** The guided 4-stage permission synchronization workflow.

---

## 3. Step-by-Step Workflow Guide

### Stage 1: Connect Your Environments
1. Navigate to **Org Connections** in the sidebar.
2. For each org you want to connect (e.g., DEV and UAT):
   * Click **Connect**.
   * Enter your **Client ID** (Consumer Key from Connected App).
   * Enter your **Client Secret** (Consumer Secret from Connected App).
   * Enter your **Org URL** (e.g., `https://yourcompany.my.salesforce.com`).
   * Click **Connect Org**.
3. Once authenticated via OAuth 2.0, the environment card displays a green **Connected** badge.

---

### Stage 2: Select Environments & Define Release Components
1. Click **Compare & Sync** in the sidebar.
2. **Select Source & Target:**
   * **Source Org:** The environment containing the intended permissions (e.g., `DEV`).
   * **Target Org:** The environment to receive the permissions (e.g., `UAT`).
   * Click **Next: Components**.

3. **Define Components to Compare:**  
   You can add components using either of two methods:

   * **Option A: Manual Entry**  
     Select the component type from the dropdown and enter its API name:
     * `ApexClass` $\longrightarrow$ e.g., `EmailServiceController`
     * `CustomField` $\longrightarrow$ e.g., `Account` (Object) and `Tax_Number__c` (Field)
     * `CustomObject` $\longrightarrow$ e.g., `Audit_Log__c`
     * `CustomTab` $\longrightarrow$ e.g., `Audit_Log__c`
     *(Note: PageLayout and FlowAccess options are displayed as "Coming Soon" placeholders).*

   * **Option B: Excel / CSV Deployment Sheet Upload**  
     Click **Upload Excel / CSV** and select your release spreadsheet.  
     Supported column headers (case-insensitive):
     * Column 1: `Type` or `Component Type` (e.g., `ApexClass`, `CustomField`, `CustomObject`, `CustomTab`)
     * Column 2: `Component Name` or `API Name` (e.g., `Account.Revenue__c`, `Invoice__c`)

4. Click **Next: Profile Mapping**.

---

### Stage 3: Profile Mapping & Target-Only Profiles

PermissionSync automatically queries both orgs in real-time and categorizes profiles into three sections:

1. **Standard Profiles:** Pre-matched system profiles existing in both orgs (e.g., `Standard User`, `Read Only`).
2. **Custom Profiles:** Matching custom profiles present in both orgs (e.g., `Custom: Sales Profile`).
3. **Present in Target, Missing in Source (Target-Only Profiles):**  
   Profiles that exist in UAT/PROD but have no direct counterpart in DEV (e.g., a newly created regional profile in UAT):
   * Check the profile row to include it.
   * Use the **`copy permissions from [ DEV (Source) ]:`** dropdown to choose which source profile's permissions should be copied to this target profile.
   * *Strict Validation:* If you select a target-only profile, the platform enforces source profile selection before allowing comparison to proceed.

4. Click **Run Comparison**.

---

### Stage 4: Interactive Results, Selective Sync & Export

1. **KPI Summary Cards:**  
   Displays verified real-time statistics:
   * **Total Checked:** Number of permission dimensions inspected.
   * **Missing in Target:** Permissions present in Source but absent in Target.
   * **Mismatches:** Permissions where boolean access levels differ.
   * **Matches:** Permissions that are already identical.

2. **Itemized Difference Table:**  
   Each difference is displayed with its Source Org profile, Component name, Target Org profile, and status badge (`✕ Present in Source, Missing in Target` or `⚠ Mismatch`).  
   * Click any row to expand a **deep diff JSON viewer** showing exact side-by-side access properties.

3. **Selective Sync (Non-Destructive Upsert):**  
   * Use the checkboxes to select all or only specific differences you wish to synchronize.
   * Click **Sync (N)** to push changes.
   * Changes are applied directly to the target org via Salesforce APIs. Unchecked items and unrelated profiles remain 100% untouched.

4. **Generating & Downloading Audit Reports:**  
   Click the export buttons to generate comprehensive audit trails:
   * **`Download Report (Excel)`:** Generates a structured `.xlsx` workbook containing an executive **Summary** sheet and a **Detailed Changes** sheet with full before/after states.
   * **`Download Report (CSV)`:** Generates a clean `.csv` file ideal for compliance archives, release tickets (Jira), or client sign-offs.

---

## 4. Best Practices for Support & Maintenance Projects

PermissionSync is specifically designed for ongoing client support and maintenance engagements:

1. **Zero Client Data Retention:**  
   PermissionSync holds credentials, tokens, and metadata snapshots strictly in ephemeral system memory. No client data is written to external cloud databases, guaranteeing compliance with client NDAs and data governance policies.
2. **Rapid Switching Between Multiple Client Orgs:**  
   Support engineers managing multiple client projects can disconnect one client's sandboxes and connect another in seconds under **Org Connections**.
3. **Emergency Production Bug Resolution:**  
   When a user in Production encounters sudden permission issues after a release, support engineers can compare Production against UAT in read-only mode to immediately isolate the missing permission without altering any metadata.
