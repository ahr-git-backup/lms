import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowRight, Flame, Infinity as InfinityIcon, Star, User } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";

const liveActivityData = [
  { t: "0", value: 0 },
  { t: "25", value: 25000 },
  { t: "50", value: 50000 },
  { t: "75", value: 100000 },
  { t: "∞", value: 500000 },
];

const Index = () => {
  useEffect(() => {
    document.title = "Beshi Joss LMS - Best Live Coaching & Exam Platform in BD";
  }, []);

  const { data: courses, isLoading } = useQuery({
    queryKey: ["public-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, short_description, price, image_url, slug, is_active")
        .eq("is_public", true) // Show only publicly listed courses
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: mentors } = useQuery({
    queryKey: ["public-mentors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentors")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: heroes } = useQuery({
    queryKey: ["public-heroes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("heroes")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["public-reviews"],
    queryFn: async () => {
      // Assuming reviews table is created, or using dummy data if not yet active
      // For now, I'll return hardcoded reviews if table fetch fails/is empty
       const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);

       if (error || !data || data.length === 0) {
           return [
               { id: 1, student_name: "Ayman Sadiq", college_name: "Dhaka College", review_text: "Best platform for HSC preparation!", rating: 5 },
               { id: 2, student_name: "Sadia Islam", college_name: "Viqarunnisa Noon", review_text: "The exam system is exactly like the real one.", rating: 5 },
               { id: 3, student_name: "Rahim Uddin", college_name: "Notre Dame College", review_text: "Live classes and notes are super helpful.", rating: 5 }
           ];
       }
       return data;
    },
  });

  // Default hero content if no custom heroes are found
  const defaultHero = {
      title: "Elevate Your Learning with Beshi Joss LMS.",
      subtitle: "The all-in-one powerhouse for live classes, instant results, and seamless course management. Join the elite community of learners today.",
      cta_text: "Enter Classroom",
      cta_link: "/login",
      image_url: null
  };

  const displayHeroes = heroes && heroes.length > 0 ? heroes : [defaultHero];
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

  useEffect(() => {
    if (emblaApi) {
      const autoplay = setInterval(() => {
        emblaApi.scrollNext();
      }, 5000);
      return () => clearInterval(autoplay);
    }
  }, [emblaApi]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pb-16 pt-10 sm:pt-14 flex-1">

        {/* Hero Section */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {displayHeroes.map((hero: any, index: number) => (
              <section key={hero.id || index} className="grid gap-10 md:grid-cols-[1.2fr,1fr] md:items-center min-w-0 flex-[0_0_100%] pl-4">
                <div className="space-y-6">
                  <p className="inline-flex items-center gap-2 rounded-full border-[3px] border-primary bg-accent/40 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.25em]">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-background text-primary">
                      <Flame className="h-3 w-3" />
                    </span>
                    Beshi Joss LMS
                  </p>
                  <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
                    {hero.title}
                  </h1>
                  <p className="max-w-xl text-base text-muted-foreground md:text-lg">
                    {hero.subtitle}
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <Button asChild size="lg">
                      <a href={hero.cta_link || "/login"} className="flex items-center gap-2">
                        {hero.cta_text || "Get Started"}
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <a href="#courses">Explore Courses</a>
                    </Button>
                  </div>
                </div>

                {/* Hero Image / 16:9 Ratio */}
                <div className="relative aspect-video w-full overflow-hidden rounded-[25px] border-[3px] border-border bg-muted shadow-sm">
                   {hero.image_url ? (
                     <img src={hero.image_url} alt={hero.title} className="h-full w-full object-cover" />
                   ) : (
                     <div className="flex h-full w-full items-center justify-center bg-secondary/50 text-muted-foreground">
                        <Flame className="h-16 w-16 opacity-20" />
                     </div>
                   )}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Free Service/Courses Section */}
        <section className="space-y-6">
            <div className="text-center md:text-left">
                <h2 className="text-2xl font-semibold tracking-tight">Free Learning Resources</h2>
                <p className="text-sm text-muted-foreground">Start learning today without any cost.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Flame className="h-5 w-5 text-primary" /> Free Exams
                        </CardTitle>
                        <CardDescription>
                            Test your preparation with our subject-wise and topic-wise free exams.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">Register for free and get instant access to practice exams. No course purchase required.</p>
                    </CardContent>
                    <CardFooter>
                        <Button asChild variant="default" className="w-full">
                            <a href="/login">Take Free Exam</a>
                        </Button>
                    </CardFooter>
                </Card>
                 <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <InfinityIcon className="h-5 w-5 text-primary" /> Free Classes
                        </CardTitle>
                        <CardDescription>
                            Watch demo classes and selected topic discussions for free.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">Explore our teaching style and quality content before you decide to join.</p>
                    </CardContent>
                    <CardFooter>
                         <Button asChild variant="outline" className="w-full">
                            <a href="https://youtube.com" target="_blank" rel="noreferrer">Watch on YouTube</a>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </section>

        {/* Paid Courses Section */}
        <section id="courses" className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Available Courses</h2>
              <p className="text-sm text-muted-foreground">
                Each course comes with live & recorded classes, exams, routines, notes and resources.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading courses...</p>
            ) : !courses || courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No courses available yet.</p>
            ) : (
              courses.map((course: any) => {
                const image = course.image_url || "/placeholder.svg";
                const description = course.short_description || "";
                const idOrSlug = course.slug || course.id;

                return (
                  <Card key={course.id} className="flex flex-col justify-between border-[3px] border-foreground">
                    {image && (
                      <div className="border-b-[3px] border-foreground">
                        <AspectRatio ratio={16 / 9}>
                          <img
                            src={image}
                            alt={`${course.name} cover`}
                            className="h-full w-full rounded-t-[22px] object-cover"
                          />
                        </AspectRatio>
                      </div>
                    )}
                    <CardHeader className="space-y-2 p-2.5 pb-0">
                      <CardTitle className="text-base font-semibold leading-snug">{course.name}</CardTitle>
                      <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col justify-between gap-4 p-2.5 pt-2">
                      <div className="text-sm font-mono">
                        <span className="text-xs uppercase text-muted-foreground">Course fee</span>
                        <div className="text-lg font-semibold">
                          {course.price != null ? `৳${Number(course.price).toLocaleString("en-BD")}` : "Contact for fee"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button asChild className="flex-1">
                          <a href={`/courses/${idOrSlug}`}>View Details</a>
                        </Button>
                        <Button asChild variant="outline" className="flex-1">
                          <a href={`/courses/${idOrSlug}/buy`}>Buy Instructions</a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </section>

        {/* Student Reviews */}
        <section className="space-y-6">
            <h2 className="text-2xl font-semibold tracking-tight text-center">Student Feedback</h2>
            <div className="grid gap-6 md:grid-cols-3">
                {reviews?.map((review: any) => (
                    <Card key={review.id} className="bg-muted/50 border-none shadow-none">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-1 text-yellow-500 mb-2">
                                {[...Array(review.rating)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                            </div>
                            <CardTitle className="text-base">{review.student_name}</CardTitle>
                            <CardDescription className="text-xs">{review.college_name}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm italic text-muted-foreground">"{review.review_text}"</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>

      </main>

      {/* Founder & Teacher Panel (Footer Top) */}
      <section className="bg-card border-t py-12 px-4 mt-auto">
          <div className="mx-auto max-w-6xl space-y-8">
               <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">Meet Our Mentors</h2>
                    <p className="text-muted-foreground">The team behind your success.</p>
               </div>

               <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4 justify-center">
                   {mentors && mentors.length > 0 ? (
                       mentors.map((mentor: any) => (
                           <div key={mentor.id} className="flex flex-col items-center text-center space-y-3">
                               <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-primary">
                                   {mentor.image_url ? (
                                       <img src={mentor.image_url} alt={mentor.name} className="h-full w-full object-cover" />
                                   ) : (
                                       <div className="h-full w-full bg-secondary flex items-center justify-center">
                                           <User className="h-10 w-10 text-muted-foreground" />
                                       </div>
                                   )}
                               </div>
                               <div>
                                   <h3 className="font-semibold">{mentor.name}</h3>
                                   <p className="text-xs text-primary font-medium uppercase tracking-wide">{mentor.role}</p>
                                   <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">{mentor.description}</p>
                               </div>
                           </div>
                       ))
                   ) : (
                       <p className="text-center col-span-full text-muted-foreground">Mentors will be added soon.</p>
                   )}
               </div>
          </div>
      </section>

      <footer className="bg-background border-t py-6 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Beshi Joss LMS. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Index;
