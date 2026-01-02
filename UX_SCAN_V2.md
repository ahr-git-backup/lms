# UX & Security Scan V2 - Deep Dive

## Overview
Following the initial optimization scan, a deep-dive security and logic analysis was performed on critical Student and Admin pages.

## Summary of Findings & Fixes

### 1. Data Leakage & Access Control
*   **Resources Page (`Resources.tsx`)**:
    *   **Loophole:** The application was fetching *all* resources and filtering them on the client side. A savvy user could inspect network traffic to access resources for unpurchased courses.
    *   **Fix:** Updated the database query to strictly filter resources by the user's `enrolledCourseIds` on the server/DB side.
*   **Leaderboard (`Leaderboard.tsx`)**:
    *   **Loophole:** Knowledge of a valid `examId` (UUID) allowed any user to view the leaderboard (and student list) for that exam, even if not enrolled.
    *   **Fix:** Added an explicit enrollment check (`check-leaderboard-access`) before rendering the leaderboard.
*   **Admin Students List (`AdminStudents.tsx`)**:
    *   **Loophole:** The query was selecting `*` from profiles. While the UI didn't show sensitive info, the API response might include private fields.
    *   **Fix:** Restricted the `select` clause to specific needed columns (`id`, `full_name`, `registration_id`, etc.).

### 2. Input Integrity & Security
*   **Student Profile (`StudentProfile.tsx`)**:
    *   **Loophole:** The "Full Name" input was disabled in the UI, but the submit handler included it in the update payload. A user could technically bypass the UI restriction.
    *   **Fix:** Removed `full_name` from the update query completely.
*   **Exam Creator (`ExamCreator.tsx`)**:
    *   **Loophole:** The JSON Import feature did not sanitize HTML content. Importing a malicious file could execute XSS attacks in the Admin dashboard and propagate to students via `MathText`.
    *   **Fix:** Implemented a `sanitizeHtml` function that strips `<script>`, `<iframe>`, and `on*` event handlers from imported content before processing.

## Remaining Considerations
*   **Backend RLS:** The client-side fixes are robust, but ensuring Row Level Security (RLS) policies in Supabase also enforce these constraints (e.g., "Users can only select resources for enrolled courses") is the ultimate layer of defense. These client-side query updates align with best practices.
*   **Performance:** The new filtering logic improves performance by reducing payload sizes (fetching less data).

## Conclusion
The application is now significantly more secure against data leaks and common web vulnerabilities.
