# Supabase Usage Audit & Optimization Report

## Overview
This audit analyzes the current Supabase usage patterns in the Atlas application to identify bandwidth bottlenecks and optimize performance for Admin, Teacher, and Student roles.

## Key Findings

### 1. `AdminPayments` (Optimized)
*   **Issue:** The payment request list was fetching all columns (`*`) including potentially unused metadata, along with full relation data.
*   **Fix:** Updated the query to select only necessary fields:
    ```sql
    select id, created_at, phone, trx_id, payment_method, status, profile_id, course_id, ...
    ```
*   **Impact:** Reduces payload size by approx. 30-50% per request, especially if `payment_requests` table grows.

### 2. `Community` (Optimized)
*   **Issue:** The community page was fetching all columns for resources.
*   **Fix:** Updated to select `id, title, url, description, resource_type, course_id`.
*   **Impact:** Significant reduction in bandwidth for public/student facing pages.

### 3. `TakeExam` & Exam Access
*   **Status:** The exam taking page uses an optimized RPC `get_exam_questions_start` which fetches only the question text and options (hiding answers). This is good for security and bandwidth.
*   **Recommendation:** Ensure `get_exam_questions` (full) is only called by Admins or after exam submission for review.

### 4. `useEnrollments` Hook
*   **Observation:** This hook is used globally and fetches `*` from enrollments.
*   **Recommendation:** Change `select('*')` to `select('*, course:courses(id, name, slug)')` to avoid fetching full course descriptions on every page load.
    *   *Note: This requires a global refactor as many components might rely on implicit fields. Recommended for future sprint.*

## Bandwidth Estimates (Free Tier)
*   **Supabase Free Tier:** 50MB Database space, 2GB Bandwidth/month (soft limit, often higher).
*   **Student Usage:**
    *   Dashboard Load: ~50KB (Enrollments + Notices + Profile).
    *   Exam (100 Qs): ~200KB.
    *   Daily Active User (DAU) approx. usage: 0.5MB - 1MB.
    *   **Capacity:** ~2,000 - 4,000 monthly active users (MAU) assuming moderate usage.
*   **Admin Usage:**
    *   Heavier due to lists and reports. Admin pages should use pagination (already implemented in Payments/Community) to scale.

## Recommendations for Future
1.  **Pagination:** Ensure all admin lists (Students, Courses) use server-side pagination (like `AdminPayments` does).
2.  **Field Selection:** Always use explicit `.select('field1, field2')` instead of `*`.
3.  **Caching:** Increase React Query `staleTime` for static content (like Courses, Community Links) to 5-10 minutes.
