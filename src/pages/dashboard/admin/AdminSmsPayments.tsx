import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquareText } from "lucide-react";

// Serial queue: one unmatched SMS at a time, oldest first. Admin handles each
// in turn — match it, or skip to the next. Keeps multiple users' payments
// from being approved out of order or in parallel.
function QueueCard({ rows, index, onNext }: { rows: any[]; index: number; onNext: () => void }) {
  const row = rows[index];
  const total = rows.length;
  return (
    <Card className="border-2 border-green-600/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{index + 1} / {total}</p>
          <Badge variant="outline" className="text-[10px]">{row.status === "error" ? "Error" : "Unmatched"}</Badge>
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-mono font-semibold">৳{row.amount}</p>
          <p className="text-sm font-mono">{row.sender_phone || "নম্বর নেই"}</p>
          <p className="text-[11px] text-muted-foreground">{format(new Date(row.created_at), "dd MMM yyyy, hh:mm a")}</p>
          {row.note && <p className="text-[11px] text-muted-foreground">{row.note}</p>}
        </div>
        <Button variant="outline" className="w-full" disabled={index >= total - 1} onClick={onNext}>
          পরেরটা →
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminSmsPayments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"all" | "unmatched">("unmatched");
  const [queueIdx, setQueueIdx] = useState(0);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["sms-payment-relay-log", tab],
    queryFn: async () => {
      let query = supabase
        .from("sms_payment_relay_log")
        .select("*")
        .order("created_at", { ascending: tab === "unmatched" })
        .limit(100);
      if (tab === "unmatched") query = query.in("status", ["unmatched", "error"]);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  const statusBadge = (status: string) => {
    if (status === "matched") return <Badge className="bg-green-600 text-white text-[10px]">Matched</Badge>;
    if (status === "error") return <Badge variant="destructive" className="text-[10px]">Error</Badge>;
    return <Badge variant="outline" className="text-[10px]">Unmatched</Badge>;
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-green-600" /> SMS Payment Relay
        </h1>
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1 max-w-xs">
        <button
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${tab === "unmatched" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          onClick={() => setTab("unmatched")}
        >
          না-মেলা
        </button>
        <button
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${tab === "all" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          onClick={() => setTab("all")}
        >
          সব SMS
        </button>
      </div>

      {tab === "unmatched" && rows && rows.length > 0 && (
        <QueueCard
          rows={rows}
          index={Math.min(queueIdx, rows.length - 1)}
          onNext={() => setQueueIdx((i) => Math.min(i + 1, rows.length - 1))}
        />
      )}

      {tab === "all" && (
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-2">
          {isLoading && <p className="text-xs text-muted-foreground">লোড হচ্ছে...</p>}
          {!isLoading && !rows?.length && (
            <p className="text-xs text-muted-foreground text-center py-6">
              {tab === "unmatched" ? "কোনো না-মেলা SMS নেই — সব ঠিকঠাক অটো-ম্যাচ হয়েছে।" : "এখনো কোনো SMS আসেনি।"}
            </p>
          )}
          {rows?.map((row: any) => (
            <div key={row.id} className="flex items-center gap-2 rounded-lg border p-2.5">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-mono font-medium">৳{row.amount} · {row.sender_phone || "নম্বর নেই"}</p>
                  {statusBadge(row.status)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {format(new Date(row.created_at), "dd MMM, hh:mm a")}
                </p>
                {row.note && <p className="text-[11px] text-muted-foreground truncate">{row.note}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      )}

    </div>
  );
}
