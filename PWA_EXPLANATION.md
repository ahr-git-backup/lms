# How PWA & Offline Sync Works in Your App

Your website is now a **Progressive Web App (PWA)**. This transforms it from a simple "website" into an "app-like" experience that works on mobile phones, tablets, and desktops, even with poor or no internet.

## 1. How It Works (The "Magic")

### A. The Service Worker (Asset Caching)
*   **What it does:** When a student visits your site, a background script (`sw.js`) automatically downloads and saves the "App Shell" (HTML, CSS, JavaScript, Logos, Fonts).
*   **The Result:** Next time they open the app, it loads **instantly** from their phone's memory, not the internet. It feels like a native app.

### B. React Query Persistence (Data Caching)
*   **What it does:** We installed a "Smart Cache" (`PersistQueryClientProvider`).
*   **The Logic:**
    1.  **Online:** When a student opens "Live Exams", the app checks the internet. If online, it downloads the latest questions and **saves a copy** to the phone's local storage.
    2.  **Offline:** If the internet cuts out, the app sees the error but instead of crashing, it says: *"I have a copy from 5 minutes ago, I will show that."*
*   **Sync on Refresh:** We set `staleTime: 0`. This means **every time** the student refreshes or opens a page, the app *tries* to get the absolute newest data. It only uses the "old" copy if the internet is dead.

## 2. PWA Features You Now Have
1.  **Installable:** Students will see an "Add to Home Screen" or "Install App" button in Chrome/Safari. It looks like an App Icon on their phone.
2.  **Full Screen:** It opens without the URL bar (browser chrome), looking professional.
3.  **Offline Resilience:** If a student is taking an exam and WiFi drops, the app stays alive.

## 3. Important Notes for "Database Sync"
*   **Read vs. Write:**
    *   **Reading (Viewing Exams/Classes):** Works offline (if previously visited).
    *   **Writing (Submitting Exam):** Still requires internet. We haven't built a "Queue" (which is very complex). If they try to submit offline, it will fail.
    *   *Advice:* Tell students: "You can view content offline, but you need internet to Submit."

## 4. Testing It
1.  Open your site.
2.  Turn off WiFi.
3.  Refresh.
4.  It should still load!
