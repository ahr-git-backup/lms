import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const remindersSchema = z.object({
  remind_before_minutes: z
    .string()
    .trim()
    .min(1, { message: "Required" })
    .refine((val) => {
      const n = Number(val);
      return Number.isFinite(n) && n >= 5 && n <= 1440;
    }, { message: "Enter between 5 and 1440 minutes" }),
  remind_for_live_classes: z.boolean(),
  remind_for_live_exams: z.boolean(),
  remind_for_practice_exams: z.boolean(),
});

type RemindersFormValues = z.infer<typeof remindersSchema>;

const Reminders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "Reminders – Beshi Joss LMS";
  }, []);

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["reminder-preferences", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("reminder_preferences")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  const form = useForm<RemindersFormValues>({
    resolver: zodResolver(remindersSchema),
    defaultValues: {
      remind_before_minutes: prefs?.remind_before_minutes?.toString() ?? "60",
      remind_for_live_classes: prefs?.remind_for_live_classes ?? true,
      remind_for_live_exams: prefs?.remind_for_live_exams ?? true,
      remind_for_practice_exams: prefs?.remind_for_practice_exams ?? false,
    },
    values: {
      remind_before_minutes: prefs?.remind_before_minutes?.toString() ?? "60",
      remind_for_live_classes: prefs?.remind_for_live_classes ?? true,
      remind_for_live_exams: prefs?.remind_for_live_exams ?? true,
      remind_for_practice_exams: prefs?.remind_for_practice_exams ?? false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: RemindersFormValues) => {
      if (!user) return;
      const minutes = Number(values.remind_before_minutes);

      const payload = {
        profile_id: user.id,
        remind_before_minutes: minutes,
        remind_for_live_classes: values.remind_for_live_classes,
        remind_for_live_exams: values.remind_for_live_exams,
        remind_for_practice_exams: values.remind_for_practice_exams,
      };

      if (prefs?.id) {
        const { error } = await supabase
          .from("reminder_preferences")
          .update(payload)
          .eq("id", prefs.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reminder_preferences").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder-preferences", user?.id] });
      toast({
        title: "Reminder preferences saved",
        description: "Your global reminder settings are updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save preferences",
        description: error.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: RemindersFormValues) => {
    mutation.mutate(values);
  };

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reminders</h1>
        <p className="text-sm text-muted-foreground">
          Control how early and for which activities you want reminder notifications.
        </p>
      </header>

      <Card className="max-w-xl border border-foreground/60">
        <CardHeader>
          <CardTitle className="text-base">Global reminder preferences</CardTitle>
          <CardDescription>
            These rules apply to all your live classes and exams across courses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading preferences…</p>
          ) : (
            <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="remind_before_minutes">Remind me before (minutes)</Label>
                <Input
                  id="remind_before_minutes"
                  type="number"
                  min={5}
                  max={1440}
                  {...form.register("remind_before_minutes")}
                />
                {form.formState.errors.remind_before_minutes && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.remind_before_minutes.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  For example, 60 means you&apos;ll be reminded 1 hour before a class or exam.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="live_classes">Live classes</Label>
                    <p className="text-xs text-muted-foreground">Remind me before live classes start.</p>
                  </div>
                  <Switch
                    id="live_classes"
                    checked={form.watch("remind_for_live_classes")}
                    onCheckedChange={(val) => form.setValue("remind_for_live_classes", val)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="live_exams">Live exams</Label>
                    <p className="text-xs text-muted-foreground">Remind me before scheduled live exams.</p>
                  </div>
                  <Switch
                    id="live_exams"
                    checked={form.watch("remind_for_live_exams")}
                    onCheckedChange={(val) => form.setValue("remind_for_live_exams", val)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="practice_exams">Practice exams</Label>
                    <p className="text-xs text-muted-foreground">Remind me about practice exams as well.</p>
                  </div>
                  <Switch
                    id="practice_exams"
                    checked={form.watch("remind_for_practice_exams")}
                    onCheckedChange={(val) => form.setValue("remind_for_practice_exams", val)}
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" size="sm" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving…" : "Save preferences"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
};

export default Reminders;
