import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";


const Announcements = () => {
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [filterType, setFilterType] = useState<"all" | "unread">("all");
  const { data: enrollments } = useEnrollments();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    document.title = "Announcements – Atlas";
    // Hide mobile dot if visible
    document.getElementById("mobile-announcement-dot")?.classList.add("hidden");
    document.getElementById("desktop-announcement-dot")?.classList.add("hidden");

    // Stop sound if playing
    const audioEl = document.getElementById("notification-sound-loop") as HTMLAudioElement;
    if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
    }

    // Note: individual notifications are marked read (and the badge count
    // decremented) only when the student actually opens/expands that specific
    // notification — see toggleExpandNotification below. We intentionally do
    // NOT bulk-mark everything as read just for visiting this page.

  }, [user, queryClient]);

  // Fetch Personal Notifications
  const { data: userNotifications } = useQuery({
      queryKey: ["user-notifications", user?.id],
      queryFn: async () => {
          if (!user) return [];
          const { data, error } = await supabase
              .from("user_notifications")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false });
          if (error) throw error;
          return data;
      },
      enabled: !!user
  });

  const deleteNotificationMutation = useMutation({
      mutationFn: async (id: string) => {
          const { error } = await supabase
              .from("user_notifications")
              .delete()
              .eq("id", id);
          if (error) throw error;
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
          toast({ title: "Notification deleted" });
      },
      onError: () => {
          toast({ title: "Failed to delete notification", variant: "destructive" });
      }
  });

  const enrolledCourseIds = enrollments?.map(e => e.course_id) || [];

  // Server-truth for which announcements this user has actually read (DB, not localStorage)
  const { data: readRows } = useQuery({
      queryKey: ["announcement-reads", user?.id],
      queryFn: async () => {
          if (!user) return [];
          const { data, error } = await supabase
              .from("announcement_reads")
              .select("announcement_id")
              .eq("user_id", user.id);
          if (error) throw error;
          return data || [];
      },
      enabled: !!user
  });
  const readAnnouncements = (readRows || []).map((r: any) => r.announcement_id);

  const { data: announcementsData, isLoading } = useQuery({
    queryKey: ["announcements", selectedCourse, enrolledCourseIds],
    queryFn: async () => {
      let query = supabase
        .from("announcements")
        .select("*, course:courses(*)", { count: 'exact' })
        .order("published_at", { ascending: false });

      if (selectedCourse !== "all") {
         if (!enrolledCourseIds.includes(selectedCourse)) return { data: [], count: 0 };
         query = query.eq("course_id", selectedCourse);
      } else {
         if (enrolledCourseIds.length > 0) {
             query = query.or(`course_id.in.(${enrolledCourseIds.join(',')}),course_id.is.null`);
         } else {
             query = query.is("course_id", null);
         }
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const announcements = announcementsData?.data || [];
  const totalCount = announcementsData?.count || 0;

  // Combined stats across Personal Notifications + Course Announcements
  const totalNoticeCount = totalCount + (userNotifications?.length || 0);
  const seenAnnouncementsCount = (readRows || []).length;
  const seenNotificationsCount = (userNotifications || []).filter((n: any) => n.is_read).length;
  const totalSeenCount = seenAnnouncementsCount + seenNotificationsCount;

  let displayedAnnouncements = announcements;
  if (filterType === "unread") {
      displayedAnnouncements = announcements.filter(a => !readAnnouncements.includes(a.id));
  }

  const toggleExpand = (id: string) => {
      if (expandedIds.includes(id)) {
          setExpandedIds(expandedIds.filter(e => e !== id));
      } else {
          setExpandedIds([...expandedIds, id]);
          // Mark as read if not already
          if (!readAnnouncements.includes(id) && user) {
              supabase.from("announcement_reads")
                  .upsert({ announcement_id: id, user_id: user.id }, { onConflict: "announcement_id,user_id" })
                  .then(() => {
                      queryClient.invalidateQueries({ queryKey: ["announcement-reads", user.id] });
                  });

              const stored = localStorage.getItem("unread_notification_count");
              const current = stored ? parseInt(stored, 10) || 0 : 0;
              const next = Math.max(0, current - 1);
              localStorage.setItem("unread_notification_count", String(next));
              window.dispatchEvent(new Event("unread-notifications-updated"));
          }
      }
  };

  const toggleExpandNotification = (id: string) => {
    if (expandedIds.includes(id)) {
        setExpandedIds(expandedIds.filter(e => e !== id));
    } else {
        setExpandedIds([...expandedIds, id]);

        // Mark just this notification as read, and decrement the badge count
        // by exactly one — count should only go down for the item actually opened.
        const notif = userNotifications?.find((n: any) => n.id === id);
        if (user && notif && !notif.is_read) {
            supabase
                .from("user_notifications")
                .update({ is_read: true })
                .eq("id", id)
                .then(() => {
                    queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
                });

            const stored = localStorage.getItem("unread_notification_count");
            const current = stored ? parseInt(stored, 10) || 0 : 0;
            const next = Math.max(0, current - 1);
            localStorage.setItem("unread_notification_count", String(next));
            window.dispatchEvent(new Event("unread-notifications-updated"));
        }
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground">Important updates and notices from your courses.</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Card className="border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-3 flex flex-col items-center text-center gap-0.5">
            <span className="text-[10px] text-muted-foreground leading-tight">Total Notice</span>
            <span className="text-lg font-bold text-blue-600 leading-tight">{totalNoticeCount}</span>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="p-3 flex flex-col items-center text-center gap-0.5">
            <span className="text-[10px] text-muted-foreground leading-tight">দেখা হয়েছে</span>
            <span className="text-lg font-bold text-emerald-600 leading-tight">{totalSeenCount}</span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Course</div>
            <Select
                value={selectedCourse}
                onValueChange={(val) => {
                    setSelectedCourse(val);
                }}
            >
            <SelectTrigger className="w-56">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {enrollments?.map((enrollment) => (
                <SelectItem key={enrollment.course_id} value={enrollment.course_id}>
                    {enrollment.course.name}
                </SelectItem>
                ))}
            </SelectContent>
            </Select>
        </div>

        <div className="flex items-center gap-4">
            <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Status</div>
            <Select value={filterType} onValueChange={(val: "all"|"unread") => setFilterType(val)}>
            <SelectTrigger className="w-32">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread Only</SelectItem>
            </SelectContent>
            </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-6">
            {/* User Notifications Section */}
            {userNotifications && userNotifications.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Bell className="h-5 w-5 text-primary" /> Personal Notifications
                    </h2>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {userNotifications.map((notif: any) => {
                        const isExpanded = expandedIds.includes(notif.id);
                        return (
                        <Card key={notif.id}
                              className={`border cursor-pointer transition-colors ${notif.type === 'payment_approved' ? 'border-green-500/50 bg-green-500/5' : notif.type === 'payment_rejected' || notif.type === 'course_request_declined' ? 'border-red-500/50 bg-red-500/5' : notif.type === 'report_reply' ? 'border-blue-500/50 bg-blue-500/5' : 'border-border'}`}
                              onClick={() => toggleExpandNotification(notif.id)}
                        >
                            <CardHeader className="space-y-1 pb-2 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {notif.is_read ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" /> : <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 animate-pulse" />}
                                        {notif.type === 'payment_approved' ? <CheckCircle className="h-5 w-5 text-green-600" /> :
                                         (notif.type === 'payment_rejected' || notif.type === 'course_request_declined') ? <AlertTriangle className="h-5 w-5 text-red-600" /> : notif.type === 'report_reply' ? <CheckCircle className="h-5 w-5 text-blue-600" /> : null}
                                        <CardTitle className="text-base">{notif.title}</CardTitle>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if(confirm("Delete this notification?")) deleteNotificationMutation.mutate(notif.id);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                                <span className="text-xs text-muted-foreground">{new Date(notif.created_at).toLocaleString()}</span>
                            </CardHeader>
                            {isExpanded && (
                                <CardContent className="pt-0 pb-4 animate-in slide-in-from-top-2 duration-200">
                                    <div className="h-px w-full bg-border/50 mb-3" />
                                    <p className="text-sm">{notif.body}</p>
                                </CardContent>
                            )}
                        </Card>
                    )})}
                </div>
            )}

            {/* General Announcements Section */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Course Announcements</h2>
                {displayedAnnouncements.length === 0 ? (
                    <Card className="border border-foreground/50">
                    <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                        {filterType === 'unread' ? "No unread announcements on this page." : "No announcements available."}
                    </CardContent>
                    </Card>
                ) : (
                    displayedAnnouncements.map((announcement) => {
                        const isExpanded = expandedIds.includes(announcement.id);
                        const isRead = readAnnouncements.includes(announcement.id);

                        return (
                        <Card
                            key={announcement.id}
                            className={`border transition-all cursor-pointer hover:bg-muted/30 ${!isRead ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
                            onClick={() => toggleExpand(announcement.id)}
                        >
                        <CardHeader className="space-y-1 py-4">
                            <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {!isRead ? <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 animate-pulse" /> : <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />}
                                <CardTitle className={`text-base ${!isRead ? 'font-bold' : 'font-medium text-foreground/80'}`}>
                                    {announcement.title}
                                </CardTitle>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                            </div>
                            <div className="flex items-center justify-between mt-1 pl-5">
                                <p className="text-xs font-mono uppercase text-muted-foreground">
                                    {announcement.course?.name || "General Announcement"}
                                </p>
                                <span className="text-xs text-muted-foreground">
                                    {new Date(announcement.published_at).toLocaleDateString()}
                                </span>
                            </div>
                        </CardHeader>
                        {isExpanded && (
                            <CardContent className="pl-9 pt-0 pb-4 animate-in slide-in-from-top-2 duration-200">
                                <div className="h-px w-full bg-border/50 mb-3" />
                                {announcement.image_url && (
                                    <img
                                        src={announcement.image_url}
                                        alt=""
                                        className="w-full max-w-md rounded-lg mb-3 object-cover"
                                        loading="lazy"
                                    />
                                )}
                                {announcement.body && (
                                    <p className="text-sm whitespace-pre-wrap">{announcement.body}</p>
                                )}
                            </CardContent>
                        )}
                        </Card>
                    )})
                )}

                {totalCount > 0 && (
                    <div className="text-xs text-muted-foreground pt-2">
                        {totalCount} items
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;
