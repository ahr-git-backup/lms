import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NotesManager from "@/components/admin/NotesManager";
import ExamsManager from "@/components/admin/ExamsManager";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const DAILY_FREE_EXAM_LIMIT_KEY = "daily_free_exam_limit";

const DailyFreeExamLimitControl = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [value, setValue] = useState<string>("");
    const [saving, setSaving] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["app-setting", DAILY_FREE_EXAM_LIMIT_KEY],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("app_settings")
                .select("value")
                .eq("key", DAILY_FREE_EXAM_LIMIT_KEY)
                .maybeSingle();
            if (error) throw error;
            return data?.value ?? null;
        },
    });

    useEffect(() => {
        if (data !== undefined && data !== null) {
            setValue(String(data));
        }
    }, [data]);

    const handleSave = async () => {
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
            toast({ title: "Invalid value", description: "Enter a whole number (0 = unlimited).", variant: "destructive" });
            return;
        }
        setSaving(true);
        const { error } = await supabase
            .from("app_settings")
            .upsert({ key: DAILY_FREE_EXAM_LIMIT_KEY, value: parsed, updated_at: new Date().toISOString() });
        setSaving(false);
        if (error) {
            toast({ title: "Failed to save", description: error.message, variant: "destructive" });
            return;
        }
        queryClient.invalidateQueries({ queryKey: ["app-setting", DAILY_FREE_EXAM_LIMIT_KEY] });
        toast({ title: "Saved", description: "Daily free exam limit updated." });
    };

    return (
        <Card>
            <CardContent className="pt-6 flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="daily_free_exam_limit">Daily Free Exam Limit (per user)</Label>
                    <Input
                        id="daily_free_exam_limit"
                        type="number"
                        min={0}
                        placeholder={isLoading ? "Loading..." : "0 = unlimited"}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-40"
                    />
                </div>
                <Button onClick={handleSave} disabled={saving || isLoading}>
                    {saving ? "Saving..." : "Save"}
                </Button>
                <p className="text-xs text-muted-foreground w-full">
                    Free (non-enrolled) users can start at most this many "Free Exams" per day. Set to 0 for unlimited.
                </p>
            </CardContent>
        </Card>
    );
};

const AdminFreeContent = () => {
    useEffect(() => {
        document.title = "Free Content Manager – Atlas";
    }, []);

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <h1 className="text-xl font-bold tracking-tight">Free Content Manager</h1>
                <p className="text-muted-foreground">Manage free classes (notes) and exams visible to everyone.</p>
            </header>
            <DailyFreeExamLimitControl />
            <Tabs defaultValue="notes" className="space-y-4">
                <TabsList className="flex flex-wrap h-auto">
                    <TabsTrigger value="notes">Free Classes (Notes)</TabsTrigger>
                    <TabsTrigger value="exams">Free Exams</TabsTrigger>
                </TabsList>
                <TabsContent value="notes">
                    <NotesManager isFreeMode={true} />
                </TabsContent>
                <TabsContent value="exams">
                    <ExamsManager isFreeMode={true} />
                </TabsContent>
            </Tabs>
        </div>
    );
};
export default AdminFreeContent;
