# Google Apps Script Setup - Daftar Upah Sync

This project uses a Google Apps Script Web App to handle writing data to Google Sheets. This avoids direct API complexity and allows for easier formatting control within the Google ecosystem.

## Setup Instructions

1.  **Create a Google Spreadsheet**
    *   Create a new Google Sheet (or use an existing one).
    *   Note the Spreadsheet ID (from the URL).

2.  **Open Apps Script Editor**
    *   In the Spreadsheet, go to `Extensions` > `Apps Script`.

3.  **Deploy the Code**
    *   Delete any existing code in `Code.gs`.
    *   Copy the content of `integrasi/spreadsheet/Code.js` and paste it into `Code.gs`.
    *   Save the project (Ctrl+S).

4.  **Configure Secret**
    *   Go to **Project Settings** (Gear icon on the left sidebar).
    *   Scroll down to **Script Properties**.
    *   Click **Add script property**.
    *   Property: `API_SECRET`
    *   Value: `YOUR_SECURE_SECRET_HERE` (Generate a random string, e.g., using `openssl rand -hex 16` or just a strong password).
    *   Click **Save script properties**.

5.  **Deploy as Web App**
    *   Click the blue **Deploy** button (top right) > **New deployment**.
    *   Click the **Select type** gear icon > **Web app**.
    *   **Description**: `v1 - Initial Deploy`.
    *   **Execute as**: `Me` (your google account).
    *   **Who has access**: `Anyone` (This is important so the backend can call it without OAuth flows. Security is handled by the `API_SECRET`).
    *   Click **Deploy**.
    *   Authorize the script if prompted.

6.  **Copy the Web App URL**
    *   Copy the generated `Web app URL` (starts with `https://script.google.com/macros/s/...`).

7.  **Update Backend Configuration**
    *   Open `backend/.env`.
    *   Add/Update the following:
        ```env
        GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
        GOOGLE_SCRIPT_SECRET=YOUR_SECURE_SECRET_HERE
        ```
