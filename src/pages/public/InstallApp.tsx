import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share, PlusSquare, CheckCircle2, Zap, WifiOff, BellRing } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";

type Platform = "android" | "ios" | "desktop" | "installed";

const detectPlatform = (): Platform => {
  if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
    return "installed";
  }
  const ua = window.navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
};

const FEATURES = [
  { icon: Zap, label: "দ্রুত লোডিং" },
  { icon: WifiOff, label: "অফলাইন সাপোর্ট" },
  { icon: BellRing, label: "লাইভ নোটিফিকেশন" },
];

const InstallApp = () => {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    document.title = "অ্যাপ ইনস্টল করুন – Atlas";
    setPlatform(detectPlatform());

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Only the appinstalled event confirms the app was actually added —
    // the prompt's "accepted" outcome fires as soon as the user taps the
    // popup button, before installation actually completes.
    const installedHandler = () => {
      setInstalled(true);
      setInstalling(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalling(true);
    }
    setDeferredPrompt(null);
  };

  const alreadyInstalled = platform === "installed" || installed;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <div className="relative overflow-hidden border-b bg-gradient-to-b from-emerald-50/80 to-transparent dark:from-emerald-950/20">
        <div className="absolute inset-0 -z-10 opacity-[0.03] bg-[radial-gradient(circle_at_1px_1px,_currentColor_1px,_transparent_1px)] bg-[length:24px_24px]" />
        <main className="container mx-auto px-4 pt-12 pb-8 max-w-lg text-center relative">
          <div className="relative mx-auto mb-6 h-24 w-24">
            <div className="absolute inset-0 rounded-[28px] bg-emerald-600/10 blur-xl" />
            <div className="relative h-24 w-24 rounded-[28px] bg-white dark:bg-neutral-900 shadow-[0_8px_30px_rgba(5,150,105,0.15)] border border-emerald-600/10 flex items-center justify-center p-3">
              <img src="/logo.png" alt="Atlas" className="h-full w-full object-contain" />
            </div>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            Atlas অ্যাপ ইনস্টল করুন
          </h1>
          <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">
            হোম স্ক্রিনে যোগ করুন — সরাসরি অ্যাপের মতো ব্যবহার করুন, প্রতিবার ব্রাউজার খোলার ঝামেলা ছাড়াই।
          </p>

          <div className="flex items-center justify-center flex-wrap gap-2 mt-6">
            {FEATURES.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-600/20"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
            ))}
          </div>
        </main>
      </div>

      <main className="container mx-auto px-4 py-10 max-w-lg flex-1 w-full">
        {alreadyInstalled ? (
          <div className="rounded-2xl border border-emerald-600/30 bg-emerald-50/60 dark:bg-emerald-900/20 shadow-sm">
            <div className="flex flex-col items-center gap-3 py-12 text-center px-6">
              <div className="h-14 w-14 rounded-full bg-emerald-600/15 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="font-bold text-lg">অ্যাপ ইতিমধ্যে ইনস্টল করা আছে!</p>
              <p className="text-sm text-muted-foreground">হোম স্ক্রিন থেকে Atlas আইকনে ট্যাপ করে খুলুন।</p>
            </div>
          </div>
        ) : installing ? (
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-col items-center gap-3 py-12 text-center px-6">
              <div className="h-14 w-14 rounded-full bg-emerald-600/15 flex items-center justify-center animate-pulse">
                <Download className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="font-semibold">অ্যাপ ইনস্টল হচ্ছে...</p>
              <p className="text-sm text-muted-foreground">কয়েক সেকেন্ড অপেক্ষা করুন, হোম স্ক্রিনে আইকন যোগ হবে।</p>
            </div>
          </div>
        ) : platform === "android" || (platform === "desktop" && deferredPrompt) ? (
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-2 text-center">
              <p className="text-sm text-muted-foreground">
                নিচের বাটনে ট্যাপ করুন — ব্রাউজার একটি ইনস্টল পপআপ দেখাবে, সেখানে কনফার্ম করলেই অ্যাপ যোগ হয়ে যাবে।
              </p>
            </div>
            <div className="px-6 pb-6 pt-4">
              <Button
                size="lg"
                onClick={handleInstallClick}
                disabled={!deferredPrompt}
                className="w-full h-14 text-lg font-bold gap-2 bg-emerald-700 hover:bg-emerald-800 text-white shadow-[0_4px_14px_rgba(5,150,105,0.35)]"
              >
                <Download className="h-5 w-5" />
                {deferredPrompt ? "অ্যাপ ইনস্টল করুন" : "লোড হচ্ছে..."}
              </Button>
              {!deferredPrompt && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  বাটন কাজ না করলে, ব্রাউজার মেনু (⋮) থেকে "Add to Home screen" / "Install app" সিলেক্ট করুন।
                </p>
              )}
            </div>
          </div>
        ) : platform === "ios" ? (
          <div className="rounded-2xl border bg-card shadow-sm px-6 py-6">
            <p className="text-sm text-muted-foreground text-center mb-6">
              Safari ব্রাউজারে এই পেজ খুলে নিচের ধাপগুলো অনুসরণ করুন
            </p>
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white text-sm font-bold">1</span>
                <p className="text-sm pt-1.5">
                  নিচের <Share className="inline h-4 w-4 mx-1 text-emerald-700" /> Share বাটনে ট্যাপ করুন
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white text-sm font-bold">2</span>
                <p className="text-sm pt-1.5">
                  <PlusSquare className="inline h-4 w-4 mx-1 text-emerald-700" /> "Add to Home Screen" খুঁজে ট্যাপ করুন
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white text-sm font-bold">3</span>
                <p className="text-sm pt-1.5">উপরে ডানদিকে "Add" ট্যাপ করুন — ব্যস, অ্যাপ ইনস্টল হয়ে যাবে</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card shadow-sm px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              আপনার ব্রাউজারের ঠিকানা বারে (address bar) ডানপাশে একটি ইনস্টল আইকন দেখুন, অথবা ব্রাউজার মেনু (⋮) থেকে
              "Install Atlas" সিলেক্ট করুন।
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default InstallApp;
