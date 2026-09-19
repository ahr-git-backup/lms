import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

// `beforeinstallprompt` fires at most once per page load, and only while
// *some* listener is attached at that moment. This component is mounted
// in multiple places (landing header, dashboard header, mobile sheet
// menus) as independent instances — if the event fires while only one
// instance existed (e.g. on the landing page) and the user then
// navigates to a page where a *different* instance mounts, that new
// instance would otherwise never see the event and would incorrectly
// think the browser doesn't support installing. Capturing the event in
// a module-level variable (outside React state) means every instance,
// mounted at any time, can reuse the same captured prompt.
let sharedDeferredPrompt: any = null;
let sharedListenerAttached = false;
const promptListeners = new Set<(e: any) => void>();

const ensureGlobalListener = () => {
  if (sharedListenerAttached) return;
  sharedListenerAttached = true;
  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault();
    sharedDeferredPrompt = e;
    promptListeners.forEach((cb) => cb(e));
  });
  window.addEventListener("appinstalled", () => {
    sharedDeferredPrompt = null;
  });
};

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(sharedDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showManualInstructions, setShowManualInstructions] = useState(false);

  useEffect(() => {
    ensureGlobalListener();

    const onPrompt = (e: any) => setDeferredPrompt(e);
    promptListeners.add(onPrompt);

    // In case the event already fired before this instance mounted.
    if (sharedDeferredPrompt) setDeferredPrompt(sharedDeferredPrompt);

    // Check if already installed/running as a standalone PWA. Different
    // platforms/browsers report this under slightly different display
    // modes, so check all of them rather than just "standalone".
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.matchMedia("(display-mode: window-controls-overlay)").matches ||
      (window.navigator as any).standalone === true || // iOS Safari
      document.referrer.startsWith("android-app://"); // Android TWA
    setIsInstalled(standalone);

    const appInstalledHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", appInstalledHandler);

    return () => {
      promptListeners.delete(onPrompt);
      window.removeEventListener("appinstalled", appInstalledHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    // Re-check display mode live at click time too, as an extra safety
    // net in case the mount-time check ran before the browser fully
    // reported the PWA's display mode.
    const currentlyStandalone =
      isInstalled ||
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.matchMedia("(display-mode: window-controls-overlay)").matches ||
      (window.navigator as any).standalone === true;

    if (currentlyStandalone) {
      if (!isInstalled) setIsInstalled(true);
      toast.info("App is already installed!");
      return;
    }

    if (!deferredPrompt) {
      setShowManualInstructions(true);
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      toast.success("Thank you for installing the app!");
      sharedDeferredPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    } else {
      toast.info("Installation cancelled");
    }
  };

  return (
    <>
      <Button
          onClick={handleInstallClick}
          variant="outline"
          size="sm"
          className={`border-primary text-primary hover:bg-primary hover:text-white transition-all font-bold shrink-0 whitespace-nowrap text-[11px] sm:text-sm h-8 sm:h-9 px-2 sm:px-3 ${!isInstalled ? "animate-pulse" : ""}`}
      >
        Install App
      </Button>

      <Dialog open={showManualInstructions} onOpenChange={setShowManualInstructions}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>অ্যাপ ইনস্টল করুন</DialogTitle>
            <DialogDescription>
              আপনার ব্রাউজার থেকে সরাসরি ইনস্টল করা যাচ্ছে না। নিচের ধাপ অনুসরণ করুন:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3 items-start rounded-lg border bg-muted/40 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <p>ব্রাউজারের উপরে ডানদিকে <strong>মেনু (⋮)</strong> বাটনে ট্যাপ করুন।</p>
            </div>
            <div className="flex gap-3 items-start rounded-lg border bg-muted/40 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              <p><strong>"Add to Home Screen"</strong> বা <strong>"Install App"</strong> অপশনটি খুঁজে বের করুন।</p>
            </div>
            <div className="flex gap-3 items-start rounded-lg border bg-muted/40 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              <p>নিশ্চিত করতে <strong>"Add"</strong> বা <strong>"Install"</strong>-এ ট্যাপ করুন — অ্যাপটি হোম স্ক্রিনে যুক্ত হয়ে যাবে।</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallPWA;
