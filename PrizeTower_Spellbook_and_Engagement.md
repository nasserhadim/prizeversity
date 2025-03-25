# 📘 PrizeTower Spellbook & Engagement System

## 🧙‍♂️ Spells Catalog
| Spell | Command / Concept | Effect Description | Cost | Flavor Text |
|-------|--------------------|---------------------|------|--------------|
| **/dev/urandom – Entropy Spell** | `/dev/urandom` | Triggers one random effect: gain most or least expensive Bazaar item, triple Bits, double Qbits, burn 25–50% Bits, reset or double a stat, or nothing happens. | 100 Qbits | _You reached into the void… and something reached back. The system provides... or it takes. Who knows what entropy has in store?_ |
| **/dev/null – Void Spell** | `/dev/null` | One destructive effect: lose all Bits/Qbits, burn 25–50% Bits/Qbits, reset a stat or all stats to 0. 10% chance to backfire. Wasted if target has nothing. | 150 Qbits | _Into the void it goes, never to be seen again. No logs. No traces. Just silence._ |
| **Bitwise Shift** | `x << y` | Doubles Bits earned for one usage. | Variable Qbits | _Your Bits have been shifted into overdrive._ |
| **Rollback** | `git reset --hard HEAD~1` | Deletes 10–25% of a target’s Bits. Applies to individual or guild. Wasted if Bits = 0. | Variable Qbits | _Time bends for those who know where to point HEAD._ |
| **Cloaking** | `chmod 000` | Hides multiplier. Applies to individual or guild. | 75 Qbits | _Access denied. Presence undetected._ |
| **Rebase** | `git rebase` | Transfers 10–25% of Bits from one player/guild to another. Usable by any player. | Variable Qbits | _History rewritten. Alliances… realigned._ |
| **Race Condition** | `volatile int sharedVar;` | Swaps your multiplier with another player or guild. | 150 Qbits | _Two threads. One outcome. Only one gets the win._ |
| **Glitch** | `int n = ++n + ++n;` | Fakes multiplier stats (inflate/lower). Undetectable unless countered by Segmentation Fault. | 75 Qbits | _Undefined behavior. Unexpected results. Pure chaos._ |
| **Segmentation Fault** | `int* p = NULL; *p = 10;` | Cancels Glitch effect if present. Wasted otherwise. | 200 Qbits | _Accessing the void has consequences._ |
| **Heisenbug** | `Quantum Bug` | Hides Bits balance. Applies to individual or guild. | Variable Qbits | _Observed? Unstable. Unobserved? Perfectly fine._ |
| **Buffer Overflow** | `strcpy(arr, "longstring");` | Doubles multiplier with no risk. Applies to individual or guild. | 90 Qbits | _You went beyond bounds... now brace for consequences._ |
| **Deadlock** | `pthread_mutex_lock()` | Prevents target from buying spells. If they try, Qbits are lost. Cannot stack. | 120 Qbits | _Everything is waiting... and nothing moves._ |
| **Recursion Storm** | `:(){ :|:& };:` | Triples multiplier. 35% chance to crash it to 0. Applies to individual or guild. | 50 Qbits | _Overload the system… or crash with it._ |
| **Null Purge** | `Data Purge` | Deletes 10–25% of target's multiplier. Applies to individual or guild. Wasted if multiplier = 0. | 100 Qbits | _Total deletion. No warnings. No recovery._ |
| **Semaphore** | `sem_wait() / sem_post()` | Auto-blocks one destructive spell. | 100 Qbits | _Only one may pass. All others must wait their turn._ |
| **Cast** | `static_cast<Type>()` | Convert between Bits and Qbits (1 Qbit = 10 Bits). Individual use only. | Variable Qbits | _A precise conversion of potential._ |

## 📈 Engagement System

- Accuracy increases through:
  - Daily check-ins
  - Visiting 3+ pages per day
  - Using Bit Fortune

**Bonus Rewards:**
- 3-Day Streak: +5 Bits
- 7-Day Streak: +1 Qbit
- Explorer Bonus: Visit 10+ pages = +0.5 Accuracy

**Note:** No cron jobs required — system uses DB/session timestamps.

## 🏅 Badge Unlock System

### Entropy Explorer
- Unlocks: `/dev/urandom`
- Requirements:
  - Use Bit Fortune 2 times
  - Maintain consistent engagement
- *“You’ve danced with chaos and learned to smile through the entropy.”*

### Root Access
- Unlocks: `/dev/null`
- Requirements:
  - Must have Entropy Explorer
  - Use 15 different spells
- *“You don’t just play the system. You are the system.”*
