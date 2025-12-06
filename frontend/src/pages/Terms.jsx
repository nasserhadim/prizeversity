import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Users, 
  Shield, 
  AlertTriangle, 
  Scale, 
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const Terms = () => {
  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (index) => {
    setOpenSection(openSection === index ? null : index);
  };

  const sections = [
    {
      title: "Acceptance of Terms",
      icon: <CheckCircle size={20} />,
      content: [
        "By accessing or using PrizeVersity, you agree to be bound by these Terms of Service and all applicable laws and regulations.",
        "",
        "**Who Can Use PrizeVersity:**",
        "• Educational institutions and their authorized personnel",
        "• Teachers, instructors, and educational administrators",
        "• Students enrolled in participating educational programs",
        "• Teaching assistants and educational support staff",
        "",
        "**Age Requirements:**",
        "• Users under 13 require parental/guardian consent",
        "• Users 13-17 should have parental awareness of their participation",
        "• Schools act as custodians for student accounts",
        "",
        "**Account Responsibility:**",
        "• You are responsible for maintaining account security",
        "• You must provide accurate and current information",
        "• One person per account - sharing accounts is prohibited"
      ]
    },
    {
      title: "Educational Use License",
      icon: <FileText size={20} />,
      content: [
        "**Grant of License:**",
        "PrizeVersity grants you a limited, non-exclusive, non-transferable license to use our platform for educational purposes only.",
        "",
        "**Permitted Uses:**",
        "• Creating and managing educational classrooms",
        "• Facilitating student collaboration and learning",
        "• Tracking educational progress and achievements",
        "• Using virtual currency (bits) for educational gamification",
        "• Uploading educational content and materials",
        "",
        "**Prohibited Uses:**",
        "• Commercial use outside of educational context",
        "• Redistributing or reselling platform access",
        "• Creating multiple accounts for the same person",
        "• Attempting to hack, disrupt, or damage the platform",
        "• Using the platform for non-educational activities",
        "",
        "**Content Ownership:**",
        "• You retain ownership of educational content you create",
        "• PrizeVersity may use anonymized data for platform improvement",
        "• User-generated content must comply with educational standards"
      ]
    },
    {
      title: "User Responsibilities",
      icon: <Users size={20} />,
      content: [
        "**For Teachers and Administrators:**",
        "• Ensure appropriate use of student data",
        "• Maintain classroom standards and behavior expectations",
        "• Verify student eligibility before adding to classrooms",
        "• Report inappropriate behavior or content immediately",
        "• Comply with institutional policies and applicable laws (FERPA, COPPA, etc.)",
        "",
        "**For Students:**",
        "• Use the platform respectfully and responsibly",
        "• Follow classroom rules and teacher instructions",
        "• Respect other students' work and privacy",
        "• Report bullying, harassment, or inappropriate content",
        "• Use virtual currency (bits) and bazaar items appropriately",
        "",
        "**All Users Must:**",
        "• Provide accurate account information",
        "• Keep login credentials secure and confidential",
        "• Respect intellectual property rights",
        "• Follow community guidelines and educational standards",
        "• Notify us of security vulnerabilities or abuse"
      ]
    },
    {
      title: "Virtual Currency and Bazaar",
      icon: <Shield size={20} />,
      content: [
        "**Bits (Virtual Currency):**",
        "• Bits have no real-world monetary value",
        "• Used solely for educational gamification and engagement",
        "• Teachers control bit distribution and classroom economy",
        "",
        "**Bazaar Items:**",
        "• Virtual items created by teachers for educational purposes",
        "• May represent real-world privileges (extra credit, etc.) at teacher discretion",
        "• PrizeVersity is not responsible for redemption of real-world rewards",
        "• Items and effects are limited to the classroom context",
        "",
        "**Transaction Policies:**",
        "• All transactions are final unless reversed by teachers",
        "• Teachers may reset or adjust balances for educational reasons",
        "• Bit values and item effects may change based on classroom needs"
      ]
    },
    {
      title: "Privacy and Data Protection",
      icon: <Scale size={20} />,
      content: [
        "**Educational Privacy:**",
        "• We comply with FERPA and COPPA by acting as a service provider to educational institutions.",
        "• Depending on the age of the student, the school/teacher may be responsible for obtaining parental consent for students to use the platform.",
        "• Parents/guardians should direct any requests for access to or correction of student data to their educational institution.",
        "",
        "**Data Collection:**",
        "• We collect only information necessary for educational services.",
        "• Personal information is protected with industry-standard security",
        "• Usage data helps improve educational outcomes",
        "",
        "**Data Sharing:**",
        "• Student information is never sold to third parties",
        "• Data sharing limited to educational context within classrooms",
        "• Legal compliance may require limited disclosure",
        "• Anonymous, aggregated data may be used for research",
        "",
        "For complete details, see our Privacy Policy."
      ]
    },
    {
      title: "Content Guidelines",
      icon: <AlertTriangle size={20} />,
      content: [
        "**Acceptable Content:**",
        "• Educational materials and resources",
        "• Age-appropriate collaborations",
        "• Academic communications",
        "• Creative educational gamification elements",
        "",
        "**Prohibited Content:**",
        "• Harassment, bullying, or discriminatory language",
        "• Inappropriate, offensive, or adult content",
        "• Copyrighted material without permission",
        "• Personal information of other users",
        "• Commercial advertisements or spam",
        "• Content that violates school policies",
        "",
        "**Content Moderation:**",
        "• Teachers have primary responsibility for classroom content",
        "• PrizeVersity may remove content that violates these terms",
        "• Repeat violations may result in account suspension",
        "• Users can report inappropriate content for review"
      ]
    },
    {
      title: "Account Termination",
      icon: <XCircle size={20} />,
      content: [
        "**User-Initiated Termination:**",
        "• You may delete your account at any time",
        "• Educational data may be retained per institutional requirements",
        "• Some information may remain in anonymized form",
        "",
        "**Platform-Initiated Termination:**",
        "• Accounts may be suspended or terminated for terms violations",
        "• Repeated inappropriate behavior may result in permanent bans",
        "• Students removed from schools lose access to associated classrooms (determined by the teacher of the classroom)",
        "",
        "**Data After Termination:**",
        "• Personal data deleted according to our Privacy Policy",
        "• Educational records may be preserved per FERPA requirements",
        "• Teachers maintain copies of classroom educational content",
        "",
        "**Appeal Process:**",
        "• Users may appeal termination decisions",
        "• Contact support with appeals within 30 days",
        "• Final decisions rest with PrizeVersity administration"
      ]
    },
    {
      title: "Service Availability",
      icon: <Clock size={20} />,
      content: [
        "**Platform Availability:**",
        "• We strive for 99.9% uptime but cannot guarantee uninterrupted service",
        "• Scheduled maintenance will be announced in advance when possible",
        "• Emergency maintenance may occur without notice",
        "",
        "**Educational Continuity:**",
        "• Classroom data is backed up regularly",
        "• Teachers notified of any issues affecting their classrooms",
        "",
        "**Feature Changes:**",
        "• We may modify features to improve educational outcomes",
        "• Major changes will be communicated to users in advance",
        "• Deprecated features will have reasonable transition periods",
        "",
        "**Support Response:**",
        "• Technical support available via email",
        "• Priority given to issues affecting classroom operations"
      ]
    },
    {
      title: "Limitation of Liability",
      icon: <Scale size={20} />,
      content: [
        "**Educational Service:**",
        "• PrizeVersity is provided as an educational tool",
        "• We do not guarantee specific educational outcomes",
        "• Teachers and institutions remain responsible for curriculum and assessment",
        "",
        "**Technical Limitations:**",
        "• We are not liable for data loss due to user error",
        "• Internet connectivity issues are outside our control",
        "• Temporary service interruptions may occur",
        "",
        "**Third-Party Integration:**",
        "• OAuth providers (Google, Microsoft) have their own terms",
        "• We are not responsible for third-party service issues",
        "• External links are provided for convenience only",
        "",
        "**Maximum Liability:**",
        "• Our liability is limited to the amount paid for services (if any)",
        "• We are not liable for indirect or consequential damages",
        "• Some jurisdictions may not allow liability limitations"
      ]
    },
    {
      title: "Updates and Changes",
      icon: <Globe size={20} />,
      content: [
        "**Terms Updates:**",
        "• We may update these terms to reflect platform changes",
        "• Users will be notified of material changes",
        "• Continued use after changes constitutes acceptance",
        "",
        "**Platform Evolution:**",
        "• Features may be added, modified, or removed",
        "• Educational focus will remain our priority",
        "• User feedback helps guide development decisions",
        "",
        "**Legal Compliance:**",
        "• Terms may change to comply with new regulations",
        "• Educational privacy laws take precedence",
        "• International users subject to applicable local laws",
        "",
        "**Communication:**",
        "• Important updates sent via email and platform notifications",
        "• Check terms periodically for changes",
        "• Contact support with questions about updates"
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
          <h1 className="text-4xl font-bold text-base-content mb-4">Terms of Service</h1>
          <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
            These terms govern your use of PrizeVersity's educational platform. Please read them carefully.
          </p>
          <p className="text-sm text-base-content/60 mt-4">
            Last updated: August 2025
          </p>
        </div>

        {/* Quick Summary */}
        <div className="card bg-base-100 shadow-lg mb-8">
          <div className="card-body">
            <h2 className="card-title mb-4">
              <FileText className="text-primary" />
              Terms Summary
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 text-success">You Can:</h3>
                <ul className="text-sm space-y-1">
                  <li>• Use PrizeVersity for educational purposes</li>
                  <li>• Create and manage classrooms</li>
                  <li>• Collaborate with students, teachers, and/or Admins/TAs</li>
                  <li>• Earn and spend virtual currency (bits)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-error">You Cannot:</h3>
                <ul className="text-sm space-y-1">
                  <li>• Use the platform for commercial purposes</li>
                  <li>• Share accounts or violate security</li>
                  <li>• Post inappropriate content</li>
                  <li>• Harass or bully other users</li>
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

        {/* Important Notice */}
        <div className="alert alert-info mt-12">
          <AlertTriangle size={20} />
          <div>
            <h3 className="font-bold">Important Notice</h3>
            <div className="text-sm">
              PrizeVersity is designed for educational use only. Virtual currency (bits) and bazaar items have no real-world monetary value. 
              Educational institutions/teachers are responsible for ensuring appropriate use within their academic programs.
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="card bg-base-100 shadow-lg mt-8">
          <div className="card-body text-center">
            <h2 className="card-title justify-center mb-4">Questions About These Terms?</h2>
            <p className="text-base-content/70 mb-6">
              If you need clarification about these terms or have legal questions, please contact us.
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
            <Link to="/privacy" className="link text-primary">Privacy Policy</Link>
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

export default Terms;