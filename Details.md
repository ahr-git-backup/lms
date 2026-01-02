# Beshi Joss LMS - Feature Details & Architecture

This document provides a comprehensive breakdown of the key features, security mechanisms, and gamification logic implemented in the Beshi Joss Learning Management System.

## 1. Gamified Study Streak

The **Study Streak** encourages students to engage with the platform daily. It is displayed prominently on the Student Dashboard.

### **How it works:**
*   **Tracking:** The system tracks the `last_study_date` in the `user_study_data` table (JSONB column `streak_info`).
*   **Logic:**
    1.  **Increment:** If the `last_study_date` was **yesterday**, completing an activity today increments the streak by 1.
    2.  **Maintain:** If the `last_study_date` is **today**, the streak remains unchanged (already counted for the day).
    3.  **Reset:** If the `last_study_date` was **before yesterday** (missed a day), the streak resets to 1 upon new activity.
    4.  **Auto-Increment:** Simply visiting the Dashboard checks this logic and updates the streak automatically if eligible.
*   **Activities that count:**
    *   Visiting the Dashboard.
    *   Completing a Pomodoro Timer session.
    *   Adding or Editing Flashcards.

## 2. Session Control & Security

We implement strict session enforcement to prevent account sharing (a common issue for paid coaching content).

### **Single Device Login:**
*   **Mechanism:** When a user logs in, a unique `current_session_id` (UUID) is generated and stored in both:
    1.  The browser's `localStorage` (`app_session_id`).
    2.  The database `profiles` table (`current_session_id` column).
*   **Enforcement:**
    *   The `AuthContext` runs a check on every route change.
    *   It compares the local session ID with the one in the database.
    *   **Result:** If they don't match (meaning a new login occurred on another device/browser), the current session is immediately invalidated, and the user is logged out with a warning toast: *"You have been logged in on another device/browser."*

### **Anti-Cheat (Exams):**
*   **Tab Switch Detection:** A hook (`useAntiCheat`) listens for `visibilitychange` events and window blur events. If a student leaves the exam tab, a warning is shown, and a violation counter is incremented.
*   **Prevention:** Right-click context menu and common developer tool shortcuts (`F12`, `Ctrl+Shift+I`, etc.) are disabled via JavaScript to deter inspection of answers.

## 3. Live Exam System

The exam system is designed for high-concurrency live tests and practice modes.

### **Workflow:**
1.  **Scheduling:** Admins set a `time_window_start` and `time_window_end` for Live Exams.
2.  **Access:**
    *   Students can only enter the exam during this window.
    *   The "Take Exam" button is disabled before the start time.
    *   If a student tries to enter late, they only get the remaining time.
3.  **Question Fetching:**
    *   Questions are fetched via a secure PostgreSQL RPC function `get_exam_questions`.
    *   **Security:** This function explicitly **excludes** the `correct_option` column from the response, ensuring the correct answers are never sent to the frontend (preventing "Inspect Element" cheating).
4.  **Submission & Scoring:**
    *   Answers are submitted to another RPC function `submit_exam_attempt`.
    *   **Server-Side Scoring:** The database calculates the score instantly by comparing submitted options with the stored correct answers. It handles positive marks and negative marking logic.
    *   **Result:** The final score is returned and stored in `exam_attempts`.

## 4. Study Tools (Program Page)

A suite of productivity tools integrated into the dashboard.

*   **Global Context:** Tools run in a global React Context (`StudyToolsContext`), allowing them to persist in the background even when navigating between pages.
*   **Floating Player:** A floating circle UI (bottom-right) appears when audio is playing or the Pomodoro timer is active, allowing quick control without leaving the current page.
*   **Components:**
    *   **Pomodoro:** Customizable Work/Break timer with audio alerts.
    *   **White Noise:** Audio player for focus sounds (Rain, Forest, Cafe) using Google Actions assets.
    *   **Flashcards:** Subject-wise flashcards synced with Supabase (`user_study_data` JSONB). Supports Flip animation.
    *   **Todo List:** Local-storage based task manager.
    *   **Interval Reminder:** A customizable recurring alarm (e.g., "Drink water every 20 mins") that sends browser notifications.

## 5. Technology Stack

*   **Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui.
*   **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Realtime).
*   **State:** TanStack Query (React Query) for server state, React Context for global UI state.
*   **Deployment:** Ready for Vercel/Netlify.
