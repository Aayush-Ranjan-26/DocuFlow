# 📄 DocuFlow AI: Automated Local Document Summarizer & Organizer 🤖⚡

<p align="center">
  <img src="https://img.shields.io/badge/n8n-Workflow-EA4B71?style=for-the-badge&logo=n8n&logoColor=white" alt="n8n" />
  <img src="https://img.shields.io/badge/Ollama-Local%20LLM-black?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" />
  <img src="https://img.shields.io/badge/Model-Llama_3.1:8B-blue?style=for-the-badge" alt="Llama 3.1" />
  <img src="https://img.shields.io/badge/Google_Sheets-Logging-34A853?style=for-the-badge&logo=googlesheets&logoColor=white" alt="Google Sheets" />
  <img src="https://img.shields.io/badge/Platform-Windows_10%20%2F%2011-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows" />
  <img src="https://img.shields.io/badge/Privacy-100%25%20Local%20AI-success?style=for-the-badge" alt="Local AI" />
</p>

---

## 🌟 Highlights & Features

**DocuFlow AI** is a fully automated, privacy-first document ingestion and knowledge pipeline built with **n8n** and **Ollama**. Simply drop any PDF or Word document into your inbox folder — the workflow handles the rest locally on your machine without leaking data to external cloud APIs!

* 🔒 **100% Private & Local AI**: Summaries and keyword tags are generated strictly on your local machine using **Ollama (`llama3.1:8b`)**. Zero document text is sent to third-party AI providers.
* 📑 **Multi-Format Ingestion**: Native extraction for both `.pdf` and Microsoft Word `.docx` documents.
* 🧠 **Structured Extraction**: Generates an executive 3-bullet takeaway plus 3 semantic tags per document in deterministic JSON format.
* 📝 **Instant Markdown Reports**: Writes clean, readable `.md` summaries directly to your summary directory — ready for Obsidian, Notion, or local reading.
* 🏷️ **Smart Metadata Renaming**: Automatically standardizes original files using the pattern:  
  `YYYY-MM-DD_<tag1>_<tag2>_<tag3>_<original_filename>`
* 📊 **Google Sheets Audit Trail**: Appends real-time status (`success` / `failed`), timestamps, summary links, and tags directly to a cloud spreadsheet.
* 🚨 **Fail-Safe Quarantine**: Unreadable or corrupt files are automatically routed to a dedicated `failed/` directory with detailed error logging.

---

## 📌 Table of Contents

