import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PublicHeader from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Phone, GraduationCap, School, LogIn } from "lucide-react";

export default function PWAProfile() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useEffect(() => {
    document.title = "Account – Atlas";
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PublicHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <User className="h-14 w-14 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">আপনি লগইন করেননি</h2>
            <p className="text-sm text-muted-foreground mt-1">
              আপনার একাউন্ট দেখতে লগইন করুন।
            </p>
          </div>
          <Button onClick={() => navigate("/login")} className="gap-2">
            <LogIn className="h-4 w-4" /> লগইন করুন
          </Button>
        </div>
      </div>
    );
  }

  const isAccountOpen = Boolean(profile?.full_name && profile?.phone);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />
      <div className="flex-1 px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold">আমার একাউন্ট</h1>

        {!isAccountOpen ? (
          <Card className="border-dashed">
            <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
              <User className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-semibold">একাউন্ট এখনো খোলা হয়নি</p>
                <p className="text-sm text-muted-foreground mt-1">
                  একাউন্ট খুললে আপনার তথ্য এখানে দেখতে পাবেন।
                </p>
              </div>
              <Button onClick={() => navigate("/complete-profile")}>
                একাউন্ট খুলুন
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">নাম</p>
                    <p className="font-medium">{profile?.full_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">ফোন নম্বর</p>
                    <p className="font-medium">{profile?.phone || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <School className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">কলেজ</p>
                    <p className="font-medium">{(profile as any)?.college_name || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">HSC ব্যাচ</p>
                    <p className="font-medium">{(profile as any)?.hsc_batch || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard/profile")}>
              তথ্য সম্পাদনা করুন
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
