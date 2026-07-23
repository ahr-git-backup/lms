import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy, Crown, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface RankedEntry {
  rank: number;
  userId: string;
  points: number;
  name: string;
  batch: string;
  avatarUrl: string | null;
  gender: string | null;
}

const medalCls: Record<number, string> = {
  1: "border-amber-400/60 bg-gradient-to-b from-amber-400/10 to-transparent scale-[1.06]",
  2: "border-gray-400/40",
  3: "border-orange-400/40",
};
const medalBadge: Record<number, string> = {
  1: "bg-amber-400 text-amber-950",
  2: "bg-gray-400 text-white",
  3: "bg-orange-500 text-white",
};

/** Custom avatar-এর অভাবে ব্যবহারকারীর gender অনুযায়ী initial-avatar-এর রং ঠিক করে,
 *  যাতে প্রতিটা avatar একরকম না দেখিয়ে অন্তত gender-appropriate একটা visual পরিচয় পায়। */
function genderAvatarClass(gender: string | null): string {
  if (gender === "female") return "bg-pink-500/10 border-pink-500/20 text-pink-600";
  if (gender === "male") return "bg-blue-500/10 border-blue-500/20 text-blue-600";
  return "bg-primary/10 border-primary/20 text-primary";
}

const QuickPracticeLeaderboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const myCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = "Leaderboard — Quick Practice";
  }, []);

  const { data: ranked, isLoading } = useQuery({
    queryKey: ["qp-leaderboard"],
    queryFn: async (): Promise<RankedEntry[]> => {
      const { data: rows, error } = await supabase
        .from("qp_user_points")
        .select("user_id, total_points")
        .order("total_points", { ascending: false })
        .limit(100);
      if (error || !rows || rows.length === 0) return [];

      const userIds = rows.map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, hsc_batch, avatar_url, gender")
        .in("id", userIds);

      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

      return rows.map((r: any, i: number) => ({
        rank: i + 1,
        userId: r.user_id,
        points: r.total_points || 0,
        name: profileMap[r.user_id]?.full_name || "Student",
        batch: profileMap[r.user_id]?.hsc_batch || "",
        avatarUrl: profileMap[r.user_id]?.avatar_url || null,
        gender: profileMap[r.user_id]?.gender || null,
      }));
    },
  });

  const myEntry = ranked?.find((r) => r.userId === user?.id);

  useEffect(() => {
    if (myEntry && myCardRef.current) {
      setTimeout(() => {
        myCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
    }
  }, [myEntry]);

  const top3 = ranked?.slice(0, 3) || [];

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-card border-b">
        <button
          onClick={() => navigate("/quick-practice")}
          className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 font-extrabold text-[17px] flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-amber-500" /> Leaderboard
        </h1>
      </div>

      {myEntry && (
        <button
          onClick={() =>
            myCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          className="w-full text-left mx-4 mt-3.5 mb-1 px-4 py-3 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 flex items-center gap-2 text-[13px]"
          style={{ width: "calc(100% - 2rem)" }}
        >
          <Target className="h-4 w-4 text-primary flex-shrink-0" />
          তোমার Rank: <b className="text-primary">#{myEntry.rank}</b> · <b>{myEntry.points}</b> পয়েন্ট
        </button>
      )}

      <div className="max-w-2xl mx-auto px-4">
        {isLoading && (
          <div className="text-center text-sm text-muted-foreground py-16">লোড হচ্ছে...</div>
        )}

        {!isLoading && (!ranked || ranked.length === 0) && (
          <div className="text-center text-sm text-muted-foreground py-16">
            এখনো কেউ Quick Practice খেলেনি। প্রথম হও! 🏆
          </div>
        )}

        {!isLoading && ranked && ranked.length > 0 && (
          <>
            {/* Top 3 podium */}
            <div className="grid grid-cols-3 gap-2 mt-5 items-end">
              {[top3[1], top3[0], top3[2]].map((p, idx) => {
                if (!p) return <div key={idx} />;
                const rc = [2, 1, 3][idx];
                return (
                  <div
                    key={p.userId}
                    className={cn(
                      "rounded-2xl border p-3 pb-3 text-center bg-card/50 backdrop-blur-sm shadow-sm relative",
                      medalCls[rc]
                    )}
                  >
                    {rc === 1 && (
                      <Crown className="h-5 w-5 text-amber-400 mx-auto mb-1 fill-amber-400" />
                    )}
                    <div
                      className={cn(
                        "mx-auto rounded-xl border flex items-center justify-center font-extrabold relative overflow-hidden",
                        genderAvatarClass(p.gender),
                        rc === 1 ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm"
                      )}
                    >
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt={p.name} className="h-full w-full object-cover rounded-xl" />
                      ) : (
                        p.name.charAt(0).toUpperCase()
                      )}
                      <span
                        className={cn(
                          "absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-card",
                          medalBadge[rc]
                        )}
                      >
                        {rc}
                      </span>
                    </div>
                    <div className="text-[11px] font-black mt-1.5 leading-tight break-words line-clamp-2 px-0.5">{p.name}</div>
                    {p.batch && (
                      <div className="text-[9px] font-bold text-indigo-400 mt-0.5 truncate">
                        {p.batch}
                      </div>
                    )}
                    <div className="text-sm font-black text-emerald-500 mt-1 font-mono">
                      {p.points}
                      <span className="block text-[8px] font-semibold text-muted-foreground font-sans">
                        পয়েন্ট
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 my-4 text-[10px] font-bold text-muted-foreground">
              <div className="flex-1 h-px bg-border" /> সেরা তিনজন <div className="flex-1 h-px bg-border" />
            </div>

            {/* Full list */}
            <div className="flex flex-col gap-1.5">
              {ranked.map((p) => {
                const isMe = p.userId === user?.id;
                return (
                  <div
                    key={p.userId}
                    ref={isMe ? myCardRef : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 bg-card/40 backdrop-blur-sm",
                      isMe && "border-primary/40 bg-primary/5"
                    )}
                  >
                    <div className="w-8 text-center font-black text-sm text-muted-foreground font-mono flex-shrink-0">
                      #{p.rank}
                    </div>
                    <div className={cn("h-9 w-9 rounded-lg border flex items-center justify-center font-extrabold text-xs flex-shrink-0 overflow-hidden", genderAvatarClass(p.gender))}>
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        p.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-black truncate">
                        {p.name}
                        {isMe && " (তুমি)"}
                      </div>
                      {p.batch && (
                        <span className="text-[8.5px] font-bold text-indigo-400 bg-indigo-400/10 border border-indigo-400/25 rounded-full px-1.5 py-0.5 mt-0.5 inline-block font-mono">
                          {p.batch}
                        </span>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-black text-emerald-500 font-mono">{p.points}</div>
                      <div className="text-[7.5px] font-semibold text-muted-foreground">পয়েন্ট</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default QuickPracticeLeaderboard;
