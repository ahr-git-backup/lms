import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import PublicHeader from "@/components/PublicHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Copy, AlertCircle, Sparkles, Tag } from "lucide-react";

const formSchema = z.object({
  trx_id: z.string().min(5, "Transaction ID is too short"),
  phone: z.string().min(11, "Phone number must be at least 11 digits"),
  payment_method: z.enum(["bkash", "nagad"], { required_error: "Please select a payment method" }),
});

const CourseBuy = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Promo Code State
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState<{ amount: number; type: 'flat' | 'percentage'; id: string } | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      trx_id: "",
      phone: profile?.phone || "",
      payment_method: "bkash",
    },
  });

  const {
    data: course,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["public-course-buy", courseId],
    queryFn: async () => {
      if (!courseId) return null;

      const { data, error } = await supabase
        .from("courses")
        .select("id, name, price, slug, bkash_number, nagad_number")
        .or(`slug.eq.${courseId},id.eq.${courseId}`)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  const freeEnrollMutation = useMutation({
    mutationFn: async () => {
        if (!course?.id || !user?.id) throw new Error("Course not found or user not logged in");

        // If price is 0 naturally, use the RPC
        if (course.price === 0) {
            const { error } = await supabase.rpc('enroll_in_free_course', { p_course_id: course.id });
            if (error) throw error;
        } else {
            // If price is 0 due to promo, submit a payment request with special flag
            const { error } = await supabase.from("payment_requests").insert({
                profile_id: user.id,
                course_id: course.id,
                trx_id: 'PROMO-FREE',
                phone: profile?.phone || 'N/A',
                payment_method: 'bkash', // Placeholder, admin will see amount 0 or TRX PROMO-FREE
                status: 'pending' // Admin will approve
            });
            if (error) throw error;
        }
    },
    onSuccess: () => {
        if (course?.price === 0) {
            toast.success("Enrolled successfully!");
             navigate("/dashboard");
        } else {
             toast.success("Enrollment request submitted! Please wait for approval.");
             navigate("/dashboard");
        }
    },
    onError: (err) => {
        toast.error(err.message);
    }
  });

  const { data: enrollment } = useQuery({
    queryKey: ["check-enrollment", course?.id, user?.id],
    queryFn: async () => {
      if (!course?.id || !user?.id) return null;
      const { data, error } = await supabase
        .from("enrollments")
        .select("id")
        .eq("course_id", course.id)
        .eq("profile_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!course?.id && !!user?.id,
  });

  const { data: existingRequest } = useQuery({
    queryKey: ["check-payment-request", course?.id, user?.id],
    queryFn: async () => {
        if (!course?.id || !user?.id) return null;
        const { data } = await supabase
            .from("payment_requests")
            .select("*")
            .eq("course_id", course.id)
            .eq("profile_id", user.id)
            .eq("status", "pending")
            .maybeSingle();
        return data;
    },
    enabled: !!course?.id && !!user?.id,
  });

  useEffect(() => {
    if (course?.name) {
      document.title = `Buy ${course.name} – Atlas`;
    } else {
      document.title = "Buy course – Atlas";
    }
  }, [course?.name]);

  const checkPromoCode = async () => {
      if (!promoCode || !course?.id) return;
      setCheckingPromo(true);
      try {
          const { data, error } = await supabase.rpc('check_promo_code', {
              p_code: promoCode,
              p_course_id: course.id
          });

          if (error) throw error;

          if (data && data.valid) {
              setDiscount({
                  amount: data.discount_amount,
                  type: data.discount_type,
                  id: data.id
              });
              toast.success("Promo code applied!");
          } else {
              setDiscount(null);
              toast.error(data?.message || "Invalid promo code");
          }
      } catch (err) {
          console.error(err);
          toast.error("Failed to check promo code");
      } finally {
          setCheckingPromo(false);
      }
  };

  const submitMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
        if (!user || !course) throw new Error("Authentication required");

        const { error } = await supabase.from("payment_requests").insert({
            profile_id: user.id,
            course_id: course.id,
            trx_id: values.trx_id,
            phone: values.phone,
            payment_method: values.payment_method,
            status: 'pending'
            // promo_code_id: discount?.id
            // Note: keeping promo_code_id commented out until schema migration for payment_requests is confirmed.
            // The admin will verify the amount sent against the expected discounted price.
        });

        if (error) throw error;
    },
    onSuccess: () => {
        setIsSubmitted(true);
        toast.success("Payment request submitted successfully!");
    },
    onError: (error) => {
        toast.error("Failed to submit: " + error.message);
    }
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    submitMutation.mutate(values);
  }

  const bkashNumber = course?.bkash_number || "01XXXXXXXXX";
  const nagadNumber = course?.nagad_number || "01XXXXXXXXX";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  // Calculate final price
  let finalPrice = course?.price || 0;
  if (discount) {
      if (discount.type === 'flat') {
          finalPrice = Math.max(0, finalPrice - discount.amount);
      } else if (discount.type === 'percentage') {
          finalPrice = Math.max(0, finalPrice - (finalPrice * (discount.amount / 100)));
      }
  }

  if (isLoading) {
      return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>;
  }

  if (enrollment) {
      return (
          <div className="min-h-screen bg-background text-foreground">
              <PublicHeader />
              <main className="mx-auto max-w-2xl px-4 py-16 text-center">
                  <div className="flex justify-center mb-4 text-green-500"><CheckCircle2 size={64} /></div>
                  <h1 className="text-2xl font-bold mb-2">You are already enrolled!</h1>
                  <p className="text-muted-foreground mb-6">You have access to {course?.name}.</p>
                  <Button asChild><Link to="/dashboard">Go to Dashboard</Link></Button>
              </main>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-10 sm:pt-14">
        <Card className="border-[3px] border-foreground">
          <CardHeader className="space-y-1 pb-3">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Payment instructions</p>
            <CardTitle className="text-xl">
              {course?.name ? `Buy ${course.name}` : "Course not found"}
            </CardTitle>
            <CardDescription className="text-xs">
              {finalPrice === 0 ? "This course is free for you." : "Complete the payment manually and submit the details below."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            {isError && (
              <p className="text-sm text-destructive">Failed to load course. Please refresh and try again.</p>
            )}

            {finalPrice === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="p-4 bg-primary/10 rounded-full">
                        <Sparkles className="h-12 w-12 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold">Enroll for Free!</h2>
                        <p className="text-muted-foreground max-w-sm mx-auto">
                            Get instant access to all classes, exams, and resources in this course without any payment.
                        </p>
                    </div>
                    {!user ? (
                        <div className="space-y-4">
                            <p className="text-sm font-medium">Please login to enroll</p>
                            <div className="flex gap-2 justify-center">
                                <Button asChild variant="default"><Link to="/login">Login Now</Link></Button>
                                <Button asChild variant="outline"><Link to="/register">Register</Link></Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            size="lg"
                            className="w-full max-w-xs text-lg shadow-lg hover:shadow-primary/25 transition-all hover:scale-105"
                            onClick={() => freeEnrollMutation.mutate()}
                            disabled={freeEnrollMutation.isPending}
                        >
                            {freeEnrollMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Start Learning Now"}
                        </Button>
                    )}
                </div>
            ) : (
                <>
                {/* Price Display */}
                <div className="text-center py-4 bg-muted/30 rounded-lg border">
                    <p className="text-muted-foreground text-xs uppercase tracking-widest mb-1">Total Payable Amount</p>
                    <div className="flex items-center justify-center gap-2">
                        {discount ? (
                            <>
                             <span className="text-xl text-muted-foreground line-through decoration-red-500/50">৳{Number(course?.price).toLocaleString("en-BD")}</span>
                             <span className="text-3xl font-bold text-primary">৳{Number(finalPrice).toLocaleString("en-BD")}</span>
                            </>
                        ) : (
                             <span className="text-3xl font-bold">৳{Number(course?.price).toLocaleString("en-BD")}</span>
                        )}
                    </div>
                    {discount && <p className="text-xs text-green-600 font-medium mt-1">Promo code applied!</p>}
                </div>

                {/* Promo Code Input */}
                <div className="flex gap-2 items-end">
                    <div className="grid w-full gap-1.5">
                        <Label htmlFor="promo" className="text-xs">Have a Promo Code?</Label>
                        <div className="relative">
                            <Tag className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="promo"
                                placeholder="Enter code here"
                                className="pl-9"
                                value={promoCode}
                                onChange={(e) => setPromoCode(e.target.value)}
                                disabled={!!discount}
                            />
                        </div>
                    </div>
                    {discount ? (
                        <Button variant="outline" onClick={() => { setDiscount(null); setPromoCode(""); }}>Remove</Button>
                    ) : (
                        <Button onClick={checkPromoCode} disabled={!promoCode || checkingPromo}>
                            {checkingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                        </Button>
                    )}
                </div>

                <div className="bg-muted/50 p-6 rounded-lg space-y-4 border">
                    <div className="flex items-center gap-2 text-base font-bold text-primary">
                        <span className="bg-primary text-primary-foreground w-7 h-7 rounded-full flex items-center justify-center text-sm">1</span>
                        Step 1: Send Money
                    </div>
                    <p className="text-muted-foreground pl-9">
                        Send <span className="font-bold text-foreground">৳{Number(finalPrice).toLocaleString("en-BD")}</span> via "Send Money".
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div className="relative p-4 bg-pink-50 dark:bg-pink-950/30 rounded-lg border border-pink-200 dark:border-pink-800 group hover:shadow-sm transition-shadow">
                            <span className="text-xs font-bold text-pink-600 dark:text-pink-400 block mb-1 uppercase tracking-wider">bKash Personal</span>
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-lg font-bold tracking-wide">{bkashNumber}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-pink-600 hover:text-pink-700 hover:bg-pink-100"
                                    onClick={() => copyToClipboard(bkashNumber, "bKash number")}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="relative p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800 group hover:shadow-sm transition-shadow">
                            <span className="text-xs font-bold text-orange-600 dark:text-orange-400 block mb-1 uppercase tracking-wider">Nagad Personal</span>
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-lg font-bold tracking-wide">{nagadNumber}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                                    onClick={() => copyToClipboard(nagadNumber, "Nagad number")}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-base font-bold text-primary">
                        <span className="bg-primary text-primary-foreground w-7 h-7 rounded-full flex items-center justify-center text-sm">2</span>
                        Step 2: Submit Details
                    </div>

                    {!user ? (
                        <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                            <div className="flex justify-center mb-3 text-muted-foreground"><AlertCircle className="h-8 w-8" /></div>
                            <p className="mb-4 font-medium">You must be logged in to submit payment details.</p>
                            <div className="flex gap-2 justify-center">
                                <Button asChild variant="default"><Link to="/login">Login Now</Link></Button>
                                <Button asChild variant="outline"><Link to="/register">Register</Link></Button>
                            </div>
                        </div>
                    ) : isSubmitted || existingRequest ? (
                        <div className="text-center py-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 animate-in zoom-in-95 duration-300 p-6">
                            <div className="flex justify-center mb-4">
                                <div className="p-3 bg-yellow-100 text-yellow-600 rounded-full dark:bg-yellow-900/30 dark:text-yellow-400">
                                    <CheckCircle2 className="h-8 w-8" />
                                </div>
                            </div>
                            <h3 className="font-bold text-xl text-yellow-900 dark:text-yellow-200 mb-4">
                                এটলাসের কোর্সে আপনাকে স্বাগতম।
                            </h3>
                            <div className="text-sm text-yellow-800 dark:text-yellow-300 space-y-3 leading-relaxed max-w-lg mx-auto">
                                <p>
                                    <a href="https://t.me/atlasweb_robot" target="_blank" rel="noreferrer" className="font-semibold underline hover:text-yellow-900">
                                        @atlasweb_Robot
                                    </a> এ আপনার বিকাশ/নগদ পেমেন্ট এর স্ক্রিনশট দিয়ে যোগাযোগ করুন।
                                    ২৪ ঘন্টার মাঝে এটলাস টিম যাবতীয় তথ্য চেক করে ওয়েবসাইটে এক্সেস দিয়ে দিবে।
                                </p>
                                <p>এক্সেস পেলে নোটিশ এ মেসেজ আসবে।</p>
                                <p>
                                    ২৪ ঘন্টার মাঝে এক্সেস না পেলে মেসেজ দিন এই নাম্বারে <br/>
                                    <a href="http://wa.me/8801999681290" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold underline mt-1 hover:text-yellow-900">
                                        01999681290 (WhatsApp)
                                    </a>
                                </p>
                            </div>
                            <Button asChild className="mt-6 bg-yellow-600 hover:bg-yellow-700 text-white border-none"><Link to="/dashboard">Go to Dashboard</Link></Button>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 border p-6 rounded-lg bg-card shadow-sm">
                                <FormField
                                control={form.control}
                                name="payment_method"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                    <FormLabel>Payment Method Used</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        className="flex flex-col space-y-1"
                                        >
                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                            <FormControl>
                                            <RadioGroupItem value="bkash" />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                            bKash
                                            </FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                            <FormControl>
                                            <RadioGroupItem value="nagad" />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                            Nagad
                                            </FormLabel>
                                        </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />

                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Sender Phone Number</FormLabel>
                                            <FormControl>
                                                <Input placeholder="01XXXXXXXXX" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="trx_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Transaction ID (TrxID)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. 9G7..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" className="w-full" disabled={submitMutation.isPending}>
                                    {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Submit Payment Proof
                                </Button>
                            </form>
                        </Form>
                    )}
                </div>
                </>
            )}

          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CourseBuy;
