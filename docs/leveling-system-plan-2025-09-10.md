Prizeversity Leveling System – Brainstorm Idea 

XP Earning Structure 

Daily Login Bonus: Students receive a small, guaranteed amount of XP (5 XP) just for logging in each day. This encourages consistency and helps build daily habits. Streak multipliers can be added (logging in 7 days straight gives bonus XP). 

Group Participation: Joining a group grants a small one-time XP boost (10 XP). Continued participation depending on the activity can provide small recurring XP rewards. 

Challenges / Assignments: These could serve as large sources of XP (50–100 XP depending on difficulty). Tied directly to coursework, quizzes, or prizeversity challenges to create engagement. 

Bonus Events: Occasional surprise XP opportunities such as attending live sessions, completing all tasks for a week, or participating in group activities. 

Milestones & Tokens/Badges 

Quick disclaimer: when the idea to earn and use badges to purchase exclusive items was brought up, I mainly thought of them as tokens. Then badges could be used as a cosmetic piece on a profile or something. Just an idea. 

Level Rewards: At milestone levels (5, 10, 20), students unlock tokens/badges in addition to XP. These tokens/badges cannot be farmed and are tied directly to meaningful progression. 

Bazaar Shop: Tokens/badges can be exchanged for exclusive rewards. Examples could include limited items, or potentially cosmetic upgrades or unique titles 

Customization Features (If time allows/if wanted by Hadi) 

For RPG games, much of the progression appeal comes from cosmetic or personalization choices. This might not be applicable or needed for this project. Could make this a stretch goal if leftover time. 

Titles & Ranks: Students unlock titles or ranks as they level up or purchase them with tokens. Titles could include academic themes like “Novice Scholar” or “Master of Quizzes.” 

Colored Names / Nameplates: Distinct color tiers or styled nameplates that showcase level progression. 

Profile Flair & Icons: Cosmetic icons (books, stars, shields) that can be attached to profiles for personalization. 

Achievement Badges: Specific badges tied to accomplishments (first group joined, first challenge completed, streak milestones). 

Engagement & Retention Mechanics 

Streak System: Students are rewarded with XP multipliers for consecutive daily logins, reinforcing consistent engagement. 

Activity Variety Bonus: Additional XP for mixing up activity types (logging in, joining groups, and completing challenges). 

Limited Challenges: Time-limited challenges that offer higher XP or unique token/badge rewards to maintain long-term interest. 

Anti-Cheating Measures 

Daily XP Caps: Prevents students from endlessly repeating low-value actions for unlimited XP. 

Quality Checks: Submissions must meet certain standards (minimum length or effort) to count toward XP. 

Randomized Rewards: Slight variation in XP earned for some activities (45–55 XP per challenge) to reduce predictability and exploitation. 

Implementation Notes 

Frontend 

Expand the existing Bazaar Shop to recognize tokens/badges as a new currency type. 

Update dashboards/profile pages to show current XP, level progress bar, streak tracker, and owned tokens/badges. 

Add simple UI elements for milestones (pop-up notification when a student earns a new token/badge). 

(If implemented) Cosmetic rewards (titles, colored names, profile flair) can be displayed in the student’s profile and forum/group posts. 

Backend 

Extend existing endpoints to award XP for actions (login, group join, challenge completion). 

Implement logic to check for level milestones and issue a token when reached. 

Tie into Bazaar routes so token/badge balances can be spent directly on shop items. 

Add moderation/admin controls for Hadi (setting XP values, creating challenges, adding token-only shop items). 

Database 

Update or extend schemas with: 

User collection: XP, current level, streak count, tokens earned, cosmetics equipped. 

Challenge collection: Defines XP payout and completion criteria. 

Shop collection: Mark which items are “token exclusive.” 

Logs collection: Track XP events to help debug abuse or cheating attempts. 

General Flow 

Student logs in → backend checks streak → XP awarded → progress updated in DB. 

Student joins group or completes challenge → backend validates → XP added → if milestone level reached, token granted. 

Student opens Bazaar Shop → sees regular items + token-only items → if enough tokens, can redeem → DB updates balance → frontend applies reward. 

Level Progression Idea 

Flat Model (not good for long-term) 

Every level cost the same XP (100 XP). 

Pros: Simple, easy to track. 

Cons: Students level up too quickly, less meaningful progression. 

Linear Model (good for short-term courses) 

Each level requires slightly more XP than the last (Level N = 100 + 20·N). 

Example: Level 1 = 120 XP, Level 5 = 200 XP, Level 10 = 300 XP. 

Keeps a steady increase without overwhelming students. 

Exponential Model (best for long-term engagement) 

Each level requires significantly more XP (Level N = 100 × 1.2^N). 

Example: Level 1 = 120 XP, Level 5 ≈ 250 XP, Level 10 ≈ 620 XP. 

Early levels feel quick ad rewarding, while higher levels take real effort. 

Hybrid Approach (balanced) 

Levels 1–5 use the Linear model (so students get early wins). 

After Level 5, switch to Exponential growth (so higher levels feel special). 