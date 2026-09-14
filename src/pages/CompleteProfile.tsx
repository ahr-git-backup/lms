import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { PhoneCall, MessageCircle, Send, User } from "lucide-react";

// Shown once, right after a Google sign-in creates a bare profiles row (no
// name/phone/college/etc — Google's own metadata doesn't map to our custom
// fields). Collects everything Register.tsx collects EXCEPT password/email,
// since auth is already done via Google, then updates the existing profile row.
const CompleteProfile = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
    // Already complete (e.g. direct nav here by mistake) -- don't make them redo it.
    if (!authLoading && profile && profile.full_name && profile.phone) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, user, profile, navigate]);
  const [isSecondTimer, setIsSecondTimer] = useState(false);
  const [hscBatch, setHscBatch] = useState("2025");
  const [hscGpa, setHscGpa] = useState("");
  const [gender, setGender] = useState("");
  const [duplicatePhone, setDuplicatePhone] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (hscBatch === "2026" || hscBatch === "2027") {
      setHscGpa("5.00");
    }
  }, [hscBatch]);

  useEffect(() => {
    document.title = "Complete Your Profile – Atlas";
  }, []);

  const convertToEnglishDigits = (str: string) => {
    const bengaliToEnglish: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    return str.split('').map(char => bengaliToEnglish[char] || char).join('');
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
    if (!user) return;
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const fullName = formData.get("fullName") as string;
    const fatherName = formData.get("fatherName") as string;
    const motherName = formData.get("motherName") as string;
    const rawPhone = formData.get("phone") as string;
    const phone = convertToEnglishDigits(rawPhone).trim();
    const hscBatchVal = formData.get("hscBatch") as string;
    const collegeName = formData.get("collegeName") as string;
    const sscGpa = formData.get("sscGpa") as string;
    const hscGpaForm = formData.get("hscGpa") as string;

    if (!gender) {
      toast({ title: "Could not save", description: "Please select your gender", variant: "destructive" });
      setLoading(false);
      return;
    }

    if (collegeName.trim().length < 10) {
      toast({ title: "Could not save", description: "Please provide your Full college name", variant: "destructive" });
      setLoading(false);
      return;
    }

    const validPrefixes = ['013', '014', '015', '016', '017', '018', '019'];
    if (phone.length !== 11 || !validPrefixes.some(prefix => phone.startsWith(prefix))) {
      toast({ title: "Could not save", description: "Please enter a valid 11-digit phone number starting with a recognized prefix.", variant: "destructive" });
      setLoading(false);
      return;
    }

    try {
      // Check if this phone belongs to a different, already-complete account.
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .neq("id", user.id)
        .maybeSingle();

      if (existingProfile) {
        setDuplicatePhone(phone);
        setLoading(false);
        return;
      }

      const profileUpdatePayload = {
        registration_id: phone,
        full_name: fullName,
        father_name: fatherName,
        mother_name: motherName,
        phone,
        hsc_batch: hscBatchVal,
        college_name: collegeName,
        ssc_gpa: sscGpa,
        hsc_gpa: hscGpaForm || null,
        gender,
        is_second_timer: isSecondTimer,
      };

      const isAbortError = (e: any) =>
        e?.name === "AbortError" || /aborted/i.test(e?.message || "");

      let updateError: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const { error } = await supabase
          .from("profiles")
          .update(profileUpdatePayload)
          .eq("id", user.id);
        updateError = error;
        if (!error || !isAbortError(error)) break;
        // Transient abort (e.g. app backgrounded mid-request) — retry once.
        await new Promise((r) => setTimeout(r, 500));
      }

      if (updateError) throw updateError;

      if (photoFile) {
        try {
          const ext = photoFile.name.split(".").pop() || "jpg";
          const filePath = `${user.id}/avatar.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(filePath, photoFile, { upsert: true, cacheControl: "3600" });
          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
            await supabase.from("profiles").update({ avatar_url: `${publicUrlData.publicUrl}?t=${Date.now()}` }).eq("id", user.id);
          }
        } catch (photoErr) {
          console.error("Photo upload failed (non-blocking):", photoErr);
        }
      }

      await refreshProfile();
      toast({ title: "Profile complete", description: "Welcome to Atlas!" });
      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      console.error("Complete profile error:", error);
      const isAbort = error?.name === "AbortError" || /aborted/i.test(error?.message || "");
      toast({
        title: "Could not save",
        description: isAbort
          ? "নেটওয়ার্ক সংযোগ বিচ্ছিন্ন হয়ে গেছে। আবার চেষ্টা করুন।"
          : error.message || "An error occurred.",
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
        <Card className="w-full max-w-xl border-[3px] border-foreground">
          <CardHeader className="space-y-2 pb-4">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Atlas</p>
            <CardTitle className="text-xl font-semibold">Complete Your Profile</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              আপনার Google একাউন্ট verify হয়ে গেছে। এক্সাম শুরু করার আগে নিচের তথ্যগুলো দিন।
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  <Input id="fullName" name="fullName" required placeholder="Your full name" defaultValue={user?.user_metadata?.full_name || user?.user_metadata?.name || ""} />
                  <p className="text-[11px] text-orange-600/90 dark:text-orange-400">Please provide your full name.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" name="phone" required placeholder="01XXXXXXXXX" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender <span className="text-red-500">*</span></Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fatherName">Father's Full Name</Label>
                  <Input id="fatherName" name="fatherName" required placeholder="Father's full name" />
                  <p className="text-[11px] text-orange-600/90 dark:text-orange-400">Please provide father's full name.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="motherName">Mother's Full Name</Label>
                  <Input id="motherName" name="motherName" required placeholder="Mother's full name" />
                  <p className="text-[11px] text-orange-600/90 dark:text-orange-400">Please provide mother's full name.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collegeName">Full College Name</Label>
                  <Input id="collegeName" name="collegeName" required placeholder="Your full college name" />
                  <p className="text-[11px] text-orange-600/90 dark:text-orange-400">Please provide your full college name.</p>
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
                  <Input id="sscGpa" name="sscGpa" type="number" step="0.01" max="5.00" min="1.00" required placeholder="5.00" />
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
                <Checkbox id="acknowledgement" required />
                <Label htmlFor="acknowledgement" className="text-sm font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  আমি স্বীকার করছি যে উপরে দেওয়া সকল তথ্য সঠিক। ভুয়া বা ভুল নম্বর ও তথ্য দিলে জরিমানা বা একাউন্ট বাতিল হতে পারে। (I acknowledge that providing fake information may result in fine or account suspension.)
                </Label>
              </div>

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? "Saving..." : "Save & Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CompleteProfile;