1. [🚀 Architecture & Data Flow](#-architecture--data-flow)
2. [🧩 Workflow Node Breakdown](#-workflow-node-breakdown)
3. [💻 Prerequisites & Requirements](#-prerequisites--requirements)
4. [🔑 Placeholder & Configuration Guide](#-placeholder--configuration-guide)
   - [1. Windows Username & Dirs](#1-windows-username--dirs)
   - [2. Google Sheet ID](#2-google-sheet-id)
   - [3. Google Sheets OAuth2 Creds](#3-google-sheets-oauth2-creds)
5. [🛠️ Step-by-Step Installation](#️-step-by-step-installation)
   - [Step 1: Install Ollama & Pull Llama 3.1](#step-1-install-ollama--pull-llama-31)
   - [Step 2: Create Local Working Directories](#step-2-create-local-working-directories)
   - [Step 3: Prepare the Google Sheet](#step-3-prepare-the-google-sheet)
   - [Step 4: Import & Configure the Workflow](#step-4-import--configure-the-workflow)
6. [🧪 How to Run & Test](#-how-to-run--test)
7. [🛡️ Error Handling & Loop Protection](#️-error-handling--loop-protection)
8. [🤝 Contribution & Customization](#-contribution--customization)

---

## 🚀 Architecture & Data Flow

```
[ 📥 New Document Dropped (.pdf / .docx) ]
                     │
                     ▼
      [ 👁️ Watch Inbox (Local File Trigger) ]
                     │
                     ▼
      [ ⏳ Wait for File Copy (2s Buffer) ]
                     │
                     ▼
      [ ⚙️ Prepare Input (Path & Format Check) ]
              │                      │
          (if .pdf)              (if .docx)
              │                      │
              ▼                      ▼
      [ 📖 Read PDF ]        [ 📜 PowerShell XML Parser ]
              │                      │
              ▼                      │
     [ 📑 Extract Text ]             │
              │                      │
              └──────────┬───────────┘
                         ▼
           [ 🧹 Normalize Extracted Text ]
                         ▼
        [ 🦙 Ollama Inference (llama3.1:8b) ]
                         ▼
             [ 🧠 Parse JSON Response ]
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
 [ 📝 Create Markdown ]        [ 🏷️ Rename Source Doc ]
          ▼                             │
 [ 💾 Write to Disk ]                   │
          │                             │
          └──────────────┬──────────────┘
                         ▼
               [ ✅ Prepare Success Log ]
                         ▼
              [ 📊 Append to Google Sheets ]
```

---

## 🧩 Workflow Node Breakdown

| Node Name | Type | Description |
| :--- | :--- | :--- |
| **Watch Inbox** 📂 | `localFileTrigger` | Monitors the local inbox folder for newly created `.pdf` and `.docx` files. |
| **Wait for File Copy** ⏳ | `wait` | Adds a 2-second debounce buffer to guarantee file copying has fully completed. |
| **Prepare Input** ⚙️ | `code` | Determines extension, skips already-processed files, and builds the extraction command. |
| **PDF Files Only** & **DOCX Files Only** 🔀 | `code` | Directs execution to the dedicated parser based on filetype. |
| **Read PDF from Disk** & **Extract PDF Text** 📑 | `readWriteFile` & `extractFromFile` | Loads binary stream and parses all plain text pages. |
| **Extract DOCX Text** 💻 | `executeCommand` | Executes an in-memory PowerShell script that unpacks the docx zip archive and extracts `word/document.xml` paragraphs. |
| **Normalize Extracted Text** 🧼 | `code` | Removes null bytes, normalizes whitespace, and verifies non-empty text content. |
| **Summarize with Ollama** 🦙 | `httpRequest` | Calls Ollama's local HTTP endpoint (`http://127.0.0.1:11434/api/generate`) requesting 3 bullet points & 3 tags in JSON format. |
| **Parse Ollama Response** 🧠 | `code` | Validates JSON schema, cleans tags, generates Markdown markup, and prepares the file rename command. |
| **Create Markdown File** & **Write Summary to Disk** 📝 | `convertToFile` & `readWriteFile` | Saves structured `.md` summary file into the `summary/` directory. |
| **Rename Source File** 🏷️ | `executeCommand` | Renames the original document in `inbox/` with date prefix and safe semantic tags. |
| **Handle Failure** & **Move Source to Failed** 🚨 | `code` & `executeCommand` | Catches exceptions, isolates corrupt files into `failed/`, and generates failure diagnostics. |
| **Prepare Success Log** & **Prepare Failure Log** 📋 | `code` | Standardizes row payload format for Google Sheets. |
| **Log to Google Sheets** 📊 | `googleSheets` | Appends record into Google Sheets with file metadata, status, tags, and error info. |

---

## 💻 Prerequisites & Requirements

* **Operating System**: Windows 10 / 11 (utilizes built-in PowerShell for native DOCX XML unpacking and filesystem moves).
* **Node.js & n8n**:
  - Node.js `v18.x` or `v20.x`
  - n8n installed globally (`npm install -g n8n`) or executed via `npx n8n`.
* **Ollama**:
  - Installed locally from [ollama.com](https://ollama.com).
  - Llama 3.1 8B pulled (`ollama pull llama3.1:8b`).
* **Google Cloud Account**:
  - Google Sheets API enabled.
  - OAuth2 Client credentials configured in n8n.

---

## 🔑 Placeholder & Configuration Guide

To protect your privacy when sharing or pushing this workflow, all environment paths and credentials use placeholders. Update these before activating:

### 1. Windows Username & Dirs 👤
Replace `YOUR_WINDOWS_USERNAME` with your local Windows username (found in `C:\Users\`):

* **In Node `Watch Inbox`**:
  ```text
  C:\Users\YOUR_WINDOWS_USERNAME\.n8n-files\inbox
  ```
* **In Node `Prepare Input`** (inside JavaScript code):
  ```javascript
  const inboxDir = 'C:\\Users\\YOUR_WINDOWS_USERNAME\\.n8n-files\\inbox';
  const summaryDir = 'C:\\Users\\YOUR_WINDOWS_USERNAME\\.n8n-files\\summary';
  const failedDir = 'C:\\Users\\YOUR_WINDOWS_USERNAME\\.n8n-files\\failed';
  ```

### 2. Google Sheet ID 📊
Open your destination Google Sheet in your web browser. Copy the ID from the URL:
```text
https://docs.google.com/spreadsheets/d/<YOUR_GOOGLE_SHEET_ID>/edit#gid=0
```
* **In Node `Log to Google Sheets`**:
  - Replace `documentId` with your Sheet ID.
  - Replace `cachedResultUrl` with your sheet URL.

### 3. Google Sheets OAuth2 Creds 🔐
The workflow JSON has clean credential placeholders:
```json
"credentials": {
  "googleSheetsOAuth2Api": {
    "id": "YOUR_GOOGLE_SHEETS_OAUTH2_CREDENTIAL_ID",
    "name": "YOUR_GOOGLE_SHEETS_CREDENTIAL_NAME"
  }
}
```
* In n8n, simply open **Log to Google Sheets** and select your authenticated Google account from the credential dropdown.

---

## 🛠️ Step-by-Step Installation

### Step 1: Install Ollama & Pull Llama 3.1 🦙
1. Download and install Ollama from [ollama.com](https://ollama.com).
2. Open PowerShell or Command Prompt and download the model:
   ```bash
   ollama pull llama3.1:8b
   ```
3. Test that the Ollama service is responsive:
   ```bash
   curl http://127.0.0.1:11434/api/tags
   ```

### Step 2: Create Local Working Directories 📁
Run this command in PowerShell to automatically generate the required directory structure:
```powershell
$base = "$HOME\.n8n-files"
New-Item -ItemType Directory -Path "$base\inbox", "$base\summary", "$base\failed" -Force
```

### Step 3: Prepare the Google Sheet 📊
1. Create a new Google Spreadsheet (e.g. `Document Processing Log`).
2. Set the first row (Row 1) headers exactly as follows:
   | original_filename | renamed_filename | timestamp | tags | summary_file | status | error_message |
3. In n8n, go to **Credentials > Add Credential > Google Sheets OAuth2 API** and authenticate your Google account.

### Step 4: Import & Configure the Workflow 📥
1. Start n8n in your terminal:
   ```bash
   npx n8n
   ```
2. In your browser (`http://localhost:5678`), select **Add workflow > Import from File**.
3. Select the workflow JSON file from this repository.
4. Update the placeholders:
   - **Watch Inbox**: Put your Windows username in the path.
   - **Prepare Input**: Update `inboxDir`, `summaryDir`, and `failedDir`.
   - **Log to Google Sheets**: Select your authenticated Google credential and your spreadsheet.
5. Click **Save** in the top bar.

---

## 🧪 How to Run & Test

1. Switch the workflow toggle to **Active** (in the top right of n8n). 🚀
2. Copy any test `.pdf` or `.docx` into your inbox folder:
   ```text
   C:\Users\<YOUR_WINDOWS_USERNAME>\.n8n-files\inbox\
   ```
3. Within seconds, the pipeline automatically processes the file:
   - 📖 Extracts and cleans the document text.
   - 🤖 Prompts Ollama for 3 bullet points & 3 key tags.
   - 📝 Creates a markdown report in:
     ```text
     C:\Users\<YOUR_WINDOWS_USERNAME>\.n8n-files\summary\<filename>.md
     ```
   - 🏷️ Renames the source document in `inbox/`:
     ```text
     YYYY-MM-DD_<tag1>_<tag2>_<tag3>_<original_filename>
     ```
   - 📊 Appends a new status row to your Google Sheet with `status: success`. 🎉

---

## 🛡️ Error Handling & Loop Protection

* **Corrupt & Unreadable Files**: If text extraction fails or Ollama encounters an error, execution immediately branches to **Handle Failure**:
  - Moves the offending file to `C:\Users\<YOUR_USERNAME>\.n8n-files\failed\<timestamp>_<filename>`.
  - Appends an entry to your Google Sheet with `status: failed` and logs the exact error description.
* **Infinite Loop Prevention**: Already-processed files with the date-prefix `YYYY-MM-DD_` are automatically ignored by the `Prepare Input` node.
* **Unsupported Extensions**: Non-PDF and non-DOCX files deposited in the inbox folder are safely bypassed.

---

## 🤝 Contribution & Customization

* **Change the LLM Model**: Want to use `mistral`, `gemma2`, or `qwen2.5`? Simply open the **Summarize with Ollama** node and change `"model": "llama3.1:8b"` to your preferred model name.
* **Customize Prompts**: Tailor summary lengths, output format, or tag counts by adjusting the prompt payload in the **Summarize with Ollama** node.
* **Cloud Sync**: Point the `summary/` folder to your OneDrive, Google Drive, or Obsidian vault for seamless cross-device knowledge access.

---

<p align="center">
  <b>Built with ❤️ using n8n and Ollama. Keep your documents organized & your data private.</b>
</p>
