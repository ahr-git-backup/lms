import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const HelpFaq = () => {
  useEffect(() => {
    document.title = "Help & FAQ – Beshi Joss LMS";
  }, []);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Help &amp; FAQ</h1>
        <p className="text-sm text-muted-foreground">
          Short answers to the most common questions for students and admins.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border border-foreground/60">
          <CardHeader>
            <CardTitle className="text-base">Students</CardTitle>
            <CardDescription>Using the LMS as a student.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">How do I log in?</p>
              <p>
                Use the <span className="font-mono text-foreground">Registration ID</span> and password given by the
                coaching. There is no public signup.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Where are my live classes and exams?</p>
              <p>
                After logging in, go to <span className="font-mono text-foreground">Dashboard &gt; Live Class</span> or
                <span className="font-mono text-foreground"> Live Exam</span>. Use the course filter at the top to
                switch between courses.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">How do I see my exam results?</p>
              <p>
                Open <span className="font-mono text-foreground">Past Exam</span> in the sidebar to see all previous
                attempts and answer reviews. Use <span className="font-mono text-foreground">Exam Analytics</span> for
                a quick performance summary.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">How do reminders work?</p>
              <p>
                Use <span className="font-mono text-foreground">Reminders</span> to choose how early you want to be
                notified before live classes and exams. The rules are global for all your courses.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-foreground/60">
          <CardHeader>
            <CardTitle className="text-base">Admins</CardTitle>
            <CardDescription>Managing content and users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">How do I create test accounts?</p>
              <p>
                Use the dedicated seeding tool on the dashboard (visible only to admins) to create sample admin/student
                users and demo content.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Where is the admin panel?</p>
              <p>
                After logging in as an admin, you will see an <span className="font-mono text-foreground">Admin
                Panel</span> section in the sidebar with links for Courses, Students, Classes, and Exams.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">How are announcements shown to students?</p>
              <p>
                Announcements can be general or course-specific. Students see them on the
                <span className="font-mono text-foreground"> Announcements</span> page with a course badge and
                published date.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Who can change student profiles?</p>
              <p>
                Students can edit their own basic details on the <span className="font-mono text-foreground">Profile
                </span> page. Admins manage roles and course assignments from the admin panel.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default HelpFaq;
