import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquareText, CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Manual-approve fallback for a row the auto-matcher couldn't confidently
// match (e.g. sender number typo, name mismatch). Admin picks the right pending
// payment_requests row by searching name/phone, same data the normal
// AdminPayments due-list already shows.
function ManualMatchDialog({ row, onClose, onDone }: { row: any; onClose: () => void; onDone: () => void }) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const { data: candidates } = useQuery({
    queryKey: ["pending-payment-requests-search", search],
    queryFn: async () => {
      let query = supabase
        .from("payment_requests")
        .select("id, amount_sent, sender_last5, created_at, profiles:profile_id(full_name, phone), courses:course_id(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);
      const { data, error } = await query;
      if (error) throw error;
      if (!search.trim()) return data || [];
      const q = search.trim().toLowerCase();
      return (data || []).filter((r: any) =>
        r.profiles?.full_name?.toLowerCase().includes(q) ||
        r.profiles?.phone?.includes(q) ||
        r.sender_last5?.includes(q)
      );
    },
  });

  const handleApprove = async (requestId: string) => {
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("approve_payment_request", { p_request_id: requestId });
      if (rpcError) throw rpcError;
      await supabase
        .from("sms_payment_relay_log")
        .update({ status: "matched", matched_payment_request_id: requestId, note: "Manually matched by admin" })
        .eq("id", row.id);
      toast({ title: "মিলিয়ে Approve করা হয়েছে" });
      onDone();
    } catch (err: any) {
      toast({ title: "Approve করা যায়নি", description: err?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>মিলিয়ে দাও — ৳{row.amount} · {row.sender_phone}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">৳{row.amount} · {row.sender_phone || "নম্বর নেই"}</p>
          <Input placeholder="নাম/ফোন/Trx ID দিয়ে খুঁজুন" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {candidates?.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between gap-2 border rounded-lg p-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.profiles?.full_name || "—"} · {c.courses?.name}</p>
                  <p className="text-xs text-muted-foreground">৳{c.amount_sent} · {c.sender_last5 || c.profiles?.phone} · {format(new Date(c.created_at), "dd MMM, hh:mm a")}</p>
                </div>
                <Button size="sm" disabled={busy} onClick={() => handleApprove(c.id)} className="shrink-0">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "মিলাও"}
                </Button>
              </div>
            ))}
            {!candidates?.length && <p className="text-xs text-muted-foreground text-center py-4">কোনো pending payment পাওয়া যায়নি</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminSmsPayments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"all" | "unmatched">("unmatched");
  const [matchRow, setMatchRow] = useState<any | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["sms-payment-relay-log", tab],
    queryFn: async () => {
      let query = supabase
        .from("sms_payment_relay_log")
        .select("*")
        .order("created_at", { ascending: false })
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
              {row.status !== "matched" && (
                <Button variant="outline" size="sm" className="shrink-0 h-8 px-2" onClick={() => setMatchRow(row)}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> মেলাও
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {matchRow && (
        <ManualMatchDialog
          row={matchRow}
          onClose={() => setMatchRow(null)}
          onDone={() => {
            setMatchRow(null);
            queryClient.invalidateQueries({ queryKey: ["sms-payment-relay-log"] });
          }}
        />
      )}
    </div>
  );
}
