import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

interface PayDueDialogProps {
  open: boolean;
  onClose: () => void;
  paymentRequestId: string;
  remainingDue: number;
  courseName?: string;
  bkashNumber?: string;
  nagadNumber?: string;
}

// Student-facing "pay off the remaining due" form. Submits directly via the
// submit_due_payment RPC, which applies the amount to amount_paid and logs
// it in emi_logs right away — there's no payment gateway in this app, every
// payment here (including the original enrollment payment) is a manually
// claimed bKash/Nagad trx id, so this mirrors that same trust model.
export const PayDueDialog = ({ open, onClose, paymentRequestId, remainingDue, courseName, bkashNumber, nagadNumber }: PayDueDialogProps) => {
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<"bkash" | "nagad">("bkash");
  const [amount, setAmount] = useState(String(remainingDue));
  const [senderLast5, setSenderLast5] = useState("");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} কপি হয়েছে!`);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("সঠিক পরিমাণ লিখুন");
      if (amt > remainingDue) throw new Error("বাকি টাকার চেয়ে বেশি লেখা যাবে না");
      if (senderLast5.length !== 5) throw new Error("Last 5 digits অবশ্যই ৫ সংখ্যার হতে হবে");

      const { error } = await supabase.rpc("submit_due_payment", {
        p_payment_request_id: paymentRequestId,
        p_amount: amt,
        p_payment_method: paymentMethod,
        p_sender_last5: senderLast5,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("পেমেন্ট সফলভাবে জমা হয়েছে! আপনার এক্সেস আপডেট হয়েছে।");
      queryClient.invalidateQueries({ queryKey: ["student-payments"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["check-class-access"] });
      setSenderLast5("");
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "জমা দিতে ব্যর্থ হয়েছে");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>বাকি টাকা পরিশোধ করুন</DialogTitle>
          <DialogDescription>
            {courseName ? `${courseName} — ` : ""}বাকি আছে ৳{remainingDue}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <Label>পেমেন্ট মেথড</Label>
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "bkash" | "nagad")} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bkash" id="due-bkash" />
                <Label htmlFor="due-bkash">বিকাশ</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nagad" id="due-nagad" />
                <Label htmlFor="due-nagad">নগদ</Label>
              </div>
            </RadioGroup>
          </div>

          {(paymentMethod === "bkash" ? bkashNumber : nagadNumber) && (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2.5">
              <span className="font-mono text-xs">{paymentMethod === "bkash" ? bkashNumber : nagadNumber}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1"
                onClick={() => copyToClipboard((paymentMethod === "bkash" ? bkashNumber : nagadNumber) || "", "নম্বর")}
              >
                <Copy className="h-3 w-3" /> কপি
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="due-amount-input">কত টাকা পাঠিয়েছেন</Label>
            <Input
              id="due-amount-input"
              type="number"
              min={1}
              max={remainingDue}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="due-last5-input">Sender Number-এর শেষ ৫ সংখ্যা</Label>
            <Input
              id="due-last5-input"
              maxLength={5}
              value={senderLast5}
              onChange={(e) => setSenderLast5(e.target.value.replace(/\D/g, ""))}
              placeholder="12345"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            জমা দিন
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
