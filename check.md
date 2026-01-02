# Website Functional Testing Checklist

This checklist outlines the steps to verify every single function of the Learning Management System (LMS) for both **Admin** and **Student** roles.

## Prerequisites
*   A deployed instance of the website.
*   **Admin Account**: Credentials with `admin` role in `user_roles`.
*   **Student Account**: Credentials with `user` role (or no specific role).
*   **Database**: Ensure `supabase_schema_fix.sql` and `supabase_schedule_tables.sql` have been run to set up tables and RLS policies.

---

## 1. System & General Checks
| Function | Steps to Test | Expected Result |
| :--- | :--- | :--- |
| **Theme Toggle** | Click the Sun/Moon icon in the header (Desktop) or Menu (Mobile). | Theme switches between Light and Dark mode. Accent color in Dark mode is Blue. |
| **Mobile Sidebar** | Resize window to mobile width (<640px). Click Hamburger icon. | Sidebar drawer opens. Menu items are listed. Can navigate. |
| **Sidebar Minimize** | On Desktop, click the Sidebar trigger icon (top-left). | Sidebar collapses to icons only. Hovering shows tooltips. Scrolling works if content overflows. |
| **Security (Anti-Piracy)** | Right-click anywhere. | Context menu does **not** appear. |
| **Security (Text Selection)** | Try to select text on the page. | Text cannot be selected (except in Input/Textarea). |
| **Security (Shortcuts)** | Press `F12`, `Ctrl+Shift+I`, `Ctrl+U`, `Ctrl+S`, `Ctrl+P`. | Nothing happens (Default browser action prevented). |

---

## 2. Admin Workflows
**Login as Admin first.**

### A. Dashboard Overview
| Function | Steps to Test | Expected Result |
| :--- | :--- | :--- |
| **Admin Access** | Check Sidebar for "Admin Panel" section. | "Admin Panel" group is visible with links: Courses, Students, Schedule, Exams, Announcements, Resources. |

### B. Course Management
| Function | Steps to Test | Expected Result |
| :--- | :--- | :--- |
| **List Courses** | Go to **Admin > Courses**. | List of existing courses is displayed. |
| **Create Course** | Fill "Course name" and "Description". Click "Create Course". | Toast appears "Course created". Course appears in the list. |
| **Delete Course** | Click "Delete" button on a course row. Confirm. | Toast appears "Course deleted". Course disappears from list. |

### C. Student Management
| Function | Steps to Test | Expected Result |
| :--- | :--- | :--- |
| **List Students** | Go to **Admin > Students**. | List of registered students is displayed. Role column shows "User". |
| **Filter by Course** | Select a course from dropdown. | List updates to show only students enrolled in that course. |
| **Enroll Student** | Enter a valid Student Reg ID and select a Course. Click "Enroll". | Toast appears "Student enrolled successfully". Student appears in list when filtered by that course. |

### D. Schedule & Classes
| Function | Steps to Test | Expected Result |
| :--- | :--- | :--- |
| **Create Class** | Go to **Admin > Class Schedule**. Select Course, Type (Live/Recorded), Title, Start/End Time. Click "Create class". | Toast appears "Class saved". Class appears in the table below. |
| **Edit Class** | Click a class row in the table. Modify details. Click "Update class". | Toast appears "Class saved". Details in table update. |
| **Delete Class** | Click Trash icon on a class row. Confirm. | Toast appears "Class deleted". Row removed. |

### E. Exam Management
| Function | Steps to Test | Expected Result |
| :--- | :--- | :--- |
| **Create Exam Metadata** | Go to **Admin > Exams**. Fill details (Title, Type, Duration, Window). Click "Create exam". | Toast appears "Exam saved". Exam appears in the list. |
| **Edit Questions** | Click **"Questions"** button on the new exam row. | Navigates to **Question Maker** page. Exam title is pre-filled. |
| **Add Questions** | Type a question, options, select correct answer. Click "Save Question". | Question is added to the list below. |
| **Import JSON** | Click "Import". Select a JSON file (array of questions). | Questions are loaded into the list. |
| **Save to Database** | Click **"Save to Exam"**. Confirm dialog. | Toast appears "Success". Questions are persisted to DB. |
| **Verify Persistence** | Navigate back to Exams, then click "Questions" again. | Previously saved questions are loaded. |
| **View Leaderboard** | Click **"Rank"** (Trophy icon) on an exam row. | Navigates to Leaderboard page. Shows list of students (empty if no attempts). |

