import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import PublicHeader from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Gift, LayoutDashboard } from "lucide-react";

export default function MyCoursesPWA() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: enrollments, isLoading } = useEnrollments();
  const directCourses = (enrollments || []).filter((e: any) => !e.is_extra);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />
      <div className="px-4 py-3">
        <p className="text-lg font-bold leading-tight">আমার কোর্স</p>
      </div>
      <main className="flex-1 px-4 pb-4">
        {!user ? (
          <Card className="border-dashed">
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-2">
              <GraduationCap className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">আপনার কোর্স দেখতে লগইন করুন</p>
              <Button size="sm" onClick={() => navigate("/login")}>লগইন করুন</Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">লোড হচ্ছে...</div>
        ) : directCourses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-2">
              <GraduationCap className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">আপনি কোনো কোর্সে ভর্তি নেই</p>
              <Button size="sm" onClick={() => navigate("/courses")}>কোর্স কিনুন</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {directCourses.map((enrollment: any) => (
              <Card key={enrollment.id} className="overflow-hidden">
                <CardContent className="p-2.5 flex flex-col gap-2">
                  <div className="h-20 w-full shrink-0 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                    {enrollment.course?.image_url ? (
                      <img src={enrollment.course.image_url} alt={enrollment.course.name} className="h-full w-full object-cover" />
                    ) : (
                      <GraduationCap className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs leading-tight line-clamp-2">
                      {enrollment.course?.name || "কোর্স"}
                    </p>
                    {enrollment.bonus_courses?.length > 0 && (
                      <p className="text-[10px] text-purple-600 dark:text-purple-300 flex items-center gap-1 mt-0.5">
                        <Gift className="h-3 w-3" /> +{enrollment.bonus_courses.length} বোনাস
                      </p>
                    )}
                  </div>
                  <Button size="sm" className="gap-1.5 w-full text-xs" onClick={() => navigate(`/dashboard`)}>
                    <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
