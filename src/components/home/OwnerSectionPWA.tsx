import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "lucide-react";

// Website's "আমাদের মেন্টরবৃন্দ" section lists all mentors. PWA home only
// shows the Founder/Owner entry, not other mentors/teachers.
export default function OwnerSectionPWA() {
  const { data: owner } = useQuery({
    queryKey: ["public-owner-mentor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentors")
        .select("*")
        .eq("role", "Founder")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!owner) return null;

  return (
    <section className="rounded-2xl border bg-card px-4 py-6 flex flex-col items-center text-center gap-3">
      <div className="h-28 w-28 rounded-full overflow-hidden border-2 border-primary shadow-lg">
        {owner.image_url ? (
          <img src={owner.image_url} alt={owner.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-secondary flex items-center justify-center">
            <User className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>
      <div>
        <h3 className="font-semibold">{owner.name}</h3>
        <p className="text-xs text-primary font-medium uppercase tracking-wide">{owner.role}</p>
        {owner.description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-[240px]">{owner.description}</p>
        )}
      </div>
    </section>
  );
}
