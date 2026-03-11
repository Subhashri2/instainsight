# SUPPLEMENTARY ALGORITHM REFERENCE

This document provides the precise algorithmic formulas, scoring constants, and example output format
to be used alongside `analysis_instruction.md`.

---

## VIRAL SCORE FORMULA

```
viral_score = (
  save_rate    × 0.35 +
  share_rate   × 0.30 +
  comment_rate × 0.20 +
  like_rate    × 0.15
) × 100
```

Where each rate is calculated as:

```
save_rate    = saves    / max(views, 1)
share_rate   = shares   / max(views, 1)
comment_rate = comments / max(views, 1)
like_rate    = likes    / max(views, 1)
```

### Viral Score Interpretation

| Score Range | Label               | Recommended Action                          |
|-------------|---------------------|---------------------------------------------|
| 80–100      | 🔥 Viral            | Repurpose, create a sequel, boost this post |
| 60–79       | ✅ High Potential    | Analyze what worked, replicate the format   |
| 40–59       | ⚡ Average           | Target the weakest metric for improvement   |
| 20–39       | ⚠️ Below Average    | Revise hook, hashtags, or posting time      |
| 0–19        | ❌ Poor             | Do not repeat this format                   |

---

## GROWTH SCORE FORMULA

The account-level **Growth Score** (0–100) represents overall account health:

```
growth_score = (
  avg_viral_score × 0.50 +
  content_consistency_score × 0.20 +
  reel_dominance_score × 0.15 +
  posting_timing_score × 0.15
)
```

Where:
- `avg_viral_score` = mean viral_score across all posts (already 0–100)
- `content_consistency_score` = 100 if posting frequency ≥ 3/week, else scaled down proportionally
- `reel_dominance_score` = (count of reels scoring above median / total reels) × 100
- `posting_timing_score` = (posts in optimal time window / total posts) × 100

---

## REEL IDEA GENERATION DIRECTIVE

Base all reel suggestions on the **viral_pattern** detected from the top-performing posts.

Each reel idea must maximize **at least one** of the following primary metrics:

| Priority | Metric      | Why It Matters                               |
|----------|-------------|----------------------------------------------|
| 1st      | Saves       | Strongest signal to the Instagram algorithm  |
| 2nd      | Shares      | Drives organic reach exponentially           |
| 3rd      | Watch Time  | Determines distribution in the Explore feed  |
| 4th      | Comments    | Boosts post lifespan through re-engagement   |

**Structure template for high-performing reels:**

```
[0–2 sec]  HOOK     — Disrupt, shock, or promise something specific
[2–5 sec]  BUILD    — Deliver the first value beat or setup
[5–X sec]  PAYOFF   — Main content that earns the save or share
[Last 2s]  CTA      — One clear next action (save, share, comment)
```

---

## EXAMPLE OUTPUT

Below is a representative example of the expected output format.  
Your actual output must be populated entirely from analyzed data — never copy these example values.

```json
{
  "dashboard": {
    "growth_score": 74,
    "engagement_rate_avg": "5.8%",
    "best_performing_post": {
      "post_id": "reel_20240312",
      "score": 91.4,
      "type": "reel"
    },
    "worst_performing_post": {
      "post_id": "image_20240301",
      "score": 3.1,
      "type": "post"
    },
    "viral_potential_score": 61
  },
  "account_summary": {
    "total_posts_analyzed": 24,
    "reel_count": 17,
    "image_post_count": 7,
    "avg_likes": 4821,
    "avg_comments": 143,
    "avg_views": 89200,
    "avg_saves": 312,
    "avg_shares": 88,
    "top_performing_hour": "7 PM",
    "top_performing_day": "Thursday"
  },
  "advanced_analysis": {
    "viral_pattern": {
      "best_duration_range": "7–12 seconds",
      "best_posting_time": "Thursday–Friday, 6:30–8:30 PM",
      "top_hashtags": ["#growthhack", "#instagramtips", "#reelsviral"],
      "best_content_type": "Reel",
      "caption_pattern": "Opens with bold declarative statement, uses max 3 emojis, ends with a question"
    },
    "post_classifications": [
      { "post_id": "reel_20240312", "tier": "viral",   "score": 91.4 },
      { "post_id": "image_20240301", "tier": "poor",   "score": 3.1,  "diagnosis": "Posted at 2 AM on Monday with no hashtags and a low-resolution cover image." }
    ],
    "audience_behavior": {
      "peak_window": "6:00–9:00 PM weekdays",
      "content_preference": "Short-form reels (under 15 seconds)",
      "interaction_style": "Save-heavy — high saves, moderate comments",
      "duration_sweet_spot": "8–11 seconds"
    },
    "growth_opportunities": [
      "4 of your 6 image posts scored below the 30th percentile. Consider converting top-performing image concepts into reels.",
      "Your viral posts average 4.1 hashtags. Posts with 10+ hashtags average 2.3× fewer saves — reduce hashtag volume.",
      "Your best reel (91.4 score) was posted at 7 PM Thursday. Only 3 of 17 reels were posted in this window — shift scheduling."
    ]
  },
  "reel_suggestions": [
    {
      "title": "The 1 mistake killing your Instagram reach",
      "hook": "Text overlay: 'Everyone does this wrong' — cuts to creator pointing at camera",
      "structure": "Hook (0–2s) → Problem reveal (2–6s) → Fix with visual proof (6–11s) → CTA (11–13s)",
      "duration": "13 seconds",
      "hashtags": ["#instagramgrowth", "#reeltips", "#socialmediamarketing", "#contentcreator", "#growthhack"],
      "cta": "Save this so you don't forget",
      "engagement_target": "saves",
      "why_it_works": "Your viral posts use a problem–solution structure in under 15 seconds. This format matches the 8–11 second sweet spot with a save-trigger CTA."
    }
  ]
}
```

---

## QUALITY CHECKLIST

Before finalizing output, verify the following:

- [ ] Every `growth_opportunity` references a specific post or metric from the data
- [ ] Every reel suggestion references the detected `viral_pattern`
- [ ] `growth_score` is computed using the formula above, not estimated
- [ ] `viral_score` is computed per-post and an account average is derived
- [ ] No field contains placeholder text or generic advice
- [ ] Output is valid JSON with no trailing commas or syntax errors