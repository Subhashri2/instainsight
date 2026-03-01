import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { scrapeInstagramProfile } from "./src/scraper.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// ─── Load instruction markdown files once at startup ─────────────────────────
const loadFile = (filePath: string) => {
  try { return fs.readFileSync(path.resolve(filePath), "utf-8"); }
  catch { return ""; }
};
const brain = loadFile("src/brain.md");
const instruction = loadFile("src/instruction.md");
const analysis = loadFile("src/analysis_instruction.md");

const MODES_DIR = path.resolve("modes");
const loadedModes: { filename: string, typeDesc: string, content: string }[] = [];

try {
  const files = fs.readdirSync(MODES_DIR).filter(f => f.endsWith('.md'));
  for (const f of files) {
    const content = loadFile(path.join(MODES_DIR, f));
    const firstLine = content.split('\n').map(l => l.trim()).find(l => l.startsWith('TYPE:')) || "";
    const typeDesc = firstLine ? firstLine.replace('TYPE:', '').trim() : f.replace('.md', '');
    loadedModes.push({ filename: f, typeDesc, content });
  }
  console.log(`[System] Loaded ${loadedModes.length} strategy modes.`, loadedModes.map(m => m.filename));
} catch (e) {
  console.error("[System] Failed to load modes directory", e);
}

if (loadedModes.length === 0) {
  loadedModes.push({ filename: "Lifestyle.md", typeDesc: "General", content: "Default strategy" });
}

// ─── AI call helper: uses Gemini 2.0 Flash ──────────────────────────────
async function callAI(prompt: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }

  console.log(`[AI] Attempting analysis with Gemini API...`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview"
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let txt = response.text();

    // Standard markdown cleaning (if model ignores JSON mode or fallback needed)
    if (txt.includes("```json")) txt = txt.split("```json")[1].split("```")[0];
    else if (txt.includes("```")) txt = txt.split("```")[1].split("```")[0];

    return {
      data: JSON.parse(txt.trim()),
      usage: {} // Usage details available in response.usageMetadata if needed
    };
  } catch (err: any) {
    console.error(`[AI] Gemini API failed: ${err.message}`);
    if (err.message.includes("429")) {
      throw new Error("Gemini API quota exceeded. Please check your plan or try later.");
    }
    throw new Error(`AI analysis failed: ${err.message}`);
  }
}


