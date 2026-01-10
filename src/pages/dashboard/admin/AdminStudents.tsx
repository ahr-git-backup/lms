import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Profile, Course, Enrollment } from "@/types/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { X, ChevronLeft, ChevronRight, Ban, Trash2, ShieldAlert } from "lucide-react";

// Schema for adding user via Edge Function
const addUserSchema = z.object({
  registrationId: z.string().min(3),
  password: z.string().min(6),
  fullName: z.string().min(1),
  email: z.string().optional()
});

const PAGE_SIZE = 10;

const AdminStudents = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCourseFilter = searchParams.get("course") || "all";
  const page = parseInt(searchParams.get("page") || "0");

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const setPage = (newPage: number) => {
      setSearchParams(prev => {
          prev.set("page", newPage.toString());
          return prev;
      });
  };

  useEffect(() => {
      const timer = setTimeout(() => {
          setDebouncedSearch(searchQuery);
          // Reset page when search changes
          if (searchQuery) setPage(0);
      }, 500);
      return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const setSelectedCourseFilter = (courseId: string) => {
      setSearchParams(prev => {
          prev.set("course", courseId);
          prev.set("page", "0"); // Reset page on filter change
          return prev;
      });
  };

  useEffect(() => {
    document.title = "Admin   Students   Udvash LMS";
  }, []);

  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ["admin-students", selectedCourseFilter, page, debouncedSearch],
    queryFn: async () => {
      // Fetch profiles with necessary data
      // We also fetch 'status' now

      if (selectedCourseFilter !== "all") {
          // If filtering by course, we query enrollments primarily
          let query = supabase
            .from("enrollments")
            .select("profile:profiles!inner(*), course:courses(name), id, course_id", { count: 'exact' })
            .eq("course_id", selectedCourseFilter);

          if (debouncedSearch) {
              query = query.or(`full_name.ilike.%${debouncedSearch}%,registration_id.ilike.%${debouncedSearch}%`, { foreignTable: "profiles" });
          }

          const { data, error, count } = await query
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          if (error) throw error;

          // Map back to expected structure
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const profiles = data.map((e: any) => ({
              ...(e.profile as Profile),
              enrollments: [{ id: e.id, course_id: e.course_id, courses: e.course }]
          }));
          return { data: profiles, count: count || 0 };
      } else {
          // Default fetch profiles directly
          let query = supabase
            .from("profiles")
            .select("id, registration_id, full_name, batch_year, created_at, status, enrollments:enrollments(id, course_id, courses(name))", { count: 'exact' });

          if (debouncedSearch) {
              query = query.or(`full_name.ilike.%${debouncedSearch}%,registration_id.ilike.%${debouncedSearch}%`);
          }

          const { data, error, count } = await query
            .order("created_at", { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          if (error) throw error;

          // Fetch roles for these users
          if (data && data.length > 0) {
              const userIds = data.map((p: any) => p.id);
              const { data: roles } = await supabase
                  .from("user_roles")
                  .select("user_id, role")
                  .in("user_id", userIds);

              // Merge roles into profile data
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const profilesWithRoles = data.map((p: any) => ({
                  ...p,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  roles: roles?.filter((r: any) => r.user_id === p.id).map((r: any) => r.role) || []
              }));
              return { data: profilesWithRoles, count: count || 0 };
          }

          return { data: data || [], count: count || 0 };
      }
    },
  });

  const students = studentsData?.data || [];
  const totalCount = studentsData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const removeEnrollmentMutation = useMutation({
      mutationFn: async (enrollmentId: string) => {
          const { error } = await supabase.from("enrollments").delete().eq("id", enrollmentId);
          if (error) throw error;
      },
      onSuccess: () => {
          toast({ title: "Access removed" });
          queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      },
      onError: (error: Error) => {
          toast({ title: "Failed to remove access", description: error.message, variant: "destructive" });
      }
  });

  // Promote/Demote Teacher Mutation
  const toggleTeacherRoleMutation = useMutation({
      mutationFn: async ({ userId, isPromoting }: { userId: string, isPromoting: boolean }) => {
          if (isPromoting) {
              const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "teacher" });
              if (error) throw error;
          } else {
              const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "teacher");
              if (error) throw error;
          }
      },
      onSuccess: () => {
          toast({ title: "Role updated successfully" });
          queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      },
      onError: (error: Error) => {
          toast({ title: "Failed to update role", description: error.message, variant: "destructive" });
      }
  });

  // Ban/Unban Mutation
  const toggleBanMutation = useMutation({
      mutationFn: async ({ userId, status }: { userId: string, status: string }) => {
          const { error } = await supabase
            .from("profiles")
            .update({ status })
            .eq("id", userId);
          if (error) throw error;
      },
      onSuccess: () => {
          toast({ title: "User status updated" });
          queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      },
      onError: (error: Error) => {
          toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
      }
  });

  // Delete User Mutation (Requires Edge Function usually for Auth User deletion, but we can delete profile/related data for "soft delete" effect or use RPC if exists)
  // Actually, standard RLS might prevent deleting from `auth.users`.
  // However, removing from `profiles` usually cascades if set up, or leaves an orphan auth user.
  // Ideally we use a `delete_user` RPC. Since we don't have one explicitly mentioned as safe for auth deletion,
  // we will rely on deleting the profile which effectively removes them from the app logic.
  // Warning: If `auth.users` persists, they can re-login but might fail profile check.
  // Let's implement banning instead for "punishment" and Profile deletion for "Removal".
  const deleteUserMutation = useMutation({
      mutationFn: async (userId: string) => {
          // Check if admin first to prevent self-deletion issues or super-admin checks
          // For now, simple delete on profile
          const { error } = await supabase.from("profiles").delete().eq("id", userId);
          if (error) throw error;
      },
      onSuccess: () => {
          toast({ title: "User data removed" });
          queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      },
      onError: (error: Error) => {
          toast({ title: "Failed to delete user", description: error.message + " (Note: Auth account may persist, ban to block login completely)", variant: "destructive" });
      }
  });

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin: Students</h1>
        <p className="text-sm text-muted-foreground">
          Create new students and manage course enrollments.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border border-foreground/60">
          <CardHeader>
            <CardTitle className="text-base">Enroll Student</CardTitle>
            <CardDescription>Manually enroll a student into a course.</CardDescription>
          </CardHeader>
          <CardContent>
               <EnrollStudentForm courses={courses || []} />
          </CardContent>
        </Card>
      </div>

      <Card className="border border-foreground/60">
        <CardHeader>
          <CardTitle className="text-base">Students</CardTitle>
          <CardDescription>
            Filter by course to see who is enrolled where.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full">
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground whitespace-nowrap">Course filter</div>
                    <Select
                    value={selectedCourseFilter}
                    onValueChange={(v) => {
                        setSelectedCourseFilter(v);
                        setPage(0);
                    }}
                    >
                    <SelectTrigger className="w-full sm:w-56">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Courses</SelectItem>
                        {courses?.map((course: Pick<Course, "id" | "name">) => (
                        <SelectItem key={course.id} value={course.id}>
                            {course.name}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>

                <div className="flex-1 w-full sm:max-w-xs">
                     <Input
                        placeholder="Search by Name or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                     />
                </div>
            </div>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading students...</div>
          ) : students.length === 0 ? (
            <div className="text-sm text-muted-foreground">No students found.</div>
          ) : (
            <>
            <div className="w-full overflow-x-auto rounded-md border border-border/60 bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registration ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Courses (Access)</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student: Profile) => (
                    <TableRow key={student.id} className={student.status === 'banned' ? "bg-red-50 dark:bg-red-900/10" : ""}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{student.registration_id}</TableCell>
                      <TableCell className="whitespace-nowrap">{student.full_name}</TableCell>
                      <TableCell className="text-xs min-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                            {(student.enrollments || []).map((e: Enrollment) => (
                                <div key={e.id} className="inline-flex items-center gap-1 bg-secondary px-2 py-1 rounded-full border">
                                    <span>{e.courses?.name}</span>
                                    <button
                                        onClick={() => {
                                            if (confirm(`Remove access to ${e.courses?.name} for ${student.full_name}?`)) {
                                                removeEnrollmentMutation.mutate(e.id);
                                            }
                                        }}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            {(!student.enrollments || student.enrollments.length === 0) && <span className="text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <span className="font-medium">{(student as any).roles?.includes("admin") ? "Admin" : (student as any).roles?.includes("teacher") ? "Teacher" : "Student"}</span>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {!(student as any).roles?.includes("admin") && (
                                <div className="flex items-center gap-2">
                                    <Label htmlFor={`teacher-switch-${student.id}`} className="text-[10px] text-muted-foreground font-normal">Teacher Access</Label>
                                    <Switch
                                        id={`teacher-switch-${student.id}`}
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        checked={(student as any).roles?.includes("teacher")}
                                        onCheckedChange={(checked) => toggleTeacherRoleMutation.mutate({ userId: student.id, isPromoting: checked })}
                                        disabled={toggleTeacherRoleMutation.isPending}
                                        className="h-4 w-7"
                                    />
                                </div>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${student.status === 'banned' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {student.status || 'active'}
                          </span>
                      </TableCell>
                      <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                              {student.status === 'banned' ? (
                                  <Button variant="outline" size="sm" onClick={() => toggleBanMutation.mutate({ userId: student.id, status: 'active' })}>
                                      Unban
                                  </Button>
                              ) : (
                                  <Button variant="ghost" size="icon" className="text-orange-500" onClick={() => toggleBanMutation.mutate({ userId: student.id, status: 'banned' })} title="Ban/Punish">
                                      <Ban className="h-4 w-4" />
                                  </Button>
                              )}
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm("Delete this user?")) deleteUserMutation.mutate(student.id) }} title="Delete">
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-4">
                 <div className="text-xs text-muted-foreground">
                     Page {page + 1} of {totalPages || 1} ({totalCount} items)
                 </div>
                 <div className="flex gap-2">
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                     >
                         <ChevronLeft className="h-4 w-4" />
                         Previous
                     </Button>
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= totalPages - 1}
                     >
                         Next
                         <ChevronRight className="h-4 w-4" />
                     </Button>
                 </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
};


