import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronDown, 
  ChevronUp, 
  Mail, 
  MessageCircle, 
  HelpCircle,
  School,
  Users,
  Briefcase,
  Trophy,
  Wallet,
  Settings,
  User,
  Bell,
  ShoppingCart,
  GraduationCap,
  UserCheck
} from 'lucide-react';

const Support = () => {
  const [openFaq, setOpenFaq] = useState(null);
  const [selectedRole, setSelectedRole] = useState('all'); // 'all', 'teacher', 'student'

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      category: "Getting Started",
      icon: <School size={20} />,
      questions: [
        {
          question: "How do I create my first classroom?",
          answer: [
            "As a teacher, navigate to the Classrooms page",
            "Click 'Create Classroom' button",
            "Enter a classroom name and unique classroom code",
            "Optionally choose a color theme for your classroom or upload a background image",
            "Students can then join using the shared classroom code"
          ],
          role: "teacher"
        },
        {
          question: "How do students join a classroom?",
          answer: [
            "Get the classroom code from your teacher",
            "Go to the Classrooms page",
            "Enter the code in the 'Join Classroom' section",
            "Click join to get immediate access to:",
            "• Groups and collaboration tools",
            "• Bazaar for spending bits",
            "• Wallet for managing currency",
            "• And more classroom features!"
          ],
          role: "student"
        },
        {
          question: "What's the difference between Teacher, Student, and TA roles?",
          answer: [
            "**Teachers can:**",
            "• Create and manage classrooms",
            "• Create and manage Group Sets/Groups such as setting group multipliers or approving/rejecting/suspending students",
            "• Create bazaar and custom reward items",
            "• Configure challenges and activities like announcements",
            "• Assign bits to students",
            "• Promote students to TA status",
            "and more!",
            "",
            "**TAs (Assistant Admins) can:**",
            "• Help manage classroom activities such as assigning bits within classrooms (if allowed by the teacher)",
            "",
            "**Students can:**",
            "• Earn bits through participation and challenges",
            "• Spend bits on bazaar items",
            "• Collaborate in groups",
            "and more!",
          ],
          role: "all"
        }
      ]
    },
    {
      category: "Bits & Wallet",
      icon: <Wallet size={20} />,
      questions: [
        {
          question: "What are Bits and how do I earn them?",
          answer: [
            "Bits are PrizeVersity's virtual currency",
            "**Students earn bits through:**",
            "• Classroom participation and activities",
            "• Completing assignments",
            "• Participating in challenges (if configured)",
            "• Manual awards from teachers/TAs",
            "",
            "Check your wallet to see:",
            "• Current balance",
            "• Transaction history"
          ],
          role: "student"
        },
        {
          question: "How do I award bits to students?",
          answer: [
            "As a teacher, you can award bits by:",
            "• Manually assigning bits to students through the Wallet feature within a classroom",
            "• Enabling bit awards on challenges",
            "• Transferring bits to students at the group level",
            "• Approving TA bit assignments within a classroom/wallet settings"
          ],
          role: "teacher"
        },
        {
          question: "Can I transfer bits to others?",
          answer: [
            "If enabled by your teacher within a classroom, yes!",
            "**To send bits:**",
            "• Go to your Wallet",
            "• Use the 'Send Bits' feature",
            "• Select the recipient",
            "• Enter the amount to transfer",
            "• Confirm the transaction"
          ],
          role: "student"
        },
        {
          question: "What happens if I spend all my bits?",
          answer: [
            "Don't worry! You can always earn more through:",
            "• Continued classroom participation",
            "• Completing new challenges (if configured by the teacher)",
            "• Group activities and projects",
            "• Special bonus activities such as associated club events endorsed by the teacher"
          ],
          role: "student"
        }
      ]
    },
    {
      category: "Bazaar & Shopping",
      icon: <Briefcase size={20} />,
      questions: [
        {
          question: "How do I create items for the Bazaar?",
          answer: [
            "As a teacher, assuming you've already setup a bazaar within a classroom, you can create custom items:",
            "• Navigate to the Bazaar section",
            "• Click 'Create Item'",
            "• Set item name, description, and cost in bits",
            "• Configure special effects (optional):",
            "  - Stat boosts (luck, shields)",
            "  - Group multipliers",
            "  - Special abilities",
            "• Upload item images"
          ],
          role: "teacher"
        },
        {
          question: "How does the Bazaar work for students?",
          answer: [
            "The Bazaar is your classroom's virtual shop where you can:",
            "• Browse items created by your teacher",
            "• Spend bits on rewards and power-ups",
            "• Purchase items with special effects like:",
            "  - Luck boosts",
            "  - Group collaboration multipliers",
            "  - Fun rewards (extra credit, etc.)",
            "• View your inventory of purchased items"
          ],
          role: "student"
        },
        {
          question: "What are item effects and stats?",
          answer: [
            "Items can provide various benefits:",
            "• **Luck boosts** - Improve chances in features like \"Mystery Fortune\"",
            "• **Attack Bonuses** - Manipulate other students'/groups' stats or bits (if enabled on certain bazaar items by the teacher)",
            "• **Shields** - Protection against attacks",
            "• **Group multipliers** - Bonus bits awarded for every additional member in the group (within a GroupSet)",
            "• **Rewards** - Real-world benefits (extra credit, etc.) Present to teacher/relevant party for redemption",
            "",
            "These gamification elements make learning more engaging!"
          ],
          role: "all"
        },
        {
          question: "Can I return items I've purchased?",
          answer: [
            "Item returns depend on your teacher's policies",
            "• Check with your teacher about return policies",
            "• Some items may be non-refundable"
          ],
          role: "student"
        }
      ]
    },
    {
      category: "Groups & Collaboration",
      icon: <Users size={20} />,
      questions: [
        {
          question: "How do I create and manage group sets/groups?",
          answer: [
            "As a teacher, you can organize collaborative learning:",
            "• Create group sets/groups for different projects",
            "• Set group size limits and join/approval requirements",
            "• Review and approve/reject student join requests",
            "• Configure group-specific settings and permissions",
            "• Suspend group members (if necessary)",
            "• Transfer bits at the group level for bulk awards"
          ],
          role: "teacher"
        },
        {
          question: "How do group sets/groups work for students?",
          answer: [
            "Groups enable collaborative learning:",
            "• Browse available groups within group sets",
            "• Request to join groups that interest you",
            "• Wait for teacher approval of your request (if required)",
            "• Collaborate with teammates on projects",
            "• Share in the reward of group stats like multipliers"
          ],
          role: "student"
        },
        {
          question: "Can I be in multiple groups?",
          answer: [
            "Yes! You can participate in multiple collaborations:",
            "• Join different groups within various group sets",
            "• Each group set represents a different activity/project"
          ],
          role: "student"
        },
        {
          question: "What is 'siphoning' in groups?",
          answer: [
            "Siphoning promotes teamwork and accountability:",
            "• Group members can vote to \"freeze\" uncooperative teammates",
            "• Requires majority vote from group members",
            "• Frozen member cannot spend bits during review period",
            "• Teacher reviews and approves/denies the siphon request",
            "• If approved, bits are redistributed to cooperative members",
            "",
            "**Important limits:**",
            "• Only one siphon request per 72 hours",
            "• Prevents abuse of the system",
            "• Encourages genuine collaboration"
          ],
          role: "all"
        }
      ]
    },
    {
      category: "Notifications & Updates",
      icon: <Bell size={20} />,
      questions: [
        {
          question: "How do I manage my notifications?",
          answer: [
            "Currently, you receive important updates through:",
            "• The notification bell icon in the navigation",
            "• Alerts about classroom activities",
            "• Transaction confirmations such as bit assignments",
            "• Group activity updates",
            "",
            "**Coming soon:** Customizable notification preferences!"
          ],
          role: "all"
        }
      ]
    },
    {
      category: "Technical Issues",
      icon: <Settings size={20} />,
      questions: [
        {
          question: "The page isn't loading properly. What should I do?",
          answer: [
            "Try these troubleshooting steps:",
            "1. Refresh the page (Ctrl+R or Cmd+R)",
            "2. Clear browser cache and cookies",
            "3. Ensure you're using a supported browser:",
            "   • Chrome (recommended)",
            "   • Firefox",
            "   • Safari",
            "   • Edge",
            "4. Check your internet connection",
            "5. Try using an incognito/private browsing window"
          ],
          role: "all"
        },
        {
          question: "I can't see my bits/items/groups updating.",
          answer: [
            "PrizeVersity uses real-time updates. If something isn't updating:",
            "• Try refreshing the page first",
            "• Check your internet connection",
            "• Look for any error messages",
            "• If problems persist, there might be a temporary connection issue",
            "• Contact support if the issue continues"
          ],
          role: "all"
        },
        {
          question: "How do I switch between light and dark mode?",
          answer: [
            "You can change themes in multiple ways:",
            "• Click the theme toggle icon in the navigation menu",
            "• Go to \"Settings\" from your profile menu and click 'Toggle Theme' to switch between light and dark modes",
            "",
            "Your theme preference is saved automatically!"
          ],
          role: "all"
        }
      ]
    }
  ];

  const quickLinks = [
    { name: "Profile Settings", path: "/settings", icon: <User size={16} /> },
    { name: "Classrooms", path: "/classrooms", icon: <School size={16} /> },
    { name: "General Feedback", path: "/feedback", icon: <MessageCircle size={16} /> }
  ];

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(q => 
      selectedRole === 'all' || q.role === 'all' || q.role === selectedRole
    )
  })).filter(category => category.questions.length > 0);

  const formatAnswer = (answer) => {
    return answer.map((line, index) => {
      if (line === '') {
        return <br key={index} />;
      }
      
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <div key={index} className="font-semibold text-base-content mt-2 mb-1">
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
      
      if (line.startsWith('  - ') || line.startsWith('   •')) {
        return (
          <div key={index} className="ml-8 mb-1 text-sm">
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
          <h1 className="text-4xl font-bold text-base-content mb-4">Help & Support</h1>
          <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
            Find answers to common questions, learn about PrizeVersity features, or get in touch with our support team.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body text-center">
              <Mail size={40} className="mx-auto text-primary mb-4" />
              <h3 className="card-title justify-center mb-2">Contact Support</h3>
              <p className="text-base-content/70 mb-4">
                Need personalized help? Email our support team.
              </p>
              <a 
                href="mailto:info@prizeversity.com"
                className="btn btn-primary"
              >
                Email Us
              </a>
            </div>
          </div>

          <div className="card bg-base-100 shadow-lg">
            <div className="card-body text-center">
              <MessageCircle size={40} className="mx-auto text-secondary mb-4" />
              <h3 className="card-title justify-center mb-2">Send Feedback</h3>
              <p className="text-base-content/70 mb-4">
                Help us improve PrizeVersity with your suggestions.
              </p>
              <Link to="/feedback" className="btn btn-secondary">
                Give Feedback
              </Link>
            </div>
          </div>

          <div className="card bg-base-100 shadow-lg">
            <div className="card-body text-center">
              <HelpCircle size={40} className="mx-auto text-accent mb-4" />
              <h3 className="card-title justify-center mb-2">Browse FAQs</h3>
              <p className="text-base-content/70 mb-4">
                Find quick answers to common questions below.
              </p>
              <button 
                onClick={() => document.getElementById('faqs').scrollIntoView({ behavior: 'smooth' })}
                className="btn btn-accent"
              >
                View FAQs
              </button>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="card bg-base-100 shadow-lg mb-12">
          <div className="card-body">
            <h2 className="card-title mb-4">Quick Links</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {quickLinks.map((link, index) => (
                <Link 
                  key={index}
                  to={link.path}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-base-200 transition-colors"
                >
                  {link.icon}
                  <span>{link.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Role Filter */}
        <div className="card bg-base-100 shadow-lg mb-8">
          <div className="card-body">
            <h2 className="card-title mb-4">Filter by Role</h2>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedRole('all')}
                className={`btn ${selectedRole === 'all' ? 'btn-primary' : 'btn-outline'}`}
              >
                <HelpCircle size={16} />
                All Questions
              </button>
              <button
                onClick={() => setSelectedRole('teacher')}
                className={`btn ${selectedRole === 'teacher' ? 'btn-primary' : 'btn-outline'}`}
              >
                <GraduationCap size={16} />
                Teacher
              </button>
              <button
                onClick={() => setSelectedRole('student')}
                className={`btn ${selectedRole === 'student' ? 'btn-primary' : 'btn-outline'}`}
              >
                <UserCheck size={16} />
                Student
              </button>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div id="faqs" className="space-y-8">
          <h2 className="text-3xl font-bold text-center text-base-content mb-8">
            Frequently Asked Questions
            {selectedRole !== 'all' && (
              <span className="text-xl font-normal text-base-content/70 block mt-2">
                Showing {selectedRole} questions
              </span>
            )}
          </h2>

          {filteredFaqs.map((category, categoryIndex) => (
            <div key={categoryIndex} className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-6">
                  {category.icon}
                  <h3 className="text-2xl font-bold text-base-content">{category.category}</h3>
                </div>

                <div className="space-y-4">
                  {category.questions.map((faq, faqIndex) => {
                    const globalIndex = categoryIndex * 100 + faqIndex;
                    return (
                      <div key={faqIndex} className="border border-base-300 rounded-lg">
                        <button
                          onClick={() => toggleFaq(globalIndex)}
                          className="w-full p-4 text-left flex justify-between items-center hover:bg-base-200 transition-colors rounded-lg"
                        >
                          <div className="flex items-center gap-3 pr-4">
                            <span className="font-medium text-base-content">
                              {faq.question}
                            </span>
                            {faq.role !== 'all' && (
                              <span className={`badge badge-sm ${
                                faq.role === 'teacher' ? 'badge-primary' : 'badge-secondary'
                              }`}>
                                {faq.role}
                              </span>
                            )}
                          </div>
                          {openFaq === globalIndex ? (
                            <ChevronUp size={20} className="text-base-content/70 flex-shrink-0" />
                          ) : (
                            <ChevronDown size={20} className="text-base-content/70 flex-shrink-0" />
                          )}
                        </button>
                        
                        {openFaq === globalIndex && (
                          <div className="px-4 pb-4">
                            <div className="pt-2 border-t border-base-300">
                              <div className="text-base-content/80 leading-relaxed">
                                {formatAnswer(faq.answer)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact Section */}
        <div className="card bg-base-100 shadow-lg mt-12">
          <div className="card-body text-center">
            <h2 className="card-title justify-center mb-4">Still Need Help?</h2>
            <p className="text-base-content/70 mb-6 max-w-2xl mx-auto">
              Can't find what you're looking for? Our support team is here to help! 
              Send us an email and we'll get back to you as soon as possible.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a 
                href="mailto:info@prizeversity.com"
                className="btn btn-primary btn-lg"
              >
                <Mail size={20} />
                info@prizeversity.com
              </a>
              <div className="text-sm text-base-content/70">
                We will try getting back to you as soon as possible!
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 py-8 border-t border-base-300">
          <p className="text-base-content/60">
            © 2025 Prizeversity. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Support;