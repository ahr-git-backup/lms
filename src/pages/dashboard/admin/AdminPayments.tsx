import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PaymentRequest } from "@/types/admin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, RefreshCw, Inbox, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const PAGE_SIZE = 10;

const AdminPayments = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // Check for pending payments and beep
    const checkForPending = async () => {
        const { count } = await supabase
            .from("payment_requests")
            .select("*", { count: 'exact', head: true })
            .eq("status", "pending");

        if (count && count > 0) {
            // Play beep if not muted
            if (!isMuted) {
                const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
                audio.play().catch(e => console.error("Audio play failed", e));
            }
        }
    };

    const interval = setInterval(checkForPending, 60000); // Reduced to 60s
    checkForPending();

    return () => clearInterval(interval);
  }, [isMuted]);

  const { data: requestsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-payment-requests", page],
    queryFn: async () => {
      // Fetch requests with relations
      const { data, error, count } = await supabase
        .from("payment_requests")
        .select(`
            id, created_at, phone, trx_id, payment_method, status, profile_id, course_id,
            profiles (full_name, registration_id),
            courses (name, price)
        `, { count: 'exact' })
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const requests = requestsData?.data || [];
  const totalCount = requestsData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
        const { error } = await supabase.rpc("approve_payment_request", { p_request_id: requestId });
        if (error) throw error;
    },
    onSuccess: () => {
        toast.success("Request approved and student enrolled.");
        queryClient.invalidateQueries({ queryKey: ["admin-payment-requests"] });
    },
    onError: (error) => {
        toast.error("Failed to approve: " + error.message);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (requestId: string) => {
        const { error } = await supabase.rpc("reject_payment_request", { p_request_id: requestId });
        if (error) throw error;
    },
    onSuccess: () => {
        toast.success("Request rejected.");
        queryClient.invalidateQueries({ queryKey: ["admin-payment-requests"] });
    },
    onError: (error) => {
        toast.error("Failed to reject: " + error.message);
    }
  });

  if (isLoading) {
      return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
        <div>
            <h1 className="text-xl font-bold tracking-tight">Payment Requests</h1>
            <p className="text-sm text-muted-foreground">Review and approve student enrollments.</p>
        </div>
        <div className="flex gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMuted(!isMuted)}
                className="gap-2"
                title={isMuted ? "Unmute notification sound" : "Mute notification sound"}
            >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                {isMuted ? "Muted" : "Sound On"}
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="gap-2"
            >
                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                Refresh
            </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>TrxID / Method</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests && requests.length > 0 ? (
              requests.map((request: PaymentRequest) => (
                <TableRow key={request.id}>
                  <TableCell className="whitespace-nowrap">
                      {format(new Date(request.created_at), "dd MMM, hh:mm a")}
                  </TableCell>
                  <TableCell>
                      <div className="font-medium">{request.profiles?.full_name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{request.profiles?.registration_id}</div>
                  </TableCell>
                  <TableCell>{request.phone}</TableCell>
                  <TableCell>
                      <div className="font-medium">{request.courses?.name || "Unknown Course"}</div>
                      <div className="text-xs text-muted-foreground">
                        Fee: {request.courses?.price ? `৳${request.courses.price}` : "Free"}
                      </div>
                  </TableCell>
                  <TableCell>
                      <div className="font-mono font-bold">{request.trx_id}</div>
                      <div className="text-xs capitalize text-muted-foreground">{request.payment_method}</div>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                            if(confirm("Reject this payment?")) rejectMutation.mutate(request.id);
                        }}
                        disabled={rejectMutation.isPending || approveMutation.isPending}
                      >
                          <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => approveMutation.mutate(request.id)}
                        disabled={rejectMutation.isPending || approveMutation.isPending}
                      >
                          <Check className="h-4 w-4" />
                      </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <Inbox className="h-10 w-10 opacity-20" />
                        <p>No pending payment requests.</p>
                        <p className="text-xs">New requests will appear here automatically.</p>
                    </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between p-4 border-t">
                <div className="text-xs text-muted-foreground">
                    Page {page + 1} of {totalPages || 1} ({totalCount} items)
                </div>
                <div className="flex gap-2">
                    <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPayments;
