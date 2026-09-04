import { Outlet, useLocation } from "react-router-dom";
import Footer from "@/components/Footer";

const PublicLayout = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === "/";

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1">
        <Outlet />
      </div>
      {isLandingPage && <Footer />}
    </div>
  );
};

export default PublicLayout;