### F. Resources & Announcements
| Function | Steps to Test | Expected Result |
| :--- | :--- | :--- |
| **Add Resource** | Go to **Admin > Resources**. Fill details (Title, URL, Type, Course). Click "Add". | Resource appears in the table. |
| **Post Announcement** | Go to **Admin > Announcements**. Fill Title, Body, Course. Click "Post". | Announcement appears in history. |

---

## 3. Student Workflows
**Login as Student.**

### A. Dashboard & Routine
| Function | Steps to Test | Expected Result |
| :--- | :--- | :--- |
| **Dashboard Home** | Go to **Dashboard**. | Shows "Next live class", "Upcoming exam", "New notes" cards with *real data* (if admin added schedules). |
| **Sidebar Menu** | Check Sidebar. | Shows "Student" links: Live Class, Live Exam, Past Exams, Results, Routine, etc. |
| **Routine - Timetable** | Go to **Routine**. Click "This Week's Timetable". | Shows grid of classes for the current week. |
| **Routine - Schedule** | Click "Monthly Schedule". | Shows list of upcoming classes and exams grouped by date. |

### B. Live Class
| Function | Steps to Test | Expected Result |
| :--- | :--- | :--- |
| **View Live Class** | Go to **Live Class**. | Shows classes scheduled for today/future. |
| **Join Class** | Click "Join Class" (if link provided). | Opens video URL in new tab. |

### C. Live Exam
| Function | Steps to Test | Expected Result |
| :--- | :--- | :--- |
| **View Live Exams** | Go to **Live Exam**. | Shows exams with `exam_type='live'` and valid time window. |
| **Start Exam** | Click "Take Exam". | If within window: Opens exam interface. If too early: Shows "Not started". |
| **Taking Exam** | Select answers. Check Timer. | Questions render with MathJax. Timer counts down. Selection prevented. |
| **Submit Exam** | Click "Submit" or wait for timer. | Submits answers. Redirects to "Exam Review" or "Results". |
| **Re-attempt Block** | Try to "Take Exam" again for the same live exam. | Shows "You have already taken this live exam". Links to Result/Leaderboard. |

### D. Practice & Results
| Function | Steps to Test | Expected Result |
| :--- | :--- | :--- |
| **Past Exam Catalog** | Go to **Past Exams**. | Shows expired live exams and practice exams. |
| **Practice Attempt** | Click "Start Practice". | Opens exam. Can submit and retake multiple times. |
| **View Results** | Go to **Results**. | Shows list of all attempts with Scores. |
| **Leaderboard** | Click Trophy icon on a result row. | Shows Leaderboard with your rank highlighted (if logic supports highlighting). |
| **Exam Review** | Click "Review" on a result row. | Shows question-by-question review with Correct/Wrong indicators and explanations. |

### E. Resources & Notes
| Function | Steps to Test | Expected Result |
| :--- | :--- | :--- |
| **Access Resources** | Go to **Resources**. | List of PDFs/Links added by Admin. "Open" button works. |
| **Class Notes** | Go to **Class Notes**. | List of notes (filtered resources). |

### F. Reminders & Profile
| Function | Steps to Test | Expected Result |
| :--- | :--- | :--- |
| **Set Reminders** | Go to **Reminders**. Toggle switches, set minutes. Save. | Toast "Preferences saved". (Note: Actual notifications depend on external triggers/push, this saves prefs). |
| **View Analytics** | Go to **Exam Analytics**. | Shows stats: Total attempts, Average score, Charts. |

---

## 4. Edge Cases to Verify
1.  **Late Join**: Try joining a live exam 1 minute before end time. Timer should show 1 minute.
2.  **No Data**: Check pages when no classes/exams exist. Should show "No data" message, not crash.
3.  **JSON Import**: Import a malformed JSON file in Exam Creator. Should show error toast, not crash page.
4.  **Network Disconnect**: (Optional) Disconnect internet while taking exam. Submit should fail gracefully (retry logic or error).
