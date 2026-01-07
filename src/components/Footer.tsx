import { Link } from "react-router-dom";
import { Facebook, Youtube, Mail, Phone, MapPin } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary text-slate-100 border-t border-primary/20">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">

          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-white w-fit px-3 py-2 rounded-md">
               <img src="/logo.png" alt="Atlas Logo" className="h-10 w-auto object-contain" />
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              Empowering students with quality education, live classes, and instant exam results. Join us to unlock your potential.
            </p>
            <div className="flex gap-4">
              <a href="#" className="bg-primary-foreground/10 p-2 rounded-full hover:bg-white hover:text-primary transition-colors">
                <Facebook size={18} />
              </a>
              <a href="#" className="bg-primary-foreground/10 p-2 rounded-full hover:bg-white hover:text-red-600 transition-colors">
                <Youtube size={18} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
              <li><Link to="/courses" className="hover:text-primary transition-colors">All Courses</Link></li>
              <li><Link to="/login" className="hover:text-primary transition-colors">Login</Link></li>
              <li><Link to="/register" className="hover:text-primary transition-colors">Register</Link></li>
            </ul>
          </div>

          {/* Resources (Placeholder) */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-primary transition-colors">Free Exams</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Demo Classes</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Success Stories</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Student Reviews</a></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <Mail size={18} className="text-primary shrink-0 mt-0.5" />
                <a href="mailto:support@atlas.com" className="hover:text-white transition-colors">support@atlas.com</a>
              </li>
              <li className="flex items-start gap-3">
                <Phone size={18} className="text-primary shrink-0 mt-0.5" />
                <a href="tel:+8801234567890" className="hover:text-white transition-colors">+880 1234 567 890</a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={18} className="text-primary shrink-0 mt-0.5" />
                <span>Dhaka, Bangladesh</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
          <p>© {currentYear} Atlas. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