const EnrollStudentForm = ({ courses }: { courses: Pick<Course, "id" | "name">[] }) => {
    const [registrationId, setRegistrationId] = useState("");
    const [courseId, setCourseId] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const enrollMutation = useMutation({
        mutationFn: async () => {
             const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("id")
                .eq("registration_id", registrationId)
                .single();

            if (profileError || !profile) {
                throw new Error("Student not found with this Registration ID");
            }

            const { error: enrollError } = await supabase
                .from("enrollments")
                .insert({
                    profile_id: profile.id,
                    course_id: courseId
                });

            if (enrollError) {
                if (enrollError.code === '23505') throw new Error("Student is already enrolled in this course");
                throw enrollError;
            }
        },
        onSuccess: () => {
            toast({ title: "Student enrolled successfully" });
            setRegistrationId("");
            setCourseId("");
            queryClient.invalidateQueries({ queryKey: ["admin-students"] });
        },
        onError: (error: Error) => {
             toast({ title: "Enrollment failed", description: error.message, variant: "destructive" });
        }
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label>Student Registration ID</Label>
              <Input
                 value={registrationId}
                 onChange={e => setRegistrationId(e.target.value)}
                 placeholder="Enter ID (e.g. 1001)"
              />
            </div>
            <div className="space-y-2">
              <Label>Select Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                 <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                 <SelectContent>
                    {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                 </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => enrollMutation.mutate()}
              disabled={!registrationId || !courseId || enrollMutation.isPending}
            >
                {enrollMutation.isPending ? "Enrolling..." : "Enroll"}
            </Button>
        </div>
    );
};

export default AdminStudents;
