import React, { useState, useRef, useEffect } from 'react';
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
  Lock,
  TrendingUp,
  Archive,
  Target,
  Shield
} from 'lucide-react';
import Footer from '../components/Footer';

const Support = () => {
  const { user } = useAuth(); // Get user from AuthContext
  const [openFaq, setOpenFaq] = useState(null);
  const [selectedRole, setSelectedRole] = useState('all'); // 'all', 'teacher', 'student', 'admin'
  // NEW: smart FAQ search
  const [smartQuery, setSmartQuery] = useState('');
  const [showSmartDropdown, setShowSmartDropdown] = useState(false); // NEW
  const searchRef = useRef(null);              // NEW
  const selectingRef = useRef(false);          // NEW

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
            "• Adjust student stats",
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
      category: "Stats & Core Mechanics",
      icon: <TrendingUp size={20} />,
      questions: [
        {
          question: "What are stats and why do they matter?",
          answer: [
            "Stats are classroom-specific power modifiers that influence rewards, earnings, and interactions. They create a strategic layer over simple participation.",
            "Core stats: Multiplier, Luck, Discount, Shield, Attack Bonus, Group Multiplier.",
            "",
            "**How they interact:**",
            "• Bits Earned Formula (conceptual): Base Award × Personal Multiplier × Group Multiplier (if teacher/admin enables both).",
            "• Luck increases chances for better outcome tiers (e.g. Mystery Box higher rarity).",
            "• Discount reduces Bazaar purchase cost (percentage).",
            "• Shield protects from certain attack / negative item effects (consumed when triggered).",
            "• Attack Bonus represents offensive item count/effects (e.g. stat swaps, drains, debuffs).",
            "• Group Multiplier adds additional earning scaling based on group size (applied only if teacher keeps group multiplier enabled)."
          ],
          role: ["all"]
        },

        // ADD: rationale for attack items in the economy
        {
          question: "Why would a student benefit from using Attack items (debuffs) on other students?",
          answer: [
            "Attack items add **strategy and counter-play** to the classroom economy — they’re not just “mean,” they’re a way to compete in a progression loop.",
            "",
            "**In a cyclical economy, power compounds:**",
            "• Earning Bits lets you buy more items.",
            "• Items can increase stats like Multiplier/Luck/Shield/Discount.",
            "• Higher stats can help you earn Bits faster (when enabled), which helps you stay ahead.",
            "",
            "**So attacks can be useful because they can:**",
            "• Slow down a top earner (reduce their ability to snowball).",
            "• Create an opening to catch up before the next rewards cycle.",
            "• Force defensive choices (e.g., investing in Shields) instead of only pure growth.",
            "",
            "**Important:** Teachers control whether these items exist, and shields/limits are designed to keep it fair."
          ],
          role: ["all"]
        },

        {
          question: "How can stats be amplified?",
          answer: [
            "• Completing challenges (if configured and award stat boosts).",
            "• Purchasing Bazaar items that grant boosts (Multiplier, Luck, Shields, Discounts).",
            "• Teacher manual adjustments (People page).",
            "• Joining groups that have member size-based group multipliers (if configured).",
            "• Using utility/passive items with embedded stat effects.",
            "• Gaining positive outcomes from attacks (e.g. swaps)."
          ],
          role: ["all"]
        },
        {
          question: "Do stats persist across classrooms?",
          answer: [
            "• No. Stats are scoped per classroom. You can have different values in different classrooms depending on teacher configuration.",
            "• Inventory items and earned boosts do not cross over."
          ],
          role: ["all"]
        },
        {
          question: "Are negative effects permanent?",
          answer: [
            "• Most attack effects are one-time (e.g. drains, swaps, nullifiers, stat debuffs).",
            "• Shields mitigate or absorb a single incoming attack then decrement/de-activate.",
            "• Teachers can rebalance by adjusting stats manually (through People page if needed)."
          ],
          role: ["all"]
        },
        {
          question: "Why didn’t my multiplier apply on a transaction?",
          answer: [
            "• Teachers/Admins can toggle multiplier and/or group multiplier application when awarding bits manually.",
            "• Deductions never apply multipliers to avoid excessive penalties.",
            "• Check the transaction detail line to see which multipliers were applied."
          ],
          role: ["student"]
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
            "• Manually assigning bits to students through the Wallet/Group **Adjust** feature within a classroom",
            "• Teachers may also enable bit awards on challenges/feedback (if configured)"
          ],
          role: ["teacher", "admin"]
        },
        {
          question: "How do I approve/reject Admin/TA bit adjustment requests?",
          answer: [
            "As a teacher, you can approve or reject Admin/TA bit adjustment requests as follows:",
            "• Navigate to the People page within a classroom, then selecting Settings → Admin/TA Requests tab (visible only if **Approval Required** is enabled for Admin/TA bit adjustments)",
            "• From the list of pending requests, click 'Approve' or 'Reject' next to each request",
          ],
          role: ["teacher"]
        },
        {
          question: "Can I transfer bits to others?",
          answer: [
            "If enabled by your teacher within a classroom, yes!",
            "**To send bits:**",
            "• Go to your Wallet",
            "• Click the 'Transfer' feature",
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
            "• **Effect items**: Power‑ups (attacks (e.g. drains, swappers, nullifiers, stat debuffs), shields, stat boosts) that change outcomes and are typically consumed when used."
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
            "• **Luck boosts** - Improve chances in features like \"Mystery Box\"",
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
          question: "When does it make sense to buy/use an Attack item?",
          answer: [
            "Attack items are usually a **timing + strategy** purchase (not a default choice). They can make sense when:",
            "• You’re trying to prevent a competitor from building an unstoppable lead.",
            "• You expect a high-value reward window soon and want to reduce someone’s advantage before it hits.",
            "• You’re playing risk/reward: spending Bits now to potentially gain more earning power later.",
            "",
            "If your classroom has Shields or defensive options, consider those too — the Bazaar is designed to support both offense and defense."
          ],
          role: ["student"]
        },
        {
          question: "Can I return items I've purchased?",
          answer: [
            "Item returns depend on your teacher's policies",
            "• Check with your teacher about return policies",
            "• Some items may be non-refundable"
          ],
          role: ["student"]
        },
        {
          question: "How are items purchased from the Bazaar redeemed/activated?",
          answer: [
            "• Items that grant active effects (Attack, Defend, Utility, Discount, etc.) must be redeemed from the Inventory section of the Bazaar.",
            "• Open the Bazaar page, click Show Inventory, find the purchased item and equip/use it to activate its effect.",
            "• Note that passive items without specified effects, such as extra credit items, should be presented to the teacher or relevant party for redemption."
          ],
          role: ["student"]
        }
      ]
    },

    // ADD: Mystery Box FAQ category
    {
      category: "Mystery Box",
      icon: <ShoppingCart size={20} />,
      questions: [
        {
          question: "What is a Mystery Box?",
          answer: [
            "• A special bazaar item that, when opened, awards one item from a configured drop pool.",
            "• Teachers define a pool of existing (non‑mystery) items plus each item's base drop chance (must sum to 100%).",
            "• Each student open consumes one use; some boxes can allow multiple opens via a max opens setting."
          ],
          role: ["all"]
        },
        {
          question: "How does luck affect Mystery Box drops?",
          answer: [
            "• The personal luck stat increases odds of higher‑rarity items.",
            "• Formula: bonus = (luck − 1) × luckMultiplier (baseline luck = 1.0 → no bonus).",
            "• Pre-Configured but customizable rarity weights by tier (portion of the luck bonus each tier receives): Common=20%, Uncommon=40%, Rare=60%, Epic=80%, Legendary=100%.",
            "• After adjustment all chances are normalized back to 100% to keep probabilities valid."
          ],
          role: ["all"]
        },
        {
          question: "What is the Mystery Box pity system?",
          answer: [
            "• If enabled, after a configured number of consecutive opens below a minimum rarity, the next open is guaranteed to be at least that minimum (e.g. Rare+).",
            "• Tracks recent opens of the same box and triggers once the threshold is reached.",
            "• Helps prevent extended streaks of low‑rarity rewards."
          ],
          role: ["all"]
        },
        {
          question: "Can Mystery Boxes limit how many times a student opens them?",
          answer: [
            "• Yes. A box can set 'Max Opens Per Student'.",
            "• Once that limit is reached, that template box cannot be opened again.",
            "• Owned (purchased) mystery boxes with usesRemaining = 0 are filtered out of inventory."
          ],
          role: ["all"]
        },
        {
          question: "How are Mystery Boxes created?",
          answer: [
            "• Teacher selects 'MysteryBox' category when creating an item in the Bazaar.",
            "• Configurable fields: luckMultiplier, pity toggle & thresholds, minimum pity rarity, max opens/student, item pool with per‑item baseDropChance.",
            "• System validates: no duplicate items, sum of baseDropChance = 100%, no nested mystery boxes."
          ],
          role: ["teacher"]
        },
        {
          question: "What happens when I open a Mystery Box?",
          answer: [
            "• The system calculates luck bonus then adjusts each item's chance by its rarity weight.",
            "• Performs a weighted random roll (or pity selection if triggered).",
            "• Clones the won item into your inventory as an owned item.",
            "• Logs a transaction (and order record) showing what you won; may award XP if classroom settings enable mystery box XP."
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
            "• Frozen member cannot spend bits during review period, including wallet transfers and bazaar purchases",
            "• Teacher reviews and approves/denies the siphon request",
            "• If approved, bits are redistributed to cooperative members",
            "",
            "**Important limits:**",
            "• Only one siphon request per 72 hours (or as configured by teacher in people settings) per group",
            "• If within the specified cooldown setting the majority of the group had not voted, nor the teacher has acted on a siphon request following a majority vote, the siphoned member's account in that classroom will be automatically unfrozen after the timeout period",
            "• This limit prevents abuse of the system and encourages genuine collaboration"
          ],
          role: ["all"]
        },
        {
          question: "What if a user's account in a classroom remains frozen after the siphon timeout?",
          answer: [
            "This may happen due to the TTL index removing expired siphon data before the janitor can run, so the record is gone and thus the system cannot unfreeze the member automatically in such a scenario.",
            "**Workaround:** A group member can submit another siphon against the frozen user and then vote NO (majority). This forces the system to unfreeze the account."
          ],
          role: ["all"]
        }
      ]
    },
    {
      category: "Challenges (Legacy & Custom)",
      icon: <Target size={20} />,
      questions: [
        {
          question: "What’s the difference between Legacy, Custom Only, and Mixed challenge series?",
          answer: [
            "**Legacy Only:** uses the built-in challenges.",
            "**Custom Only:** uses teacher-created custom challenges.",
            "**Mixed:** combines legacy + custom challenges in one series.",
            "",
            "Teachers choose the series type during Challenge configuration."
          ],
          role: ["teacher"]
        },
        // NEW: explicit rewards FAQ
        {
          question: "What rewards can be earned from challenges?",
          answer: [
            "Challenges can award **Bits** and/or **stat boosts** depending on teacher configuration.",
            "Rewards may include:",
            "• Bits (₿)",
            "• Multiplier increase",
            "• Luck boost",
            "• Discount %",
            "• Shield activation",
            "",
            "**XP** may also be earned from challenge outcomes (based on classroom XP settings)."
          ],
          role: ["all"]
        },
        {
          question: "Where do I find Challenges as a student?",
          answer: [
            "Go to your classroom → Challenges page.",
            "If the classroom includes challenges, you’ll see a **Challenges** section.",
            "Some challenges may be hidden until your teacher makes them visible."
          ],
          role: ["student"]
        },
        {
          question: "Why does it say I must start the challenge before submitting an answer?",
          answer: [
            "Some challenges generate **personalized content** when you click **Start**.",
            "Starting the challenge creates your unique prompt/resources, so submissions can be verified correctly."
          ],
          role: ["student"]
        },
        {
          question: "How do challenges work (e.g. Passcode, Cipher Decoder, Hash Cracker, Hidden Message, Pattern Finder)?",
          answer: [
            "Challenges can generate unique instructions/resources for each student. For instance, a file may need to be downloaded and examined to find the solution.",
            "If the challenge provides an **answer format**, follow it exactly.",
            "",
            "If rewards are configured, you’ll see them in the challenge card and on completion (e.g., Bits + stat boosts)."
          ],
          role: ["all"]
        },
        {
          question: "Can teachers reset a student's challenge progress?",
          answer: [
            "Yes. Teachers can reset progress for:",
            "• A specific challenge, or",
            "• All challenges in the series for a student.",
            "",
            "This is useful if a student is stuck, used too many attempts, or needs a fresh start."
          ],
          role: ["all"]
        },
        {
          question: "Do challenges have due dates and attempt limits?",
          answer: [
            "Legacy challenges may have pre-configured attempt limits, while custom challenges are more flexible and can include:",
            "• A due date (if enabled by the teacher)",
            "• A maximum number of attempts",
            "• Hints (optionally enabled) with a per-hint penalty (if configured)",
            "",
            "**Note:** Hint usage can reduce Bits rewards if the teacher enabled hint penalties."
          ],
          role: ["all"]
        }
      ]
    },
    {
      category: "XP & Leveling",
      icon: <TrendingUp size={20} />,
      questions: [
        {
          question: "How does XP and leveling work?",
          answer: [
            "• XP tracks progress in each classroom and increases levels over time.",
            "• Each classroom can use different leveling formulas (Linear/Exponential/Logarithmic).",
            "• Levels unlock badges if required level thresholds are attained (as configured)."
          ],
          role: ["all"]
        },
        {
          question: "Which actions give XP?",
          answer: [
            "Teachers configure XP awards per classroom. Common sources include:",
            "• Bits Earned (i.e. credits like Teacher or Admin/TA balance adjustments, challenge and/or feedback bit awards)",
            "• Bits Spent* (i.e. bazaar purchases)",
            "• Stat boosts (e.g., bazaar item stat power-ups, challenge stat rewards)",
            "• Challenges completed (if configured)",
            "• Daily check‑ins",
            "• Mystery box usage",
            "• Joining a group (one‑time per GroupSet)",
            "• Feedback submission (regardless whether or not bit award is enabled for feedback)",
            "",
            "**Tip:** To see the exact XP values and applicability for a classroom, view the Stats and click the small info (i) icon next to the Level — the popover shows the configured settings and notes.",
            "",
            "***About Bits Spent XP:**",
            "• Spending XP is only awarded on intentional purchases (i.e. bazaar item purchases).",
            "• It is NOT awarded for negative adjustments like siphons/attacks or teacher/admin debits."
          ],
          role: ["all"]
        },
        {
          question: "How do bits convert to XP?",
          answer: [
            "Teachers set XP per bit for both earning and spending.",
            "• Bits Earned → XP (e.g., 1 XP per bit)",
            "• Bits Spent → XP (e.g., 0.5 XP per bit) — purchases",
            "",
            "Teachers also choose how to count bits for XP:",
            "• Final (after multipliers) — current default",
            "• Base (before multipliers) — ignores personal/group multipliers when converting bits to XP"
          ],
          role: ["all"]
        },
        {
          question: "How do I change XP settings for my classroom?",
          answer: [
            "Go to People → XP & Leveling Settings.",
            "You can configure:",
            "• Enable/disable XP system",
            "• XP per bit earned/spent",
            "• Challenge/daily check‑in/mystery box/group join/feedback submission XP",
            "• Leveling formula and base XP for Level 2 and beyond (since the base is level 1)",
            "• Bits→XP basis (with or without multipliers)"
          ],
          role: ["teacher"]
        },
        // NEW: leaderboard impact
        {
          question: "How does leveling impact the Leaderboard?",
          answer: [
            "• Leaderboard ordering (see classroom Leaderboard page) ranks students by Level first, then XP as a tiebreaker.",
            "• Consistent XP sources (bits earned, stat boosts, daily check‑ins, etc.) accelerate level gains and badge unlocks (if configured).",
            "• **Strategy:** focus on reliable XP actions to level sooner; spending bits wisely can add XP (if Bits Spent XP enabled).",
            "• High level + high XP within that level maximizes visibility and motivation."
          ],
          role: ["all"]
        },
        {
          question: "Why didn’t I get XP for losing bits or being siphoned?",
          answer: [
            "• To prevent system abuse/spam and keep XP fair, negative transactions do not grant spending XP.",
            "• Only intentional spending (bazaar item purchases for example) grants Bits spent XP."
          ],
          role: ["student"]
        }
      ]
    },
    {
      category: "Badges & Achievements",
      icon: <Trophy size={20} />,
      questions: [
        {
          question: "How do I view my badges?",
          answer: [
            "To view your badge collection:",
            "• Navigate to any classroom you're enrolled in",
            "• Click on the 'Badges' menu in the navigation bar",
            "• You'll see:",
            "  - Stats showing badges earned and completion percentage",
            "  - Earned badges section with colorful, animated badges",
            "  - Locked badges section showing what you still need to unlock",
            "• Locked badges show:",
            "  - The level requirement to unlock",
            "  - How many more levels you need",
            "",
            "Badges are earned automatically when you reach the required level in that classroom."
          ],
          role: ["student"]
        },
        {
          question: "How do I create and manage badges for my classroom?",
          answer: [
            "As a teacher, you can create and manage custom badges:",
            "",
            "**To create badges:**",
            "• Go to the Badges page (from the navigation menu)",
            "• Click 'Create Badge' and fill in:",
            "  - Badge name and description",
            "  - Level requirement (when students unlock it)",
            "  - Icon/emoji representation",
            "  - Optional: Upload a custom image",
            "",
            "**Badge Management Dashboard:**",
            "The Badges page provides a comprehensive dashboard showing:",
            "• All created badges with edit/delete options",
            "• Student progress table showing:",
            "  - Each student's current level and XP",
            "  - Number of badges earned",
            "  - Next badge they'll unlock",
            "  - XP/levels needed for next badge",
            "",
            "**Filtering & Sorting:**",
            "• Search students by name or email",
            "• Filter by level or badge status",
            "• Sort by name, level, XP, or badges earned",
            "",
            "**Export Data:**",
            "• Export student badge progress to CSV or JSON",
            "• Great for tracking class achievement over time",
            "",
            "Students automatically earn badges when they reach the required level!"
          ],
          role: ["teacher"]
        },
        {
          question: "Can I see which students are close to earning badges?",
          answer: [
            "Yes! Teachers have full visibility into student badge progress:",
            "",
            "On the Badges page, you can:",
            "• See exactly how much XP each student needs for their next badge",
            "• View how many levels students need to reach the next badge",
            "• Filter to see only students without any badges",
            "• Sort by badges earned to identify students who may need encouragement",
            "• Export this data for planning purposes",
            "",
            "This helps you identify students who are close to milestones and provide targeted motivation!"
          ],
          role: ["teacher"]
        }
      ]
    },

    // NEW: Classroom Feedback FAQ (inserted before Bans & Classroom Access)
    {
      category: "Classroom Feedback",
      icon: <MessageCircle size={20} />,
      questions: [
        {
          question: "What is Classroom Feedback?",
          answer: [
            "A classroom‑scoped rating/comment students can submit (1–5 stars plus optional comment) to help teachers improve the learning experience.",
            "Each submission is stored as a feedback document (see Feedback list) and can be moderated by the teacher/admin."
          ],
          role: ["all"]
        },
        {
          question: "How do I submit feedback?",
          answer: [
            "• Open the classroom and go to the Feedback page.",
            "• Select a star rating, enter a comment, optionally toggle Anonymous, then submit.",
            "• After submitting you can view recent feedback entries."
          ],
          role: ["student"]
        },
        {
          question: "Can I submit anonymously?",
          answer: [
            "• Yes if you toggle Anonymous before submitting.",
            "• Teachers may optionally allow anonymous submissions to receive the reward (configurable).",
            "• Anonymous still enforces cooldown and duplicate prevention."
          ],
          role: ["all"]
        },
        {
          question: "How does the feedback reward work?",
          answer: [
            "• Teacher can enable a bit reward (and whether group/personal multipliers apply).",
            "• Student is awarded only once per classroom (duplicates blocked).",
            "• Anonymous reward only granted if teacher enabled 'allow anonymous'.",
            "• Reward uses classroom balance logic; XP may convert from bits if classroom XP settings apply."
          ],
          role: ["all"]
        },
        {
          question: "Why didn’t I receive the reward?",
          answer: [
            "Common reasons:",
            "• Reward disabled in this classroom.",
            "• You already received the one‑time reward.",
            "• Anonymous not allowed for reward.",
            "• Submission failed validation (e.g. missing rating)."
          ],
          role: ["student"]
        },
        {
          question: "What is the submission cooldown?",
          answer: [
            "A per‑user (or anonymous IP) cooldown defined by FEEDBACK_COOLDOWN_DAYS (default 90; fallback 7).",
            "Cooldown is scoped: site feedback separate from each classroom."
          ],
          role: ["all"]
        },
        {
          question: "How do teachers moderate feedback?",
          answer: [
            "• Review reports submitted by users (creates moderation log records).",
            "• Hide/Unhide entries (remain stored but hidden from student view).",
            "• Export feedback + moderation logs to CSV/JSON for records."
          ],
          role: ["teacher","admin"]
        },
        {
          question: "Can feedback be exported?",
          answer: [
            "• Yes: teacher/admin can export classroom feedback to CSV or JSON including rating counts and classroom meta.",
            "• Useful for longitudinal analysis or administrator reviews."
          ],
          role: ["teacher","admin"]
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
    },
    {
      category: "Classrooms: Archiving & Visibility",
      icon: <Archive size={20} />, // ensure Archive is imported from lucide-react if not already
      questions: [
        {
          question: "What happens when a teacher archives a classroom?",
          answer: [
            "• Archiving is a way to mark a classroom as inactive.",
            "• Students may still see the classroom in 'My Classrooms' but it will be labeled as Archived.",
            "• If you think a class disappeared, it may have been archived by the teacher or deleted."
          ],
          role: ["all"]
        },
        {
          question: "How do I restore an archived classroom?",
          answer: [
            "• Teachers: go to Classroom Dashboard → Archived → Restore (or Classroom Settings → Unarchive).",
            "• Restoring makes it active again."
          ],
          role: ["teacher"]
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
          question: "I applied a template, but I don’t see the new items/badges. What should I do?",
          answer: [
            "Sometimes the page may not immediately re-sync after applying a template (Bazaar items or Badge templates). Try:",
            "1. Close and re-open the Templates modal (if it’s still open).",
            "2. Wait a few seconds—changes may load shortly after the success message.",
            "3. Refresh the page (Ctrl+R / Cmd+R). This forces a full reload and usually shows the newly applied items/badges.",
            "",
            "If it still doesn’t appear after refreshing, the template may have skipped duplicates (same-name items/badges), or the apply action may have partially completed. Try applying again or contact support."
          ],
          role: ["teacher"]
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

  // NEW: similarity helpers
  const levenshtein = (a, b) => {
    if (!a || !b) return 0;
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  };

  const normalize = s =>
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9×\s]/g, ' ') // allow × so formula stays searchable
      .replace(/\s+/g, ' ')
      .trim();

  const tokenize = s => normalize(s).split(' ').filter(Boolean);

  const computeFAQSuggestions = (query, data) => {
    const q = normalize(query);
    if (!q) return [];
    const qTokens = tokenize(q);
    const results = [];

    data.forEach((cat, cIdx) => {
      cat.questions.forEach((qItem, qIdx) => {
        const questionText = qItem.question;
        const answerText = Array.isArray(qItem.answer) ? qItem.answer.join(' ') : qItem.answer;
        const hay = normalize(`${questionText} ${answerText}`);
        const hayTokens = tokenize(hay);

        // Token overlap
        const overlap = qTokens.filter(t => hayTokens.includes(t)).length;
        const jaccard = overlap === 0
          ? 0
          : overlap / new Set([...qTokens, ...hayTokens]).size;

        // Substring / phrase presence
        const phraseHit = hay.includes(q) ? 1 : 0;

        // Levenshtein distance (shortest distance to any hay token)
        let minDist = Infinity;
        qTokens.forEach(t => {
          hayTokens.forEach(ht => {
            const d = levenshtein(t, ht);
            if (d < minDist) minDist = d;
          });
        });
        if (!Number.isFinite(minDist)) minDist = q.length;

        // Score composition
        // Weight overlap + phrase; penalize distance lightly
        const score =
          (overlap * 1.2) +
          (jaccard * 2.0) +
          (phraseHit * 3.5) -
          (minDist * 0.15);

        results.push({
          score,
          question: questionText,
          preview: questionText,
          globalIndex: cIdx * 100 + qIdx,
        });
      });
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  };

  const suggestions = computeFAQSuggestions(smartQuery, filteredFaqs);

  const openSuggested = (globalIndex) => {
    setOpenFaq(globalIndex);
    setShowSmartDropdown(false); // hide after selection
    const targetId = `faq-item-${globalIndex}`;
    // defer until DOM updates (state applied)
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          const y = el.getBoundingClientRect().top + window.scrollY - 100; // adjust offset for fixed nav
          window.scrollTo({ top: y, behavior: 'smooth' });
          // temporary highlight
          el.classList.add('ring','ring-primary','ring-offset-2','ring-offset-base-200');
          setTimeout(() => {
            el.classList.remove('ring','ring-primary','ring-offset-2','ring-offset-base-200');
          }, 1500);
        }
      }, 60);
    });
  };

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
        <div className="text-center mb-8"> {/* reduced bottom margin since search follows */}
          <h1 className="text-4xl font-bold text-base-content mb-4">Help & Support</h1>
          <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
            Find answers to common questions, learn about PrizeVersity features, or get in touch with our support team.
          </p>
        </div>

        {/* Smart FAQ Search (moved to top) */}
        <div ref={searchRef} className="mb-12 relative">
          <input
            type="search"
            className="input input-bordered w-full"
            placeholder="Search FAQs (e.g. 'leveling', 'join classroom', 'badges')"
            value={smartQuery}
            onChange={(e) => {
              setSmartQuery(e.target.value);
              setShowSmartDropdown(e.target.value.trim().length > 0);
            }}
            onFocus={() => {
              if (smartQuery.trim()) setShowSmartDropdown(true);
            }}
            onBlur={() => {
              // delay so click on suggestion registers
              setTimeout(() => {
                if (!selectingRef.current) setShowSmartDropdown(false);
                selectingRef.current = false;
              }, 80);
            }}
          />
          {smartQuery && showSmartDropdown && suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 mt-2 z-20 card bg-base-100 shadow-lg border border-base-300"
              onMouseDown={() => { selectingRef.current = true; }} // prevent immediate close
            >
              <div className="p-2 max-h-72 overflow-auto">
                {suggestions.map(s => (
                  <button
                    key={s.globalIndex}
                    type="button"
                    onClick={() => openSuggested(s.globalIndex)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-base-200 transition text-sm"
                  >
                    {s.preview}
                  </button>
                ))}
              </div>
            </div>
          )}
          {smartQuery && showSmartDropdown && suggestions.length === 0 && (
            <div
              className="absolute left-0 right-0 mt-2 z-20 card bg-base-100 shadow-lg border border-base-300"
              onMouseDown={() => { selectingRef.current = true; }}
            >
              <div className="p-3 text-sm text-base-content/70">
                No close matches found. Try different wording.
              </div>
            </div>
          )}
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

        {/* Role Filter */} {/* REMOVED: moving below FAQ header */}
        {/* <div className="card bg-base-100 shadow-lg mb-8">
          <div className="card-body">
            <h2 className="card-title mb-4">Filter by Role</h2>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSelectedRole('all')} className={`btn ${selectedRole === 'all' ? 'btn-primary' : 'btn-outline'}`}>
                <HelpCircle size={16} /> All Questions
              </button>
              <button onClick={() => setSelectedRole('teacher')} className={`btn ${selectedRole === 'teacher' ? 'btn-primary' : 'btn-outline'}`}>
                <GraduationCap size={16} /> Teacher
              </button>
              <button onClick={() => setSelectedRole('admin')} className={`btn ${selectedRole === 'admin' ? 'btn-primary' : 'btn-outline'}`}>
                <Briefcase size={16} /> Admin/TA
              </button>
              <button onClick={() => setSelectedRole('student')} className={`btn ${selectedRole === 'student' ? 'btn-primary' : 'btn-outline'}`}>
                <UserCheck size={16} /> Student
              </button>
            </div>
          </div>
        </div> */}

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

          {/* Role Filter (moved here) */}
          <div className="card bg-base-100 shadow-lg mb-8">
            <div className="card-body">
              <h2 className="card-title mb-4">Filter by Role</h2>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedRole('all')}
                  className={`btn ${selectedRole === 'all' ? 'btn-primary' : 'btn-outline'}`}
                >
                  <HelpCircle size={16} /> All Questions
                </button>
                <button
                  onClick={() => setSelectedRole('teacher')}
                  className={`btn ${selectedRole === 'teacher' ? 'btn-primary' : 'btn-outline'}`}
                >
                  <GraduationCap size={16} /> Teacher
                </button>
                <button
                  onClick={() => setSelectedRole('admin')}
                  className={`btn ${selectedRole === 'admin' ? 'btn-primary' : 'btn-outline'}`}
                >
                  <Briefcase size={16} /> Admin/TA
                </button>
                <button
                  onClick={() => setSelectedRole('student')}
                  className={`btn ${selectedRole === 'student' ? 'btn-primary' : 'btn-outline'}`}
                >
                  <UserCheck size={16} /> Student
                </button>
              </div>
            </div>
          </div>

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
                      <div
                        key={faqIndex}
                        id={`faq-item-${globalIndex}`}
                        className="border border-base-300 rounded-lg scroll-mt-24"
                      >
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