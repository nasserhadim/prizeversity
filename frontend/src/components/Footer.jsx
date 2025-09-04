import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <div className="text-center mt-12 py-8 border-t border-base-300">
      <div className="flex flex-col sm:flex-row justify-center gap-4 mb-4">
        <Link to="/privacy" className="link text-primary">Privacy Policy</Link>
        <Link to="/terms" className="link text-primary">Terms of Service</Link>
        <Link to="/support" className="link text-primary">Help & Support</Link>
        <Link to="/feedback" className="link text-primary">Site Feedback</Link>
      </div>
      <p className="text-base-content/60">
        © {new Date().getFullYear()} Prizeversity. All rights reserved.
      </p>
    </div>
  );
};

export default Footer;