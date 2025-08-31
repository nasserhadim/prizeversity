import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Eye, 
  Database, 
  Lock, 
  Users, 
  Mail, 
  Cookie,
  FileText,
  Calendar,
  UserX,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const Privacy = () => {
  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (index) => {
    setOpenSection(openSection === index ? null : index);
  };

  const sections = [
    {
      title: "Information We Collect",
      icon: <Database size={20} />,
      content: [
        "**Personal Information:**",
        "• Name (first and last name)",
        "• Email address",
        "• Profile pictures/avatars you upload",
        "• Educational role (teacher, student, TA)",
        "",
        "**Account Information:**",
        "• Login credentials and authentication data",
        "• OAuth information from Google/Microsoft (if you sign in via these services)",
        "• Account preferences and settings",
        "",
        "**Educational Data:**",
        "• Classroom participation and activity",
        "• Bits (virtual currency) transactions and balances",
        "• Group memberships and collaborations",
        "• Bazaar purchases and inventory",
        "",
        "**Technical Information:**",
        "• Device and browser information",
        "• IP addresses and general location data",
        "• Usage patterns and feature interactions",
        "• Error logs and performance data"
      ]
    },
    {
      title: "How We Use Your Information",
      icon: <Eye size={20} />,
      content: [
        "**To Provide Educational Services:**",
        "• Create and manage your classroom experience",
        "• Enable collaboration between students and teachers",
        "• Track educational progress and achievements",
        "• Process virtual currency (bits) transactions",
        "",
        "**To Improve Our Platform:**",
        "• Analyze usage patterns to enhance features",
        "• Fix technical issues and bugs",
        "• Develop new educational tools and capabilities",
        "",
        "**To Communicate With You:**",
        "• Send important account and security notifications",
        "• Provide customer support when requested",
        "• Share updates about new features",
        "",
        "**Legal Compliance:**",
        "• Comply with applicable educational privacy laws (FERPA, COPPA, etc.)",
        "• Respond to legal requests when required",
        "• Protect the rights and safety of our users"
      ]
    },
    {
      title: "Information Sharing",
      icon: <Users size={20} />,
      content: [
        "**Within a Classroom:**",
        "• Your name and role are visible to other classroom members",
        "• Teachers can view student progress and participation",
        "",
        "**We Do NOT Share With Third Parties:**",
        "• Your personal information is never sold to advertisers",
        "• Educational data stays within the PrizeVersity platform",
        "• We don't use your data for marketing to external parties",
        "",
        "**Limited Exceptions:**",
        "• Legal compliance when required by law",
        "• Security investigations to protect user safety",
        "• Service providers who help us operate the platform (under strict privacy agreements)",
        "",
        "**OAuth Providers:**",
        "• If you sign in with Google/Microsoft, we only receive basic profile information",
        "• We don't access your email content or other external data",
        "• You can revoke these permissions anytime through your provider's settings"
      ]
    },
    {
      title: "Data Security",
      icon: <Lock size={20} />,
      content: [
        "**Technical Safeguards:**",
        "• All data is encrypted in transit using HTTPS/SSL",
        "• Database access is restricted and monitored",
        "• Regular security audits and updates",
        "",
        "**Access Controls:**",
        "• Teachers can only access their own classroom data",
        "• Students can only view information relevant to their participation",
        "• Administrative access is limited to essential personnel like Admins/TAs",
        "",
        "**Data Backups:**",
        "• Regular encrypted backups ensure data protection",
        "• Backup storage follows the same security standards",
        "• Disaster recovery procedures protect against data loss",
        "",
        "**Incident Response:**",
        "• We monitor for security threats continuously",
        "• Any security incidents are promptly investigated",
        "• Users are notified of any breaches affecting their data"
      ]
    },
    {
      title: "Your Privacy Rights",
      icon: <UserX size={20} />,
      content: [
        "**Access and Control:**",
        "• View and update your profile information anytime",
        "",
        "**Data Portability:**",
        "• Maintain ownership of your created content",
        "",
        "**Account Management:**",
        "• Delete your account and personal data anytime",
        "",
        "**For Students Under 18:**",
        "• Schools and teachers act as privacy custodians",
        "• Additional protections under COPPA and state laws apply"
      ]
    },
    {
      title: "Cookies and Tracking",
      icon: <Cookie size={20} />,
      content: [
        "**Essential Cookies:**",
        "• Authentication tokens to keep you logged in",
        "• Session data for platform functionality",
        "• Security tokens to prevent unauthorized access",
        "",
        "**Preference Cookies:**",
        "• Theme settings (light/dark mode)",
        "• Language and accessibility preferences",
        "• Classroom dashboard customizations",
        "",
        "**Analytics (Minimal):**",
        "• Basic usage statistics to improve the platform",
        "• Error reporting to fix technical issues",
        "• Performance monitoring for better user experience",
        "",
        "**No Advertising Tracking:**",
        "• We don't use cookies for advertising",
      ]
    },
    {
      title: "Educational Privacy Compliance",
      icon: <FileText size={20} />,
      content: [
        "**FERPA Compliance:**",
        "• We are a service provider to educational institutions. As such, we handle educational records in accordance with FERPA.",
        "• Educational institutions and teachers act as the custodians of student data and are responsible for managing access and correction requests from parents.",
        "",
        "**COPPA Compliance:**",
        "• We rely on the educational institution to obtain any necessary parental consent for students under 13 to use our platform for educational purposes.",
        "• Our platform does not knowingly collect personal information from children under 13 without such consent.",
        "• Account creation is handled via third-party OAuth providers (Google, Microsoft), which have their own age restrictions."
      ]
    },
    {
      title: "Data Retention",
      icon: <Calendar size={20} />,
      content: [
        "**Active Accounts:**",
        "• Personal and educational data retained while account is active",
        "• Classroom data maintained for the duration of the course",
        "• Transaction history preserved for educational records",
        "",
        "**Account Deletion:**",
        "• Personal data deleted within 30 days of account closure",
        "• Educational records may be retained longer for institutional needs",
        "• Anonymized data may be kept for platform improvement",
        "",
        "**Inactive Accounts:**",
        "• Accounts inactive for 3+ years may be archived",
        "• Data deletion notices sent before any removal",
        "• Educational institutions can request extended retention",
        "",
        "**Legal Requirements:**",
        "• Some data retained longer when required by law",
        "• Court orders may require specific retention periods",
        "• Financial records (if any) kept per applicable regulations"
      ]
    }
  ];

  const formatContent = (content) => {
    return content.map((line, index) => {
      if (line === '') {
        return <br key={index} />;
      }
      
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <div key={index} className="font-semibold text-base-content mt-4 mb-2">
            {line.slice(2, -2)}
          </div>
        );
      }
      
      if (line.startsWith('• ')) {
        return (
          <div key={index} className="ml-4 mb-1">
            {line}
          </div>
        );
      }
      
      return (
        <div key={index} className="mb-1">
          {line}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-base-200 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-base-content mb-4">Privacy Policy</h1>
          <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
            Your privacy is important to us. This policy explains how we collect, use, and protect your information on PrizeVersity.
          </p>
          <p className="text-sm text-base-content/60 mt-4">
            Last updated: August 2025
          </p>
        </div>

        {/* Quick Summary */}
        <div className="card bg-base-100 shadow-lg mb-8">
          <div className="card-body">
            <h2 className="card-title mb-4">
              <Shield className="text-primary" />
              Privacy at a Glance
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">What We Collect:</h3>
                <ul className="text-sm space-y-1">
                  <li>• Basic profile information</li>
                  <li>• Educational activity data</li>
                  <li>• Technical usage information</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">What We Don't Do:</h3>
                <ul className="text-sm space-y-1">
                  <li>• Sell your data to advertisers</li>
                  <li>• Track you across other websites</li>
                  <li>• Share data without permission</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-6">
          {sections.map((section, index) => (
            <div key={index} className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <button
                  onClick={() => toggleSection(index)}
                  className="w-full text-left flex justify-between items-center p-4 hover:bg-base-200 transition-colors rounded-lg -m-4 mb-0"
                >
                  <div className="flex items-center gap-3">
                    {section.icon}
                    <h2 className="text-xl font-bold text-base-content">{section.title}</h2>
                  </div>
                  {openSection === index ? (
                    <ChevronUp size={20} className="text-base-content/70 flex-shrink-0" />
                  ) : (
                    <ChevronDown size={20} className="text-base-content/70 flex-shrink-0" />
                  )}
                </button>
                
                {openSection === index && (
                  <div className="mt-4 pt-4 border-t border-base-300">
                    <div className="text-base-content/80 leading-relaxed">
                      {formatContent(section.content)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Contact Information */}
        <div className="card bg-base-100 shadow-lg mt-12">
          <div className="card-body text-center">
            <h2 className="card-title justify-center mb-4">Questions About Privacy?</h2>
            <p className="text-base-content/70 mb-6">
              If you have questions about this privacy policy or how we handle your data, please contact us.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a 
                href="mailto:info@prizeversity.com"
                className="btn btn-primary"
              >
                <Mail size={16} />
                info@prizeversity.com
              </a>
              <Link to="/support" className="btn btn-outline">
                Visit Support Center
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 py-8 border-t border-base-300">
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-4">
            <Link to="/terms" className="link text-primary">Terms of Service</Link>
            <Link to="/support" className="link text-primary">Help & Support</Link>
            <Link to="/feedback" className="link text-primary">Site Feedback</Link>
          </div>
          <p className="text-base-content/60">
            © 2025 Prizeversity. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;