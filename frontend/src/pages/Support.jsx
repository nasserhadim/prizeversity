import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import useAuth
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
  UserCheck,
  Lock
} from 'lucide-react';
import Footer from '../components/Footer';

const Support = () => {
  const { user } = useAuth(); // Get user from AuthContext
  const [openFaq, setOpenFaq] = useState(null);
  const [selectedRole, setSelectedRole] = useState('all'); // 'all', 'teacher', 'student', 'admin'

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
          role: ["teacher"]
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
          role: ["student"]
        },
        {
          question: "What's the difference between Teacher, Student, and Admin/TA roles?",
          answer: [
            "**Teachers can:**",
            "• Create and manage classrooms",
            "• Create and manage Group Sets/Groups such as setting group multipliers or approving/rejecting/suspending students",
            "• Create bazaar and custom reward items",
            "• Configure challenges and activities like announcements",
            "• Assign bits to students",
            "• Promote students to Admin/TA status",
            "and more!",
            "",
            "**TAs (Assistant Admins) can:**",
            "• Help manage classroom activities such as assigning bits within classrooms (if allowed by the teacher)",
            "• Assist with group management",
            "",
            "**Students can:**",
            "• Earn bits through participation and challenges",
            "• Spend bits on bazaar items",
            "• Collaborate in groups",
            "and more!",
          ],
          role: ["all"]
        }
      ]
    },
    {
      category: "Bits & Wallet",
      icon: <Wallet size={20} />,
      questions: [
        {
          question: "What are Bits and how are they earned?",
          answer: [
            "Bits are PrizeVersity's virtual currency",
            "**Students earn bits through:**",
            "• Classroom participation and activities",
            "• Completing assignments",
            "• Participating in challenges (if configured)",
            "• Manual awards from teachers or Admins/TAs (if allowed by teacher)",
            "",
            "Check the wallet to see:",
            "• Current balance",
            "• Transaction history"
          ],
          role: ["all"]
        },
        {
          question: "How do I award bits to students?",
          answer: [
            "As a teacher or Admin/TA (if approved by teacher), you can award bits by:",
            "• Manually assigning bits to students through the Wallet feature within a classroom",
            "• Transferring bits to students at the group level",
            "• Teachers may also enable bit awards on challenges (if configured)"
          ],
          role: ["teacher", "admin"]
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
          role: ["student"]
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
          role: ["student"]
        },
        {
          question: "Why do transaction multipliers show 1.00x despite a student's multipliers being higher?",
          answer: [
            "• If a transaction shows something like (Base: 5₿, Personal: 1.00x, Group: 1.00x, Total: 1.00x) it usually means the instructor chose to bypass personal and/or group multipliers for that specific adjustment so the system records them as 1.00x and the math matches the flat amount shown.",
            "• Teachers (and admins/TAs) can enable or disable applying group and personal multipliers when assigning or adjusting balances.",
            "• Note that multipliers always apply to positive transactions (awards) but are ignored for negative transactions (deductions) to avoid penalizing students too harshly."
          ],
          role: ["all"]
        }
      ]
    },
    {
      category: "Bazaar & Shopping",
      icon: <Briefcase size={20} />,
      questions: [
        {
          question: "What are the different types of Bazaar items?",
          answer: [
            "• **Passive items**: Rewards (extra credit, passes, etc.) that can be redeemed using Bits. Passive items can also be configured by the teacher to include secondary effects.",
            "• **Effect items**: Power‑ups (attacks, swappers, nullifiers, shields, stat boosts) that change outcomes and are typically consumed when used."
          ],
          role: ["all"]
        },
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
          role: ["teacher"]
        },
        {
          question: "How does the Bazaar work for students?",
          answer: [
            "The Bazaar is a classroom's virtual shop where you can:",
            "• Browse items created by your teacher",
            "• Spend bits on rewards and power-ups",
            "• Purchase items with special effects like:",
            "  - Luck boosts",
            "  - Group collaboration multipliers",
            "  - Fun rewards (extra credit, etc.)",
            "• View your inventory of purchased items"
          ],
          role: ["student"]
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
          role: ["all"]
        },
        {
          question: "Can I return items I've purchased?",
          answer: [
            "Item returns depend on your teacher's policies",
            "• Check with your teacher about return policies",
            "• Some items may be non-refundable"
          ],
          role: ["student"]
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
            "• Adjust bits at the group level for bulk awards"
          ],
          role: ["teacher"]
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
          role: ["student"]
        },
        {
          question: "Can I be in multiple groups?",
          answer: [
            "Yes! You can participate in multiple collaborations (as long as it's a different GroupSet):",
            "• Each group set represents a different activity/project",
            "• Join different groups within various group sets"
          ],
          role: ["student"]
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
            "• Only one siphon request per 72 hours (or as configured by teacher in people settings) per group",
            "• Prevents abuse of the system",
            "• Encourages genuine collaboration"
          ],
          role: ["all"]
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
          role: ["all"]
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
          role: ["all"]
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
          role: ["all"]
        },
        {
          question: "How do I switch between light and dark mode?",
          answer: [
            "You can change themes in multiple ways:",
            "• Click the theme toggle icon in the navigation menu",
            "• Alternatively, go to \"Settings\" from your profile menu and click 'Toggle Theme' to switch between light and dark modes",
            "",
            "Your theme preference is saved automatically!"
          ],
          role: ["all"]
        }
      ]
    },
    {
      category: "Bans & Classroom Access",
      icon: <Lock size={20} />,
      questions: [
        {
          question: "What does banning a student do?",
          answer: [
            "• Banning prevents a student from accessing the classroom and from receiving any balance adjustments for that classroom (credits/assignments/transfers).",
            "• Banned students are blocked at the server level so they cannot bypass the ban by re-entering the classroom code.",
            "• The system will also prevent any balance changes targeted at a banned student for the affected classroom."
          ],
          role: ["teacher","admin","student"]
        },
        {
          question: "When should I Ban vs Remove a student?",
          answer: [
            "• **Remove**: takes a student out of the classroom but does not prevent them from rejoining via the classroom code.",
            "• **Ban**: keeps the student listed as barred from the classroom so they cannot rejoin even if they have the classroom code.",
            "• **Important**: If you both ban AND remove a student, the student entry may be permanently removed from the classroom roster and the teacher will lose the ability to unban—so only Remove if you are sure you never want them to reappear in the classroom list.",
            "• **Recommendation**: Prefer Ban (without removing) when you want to temporarily or permanently block access while preserving the ability to unban later. Only Remove when you are certain you want the student gone from the roster entirely."
          ],
          role: ["teacher"]
        },
        {
          question: "Can a teacher unban a student?",
          answer: [
            "• Yes — teachers can unban students and restore their ability to access the classroom and receive balance adjustments, provided the student record still exists in the classroom data (i.e. student was NOT removed).",
            "• If the student was removed and the teacher expects to unban later, then unfortunately it wont be possible to unban the student as their record was permanently deleted from the classroom roster upon removal.",
          ],
          role: ["teacher"]
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
      selectedRole === 'all' || q.role.includes(selectedRole) || q.role.includes('all')
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
        const parts = line.slice(2).split('**');
        return (
          <div key={index} className="ml-4 mb-1">
            •{' '}
            {parts.map((part, i) =>
              i % 2 === 1 ? (
                <strong key={i}>{part}</strong>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
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
      
      // Handle general in-line bolding
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <div key={index} className="mb-1">
            {parts.map((part, i) =>
              i % 2 === 1 ? (
                <strong key={i}>{part}</strong>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
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
              <h3 className="card-title justify-center mb-2">Site Feedback</h3>
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

        {/* Quick Links - Conditionally render if user is logged in */}
        {user && (
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
        )}

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
                onClick={() => setSelectedRole('admin')}
                className={`btn ${selectedRole === 'admin' ? 'btn-primary' : 'btn-outline'}`}
              >
                <Briefcase size={16} />
                Admin/TA
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
                            {!faq.role.includes('all') && faq.role.map(role => (
                              <span key={role} className={`badge badge-sm ${
                                role === 'teacher' ? 'badge-primary' :
                                role === 'admin' ? 'badge-info' :
                                'badge-secondary'
                              }`}>
                                {role === 'admin' ? 'Admin/TA' : role}
                              </span>
                            ))}
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
        <Footer />
      </div>
    </div>
  );
};

export default Support;