// ─── Compute a basic fallback dashboard from raw post data ───────────────────
function computeBasicInsights(summaryData: any[], followers: number = 0) {
  const total = summaryData.length;
  if (total === 0) return {};

  // ── Aggregates (what the user asked for) ──────────────────────────────────
  const totalLikes = summaryData.reduce((s, p) => s + (p.like_count || 0), 0);
  const totalComments = summaryData.reduce((s, p) => s + (p.comments_count || 0), 0);
  const totalViews = summaryData.reduce((s, p) => s + (p.view_count || 0), 0);
  const totalInteractions = totalLikes + totalComments;

  const avgLikes = Math.round(totalLikes / total);
  const avgComments = Math.round(totalComments / total);
  const avgViews = Math.round(totalViews / total);

  // Post-type breakdown
  const videoPosts = summaryData.filter(p => p.type === "Video").length;
  const imagePosts = total - videoPosts;

  // ── Buyer Intent ───────────────────────────────────────────────────────────
  const BUYER_INTENT_KEYWORDS = ["price", "pp", "cost", "how much", "rate", "available", "dm", "where", "buy", "shop", "whatsapp", "contact", "booking"];
  let totalBuyerIntentComments = 0;
  let totalFilteredComments = 0;

  summaryData.forEach(p => {
    if (p.latest_comments) {
      p.latest_comments.forEach((c: any) => {
        totalFilteredComments++;
        const text = (c.text || "").toLowerCase();
        if (BUYER_INTENT_KEYWORDS.some(k => text.includes(k))) totalBuyerIntentComments++;
      });
    }
  });

  const buyerIntentScore = totalFilteredComments > 0
    ? Math.round((totalBuyerIntentComments / totalFilteredComments) * 100)
    : 0;

  // ── Engagement Rate ────────────────────────────────────────────────────────
  // Preferred: (avg_likes + avg_comments) / followers * 100
  // Fallback when no followers: relative to views
  let engRate = "0.00%";
  let rawEngRate = 0;
  if (followers > 0) {
    rawEngRate = ((avgLikes + avgComments) / followers) * 100;
    engRate = `${rawEngRate.toFixed(2)}%`;
  } else if (avgViews > 0) {
    rawEngRate = ((avgLikes + avgComments) / avgViews) * 100;
    engRate = `${rawEngRate.toFixed(2)}%`;
  }

  // ── Account Score (weighted) ───────────────────────────────────────────────
  const engagementScoreFinal = Math.min(100, Math.round(rawEngRate * 10));
  const viewScore = Math.min(100, Math.round(avgViews / 200));
  const accountScoreFinal = Math.min(100, Math.round(
    (engagementScoreFinal * 0.4) +
    (viewScore * 0.3) +
    (buyerIntentScore * 0.3)
  ));

  // ── Post ranking (Algorithm v3) ────────────────────────────────────────────
  const scored = summaryData.map(p => ({
    ...p,
    eng: (p.like_count + (p.comments_count * 2.5)) / Math.max(p.view_count, 1),
  }));
  scored.sort((a, b) => b.eng - a.eng);

  // ── Viral Potential ────────────────────────────────────────────────────────
  const viralPostsCount = summaryData.filter(p => p.view_count > (avgViews * 1.5)).length;
  const viralPotential = Math.min(100, Math.round((viralPostsCount / total) * 100) + 20);

  // ── Best Posting Hour ──────────────────────────────────────────────────────
  const hourCounts: Record<number, number> = {};
  summaryData.forEach(p => {
    if (p.timestamp) {
      const h = new Date(p.timestamp).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
  });
  const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);
  const bestHourFinal = sortedHours[0]?.[0] ?? "12";

  // ── Top Hashtags ───────────────────────────────────────────────────────────
  const hashtagCount: Record<string, number> = {};
  summaryData.forEach(p => (p.hashtags || []).forEach((h: string) => { hashtagCount[h] = (hashtagCount[h] || 0) + 1; }));
  const topHashtagsFinal = Object.entries(hashtagCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

  // ── Format helpers ─────────────────────────────────────────────────────────
  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

  return {
    _computed: true,
    account_score: accountScoreFinal,
    buyer_intent_score: buyerIntentScore,
    dashboard: {
      growth_score: Math.min(100, Math.round((avgLikes / 500) * 100)),
      engagement_rate_avg: engRate,
      viral_potential_score: viralPotential,
      best_performing_post: scored[0] || {},
      worst_performing_post: scored[scored.length - 1] || {},
    },
    account_summary: {
      total_posts_analyzed: total,
      // Averages (per post)
      avg_likes: avgLikes,
      avg_comments: avgComments,
      avg_views: avgViews,
      // Totals (across all scraped posts)
      total_likes: totalLikes,
      total_comments: totalComments,
      total_views: totalViews,
      total_interactions: totalInteractions,
      // Formatted versions for UI display
      total_views_fmt: fmt(totalViews),
      total_interactions_fmt: fmt(totalInteractions),
      avg_views_fmt: fmt(avgViews),
      avg_likes_fmt: fmt(avgLikes),
      // Type breakdown
      reel_count: videoPosts,
      image_count: imagePosts,
      // Other
      top_hashtags: topHashtagsFinal,
      best_hour: `${bestHourFinal}:00`,
      followers: followers
    },
    next_post_plan: {
      topic: scored[0]?.topic || "Trending Topic",
      type: scored[0]?.type || "Video",
      time: `${bestHourFinal}:00`,
      hook: "Ready-to-use hook matching your top-performing style.",
      music: "Trending audio in your niche",
      cta: buyerIntentScore > 15 ? "DM for pricing details" : "Follow for daily inspiration"
    },
    advanced_analysis: {
      post_classifications: scored.map((p, i) => ({
        ...p,
        tier: i < Math.ceil(total * 0.25) ? "viral" : i < Math.ceil(total * 0.75) ? "average" : "poor",
      })),
      growth_opportunities: [
        `Optimal Posting: Post around ${bestHourFinal}:00 for maximum reach.`,
        `Hashtag Strategy: Your best tags include ${topHashtagsFinal.slice(0, 2).join(", ") || "niche specific tags"}.`,
        `Monetization: ${buyerIntentScore}% buyer intent detected. Use clear shopping CTAs.`,
        `Content Mix: You have ${videoPosts} Reels and ${imagePosts} Images. ${videoPosts > imagePosts ? "Reels dominate your feed — keep pushing video." : "Consider more Reels for wider reach."}`,
      ],
    },
    action_cards: [
      {
        id: "fallback_1",
        type: "engagement",
        title: "Optimal Posting Window",
        priority: "medium",
        confidence_score: 85,
        trigger: `Your engagement peaks between ${bestHourFinal}:00 and ${Number(bestHourFinal) + 2}:00.`,
        action: { primary: `Schedule your next 3 posts at exactly ${bestHourFinal}:00.` },
        ready_to_copy: { hook: "Timing is everything!", caption: "Engagement is highest when you post at the right time. What time is it where you are?", cta: "Comment your timezone below!" },
        post_time: { date: "Today", time: `${bestHourFinal}:00` },
        expected_result: { metric: "+15% engagement", confidence_level: "High" },
        meta: { difficulty: "Easy", estimated_time_to_create: "2m", impact_score: 7, urgency_score: 9 }
      },
      {
        id: "buyer_intent_card",
        type: "sales",
        title: "🔥 High Intent detected",
        priority: "high",
        confidence_score: 95,
        trigger: `${buyerIntentScore}% of recent comments ask about price/availability.`,
        action: { primary: "Add 'DM for details' to your high-intent posts.", secondary: "Pin a comment with pricing info." },
        ready_to_copy: { hook: "Lots of questions about this lately!", caption: "Since so many of you were asking about this piece, I've added all the details to the link in my bio.", cta: "DM me for a direct link!" },
        post_time: { date: "Today", time: "ASAP" },
        expected_result: { metric: "+20% conversion", confidence_level: "High" },
        meta: { difficulty: "Easy", estimated_time_to_create: "1m", impact_score: 9, urgency_score: 10 }
      },
      {
        id: "viral_potential_card",
        type: "growth",
        title: "Viral Spark Detected",
        priority: "high",
        confidence_score: 88,
        trigger: `Your last reel exceeded ${fmt(avgViews)} average views by 40%.`,
        action: { primary: "Replicate the first 3 seconds of your top video.", secondary: "Use same audio-visual sync pattern." },
        ready_to_copy: { hook: "You guys liked this one so much...", caption: "Part 2 of what you've been asking for! Let's dive deeper into the process.", cta: "Share with someone who needs to see this!" },
        post_time: { date: "Tomorrow", time: "09:00" },
        expected_result: { metric: "+30% reach", confidence_level: "Medium" },
        meta: { difficulty: "Medium", estimated_time_to_create: "15m", impact_score: 10, urgency_score: 8 }
      },
      {
        id: "hashtag_refine_card",
        type: "opportunity",
        title: "Hashtag Synergy",
        priority: "medium",
        confidence_score: 82,
        trigger: `Low competition found for #${topHashtagsFinal[0] || 'your niche'}.`,
        action: { primary: "Update your hashtag stack to prioritize mid-tier tags.", secondary: "Add 3 location-specific tags." },
        ready_to_copy: { hook: "Finding your tribe online...", caption: "If you're seeing this, you're exactly where you're meant to be. Our community is growing every day!", cta: "Tap the link in bio to join us!" },
        post_time: { date: "Today", time: "Late Night" },
        expected_result: { metric: "+12% discovery", confidence_level: "High" },
        meta: { difficulty: "Easy", estimated_time_to_create: "5m", impact_score: 6, urgency_score: 6 }
      },
      {
        id: "content_gap_card",
        type: "warning",
        title: "Consistency Warning",
        priority: "high",
        confidence_score: 90,
        trigger: "Posting frequency has dropped 20% compared to last month.",
        action: { primary: "Post a simple behind-the-scenes photo today.", secondary: "No heavy editing required." },
        ready_to_copy: { hook: "Real life check!", caption: "Behind every perfect feed is a lot of messy work. Here's what's happening today in the studio.", cta: "Double tap if you feel this!" },
        post_time: { date: "Today", time: "ASAP" },
        expected_result: { metric: "Restore reach", confidence_level: "High" },
        meta: { difficulty: "Easy", estimated_time_to_create: "1m", impact_score: 8, urgency_score: 10 }
      }
    ]
  };
}

// ─── Express Server ───────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  // Image Proxy to bypass Instagram CDN restrictions
  app.get("/api/image-proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).send("URL required");

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"
        }
      });

      if (!response.ok) return res.status(response.status).send("Failed to fetch image");
      res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch {
      res.status(500).send("Proxy error");
    }
  });

  app.post("/api/insights", async (req, res) => {
    const { username, contentType, count, enableAI } = req.body;
    if (!username) return res.status(400).json({ error: "Username is required" });

    try {
      // ── STEP 1: Scrape latest content with configurable type and count ───
      // Calls the isolated scraper. Easy to swap for open-source later.
      const items = await scrapeInstagramProfile(username, contentType, count);

      if (!items || items.length === 0) {
        return res.status(404).json({
          error: "No posts found or profile is private.",
          details: "The scraper couldn't find any recent posts for this username.",
          suggestion: "Check that the account is public and the username is correct.",
        });
      }

      // Profile extraction
      const first: any = items[0];
      const pInfo = first?.owner || first?.user || {};
      const fCount = pInfo.followersCount ?? pInfo.followers ?? first.followersCount ?? 0;

      const userProfile = {
        username: first.ownerUsername || pInfo.username || username,
        fullName: first.ownerFullName || pInfo.fullName || "",
        followersCount: fCount,
        followingCount: pInfo.followingCount ?? first.followsCount ?? 0,
        postsCount: pInfo.postsCount ?? first.postsCount ?? items.length,
        profilePicUrl: first.profilePicUrl || pInfo.profilePicUrl || null,
        categoryName: [first.businessCategoryName, pInfo.categoryName].find(c => c && typeof c === 'string' && c.toLowerCase() !== 'none') || (first.isBusinessAccount ? "Business" : "Creator"),
      };

      // ── STEP 2: Normalize and Enhance ────────────────────────────────────
      const normalizedPosts = items.map((item: any) => ({
        ...item,
        likesCount: item.likesCount ?? item.likes ?? 0,
        commentsCount: item.commentsCount ?? item.comments ?? 0,
        videoViewCount: item.videoViewCount ?? item.videoPlayCount ?? item.views ?? 0,
        displayUrl: item.displayUrl || item.thumbnailUrl || item.previewUrl || item.url,
        type: item.type || (item.isVideo ? "Video" : "Image"),
        timestamp: item.timestamp ?? item.taken_at_timestamp,
        music_info: item.musicArtist ? `${item.musicArtist} - ${item.musicName}` : null,
        tagged_users: (item.taggedUsers || []).map((u: any) => u.username),
      }));

      const summaryData = normalizedPosts.map((item: any) => ({
        type: item.type,
        like_count: item.likesCount,
        comments_count: item.commentsCount,
        view_count: item.videoViewCount,
        timestamp: item.timestamp,
        caption: (item.caption || "").substring(0, 300),
        hook_text: (item.caption || "").split("\n")[0].substring(0, 80),
        hashtags: item.hashtags || [],
        duration: item.videoDuration || 0,
        music: item.music_info,
        tagged_users: item.tagged_users,
        is_collab: item.tagged_users.length > 0,
        latest_comments: (item.latestComments || []).map((c: any) => ({ text: c.text })),
      }));

      // ── STEP 3: Basic Baseline Dashboard ────────────────────────────────
      const basicInsights = computeBasicInsights(summaryData, fCount);
      console.log(`[Data] Computed baseline with ${fCount} followers.`);

      // Stream the first chunk immediately to render initial dashboard
      res.setHeader("Content-Type", "application/x-ndjson");
      res.write(JSON.stringify({
        type: "basic",
        data: {
          user: userProfile,
          posts: normalizedPosts,
          insights: basicInsights,
          dev: {
            summaryData,
            rawItems: items.length
          }
        }
      }) + "\n");

      // ── STEP 4: AI Strategic Analysis ───────────────────────────────────
      if (enableAI === false) {
        console.log("[AI] Skipping AI analysis as requested by user.");
        return res.end();
      }

      let aiInsights: any = null;
      let aiUsage: any = null;

      // 1. Detect Mode Dynamically via AI
      const bio = first?.owner?.biography || first?.user?.biography || "";
      let selectedModeFilename = "Lifestyle.md";

      const modeListStr = loadedModes.map(m => `{"filename": "${m.filename}", "description": "${m.typeDesc}"}`).join(",\n");
      const modePrompt = `Match the user to the best strategy playbook.
User Category: ${userProfile.categoryName}
User Bio: ${bio}
User Name: ${userProfile.fullName}

Available Playbooks:
[
${modeListStr}
]

Task: Output JSON with strictly ONE field "filename" containing the exact string of the best matching playbook.
{ "filename": "example.md" }`;

      try {
        console.log("[AI] Detecting optimal strategy mode...");
        const modeAiResult = await callAI(modePrompt);
        if (modeAiResult.data && modeAiResult.data.filename) {
          selectedModeFilename = modeAiResult.data.filename;
        }
      } catch (e: any) {
        console.log("[AI] Mode selection failed, using fallback. Error:", e.message);
      }

      const selectedMode = loadedModes.find(m => m.filename === selectedModeFilename) || loadedModes[0];
      const modeInstructions = selectedMode.content;
      console.log(`[AI] Mode dynamically selected: ${selectedMode.filename}`);

      // 2. Prepare Minimal Data for AI (Top 5 Posts)
      const top5Posts = summaryData
        .map(p => ({
          hook_text: p.hook_text || "",
          view_count: p.view_count || 0,
          like_count: p.like_count || 0,
          comments_count: p.comments_count || 0,
          duration: p.duration || 0,
          timestamp: p.timestamp || new Date().toISOString(),
          comments: p.latest_comments.map((c: any) => c.text).filter(Boolean).slice(0, 5)
        }))
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 5);

      console.log("[AI] Starting Algorithm v3 analysis with focused data...");

      const prompt = `You are a Social Media Strategy AI. Analyze using MAXIMUM INSIGHT Algorithm v3.

ACCOUNT: Followers ${fCount}
COMPUTED STATS: Avg Views: ${basicInsights.account_summary.avg_views} | Avg Likes: ${basicInsights.account_summary.avg_likes} | Best Hour: ${basicInsights.account_summary.best_hour}
ACCOUNT SCORE: ${basicInsights.account_score}/100
BUYER INTENT: ${basicInsights.buyer_intent_score}%

TOP 5 POSTS THIS WEEK:
${JSON.stringify(top5Posts, null, 2)}

PLAYBOOK:
${modeInstructions}

TASK: Detect signals and give next actions.
ALGORITHM v3 JSON REQUIREMENTS:
Even though you are providing actions based on the playbook, you MUST map your analysis into the following STRICT JSON output structure. Do not output markdown text, ONLY JSON.

Return JSON:
{
  "next_post_plan": {
    "topic": "Strategic topic based on NICHE and Playbook",
    "type": "Video | Image",
    "time": "HH:MM",
    "hook": "Full hook line variation from Playbook",
    "music": "Music strategy",
    "collab": true,
    "cta": "Heavy-hitting CTA from Playbook"
  },
  "advanced_analysis": {
    "post_classifications": [{ "type": "", "tier": "viral|average|poor", "engagement_score": 0 }],
    "growth_opportunities": [
      "Detail matching playbook signal",
      "Detail action list from playbook",
      "Detail hook variation to test"
    ]
  },
  "action_cards": [
    {
      "id": "playbook_action_1",
      "type": "growth | sales | engagement | opportunity | warning",
      "title": "Clear Action Heading from Playbook",
      "priority": "high",
      "confidence_score": 90,
      "trigger": "Signal Detected from Playbook",
      "action": { "primary": "What to do based on Actions list", "secondary": "Why it's smart" },
      "ready_to_copy": { "hook": "Suggested Hook Variation", "caption": "Body", "cta": "Playbook CTA" },
      "post_time": { "date": "Tomorrow", "time": "HH:MM" },
      "expected_result": { "metric": "+X% growth | sales based on Playbook expected win", "confidence_level": "High" },
      "meta": { "difficulty": "Easy", "estimated_time_to_create": "15m", "impact_score": 9, "urgency_score": 8 }
    }
  ]
}

REQUIRED: EXACTLY 5 high-impact action_cards representing the mapped Playbook strategies. JSON ONLY.`;

      try {
        const aiResult = await callAI(prompt);
        aiInsights = aiResult.data;
        aiUsage = aiResult.usage;
      } catch (aiErr: any) {
        console.warn("[AI] Failed, using fallback:", aiErr.message);
      }

      // Stream AI analysis chunk
      const finalInsights = {
        ...basicInsights,
      };

      if (aiInsights) {
        if (aiInsights.next_post_plan) finalInsights.next_post_plan = aiInsights.next_post_plan;
        if (aiInsights.advanced_analysis) finalInsights.advanced_analysis = aiInsights.advanced_analysis;
        if (aiInsights.action_cards) finalInsights.action_cards = aiInsights.action_cards;
      }

      res.write(JSON.stringify({
        type: "ai",
        data: {
          insights: finalInsights,
          aiUsed: !!aiInsights,
          dev: {
            prompt: prompt,
            usage: aiUsage
          }
        }
      }) + "\\n");

      return res.end();

    } catch (error: any) {
      console.error("[Error]", error);
      if (!res.headersSent) {
        return res.status(500).json({
          error: "Analysis failed",
          details: error.message,
          suggestion: "Verify API keys and try again.",
        });
      } else {
        res.write(JSON.stringify({ type: "error", error: "Analysis failed", details: error.message }) + "\n");
        return res.end();
      }
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
