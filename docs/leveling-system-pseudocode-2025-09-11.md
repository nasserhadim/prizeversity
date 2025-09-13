# Leveling System Pseudocode – 2025-09-11

## XP Sources
XP_VALUES = {
    login_daily: 5,           // once every 24h
    join_group: 10,           // only once per group
    challenge_complete: 50,   // validated server-side
    quiz_complete: 20         // future expansion
}

## Hybrid XP Curve
- Early levels: fast progress to encourage engagement.
- Later levels: gradually steeper to keep players invested.

function nextLevelXP(level):
    if level <= 5:
        return 30 + 10*(level-1)   // 30, 40, 50, ...
    else:
        return 20 + (level * 15)   // ramps up more steeply

function totalXPForLevel(targetLevel):
    total = 0
    for i in 1..(targetLevel-1):
        total += nextLevelXP(i)
    return total

## Awarding XP
function awardXP(user, type, meta):
    if type == "login" and within24h(user.lastLoginXPAt):
        return "Cooldown"
    if type == "join_group" and alreadyJoined(user, meta.groupId):
        return "No XP"
    if type == "challenge_complete" and not validateChallenge(meta.challengeId):
        return "Invalid"

    xpToAdd = XP_VALUES[type]
    user.xp += xpToAdd
    logXPEvent(user, type, xpToAdd, meta)
    maybeLevelUp(user)

## Leveling Up
function maybeLevelUp(user):
    while user.xp >= totalXPForLevel(user.level+1):
        user.level += 1
        grantMilestoneRewards(user)

## Rewards
- Tokens at milestone levels (5, 10, 20).  
- Badges for achievements (first challenge, 7-day streak).  
- Cosmetic unlocks (titles/colored names) at higher levels.

function grantMilestoneRewards(user):
    if user.level == 5: giveToken(user, 1)
    if user.level == 10: giveToken(user, 2)
    if user.level == 20: giveBadge(user, "Veteran")

## Daily Streaks
- Track consecutive daily logins or actions.  
- At 7 days: unlock "Consistency" badge.  
- Reset streak if user misses a day.