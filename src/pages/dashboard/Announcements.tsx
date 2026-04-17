import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

const Announcements = () => {
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [filterType, setFilterType] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(0);
  const { data: enrollments } = useEnrollments();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [readAnnouncements, setReadAnnouncements] = useState<string[]>([]);

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

    // Load read announcements from local storage
    const read = localStorage.getItem("read_announcements_ids");
    if (read) {
        setReadAnnouncements(JSON.parse(read));
    }

    // Mark user notifications as read in DB
    const markAsRead = async () => {
        if (!user) return;
        await supabase
            .from("user_notifications")
            .update({ is_read: true })
            .eq("user_id", user.id)
            .eq("is_read", false);

        // Invalidate query to refresh UI state
        queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
    };
    markAsRead();
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

  const { data: announcementsData, isLoading } = useQuery({
    queryKey: ["announcements", selectedCourse, enrolledCourseIds, page],
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

      const { data, error, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const announcements = announcementsData?.data || [];
  const totalCount = announcementsData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

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
          if (!readAnnouncements.includes(id)) {
              const newRead = [...readAnnouncements, id];
              setReadAnnouncements(newRead);
              localStorage.setItem("read_announcements_ids", JSON.stringify(newRead));
              // Also update last viewed globally to prevent dot from reappearing immediately
              localStorage.setItem("last_viewed_announcements", new Date().toISOString());
          }
      }
  };

  const toggleExpandNotification = (id: string) => {
    if (expandedIds.includes(id)) {
        setExpandedIds(expandedIds.filter(e => e !== id));
    } else {
        setExpandedIds([...expandedIds, id]);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground">Important updates and notices from your courses.</p>
      </header>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Course</div>
            <Select
                value={selectedCourse}
                onValueChange={(val) => {
                    setSelectedCourse(val);
                    setPage(0);
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
                                {!isRead && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 animate-pulse" />}
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
                                <p className="text-sm whitespace-pre-wrap">{announcement.body}</p>
                            </CardContent>
                        )}
                        </Card>
                    )})
                )}

                {/* Pagination Controls */}
                <div className="flex items-center justify-between pt-4">
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
      )}
    </div>
  );
};

export default Announcements;
