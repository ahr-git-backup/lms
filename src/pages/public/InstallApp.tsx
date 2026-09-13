import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Share, PlusSquare, CheckCircle2 } from "lucide-react";
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

const InstallApp = () => {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    document.title = "অ্যাপ ইনস্টল করুন – Atlas";
    setPlatform(detectPlatform());

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setInstalled(true);
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
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const alreadyInstalled = platform === "installed" || installed;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />
      <main className="container mx-auto px-4 py-10 max-w-lg flex-1">
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Atlas"
            className="h-20 w-20 mx-auto mb-4 rounded-2xl shadow-md"
          />
          <h1 className="text-2xl font-bold tracking-tight mb-2">Atlas অ্যাপ ইনস্টল করুন</h1>
          <p className="text-muted-foreground">
            হোম স্ক্রিন থেকে সরাসরি অ্যাপের মতো ব্যবহার করুন — দ্রুত লোড, অফলাইন সাপোর্ট।
          </p>
        </div>

        {alreadyInstalled ? (
          <Card className="border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/20">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <p className="font-semibold">অ্যাপ ইতিমধ্যে ইনস্টল করা আছে!</p>
            </CardContent>
          </Card>
        ) : platform === "android" || (platform === "desktop" && deferredPrompt) ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <p className="text-center text-sm text-muted-foreground">
                নিচের বাটনে ট্যাপ করুন, ব্রাউজার একটি ইনস্টল পপআপ দেখাবে।
              </p>
              <Button
                size="lg"
                onClick={handleInstallClick}
                disabled={!deferredPrompt}
                className="w-full h-14 text-lg font-bold gap-2"
              >
                <Download className="h-5 w-5" />
                {deferredPrompt ? "অ্যাপ ইনস্টল করুন" : "লোড হচ্ছে..."}
              </Button>
              {!deferredPrompt && (
                <p className="text-xs text-muted-foreground text-center">
                  যদি বাটন কাজ না করে, ব্রাউজার মেনু (⋮) থেকে "Add to Home screen" / "Install app" সিলেক্ট করুন।
                </p>
              )}
            </CardContent>
          </Card>
        ) : platform === "ios" ? (
          <Card>
            <CardContent className="flex flex-col gap-5 py-8">
              <p className="text-sm text-muted-foreground text-center">
                iPhone/iPad এ Safari ব্রাউজার দিয়ে খুলুন এবং নিচের ধাপগুলো অনুসরণ করুন:
              </p>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                <p className="text-sm pt-0.5">নিচের <Share className="inline h-4 w-4 mx-1" /> Share বাটনে ট্যাপ করুন</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                <p className="text-sm pt-0.5">
                  <PlusSquare className="inline h-4 w-4 mx-1" /> "Add to Home Screen" খুঁজে ট্যাপ করুন
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
                <p className="text-sm pt-0.5">উপরে ডানদিকে "Add" ট্যাপ করুন — ব্যস, অ্যাপ ইনস্টল হয়ে যাবে</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                আপনার ব্রাউজারের ঠিকানা বারে (address bar) ডানপাশে একটি ইনস্টল আইকন দেখুন, অথবা ব্রাউজার মেনু (⋮) থেকে
                "Install Atlas" সিলেক্ট করুন।
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default InstallApp;
