import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

// Small "contact us on WhatsApp" button used on payment-blocked screens.
// Number is read from app_settings (key: support_whatsapp_number), which is
// publicly readable and editable by admins from AdminPayments.
export const WhatsAppSupportButton = ({ message, className }: { message?: string; className?: string }) => {
  const { data: number } = useQuery({
    queryKey: ["app-setting", "support_whatsapp_number"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "support_whatsapp_number").maybeSingle();
      return (data?.value as string) || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!number) return null;

  const cleanNumber = number.replace(/\D/g, "");
  const href = `https://wa.me/${cleanNumber}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

  return (
    <Button asChild variant="outline" className={`gap-2 border-green-500/40 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/20 ${className || ""}`}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-4 w-4" /> WhatsApp-এ যোগাযোগ করুন
      </a>
    </Button>
  );
};
