import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import {
  Check,
  Monitor,
  Users,
  BookOpen,
  Lightbulb,
  FileText,
  MessageCircle,
  Smartphone,
  BarChart,
  Flame,
  Infinity as InfinityIcon,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { StudentReviews } from "@/components/StudentReviews";

const FEATURES = [
    { icon: Monitor, title: "Offline/Online Program", desc: "Seamless learning experience." },
    { icon: Users, title: "Experienced Teachers", desc: "Learn from the best mentors." },
    { icon: BookOpen, title: "Study Materials", desc: "Quality notes and resources." },
    { icon: Lightbulb, title: "Concept Based Class", desc: "Build strong foundations." },
    { icon: FileText, title: "Unique Exam System", desc: "Standard evaluation methods." },
    { icon: MessageCircle, title: "24/7 Q&A Support", desc: "Instant doubt solving." },
    { icon: Smartphone, title: "Auto SMS Results", desc: "Track progress instantly." },
    { icon: BarChart, title: "Exam Analysis", desc: "Detailed performance reports." },
];

const STATS = [
    { year: "2024", title: "Medical Admission", details: "20/20 in Top 20, 240 in DMC. Total 4805+ Success." },
    { year: "2023", title: "Medical Admission", details: "50/50 in Top 50, 241 in DMC. Total 4750+ Success." },
    { year: "2022", title: "Medical Admission", details: "18/20 in Top 20, 209 in DMC. Total 3546 Success." },
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
        .select("id, name, short_description, price, original_price, image_url, slug, is_active")
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
               { id: 1, student_name: "Ayman Sadiq", college_name: "Dhaka College", review_text: "Best platform for HSC preparation!", rating: 5, gender: "male", image_url: "" },
               { id: 2, student_name: "Sadia Islam", college_name: "Viqarunnisa Noon", review_text: "The exam system is exactly like the real one.", rating: 5, gender: "female", image_url: "" },
               { id: 3, student_name: "Rahim Uddin", college_name: "Notre Dame College", review_text: "Live classes and notes are super helpful.", rating: 5, gender: "male", image_url: "" },
               { id: 4, student_name: "Fatima Akter", college_name: "Holy Cross College", review_text: "I improved my physics grade significantly.", rating: 5, gender: "female", image_url: "" },
               { id: 5, student_name: "Karim Hasan", college_name: "Rajuk Uttara Model College", review_text: "Highly recommended for admission test prep.", rating: 5, gender: "male", image_url: "" }
           ];
       }
       return data;
    },
  });

  // Default hero content if no custom heroes are found
  const defaultHero = {
      title: "Welcome to Beshi Joss LMS",
      subtitle: "Your gateway to excellence. Join us to master your subjects with the best resources and mentors. The all-in-one powerhouse for live classes, instant results, and seamless course management.",
      cta_text: "Get Started",
      cta_link: "/login",
      image_url: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1600&h=900"
  };

  const displayHeroes = heroes && heroes.length > 0 ? heroes : [defaultHero];
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5000 })]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />

      {/* Hero Section (Full Width) */}
      <div className="overflow-hidden w-full" ref={emblaRef}>
          <div className="flex">
            {displayHeroes.map((hero: any, index: number) => (
              <section key={hero.id || index} className="min-w-0 flex-[0_0_100%]">
                <a href={hero.cta_link || "#"} className="block relative w-full h-auto aspect-video md:aspect-auto md:h-[calc(100vh-64px)] overflow-hidden bg-black/5 cursor-pointer hover:opacity-95 transition-opacity">
                   {hero.image_url ? (
                     <div className="h-full w-full relative">
                        {/* Blurred background for fill */}
                        <div
                            className="absolute inset-0 bg-cover bg-center blur-xl opacity-50 scale-110"
                            style={{ backgroundImage: `url(${hero.image_url})` }}
                        />
                        {/* Main Image */}
                        <img
                            src={hero.image_url}
                            alt={hero.title}
                            className="relative h-full w-full object-contain z-10"
                        />
                     </div>
                   ) : (
                     <div className="flex h-full w-full items-center justify-center bg-secondary/50 text-muted-foreground">
                        <Flame className="h-16 w-16 opacity-20" />
                     </div>
                   )}
                </a>
              </section>
            ))}
          </div>
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pb-16 pt-10 sm:pt-14 flex-1">

        {/* Paid Courses Section (Grid View) */}
        <section id="courses" className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Available Courses</h2>
              <p className="text-sm text-muted-foreground">
                Premium programs designed for your success.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground col-span-full">Loading courses...</p>
            ) : !courses || courses.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">No courses available yet.</p>
            ) : (
              courses.map((course: any) => {
                const image = course.image_url || "/placeholder.svg";
                const description = course.short_description || "";
                const idOrSlug = course.slug || course.id;

                return (
                  <Card key={course.id} className="overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                    {/* Course Image */}
                    <div className="w-full aspect-video relative">
                            <img
                            src={image}
                            alt={`${course.name} cover`}
                            className="h-full w-full object-cover"
                            />
                    </div>
                    {/* Content */}
                    <div className="flex-1 p-5 flex flex-col justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-bold mb-2 leading-tight">{course.name}</h3>
                            <p className="text-muted-foreground text-xs mb-4 line-clamp-3">{description}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Live Classes</div>
                                <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Lecture Notes</div>
                                <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Standard Exams</div>
                                <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Solve Sheets</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-auto pt-4 border-t border-dashed">
                            <div className="flex flex-col items-start">
                                {course.original_price != null && Number(course.original_price) > Number(course.price) && (
                                    <span className="text-[10px] text-muted-foreground line-through">
                                        ৳{Number(course.original_price).toLocaleString("en-BD")}
                                    </span>
                                )}
                                <div className="text-base font-bold text-primary">
                                    {course.price != null ? `৳${Number(course.price).toLocaleString("en-BD")}` : "Contact"}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button asChild variant="outline" size="sm" className="h-8 px-2 text-xs">
                                    <a href={`/courses/${idOrSlug}`}>Details</a>
                                </Button>
                                <Button asChild size="sm" className="h-8 px-2 text-xs">
                                    <a href={`/courses/${idOrSlug}/buy`}>Enroll</a>
                                </Button>
                            </div>
                        </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </section>

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

        {/* Unique Services Section */}
        <section className="space-y-6">
            <div className="text-center md:text-left">
                <h2 className="text-2xl font-semibold tracking-tight">Unique Services</h2>
                <p className="text-sm text-muted-foreground">Why choose Beshi Joss LMS?</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {FEATURES.map((feature, i) => (
                    <Card key={i} className="border-2 border-primary/10 hover:border-primary/30 transition-colors">
                        <CardContent className="flex flex-col items-center text-center p-4 gap-2">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <feature.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">{feature.title}</h3>
                                <p className="text-xs text-muted-foreground">{feature.desc}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>

        {/* Success Stats Section */}
        <section className="space-y-6">
             <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">Our Success Stories</h2>
                <p className="text-muted-foreground">Consistent results year after year.</p>
             </div>
             <div className="grid gap-4 md:grid-cols-3">
                 {STATS.map((stat, i) => (
                     <Card key={i} className="text-center bg-primary/5 border-primary/20">
                         <CardHeader>
                             <CardTitle className="text-4xl font-bold text-primary">{stat.year}</CardTitle>
                             <CardDescription className="font-semibold uppercase tracking-wider">{stat.title}</CardDescription>
                         </CardHeader>
                         <CardContent>
                             <p className="text-sm font-medium">{stat.details}</p>
                         </CardContent>
                     </Card>
                 ))}
             </div>
        </section>

        {/* Student Reviews */}
        <StudentReviews reviews={reviews} />

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
                               <div className="h-40 w-40 rounded-full overflow-hidden border-2 border-primary shadow-lg hover:shadow-xl transition-shadow">
                                   {mentor.image_url ? (
                                       <img src={mentor.image_url} alt={mentor.name} className="h-full w-full object-cover" />
                                   ) : (
                                       <div className="h-full w-full bg-secondary flex items-center justify-center">
                                           <User className="h-16 w-16 text-muted-foreground" />
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

    </div>
  );
};

export default Index;
