import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { DemoContentItem } from "@/types/admin";
import { PlayCircle, FileText, Lock, CheckCircle2, Tag, Clock, Gift, Copy, Check, Loader2, Timer , MessageCircle, Send} from "lucide-react";
import { getEmbedUrl } from "@/lib/videoUtils";
import { useToast } from "@/hooks/use-toast";
import ClassPlayer from "@/components/ClassPlayer";
import SEO from "@/components/SEO";

// Live countdown timer component
const CountdownTimer = ({ deadline }: { deadline: string }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime();
      const end = new Date(deadline).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft("Expired");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${mins}m ${secs}s`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      } else {
        setTimeLeft(`${mins}m ${secs}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (expired) return null;

  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums">
      <Timer className="h-3 w-3" />
      {timeLeft}
    </span>
  );
};

const CourseDetails = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_amount: number;
    discount_type: string;
    id: string;
  } | null>(null);
  const [couponError, setCouponError] = useState("");

  const {
    data: course,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["public-course", courseId],
    queryFn: async () => {
      if (!courseId) return null;

      const { data, error } = await supabase
        .from("courses")
        .select("id, name, full_description, short_description, price, original_price, image_url, video_url, routine_url, what_you_get, demo_content, slug")
        .or(`slug.eq.${courseId},id.eq.${courseId}`)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // Fetch special discounts for this course
  const { data: specialDiscounts } = useQuery({
    queryKey: ["special-discounts", course?.id],
    queryFn: async () => {
      if (!course?.id) return [];
      const { data, error } = await supabase.rpc("get_special_discounts", { p_course_id: course.id });
      if (error) return [];
      return data || [];
    },
    enabled: !!course?.id,
  });

  useEffect(() => {
    if (course?.name) {
      document.title = `${course.name} – Atlas`;
    } else {
      document.title = "Course – Atlas";
    }
  }, [course?.name]);

  const idOrSlug = course?.slug || course?.id || courseId;

  // Safe parsing of demo_content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demoContent: DemoContentItem[] = (course?.demo_content as any) || [];

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !course?.id) return;
    setCouponLoading(true);
    setCouponError("");

    try {
      const { data, error } = await supabase.rpc("check_promo_code", {
        p_code: couponCode.trim(),
        p_course_id: course.id,
      });

      if (error) throw error;

      if (data?.valid) {
        setAppliedCoupon({
          code: data.code || couponCode.trim().toUpperCase(),
          discount_amount: data.discount_amount,
          discount_type: data.discount_type,
          id: data.id,
        });
        toast({ title: "Coupon applied!", description: `Discount: ${data.discount_type === 'percentage' ? `${data.discount_amount}%` : `৳${data.discount_amount}`}` });
      } else {
        setCouponError(data?.message || "Invalid coupon code");
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError("Failed to check coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  const getDiscountedPrice = () => {
    if (!course?.price || !appliedCoupon) return null;
    const price = Number(course.price);
    if (appliedCoupon.discount_type === "percentage") {
      return Math.max(0, price - (price * appliedCoupon.discount_amount / 100));
    }
    return Math.max(0, price - appliedCoupon.discount_amount);
  };

  const discountedPrice = getDiscountedPrice();

  const formatBDTime = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleString("en-BD", {
        timeZone: "Asia/Dhaka",
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return new Date(isoDate).toLocaleString();
    }
  };

  // Build enrollment URL with coupon params
  const getEnrollUrl = () => {
    const base = idOrSlug ? `/courses/${idOrSlug}/buy` : "#";
    if (appliedCoupon) {
      return `${base}?coupon=${encodeURIComponent(appliedCoupon.code)}&coupon_id=${appliedCoupon.id}&discount_amount=${appliedCoupon.discount_amount}&discount_type=${appliedCoupon.discount_type}`;
    }
    return base;
  };

  const CouponSection = ({ compact = false }: { compact?: boolean }) => (
    <div className={`space-y-2 ${compact ? "" : "border-t pt-4"}`}>
      {appliedCoupon ? (
        <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <div>
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">{appliedCoupon.code}</span>
              <span className="text-xs text-green-600 dark:text-green-500 ml-2">
                {appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount_amount}% off` : `৳${appliedCoupon.discount_amount} off`}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setAppliedCoupon(null); setCouponCode(""); setCouponError(""); }}>
            Remove
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={couponCode}
              onChange={(e) => { setCouponCode(e.target.value); setCouponError(""); }}
              placeholder="Enter coupon code"
              className="text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleApplyCoupon}
              disabled={couponLoading || !couponCode.trim()}
              className="shrink-0"
            >
              {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
          {couponError && <p className="text-xs text-red-500">{couponError}</p>}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground pb-28 md:pb-16">
      <SEO 
        title={course?.name || "Loading"} 
        description={course?.short_description || undefined}
      />
      <PublicHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Left Column (Content) */}
        <div className="md:col-span-2 space-y-8">

            {/* 1. Course Header & Media */}
            <div className="space-y-4">
                 <div className="w-full rounded-xl overflow-hidden border bg-muted shadow-sm">
                    <AspectRatio ratio={16 / 9}>
                        {
                            // @ts-ignore
                            course?.video_url ? (
                                <ClassPlayer
                                    videoId={course.video_url}
                                    title="Course Intro"
                                />
                            ) : course?.image_url ? (
                                <img
                                    src={course.image_url}
                                    alt={`${course.name} cover`}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                                    No Media Available
                                </div>
                            )
                        }
                    </AspectRatio>
                </div>
                <div>
                     <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                        {isLoading ? "Loading..." : course?.name ?? "Course not found"}
                    </h1>
                     {!isLoading && !isError && course?.short_description && (
                        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{course.short_description}</p>
                     )}
                     

                </div>
            </div>

            {/* Mobile-only: Special Discount + Coupon + Price Card */}
            <div className="md:hidden space-y-3">
              {/* Discount banners */}
              {specialDiscounts && specialDiscounts.length > 0 && specialDiscounts.map((discount: any, idx: number) => (
                <div key={idx} className="rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 p-3">
                  <div className="flex items-start gap-2.5">
                    <Gift className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 leading-snug">{discount.special_discount_text}</p>
                      <div className="flex items-center justify-between mt-2">
                        {discount.special_discount_deadline && (
                          <span className="text-red-600 dark:text-red-400"><CountdownTimer deadline={discount.special_discount_deadline} /></span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-amber-300 hover:bg-amber-100 text-amber-800"
                          onClick={() => {
                            navigator.clipboard.writeText(discount.code);
                            toast({ title: "Copied!", description: `"${discount.code}" copied to clipboard.` });
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          {discount.code}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Coupon input */}
              <CouponSection />
            </div>

            {/* 2. Course Description Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Course Description</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-stone dark:prose-invert max-w-none text-sm">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex, rehypeRaw]}
                        components={{
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            img: ({node, ...props}: any) => <img {...props} className="rounded-lg max-w-full" />
                        }}
                    >
                        {course?.full_description || "No description available."}
                    </ReactMarkdown>
                </CardContent>
            </Card>

             {/* 3. What You Get Card */}
             {course?.what_you_get && Array.isArray(course.what_you_get) && course.what_you_get.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">What you will get</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-stone dark:prose-invert max-w-none text-sm">
                         <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex, rehypeRaw]}
                            components={{
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                img: ({node, ...props}: any) => <img {...props} className="rounded-lg max-w-full" />
                            }}
                         >
                            {course.what_you_get.join("\n")}
                        </ReactMarkdown>
                    </CardContent>
                </Card>
            )}

            {/* 4. Demo Classes Card */}
            {demoContent.length > 0 && (
                 <Card>
                     <CardHeader>
                         <CardTitle className="text-xl">Demo Classes</CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-2">
                        {demoContent.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-3 p-3 rounded-md border hover:bg-muted/50 transition-colors group"
                            >
                                <div className="bg-primary/10 p-2 rounded-full text-primary">
                                    <PlayCircle className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-sm">{item.title}</p>
                                    <div className="flex gap-2 text-xs text-muted-foreground">
                                        {item.video_url && <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3" /> Video</span>}
                                        {item.note_url && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Note</span>}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {item.video_url && (
                                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/courses/${idOrSlug}/demo/${idx}?type=video`)}>
                                            Watch
                                        </Button>
                                    )}
                                    {item.note_url && (
                                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/courses/${idOrSlug}/demo/${idx}?type=note`)}>
                                            Note
                                        </Button>
                                    )}
                                    {item.is_locked && <Lock className="w-4 h-4 text-muted-foreground ml-2" />}
                                </div>
                            </div>
                        ))}
                     </CardContent>
                 </Card>
            )}

            {/* Routine Button (Moved Below) */}
            {!isLoading && course?.routine_url && (
                <div className="flex justify-center mt-6 mb-4">
                    <Button variant="default" size="lg" asChild className="w-full md:w-auto font-bold text-base shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <a href={course.routine_url} target="_blank" rel="noopener noreferrer">
                            <FileText className="w-5 h-5 mr-2" />
                            Download Routine
                        </a>
                    </Button>
                </div>
            )}

            {/* Need Help Section */}
            <div className="mt-6 flex flex-col gap-3">
                <p className="text-sm font-semibold text-center text-muted-foreground">Need Help? Contact Support</p>
                <div className="flex gap-3 justify-center">
                    <Button variant="outline" asChild className="flex-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#075E54] dark:text-[#25D366]">
                        <a href="https://wa.me/8801999681290" target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            WhatsApp
                        </a>
                    </Button>
                    <Button variant="outline" asChild className="flex-1 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border-[#0088cc]/30 text-[#0088cc] dark:text-[#33aaff]">
                        <a href="https://t.me/rafi_somc" target="_blank" rel="noopener noreferrer">
                            <Send className="w-4 h-4 mr-2" />
                            Telegram
                        </a>
                    </Button>
                </div>
            </div>

        </div>

        {/* Right Column (Sticky Enrollment Card) */}
        <div className="hidden md:block">
            <div className="sticky top-24 space-y-4">

                {/* Special Discount Banners — above price */}
                {specialDiscounts && specialDiscounts.length > 0 && specialDiscounts.map((discount: any, idx: number) => (
                  <div key={idx} className="relative overflow-hidden rounded-xl border-2 border-amber-300/50 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/30 p-3 shadow-sm">
                    <div className="flex items-start gap-2">
                      <Gift className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-amber-900 dark:text-amber-200 leading-snug">{discount.special_discount_text}</p>
                        {discount.special_discount_deadline && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-amber-700 dark:text-amber-400">Ends in:</span>
                            <span className="text-red-600 dark:text-red-400"><CountdownTimer deadline={discount.special_discount_deadline} /></span>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 h-7 text-xs w-full border-amber-300 hover:bg-amber-100 text-amber-800"
                          onClick={() => {
                            navigator.clipboard.writeText(discount.code);
                            toast({ title: "Code copied!", description: `"${discount.code}" copied to clipboard.` });
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy: {discount.code}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                <Card className="border-primary/20 shadow-lg overflow-hidden">
                    <div className="bg-primary/5 p-4 border-b border-primary/10 text-center">
                        <p className="text-sm text-muted-foreground font-medium">Enrolling in</p>
                        <h3 className="font-bold text-primary line-clamp-1" title={course?.name}>{course?.name || "..."}</h3>
                    </div>
                    <CardContent className="p-6 space-y-4">
                        <div className="text-center">
                            {course?.original_price && (
                                <p className="text-sm text-muted-foreground line-through">
                                    ৳{Number(course.original_price).toLocaleString("en-BD")}
                                </p>
                            )}
                            {discountedPrice != null && appliedCoupon ? (
                              <>
                                <p className="text-sm text-muted-foreground line-through">
                                    ৳{Number(course?.price).toLocaleString("en-BD")}
                                </p>
                                <div className="text-4xl font-extrabold text-green-600">
                                    {discountedPrice === 0 ? "Free!" : `৳${discountedPrice.toLocaleString("en-BD")}`}
                                </div>
                              </>
                            ) : (
                              <div className="text-4xl font-extrabold text-primary">
                                  {course?.price != null ? `৳${Number(course.price).toLocaleString("en-BD")}` : "Free"}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">One-time payment</p>
                        </div>

                        <CouponSection />

                        <Button asChild size="lg" className="w-full text-lg font-bold shadow-md hover:shadow-lg transition-all" disabled={!course && !isLoading}>
                            <a href={getEnrollUrl()}>Enroll Now</a>
                        </Button>

                        <div className="space-y-2 text-sm text-muted-foreground">
                             <div className="flex items-center gap-2">
                                 <CheckCircle2 className="w-4 h-4 text-green-500" />
                                 <span>Fast Access</span>
                             </div>
                             <div className="flex items-center gap-2">
                                 <CheckCircle2 className="w-4 h-4 text-green-500" />
                                 <span>Premium Support</span>
                             </div>
                        </div>
                    </CardContent>
                </Card>

            {/* Need Help Section */}
            <div className="mt-6 flex flex-col gap-3">
                <p className="text-sm font-semibold text-center text-muted-foreground">Need Help? Contact Support</p>
                <div className="flex gap-3 justify-center">
                    <Button variant="outline" asChild className="flex-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#075E54] dark:text-[#25D366]">
                        <a href="https://wa.me/8801999681290" target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            WhatsApp
                        </a>
                    </Button>
                    <Button variant="outline" asChild className="flex-1 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border-[#0088cc]/30 text-[#0088cc] dark:text-[#33aaff]">
                        <a href="https://t.me/rafi_somc" target="_blank" rel="noopener noreferrer">
                            <Send className="w-4 h-4 mr-2" />
                            Telegram
                        </a>
                    </Button>
                </div>
            </div>

            </div>
        </div>

      </main>

      {/* Sticky Bottom Bar for Mobile — minimal: price + enroll only */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t z-50 md:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <div className="px-4 py-3 flex items-center gap-3">
              <div className="flex flex-col min-w-0">
                  {course?.original_price && (
                      <span className="text-[10px] text-muted-foreground line-through leading-none">
                          ৳{Number(course.original_price).toLocaleString("en-BD")}
                      </span>
                  )}
                  {discountedPrice != null && appliedCoupon ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm text-muted-foreground line-through">৳{Number(course?.price).toLocaleString("en-BD")}</span>
                      <span className="text-lg font-bold text-green-600 leading-tight">
                          {discountedPrice === 0 ? "Free!" : `৳${discountedPrice.toLocaleString("en-BD")}`}
                      </span>
                    </div>
                  ) : (
                    <span className="text-lg font-bold text-primary leading-tight">
                        {course?.price != null ? `৳${Number(course.price).toLocaleString("en-BD")}` : "Free"}
                    </span>
                  )}
              </div>
              <Button asChild size="lg" className="flex-1 shadow-md font-bold" disabled={!course && !isLoading}>
                  <a href={getEnrollUrl()}>Enroll Now</a>
              </Button>
          </div>
      </div>
    </div>
  );
};

export default CourseDetails;
