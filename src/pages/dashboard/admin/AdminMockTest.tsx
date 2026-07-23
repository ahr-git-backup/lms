import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const AdminMockTest = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: enabled, isLoading } = useQuery({
    queryKey: ["app-setting", "mock_test_enabled"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_app_setting", { p_key: "mock_test_enabled" });
      if (error) throw error;
      return data === true;
    },
  });

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "mock_test_enabled", value: checked });
      if (error) throw error;
      queryClient.setQueryData(["app-setting", "mock_test_enabled"], checked);
      toast({ title: checked ? "Mock Test enabled" : "Mock Test hidden", description: "Home page tile updated." });
    } catch (e: any) {
      toast({ title: "Failed to update", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-fuchsia-600" /> Mock Test
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the Unlimited Mock Test feature and its visibility on the home page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visibility</CardTitle>
          <CardDescription>Show the "Mock Test" tile next to Study Tracker on the home page.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch checked={!!enabled} onCheckedChange={handleToggle} disabled={saving} />
          )}
          <span className="text-sm font-medium">{enabled ? "Visible to students" : "Hidden from students"}</span>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Content management</CardTitle>
          <CardDescription>Coming soon</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Full content authoring (subject/chapter/topic, CSV upload, question bank, and linking readymade exams)
          will be added here, reusing the same building blocks as the Exam tab.
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMockTest;
