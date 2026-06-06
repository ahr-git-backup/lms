import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import {
  ArrowRight,
  Star,
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
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { StudentReviews } from "@/components/StudentReviews";
import { CourseSection } from "@/components/home/CourseSection";
import HeroCarouselItem from "@/components/home/HeroCarouselItem";

const FEATURES = [
    { icon: Monitor, title: "অনলাইন প্রোগ্রাম", desc: "ঘরে বসেই সেরা প্রস্তুতি।" },
    { icon: Users, title: "অভিজ্ঞ শিক্ষকবৃন্দ", desc: "সেরা মেন্টরদের সান্নিধ্যে।" },
    { icon: BookOpen, title: "স্টাডি ম্যাটেরিয়ালস", desc: "মানসম্মত নোট এবং রিসোর্স।" },
    { icon: Lightbulb, title: "কনসেপ্ট ভিত্তিক ক্লাস", desc: "বেসিক হোক শক্তিশালী।" },
    { icon: FileText, title: "ইউনিক এক্সাম সিস্টেম", desc: "নিজেকে যাচাইয়ের সেরা মাধ্যম।" },
    { icon: MessageCircle, title: "Q&A সাপোর্ট", desc: "তাৎক্ষণিক সমস্যার সমাধান।" },
    { icon: Smartphone, title: "সঠিক গাইডলাইন", desc: "সাফল্যের পথে এগিয়ে চলুন।" },
    { icon: BarChart, title: "এক্সাম লিডারবোর্ড", desc: "অন্যদের সাথে নিজের অবস্থান যাচাই।" },
];

const STATS = [
    { year: "২০২৪", title: "মেডিকেল ভর্তি", details: "টপ ২০-এ ৬/২০। মোট ৩৫০+ সাফল্য।" },
    
];

const Index = () => {
  useEffect(() => {
    document.title = "Atlas - Best Coaching & Exam Platform";
  }, []);

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

  const { data: specialExams } = useQuery({
    queryKey: ["public-special-exams"],
    queryFn: async () => {
      // @ts-ignore
      const { data, error } = await supabase
        .from("special_exam_cards")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      };
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
               { id: 1, student_name: "Sadiq", college_name: "Dhaka College", review_text: "এইচএসসি প্রস্তুতির জন্য সেরা প্ল্যাটফর্ম!", rating: 5, gender: "male", image_url: "https://pub-48488a27fc9244d9b86fec8da3eb89f4.r2.dev/d63297ba-5e53-45ba-a2a1-7ab15d3c5ade.webp", post_image_url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop" }
           ];
       }
       return data;
    },
  });

  // Default hero content if no custom heroes are found
  const defaultHero = {
      title: "এটলাসে স্বাগতম",
      subtitle: "সেরা রিসোর্স এবং মেন্টরদের সাথে নিয়ে এক্সিলেন্স অর্জনের পথে আপনাকে স্বাগতম। লাইভ ক্লাস, তাৎক্ষণিক রেজাল্ট এবং সম্পূর্ণ কোর্স ম্যানেজমেন্টের এক অনন্য আয়োজন।",
      cta_text: "শুরু করুন",
      cta_link: "/login",
      image_url: "https://pub-48488a27fc9244d9b86fec8da3eb89f4.r2.dev/99deffc5-66ec-46c4-a582-f02d9c07a0de.webp"
  };

  const displayHeroes = heroes && heroes.length > 0 ? heroes : [defaultHero];
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5000 })]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
      <PublicHeader />

      {/* Hero Section (Full Width) */}
      <div className="overflow-hidden w-full relative" ref={emblaRef}>
          <div className="flex">
            {displayHeroes.map((hero: any, index: number) => (
              <HeroCarouselItem key={hero.id || index} hero={hero} />
            ))}
          </div>
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pb-16 pt-10 sm:pt-14 flex-1">

        {/* Special Exams Section */}
        {specialExams && specialExams.length > 0 && (
            <section id="special-exams" className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">বিশেষ ঘোষণা</h2>
                        <p className="text-sm text-muted-foreground mt-1">গুরুত্বপূর্ণ আপডেট এবং বিশেষ ঘোষণা সমূহ।</p>
                    </div>
                    <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        লাইভ আপডেট
                    </span>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {(specialExams as any[]).map((exam: any) => {
                      const isAnnouncement = exam.card_type === 'announcement';

                      if (isAnnouncement) {
                        return (
                          <div key={exam.id} className="relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 group">
                            {/* Accent gradient top bar */}
                            <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" />
                            {exam.image_url && (
                              <div className="h-48 w-full overflow-hidden">
                                <img src={exam.image_url} alt={exam.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              </div>
                            )}
                            <div className="flex flex-grow flex-col gap-3 p-5">
                              {/* Card badge */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider bg-violet-500/10 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/20">📢 বিজ্ঞপ্তি</span>
                              </div>
                              <h3 className="text-lg font-bold leading-tight text-foreground">{exam.title}</h3>
                              {exam.details && (
                                <p className="text-sm text-muted-foreground leading-relaxed">{exam.details}</p>
                              )}
                              {exam.instructions && (
                                <div className="mt-auto rounded-xl bg-white/60 dark:bg-white/5 border border-violet-200/50 dark:border-violet-500/20 px-4 py-3 backdrop-blur-sm">
                                  <p className="text-xs text-violet-700 dark:text-violet-300 leading-snug font-medium">{exam.instructions}</p>
                                </div>
                              )}
                              {exam.action_link && (
                                <a
                                  href={exam.action_link}
                                  className="mt-2 inline-flex items-center justify-center gap-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl transition-colors"
                                >
                                  {exam.button_text || "বিস্তারিত দেখুন"} <ArrowRight className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // ── Exam Card ─────────────────────────────────────────────────
                      return (
                        <Card key={exam.id} className="overflow-hidden flex flex-col hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 border-primary/10 hover:border-primary/30 group rounded-2xl">
                            {exam.image_url && (
                                <div className="h-44 w-full overflow-hidden bg-muted">
                                    <img src={exam.image_url} alt={exam.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                </div>
                            )}
                            <div className="h-1.5 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
                            <CardHeader className="pb-3">
                                <div className="flex items-start gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 mt-0.5">📋 বিশেষ পরীক্ষা</span>
                                </div>
                                <CardTitle className="text-xl font-bold mt-2">{exam.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-grow flex-col gap-2 pt-0">
                                {exam.details && (
                                    <div className="space-y-1.5">
                                        <div className="grid grid-cols-1 gap-y-1 text-xs text-muted-foreground">
                                            {exam.details.split(/[,|\n]+/).filter((d: string) => d.trim().length > 0).map((detail: string, i: number) => (
                                                <div key={i} className="flex items-start gap-2 bg-muted/40 rounded-lg px-3 py-1.5">
                                                    <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                                                    <span className="text-[11px] leading-tight">{detail.trim()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {exam.instructions && (
                                    <div className="mt-2 text-sm bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl flex items-start gap-3">
                                        <Lightbulb className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                                        <p className="text-yellow-700 dark:text-yellow-500/90 text-xs leading-snug font-medium">
                                            {exam.instructions}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                            {exam.action_link && (
                                <CardFooter className="pt-2 pb-4">
                                    <Button asChild className="w-full text-sm h-10 rounded-xl" size="sm">
                                        <a href={exam.action_link}>
                                            {exam.button_text || "বিস্তারিত দেখুন"} <ArrowRight className="ml-2 h-4 w-4" />
                                        </a>
                                    </Button>
                                </CardFooter>
                            )}
                        </Card>
                      );
                    })}
                </div>
            </section>
        )}


        {/* Paid Courses Section (Grid View) */}
        <CourseSection />

        {/* Free Service/Courses Section */}
        <section id="free-resources" className="space-y-6">
            <div className="text-center md:text-left">
                <h2 className="text-2xl font-semibold tracking-tight">ফ্রি লার্নিং রিসোর্স</h2>
                <p className="text-sm text-muted-foreground">আজই শুরু করুন সম্পূর্ণ ফ্রিতে।</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Flame className="h-5 w-5 text-primary" /> ফ্রি এক্সাম
                        </CardTitle>
                        <CardDescription>
                            আমাদের সাবজেক্ট এবং টপিক ভিত্তিক ফ্রি এক্সাম দিয়ে নিজেকে যাচাই করুন।
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">ফ্রি রেজিস্ট্রেশন করে প্র্যাকটিস এক্সামে অংশ নিন। কোনো কোর্স কেনার প্রয়োজন নেই।</p>
                    </CardContent>
                    <CardFooter>
                        <Button asChild variant="default" className="w-full">
                            <a href="/free-exam">ফ্রি এক্সাম দিন</a>
                        </Button>
                    </CardFooter>
                </Card>
                 <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <InfinityIcon className="h-5 w-5 text-primary" /> ফ্রি ক্লাস
                        </CardTitle>
                        <CardDescription>
                            ক্লাস এবং নির্বাচিত টপিক আলোচনা দেখুন একদম ফ্রিতে।
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">ভর্তির আগে আমাদের পড়ানোর স্টাইল এবং কনটেন্ট কোয়ালিটি যাচাই করুন।</p>
                    </CardContent>
                    <CardFooter>
                         <Button asChild variant="outline" className="w-full">
                            <a href="/free-class">ক্লাস সমূহ দেখুন</a>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </section>

        {/* Unique Services Section */}
        <section className="space-y-6">
            <div className="text-center md:text-left">
                <h2 className="text-2xl font-semibold tracking-tight">আমাদের বিশেষত্ব</h2>
                <p className="text-sm text-muted-foreground">কেন বাছবেন এটলাস?</p>
            </div>
            <div>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {FEATURES.map((feature, i) => (
                        <Card key={i} className="border-2 border-primary/10 hover:border-primary/30 transition-colors">
                            <CardContent className="flex flex-col items-center text-center p-4 gap-2">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <feature.icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-xs md:text-sm">{feature.title}</h3>
                                    <p className="text-[10px] md:text-xs text-muted-foreground">{feature.desc}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                 </div>
            </div>
        </section>

        {/* Success Stats Section */}
        <section id="success-stories" className="space-y-6">
             <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">সাফল্যের গল্প</h2>
                <p className="text-muted-foreground">প্রতি বছর ধারাবাহিক সাফল্য।</p>
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
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <StudentReviews reviews={reviews as any} id="reviews" />

      </main>

      {/* Founder & Teacher Panel (Footer Top) */}
      <section className="bg-card border-t py-12 px-4 mt-auto">
          <div className="mx-auto max-w-6xl space-y-8">
               <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">আমাদের মেন্টরবৃন্দ</h2>
                    <p className="text-muted-foreground">আপনার সফলতার কারিগর।</p>
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
                       <p className="text-center col-span-full text-muted-foreground">খুব শীঘ্রই মেন্টর যুক্ত করা হবে।</p>
                   )}
               </div>
          </div>
      </section>

      {/* Floating Contact Buttons */}
      <div className="fixed bottom-6 right-5 z-50 flex flex-col gap-3">
        <a
          href="https://wa.me/8801999681290"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-center h-12 w-12 rounded-full bg-[#25D366] shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300"
          title="WhatsApp"
        >
          <MessageCircle className="h-6 w-6 text-white" />
          <span className="absolute right-14 bg-[#25D366] text-white text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-md pointer-events-none">
            WhatsApp
          </span>
        </a>
        <a
          href="https://t.me/rafi_somc"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-center h-12 w-12 rounded-full bg-[#0088cc] shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300"
          title="Telegram"
        >
          <Send className="h-6 w-6 text-white" />
          <span className="absolute right-14 bg-[#0088cc] text-white text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-md pointer-events-none">
            Telegram
          </span>
        </a>
      </div>
    </div>
  );
};

export default Index;
