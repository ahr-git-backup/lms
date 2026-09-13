import { Outlet, useLocation } from "react-router-dom";
import Footer from "@/components/Footer";
import { usePWADisplayMode } from "@/pwa/usePWADisplayMode";
import { cn } from "@/lib/utils";

const PublicLayout = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === "/";
  const isStandalone = usePWADisplayMode();

  return (
    <div className={cn("flex flex-col min-h-screen", isStandalone && "pb-[calc(60px+env(safe-area-inset-bottom))]")}>
      <div className="flex-1">
        <Outlet />
      </div>
      {isLandingPage && !isStandalone && <Footer />}
    </div>
  );
};

export default PublicLayout;
