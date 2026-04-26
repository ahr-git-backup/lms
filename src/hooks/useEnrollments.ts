import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useEnrollments = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["enrollments", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const now = new Date().toISOString();

      const { data: enrollments, error } = await supabase
        .from("enrollments")
        .select(`
          *,
          course:courses(*)
        `)
        .eq("profile_id", user.id);

      if (error) throw error;

      // Filter out expired enrollments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeEnrollments = (enrollments || []).filter((e: any) => {
        if (!e.expires_at) return true; // No expiry = always active
        return e.expires_at > now;      // Only active if not expired
      });

      // Handle Linked/Extra Courses (bonus courses from linked_course_ids)
      const directIds = new Set(activeEnrollments.map((e: any) => e.course_id));
      const allLinkedIds = new Set<string>();

      const resolveLinked = async (idsToResolve: string[]) => {
          if (idsToResolve.length === 0) return;

          const { data: courses } = await supabase
              .from("courses")
              .select("id, linked_course_ids")
              .in("id", idsToResolve);

          if (!courses) return;

          const nextIds: string[] = [];
          courses.forEach((c: any) => {
              if (c.linked_course_ids && Array.isArray(c.linked_course_ids)) {
                  c.linked_course_ids.forEach((id: string) => {
                      if (!directIds.has(id) && !allLinkedIds.has(id)) {
                          allLinkedIds.add(id);
                          nextIds.push(id);
                      }
                  });
              }
          });

          if (nextIds.length > 0) {
              await resolveLinked(nextIds);
          }
      };

      await resolveLinked(Array.from(directIds));

      if (allLinkedIds.size > 0) {
          const { data: extraCourses } = await supabase
              .from("courses")
              .select("*")
              .in("id", Array.from(allLinkedIds));

          if (extraCourses) {
              const extraEnrollments = extraCourses.map(c => ({
                  id: `virtual-${c.id}`, // Virtual ID
                  course_id: c.id,
                  profile_id: user.id,
                  created_at: new Date().toISOString(),
                  expires_at: null, // Bonus courses inherit from parent (no separate expiry)
                  course: c,
                  is_extra: true,       // Mark as bonus/extra course
                  is_bonus: true,       // Explicit bonus flag
              }));
              return [...activeEnrollments, ...extraEnrollments] as any[];
          }
      }

      return activeEnrollments || [];
    },
    enabled: !!user,
  });
};

/**
 * Returns only the directly-enrolled (non-bonus) course IDs.
 * Used for community links, dashboard "My Courses", etc.
 */
export const useDirectEnrollments = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["direct-enrollments", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const now = new Date().toISOString();

      const { data: enrollments, error } = await supabase
        .from("enrollments")
        .select(`
          *,
          course:courses(*)
        `)
        .eq("profile_id", user.id);

      if (error) throw error;

      // Only return active, direct (non-bonus) enrollments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (enrollments || []).filter((e: any) => {
        if (!e.expires_at) return true;
        return e.expires_at > now;
      });
    },
    enabled: !!user,
  });
};
