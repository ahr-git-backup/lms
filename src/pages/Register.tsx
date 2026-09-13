import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import PublicHeader from "@/components/PublicHeader";
import PostSignupChoiceDialog from "@/components/PostSignupChoiceDialog";
import { Eye, EyeOff, AlertTriangle, PhoneCall, MessageCircle, Send, User, CheckCircle2 } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import { trackPixelEvent, generateEventId, getStoredUtmParams, getFacebookCookies } from "@/lib/metaPixel";

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSecondTimer, setIsSecondTimer] = useState(false);
  const [hscBatch, setHscBatch] = useState("2025");
  const [hscGpa, setHscGpa] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [gender, setGender] = useState("");
  const [duplicatePhone, setDuplicatePhone] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showPostSignupChoice, setShowPostSignupChoice] = useState(false);
  const [postSignupTarget, setPostSignupTarget] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (hscBatch === "2026" || hscBatch === "2027") {
      setHscGpa("5.00");
    }
  }, [hscBatch]);

  useEffect(() => {
    document.title = "Register – Atlas";
  }, []);

  const convertToEnglishDigits = (str: string) => {
    const bengaliToEnglish: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    return str.split('').map(char => bengaliToEnglish[char] || char).join('');
  };

  // Sequential field validation — each field shows a success tick once valid,
  // and unlocks the next field in order.
  const [fields, setFields] = useState({
    fullName: "",
    phone: "",
    email: "",
    fatherName: "",
    motherName: "",
    collegeName: "",
    sscGpa: "",
  });

  const fieldValidity = {
    fullName: fields.fullName.trim().length >= 3,
    phone: (() => {
      const p = convertToEnglishDigits(fields.phone).trim();
      const validPrefixes = ['013', '014', '015', '016', '017', '018', '019'];
      return p.length === 11 && validPrefixes.some((prefix) => p.startsWith(prefix));
    })(),
    gender: !!gender,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()),
    fatherName: fields.fatherName.trim().length >= 3,
    motherName: fields.motherName.trim().length >= 3,
    collegeName: fields.collegeName.trim().length >= 10,
    sscGpa: (() => {
      const v = parseFloat(fields.sscGpa);
      return !isNaN(v) && v >= 1 && v <= 5;
    })(),
  };

  // Order in which fields must be completed before the next unlocks
  const fieldOrder: (keyof typeof fieldValidity)[] = [
    "fullName", "phone", "gender", "email", "fatherName", "motherName", "collegeName", "sscGpa",
  ];

  const isFieldUnlocked = (name: keyof typeof fieldValidity) => {
    const idx = fieldOrder.indexOf(name);
    if (idx <= 0) return true;
    return fieldOrder.slice(0, idx).every((f) => fieldValidity[f]);
  };

  const updateField = (name: keyof typeof fields, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 5MB.", variant: "destructive" });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const fullName = formData.get("fullName") as string;
    const fatherName = formData.get("fatherName") as string;
    const motherName = formData.get("motherName") as string;
    // const registrationId = formData.get("registrationId") as string; // Optional or generated
    const rawPhone = formData.get("phone") as string;
    const phone = convertToEnglishDigits(rawPhone).trim();
    const emailInput = formData.get("email") as string;
    const hscBatch = formData.get("hscBatch") as string;
    const collegeName = formData.get("collegeName") as string;
    const sscGpa = formData.get("sscGpa") as string;
    const hscGpaForm = formData.get("hscGpa") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!gender) {
      toast({
        title: "Registration failed",
        description: "Please select your gender",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (collegeName.trim().length < 10) {
      toast({
        title: "Registration failed",
        description: "Please provide your Full college name",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Registration failed",
        description: "Passwords do not match",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const validPrefixes = ['013', '014', '015', '016', '017', '018', '019'];
    if (phone.length !== 11 || !validPrefixes.some(prefix => phone.startsWith(prefix))) {
      toast({
        title: "Registration failed",
        description: "Please enter a valid 11-digit phone number starting with a recognized prefix.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      // 0. Check if phone already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (existingProfile) {
        setDuplicatePhone(phone);
        setLoading(false);
        return;
      }
      // 1. Determine Auth Email Strategy
      // If user provided a real email, use it. Otherwise, fallback to phone logic?
      // Requirement: "Real Email" preferred. We make email mandatory in UI now.

      const email = emailInput.trim().toLowerCase();

      // Check if email is valid format roughly
      if (!email || !email.includes('@')) {
        throw new Error("Please provide a valid email address.");
      }

      const emailDomain = email.split('@')[1];
      const allowedDomains = ['atlascourses.com', 'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
      if (!allowedDomains.includes(emailDomain)) {
        throw new Error("Only Gmail, Yahoo, Outlook, or Hotmail accounts are allowed.");
      }

      // 2. Create the user in Supabase Auth
      const utmParams = getStoredUtmParams();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          captchaToken,
          data: {
            full_name: fullName,
            father_name: fatherName,
            mother_name: motherName,
            hsc_batch: hscBatch,
            college_name: collegeName,
            ssc_gpa: sscGpa,
            hsc_gpa: hscGpaForm,
            phone: phone,
            gender: gender,
            is_second_timer: isSecondTimer,
            utm_source: utmParams.utm_source || null,
            utm_medium: utmParams.utm_medium || null,
            utm_campaign: utmParams.utm_campaign || null,
            utm_content: utmParams.utm_content || null,
            utm_term: utmParams.utm_term || null,
          }
        }
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error("No user returned from sign up. Please check your email for verification.");
      }

      // Note: The public.profiles insertion is now handled safely by a database trigger (handle_new_user)
      // which automatically runs when the user is created in Supabase Auth. This prevents issues when email verification is required.

      // Optional photo upload (non-blocking — registration succeeds even if this fails)
      if (photoFile) {
        try {
          const ext = photoFile.name.split(".").pop() || "jpg";
          const filePath = `${authData.user.id}/avatar.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(filePath, photoFile, { upsert: true, cacheControl: "3600" });
          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
            await supabase.from("profiles").update({ avatar_url: `${publicUrlData.publicUrl}?t=${Date.now()}` }).eq("id", authData.user.id);
          }
        } catch (photoErr) {
          console.error("Photo upload failed (non-blocking):", photoErr);
        }
      }

      toast({
        title: "Registration successful",
        description: "Account created! Redirecting...",
      });

      // Meta Pixel: CompleteRegistration (browser + server CAPI, same event_id for dedup)
      const regEventId = generateEventId();
      trackPixelEvent("CompleteRegistration", { content_name: "Registration" }, regEventId);
      const fbCookies = getFacebookCookies();
      supabase.functions.invoke("meta-capi", {
        body: {
          event_name: "CompleteRegistration",
          event_id: regEventId,
          event_source_url: window.location.href,
          user: {
            email,
            phone,
            fbp: fbCookies.fbp,
            fbc: fbCookies.fbc,
          },
        },
      }).catch(() => { /* non-blocking: registration already succeeded */ });

      if (authData.session) {
        setPostSignupTarget(location.state?.from);
        setShowPostSignupChoice(true);
      } else {
        navigate("/login", { state: { from: location.state?.from } });
      }

    } catch (error: any) {
      console.error("Registration error:", error);

      // Supabase Auth wraps our handle_new_user trigger's unique-constraint
      // failures (duplicate phone/registration_id in profiles, or Auth's own
      // duplicate-email check) into a generic "Database error saving new
      // user" / "User already registered" message. Detect those cases and
      // show the real reason in Bangla instead of the raw DB error.
      const rawMsg: string = error?.message || "";
      const lower = rawMsg.toLowerCase();
      let title = "রেজিস্ট্রেশন ব্যর্থ হয়েছে";
      let description = rawMsg || "একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।";

      if (lower.includes("already registered") || lower.includes("user already exists") || lower.includes("email") && lower.includes("exist")) {
        title = "এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা আছে";
        description = "এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট রেজিস্টার করা আছে। অন্য ইমেইল ব্যবহার করুন অথবা লগইন করুন।";
      } else if (lower.includes("phone") && (lower.includes("duplicate") || lower.includes("unique") || lower.includes("already"))) {
        title = "এই ফোন নম্বর দিয়ে আগেই অ্যাকাউন্ট খোলা আছে";
        description = "এই ফোন নম্বর দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট রেজিস্টার করা আছে। অন্য ফোন নম্বর ব্যবহার করুন অথবা লগইন করুন।";
      } else if (lower.includes("database error saving new user")) {
        // Trigger-level failure with no specific field named in the message —
        // by far the most common cause is a duplicate phone number (profiles.
        // registration_id / phone unique constraint), since email duplicates
        // are normally caught earlier by Auth itself with a clearer message.
        title = "এই তথ্য দিয়ে আগেই অ্যাকাউন্ট খোলা আছে";
        description = "সম্ভবত এই ফোন নম্বর বা ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট আছে। নতুন ফোন নম্বর/ইমেইল দিয়ে চেষ্টা করুন, অথবা লগইন করুন।";
      }

      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4 py-10">
        <Card className="w-full max-w-xl overflow-hidden rounded-[26px] border-[3px] border-foreground shadow-lg">
                    <CardHeader className="space-y-2 pb-4 pt-7 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Atlas</p>
            <CardTitle className="text-xl font-semibold text-foreground">Create an Account</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Register a new student account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Duplicate Phone Alert */}
            {duplicatePhone && (
              <div className="mb-4 rounded-lg border-2 border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-700 p-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-start gap-3">
                  <PhoneCall className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div className="space-y-2">
                    <p className="font-bold text-red-700 dark:text-red-400">এই ফোন নম্বরটি আগেই রেজিস্ট্রেশন করা হয়েছে!</p>
                    <p className="text-sm text-red-600 dark:text-red-300">
                      <span className="font-mono font-bold">{duplicatePhone}</span> নম্বর দিয়ে আগেই একটি অ্যাকাউন্ট আছে।
                      যদি সাহায্য দরকার হয়, আমাদের সাথে যোগাযোগ করুন:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href="https://wa.me/8801999681290"
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] text-white text-xs font-semibold px-3 py-1.5 hover:opacity-90 transition-opacity"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                      <a
                        href="https://t.me/rafi_somc"
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#0088cc] text-white text-xs font-semibold px-3 py-1.5 hover:opacity-90 transition-opacity"
                      >
                        <Send className="h-3.5 w-3.5" /> Telegram
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="flex flex-col items-center gap-2 pb-2">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full border-2 border-dashed border-muted-foreground/40 overflow-hidden flex items-center justify-center bg-muted">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-8 w-8 text-muted-foreground/50" />
                    )}
                  </div>
                  <label
                    htmlFor="photoUpload"
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer text-xs"
                    title="Upload photo"
                  >
                    +
                  </label>
                  <input id="photoUpload" type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                </div>
                <p className="text-xs text-muted-foreground">Profile Photo (Optional)</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Own Full Name</Label>
                  <div className="relative">
                    <Input
                      id="fullName"
                      name="fullName"
                      required
                      placeholder="Your full name"
                      value={fields.fullName}
                      onChange={(e) => updateField("fullName", e.target.value)}
                      className={fieldValidity.fullName ? "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10 pr-9 border-green-500 focus-visible:ring-green-500" : "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10"}
                    />
                    {fieldValidity.fullName && (
                      <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                  </div>
                  {!fieldValidity.fullName && (
                    <p className="text-[11px] text-orange-600/90 dark:text-orange-400">Please provide your full name.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Input
                      id="phone"
                      name="phone"
                      required
                      placeholder="01XXXXXXXXX"
                      value={fields.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      disabled={!isFieldUnlocked("phone")}
                      className={fieldValidity.phone ? "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10 pr-9 border-green-500 focus-visible:ring-green-500" : "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10"}
                    />
                    {fieldValidity.phone && (
                      <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Select value={gender} onValueChange={setGender} disabled={!isFieldUnlocked("gender")}>
                      <SelectTrigger id="gender" className={fieldValidity.gender ? "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10 pr-9 border-green-500 focus:ring-green-500" : "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10"}>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldValidity.gender && (
                      <CheckCircle2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500 pointer-events-none" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="user@example.com"
                      value={fields.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      disabled={!isFieldUnlocked("email")}
                      className={fieldValidity.email ? "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10 pr-9 border-green-500 focus-visible:ring-green-500" : "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10"}
                    />
                    {fieldValidity.email && (
                      <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fatherName">Father's Full Name</Label>
                  <div className="relative">
                    <Input
                      id="fatherName"
                      name="fatherName"
                      required
                      placeholder="Father's full name"
                      value={fields.fatherName}
                      onChange={(e) => updateField("fatherName", e.target.value)}
                      disabled={!isFieldUnlocked("fatherName")}
                      className={fieldValidity.fatherName ? "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10 pr-9 border-green-500 focus-visible:ring-green-500" : "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10"}
                    />
                    {fieldValidity.fatherName && (
                      <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                  </div>
                  {!fieldValidity.fatherName && isFieldUnlocked("fatherName") && (
                    <p className="text-[11px] text-orange-600/90 dark:text-orange-400">Please provide father's full name.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="motherName">Mother's Full Name</Label>
                  <div className="relative">
                    <Input
                      id="motherName"
                      name="motherName"
                      required
                      placeholder="Mother's full name"
                      value={fields.motherName}
                      onChange={(e) => updateField("motherName", e.target.value)}
                      disabled={!isFieldUnlocked("motherName")}
                      className={fieldValidity.motherName ? "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10 pr-9 border-green-500 focus-visible:ring-green-500" : "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10"}
                    />
                    {fieldValidity.motherName && (
                      <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                  </div>
                  {!fieldValidity.motherName && isFieldUnlocked("motherName") && (
                    <p className="text-[11px] text-orange-600/90 dark:text-orange-400">Please provide mother's full name.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collegeName">Full College Name</Label>
                  <div className="relative">
                    <Input
                      id="collegeName"
                      name="collegeName"
                      required
                      placeholder="Your full college name"
                      value={fields.collegeName}
                      onChange={(e) => updateField("collegeName", e.target.value)}
                      disabled={!isFieldUnlocked("collegeName")}
                      className={fieldValidity.collegeName ? "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10 pr-9 border-green-500 focus-visible:ring-green-500" : "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10"}
                    />
                    {fieldValidity.collegeName && (
                      <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                  </div>
                  {!fieldValidity.collegeName && isFieldUnlocked("collegeName") && (
                    <p className="text-[11px] text-orange-600/90 dark:text-orange-400">Please provide your full college name.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hscBatch">HSC Batch</Label>
                  <select
                    id="hscBatch"
                    name="hscBatch"
                    value={hscBatch}
                    onChange={(e) => setHscBatch(e.target.value)}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sscGpa">SSC GPA (Out of 5)</Label>
                  <div className="relative">
                    <Input
                      id="sscGpa"
                      name="sscGpa"
                      type="number"
                      step="0.01"
                      max="5.00"
                      min="1.00"
                      required
                      placeholder="5.00"
                      value={fields.sscGpa}
                      onChange={(e) => updateField("sscGpa", e.target.value)}
                      disabled={!isFieldUnlocked("sscGpa")}
                      className={fieldValidity.sscGpa ? "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10 pr-9 border-green-500 focus-visible:ring-green-500" : "h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10"}
                    />
                    {fieldValidity.sscGpa && (
                      <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hscGpa">HSC GPA (Optional)</Label>
                  <Input
                    id="hscGpa"
                    name="hscGpa"
                    type="number"
                    step="0.01"
                    max="5.00"
                    min="0.00"
                    placeholder="5.00"
                    value={hscGpa}
                    onChange={(e) => setHscGpa(e.target.value)}
                    className="h-11 rounded-xl border-input text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10"
                  />
                  <p className="text-[11px] text-orange-600/90 dark:text-orange-400">If you have not given HSC exam yet, please fill 5.00</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 py-2">
                <Checkbox
                  id="isSecondTimer"
                  checked={isSecondTimer}
                  onCheckedChange={(checked) => setIsSecondTimer(checked as boolean)}
                />
                <Label htmlFor="isSecondTimer" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I am a Second Timer Student
                </Label>
              </div>

              <div className="flex items-start space-x-2 py-2">
                <Checkbox
                  id="acknowledgement"
                  required
                />
                <Label htmlFor="acknowledgement" className="text-sm font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  আমি স্বীকার করছি যে উপরে দেওয়া সকল তথ্য সঠিক। ভুয়া বা ভুল নম্বর ও তথ্য দিলে জরিমানা বা একাউন্ট বাতিল হতে পারে। (I acknowledge that providing fake information may result in fine or account suspension.)
                </Label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      className="login-caret h-11 rounded-xl border-input pr-10 text-[15px] tracking-wide shadow-sm transition-all focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">Toggle password visibility</span>
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      className="login-caret h-11 rounded-xl border-input pr-10 text-[15px] tracking-wide shadow-sm transition-all focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">Toggle password visibility</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50/60 to-white shadow-[0_8px_25px_rgba(245,158,11,0.1)] dark:border-amber-500/20 dark:from-amber-950/30 dark:via-amber-900/10 dark:to-transparent">
                <div className="flex items-start gap-3 p-4">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_6px_16px_rgba(245,158,11,0.3)]">
                    <AlertTriangle className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div className="space-y-1 text-[13px] text-amber-900 dark:text-amber-200">
                    <p className="mb-1 text-sm font-black tracking-tight">সতর্কবার্তা!</p>
                    <p className="leading-relaxed text-amber-800/90 dark:text-amber-200/80">আপনার ফোন নম্বর এবং পাসওয়ার্ড মনে রাখুন এবং কোথাও লিখে রাখুন।</p>
                    <p className="font-bold text-red-600 dark:text-red-400">অবশ্যই নিজের সচল ইমেইল দিবেন।</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center py-2">
                <Turnstile
                  siteKey="1x00000000000000000000AA"
                  onSuccess={(token) => setCaptchaToken(token)}
                />
              </div>

              <div className="flex items-start space-x-2 py-2 mt-2 mb-1">
                <Checkbox
                  id="termsConfirm"
                  required
                />
                <Label htmlFor="termsConfirm" className="text-sm font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I confirm the information I provided is accurate. (আমি নিশ্চিত করছি যে প্রদত্ত তথ্য সঠিক।)
                </Label>
              </div>

              <Button
                type="submit"
                className="mt-4 h-12 w-full rounded-xl bg-primary text-primary-foreground text-[15px] font-bold shadow-sm transition-transform hover:scale-[1.01]"
                disabled={loading || !captchaToken}
              >
                {loading ? "Creating Account..." : "Register"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      <PostSignupChoiceDialog
        open={showPostSignupChoice}
        onDashboard={() => navigate(postSignupTarget || "/dashboard", { replace: true })}
        onHomepage={() => navigate("/", { replace: true })}
      />
    </div>
  );
};

export default Register;
