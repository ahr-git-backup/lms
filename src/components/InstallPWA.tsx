import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed/running as a standalone PWA
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true; // iOS Safari
    setIsInstalled(standalone);

    const appInstalledHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", appInstalledHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", appInstalledHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isInstalled) {
      toast.info("App is already installed!");
      return;
    }

    if (!deferredPrompt) {
      toast.info(
        "To install: use your browser's menu and choose \"Add to Home Screen\" or \"Install App\"."
      );
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      toast.success("Thank you for installing the app!");
      setDeferredPrompt(null);
      setIsInstalled(true);
    } else {
      toast.info("Installation cancelled");
    }
  };

  return (
    <Button
        onClick={handleInstallClick}
        variant="outline"
        size="sm"
        className={`border-primary text-primary hover:bg-primary hover:text-white transition-all font-bold shrink-0 ${!isInstalled ? "animate-pulse" : ""}`}
    >
      {isInstalled ? "Installed" : "Install App"}
    </Button>
  );
};

export default InstallPWA;
