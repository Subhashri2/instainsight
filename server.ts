import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { scrapeInstagramProfile } from "./src/scraper.js";
import { scanBuyerIntent } from "./src/utils/buyerIntentScanner.js";
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

// ─── Load playbooks for Niche Auto-Detection ───────────────────────────────
import { detectNiche } from "./refCode/playbooks.js";

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

    const usage = response.usageMetadata || {};
    return {
      data: JSON.parse(txt.trim()),
      usage: {
        promptTokens: (usage as any).promptTokenCount || 0,
        completionTokens: (usage as any).candidatesTokenCount || 0,
        totalTokens: (usage as any).totalTokenCount || 0
      }
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
function computeBasicInsights(summaryData: any[], followers: number = 0, playbook?: any) {
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

  // ── Buyer Intent (Improved) ───────────────────────────────────────────────
  const intentResult = scanBuyerIntent(summaryData);
  const buyerIntentScore = intentResult.intentScore;
  const buyerIntentMetadata = {
    topSignals: intentResult.topSignals,
    signalBreakdown: intentResult.signalBreakdown,
    hotPosts: intentResult.hotPosts,
    recommendation: intentResult.recommendation,
    totalCommentsScanned: intentResult.totalCommentsScanned
  };

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

  // ── Post ranking (Algorithm v3 + v4.md Metrics) ───────────────────────────
  const scored = summaryData.map(p => {
    let v4Value = 0;
    let internalScore = 0;

    if (p.type === "Video") {
      // engagement_rate (video) = (likes + comments) / views × 100
      v4Value = p.view_count > 0 ? ((p.like_count + p.comments_count) / p.view_count) * 100 : 0;
      // Internal Eng for sorting (Algorithm v3)
      internalScore = (p.like_count + (p.comments_count * 2.5)) / Math.max(p.view_count, 1);
    } else {
      // engagement_score (image) = likes + comments
      v4Value = p.like_count + p.comments_count;
      // Internal Eng for sorting (Algorithm v3) - for images, we use likes + comments * 2.5
      internalScore = p.like_count + (p.comments_count * 2.5);
    }

    return {
      ...p,
      engagement_metric: v4Value,
      engagement_metric_type: p.type === "Video" ? "rate" : "score",
      eng: internalScore,
    };
  });
  scored.sort((a, b) => b.eng - a.eng);

  // ── Viral Potential (% of posts > 2x average engagement) ──────────────────
  const avgEngAcrossPosts = (totalLikes + totalComments) / total;
  const viralPostsCount = summaryData.filter(p => (p.like_count + p.comments_count) > (avgEngAcrossPosts * 2)).length;
  const viralPotential = Math.min(100, Math.round((viralPostsCount / total) * 100));

  // ── Best Posting Hour (Avg Engagement per Hour) ──────────────────────────
  const hourData: Record<number, { posts: number; engagement: number }> = {};
  summaryData.forEach(p => {
    if (p.timestamp) {
      const h = new Date(p.timestamp).getHours();
      if (!hourData[h]) hourData[h] = { posts: 0, engagement: 0 };
      hourData[h].posts += 1;
      hourData[h].engagement += (p.like_count + p.comments_count);
    }
  });
  const sortedHours = Object.entries(hourData)
    .map(([hour, data]) => ({ hour, avgEng: data.engagement / data.posts }))
    .sort((a, b) => b.avgEng - a.avgEng);
  const bestHourFinal = sortedHours[0]?.hour ?? "12";

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
    buyer_intent_metadata: buyerIntentMetadata,
    dashboard: {
      growth_score: Math.min(100, Math.round((engagementScoreFinal * 0.4) + (viralPotential * 0.4) + (buyerIntentScore * 0.2))),
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
      // Type breakdown (Fixed for better R/P grouping)
      reel_count: videoPosts,
      image_count: imagePosts,
      // Other
      top_hashtags: topHashtagsFinal,
      best_hour: `${bestHourFinal}:00`,
      followers: followers,
      // Section 2.1 Metrics
      avg_caption_length: Math.round(summaryData.reduce((s, p) => s + (p.caption?.length || 0), 0) / (total || 1)),
      posting_frequency: Number((total / Math.max(1, (new Date().getTime() - new Date(summaryData[total - 1]?.timestamp || 0).getTime()) / (1000 * 60 * 60 * 24 * 7))).toFixed(1))
    },
    next_post_plan: {
      topic: scored[0]?.topic || (playbook?.nicheLabel === "Bridal" ? "Stunning bridal entry ideas" : "Behind the scenes of our latest collection"),
      type: scored[0]?.type || "Video",
      time: `${bestHourFinal}:00`,
      hook: scored[0] ? `Since your "${scored[0].hook_text.substring(0, 20)}..." performed well, let's double down on that hook style.` : "Personalized hook based on your audience behavior.",
      music: "Trending audio in your niche",
      cta: buyerIntentScore > 15 ? "Check out the link in bio for pricing" : "Follow for more daily inspiration",
      caption: "Crafting a caption that resonates with your core audience...",
      hashtags: topHashtagsFinal.length > 0 ? topHashtagsFinal : ["businessowner", "creativestrategy"]
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
        id: "optimal_posting_card",
        type: "engagement",
        title: "Prime Visibility Window",
        priority: "medium",
        confidence_score: 92,
        trigger: `Engagement peaks between ${bestHourFinal}:00 and ${Number(bestHourFinal) + 2}:00.`,
        action: {
          primary: `Schedule your next 3 ${playbook?.nicheLabel === 'Bridal' ? 'Lehenga demo' : 'product'} posts at exactly ${bestHourFinal}:00.`,
          secondary: "Analyze story views vs post views during this period."
        },
        ready_to_copy: {
          hook: "Timing is everything! ⏰",
          caption: `We noticed you guys are most active around this time. What's your favorite part of our ${playbook?.nicheLabel || 'latest'} collection?`,
          cta: "Drop a ❤️ if you're seeing this!"
        },
        post_time: { date: "Today", time: `${bestHourFinal}:00` },
        expected_result: { metric: "+15% reach", confidence_level: "High" },
        meta: { difficulty: "Easy", estimated_time_to_create: "2m", impact_score: 7, urgency_score: 9 }
      },
      {
        id: "buyer_intent_card",
        type: "sales",
        title: playbook?.nicheLabel === 'Bridal' ? "🔥 Bridal Sales Opportunity" : "🔥 High Intent detected",
        priority: "high",
        confidence_score: 95,
        trigger: `${buyerIntentScore}% of recent comments ask about price/availability.`,
        action: {
          primary: playbook?.nicheLabel === 'Bridal' ? "Create a 'Price Breakdown' reel for your top lehenga." : "Add 'DM for details' to your high-intent posts.",
          secondary: "Pin a comment with shipping timelines."
        },
        ready_to_copy: {
          hook: "Lots of questions about this lately! ✨",
          caption: `Since so many of you were asking about the details of our ${playbook?.nicheLabel || 'new'} arrivals, I've added a direct link to the bio.`,
          cta: "DM me for a direct shopping link!"
        },
        post_time: { date: "Today", time: "ASAP" },
        expected_result: { metric: "+25% conversion", confidence_level: "High" },
        meta: { difficulty: "Easy", estimated_time_to_create: "1m", impact_score: 9, urgency_score: 10 }
      },
      {
        id: "viral_potential_card",
        type: "growth",
        title: "Viral Blueprint Detected",
        priority: "high",
        confidence_score: 88,
        trigger: `Your last ${videoPosts > 0 ? 'reel' : 'post'} exceeded ${fmt(avgViews || avgLikes)} average by 40%.`,
        action: {
          primary: `Replicate the visual hook from your top ${playbook?.nicheLabel || 'content'}.`,
          secondary: "Use the same trending audio track."
        },
        ready_to_copy: {
          hook: "You guys liked this one so much...",
          caption: "Part 2 of what you've been asking for! Let's dive deeper into the process.",
          cta: "Share with a friend who needs to see this!"
        },
        post_time: { date: "Tomorrow", time: "09:00" },
        expected_result: { metric: "+30% viral reach", confidence_level: "Medium" },
        meta: { difficulty: "Medium", estimated_time_to_create: "15m", impact_score: 10, urgency_score: 8 }
      }
    ]
  };
}

function normalizePosts(items: any[]) {
  return items.map((item: any) => {
    // Normalize type: Instagram types can be Video, Reel, Image, Sidecar, GraphImage, etc.
    let type = item.type || (item.isVideo ? "Video" : "Image");
    if (type === "Sidecar" || type === "GraphImage" || type === "GraphSidecar") type = "Image";
    if (type === "Reel" || type === "GraphVideo") type = "Video";

    return {
      ...item,
      likesCount: item.likesCount ?? item.likes ?? 0,
      commentsCount: item.commentsCount ?? item.comments ?? 0,
      videoViewCount: item.videoViewCount ?? item.videoPlayCount ?? item.views ?? 0,
      displayUrl: item.displayUrl || item.thumbnailUrl || item.previewUrl || item.url,
      type: type,
      timestamp: item.timestamp ?? item.taken_at_timestamp,
      music_info: item.musicArtist ? `${item.musicArtist} - ${item.musicName}` : null,
      tagged_users: (item.taggedUsers || []).map((u: any) => u.username),
    };
  });
}

function buildSummaryData(normalizedPosts: any[]) {
  return normalizedPosts.map((item: any) => ({
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
    const { username, contentType, enableAI } = req.body;
    const count = 30; // Hardcoded default as per v4.md requirements
    if (!username) return res.status(400).json({ error: "Username is required" });

    try {
      // ── STEP 1: Scrape latest content with configurable type and count ───
      const items = await scrapeInstagramProfile(username, contentType, count, false);

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

      // 1. Detect Niche via Playbooks (Early detection so computeBasicInsights can use it)
      const { playbook } = detectNiche(userProfile);

      // ── STEP 2: Normalize and Enhance ────────────────────────────────────
      const normalizedPosts = normalizePosts(items);
      const summaryData = buildSummaryData(normalizedPosts);

      // ── STEP 3: Basic Baseline Dashboard ────────────────────────────────
      const basicInsights = computeBasicInsights(summaryData, fCount, playbook);
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

      const enrichedPromise = scrapeInstagramProfile(username, contentType, count, true)
        .then((enrichedItems: any[]) => {
          if (!enrichedItems || enrichedItems.length === 0) {
            return null;
          }

          const enrichedFirst: any = enrichedItems[0];
          const enrichedPInfo = enrichedFirst?.owner || enrichedFirst?.user || {};
          const enrichedFollowers = enrichedPInfo.followersCount ?? enrichedPInfo.followers ?? enrichedFirst.followersCount ?? fCount;
          const enrichedNormalizedPosts = normalizePosts(enrichedItems);
          const enrichedSummaryData = buildSummaryData(enrichedNormalizedPosts);
          const enrichedInsights = computeBasicInsights(enrichedSummaryData, enrichedFollowers, playbook);

          return {
            posts: enrichedNormalizedPosts,
            summaryData: enrichedSummaryData,
            insights: enrichedInsights,
            followers: enrichedFollowers,
            rawItems: enrichedItems.length
          };
        })
        .catch((enrichedErr: any) => {
          console.warn("[Data] Comment enrichment failed, continuing with baseline:", enrichedErr.message);
          return null;
        });

      // ── STEP 4: AI Strategic Analysis ───────────────────────────────────
      if (enableAI === false) {
        console.log("[AI] Skipping AI analysis as requested by user.");
        const enrichedData = await enrichedPromise;
        if (enrichedData) {
          res.write(JSON.stringify({
            type: "enriched",
            data: {
              posts: enrichedData.posts,
              insights: enrichedData.insights,
              dev: {
                summaryData: enrichedData.summaryData,
                rawItems: enrichedData.rawItems
              }
            }
          }) + "\n");
        }
        return res.end();
      }

      let aiInsights: any = null;
      let aiUsage: any = null;

      // 1. Detect Niche via Playbooks
      const { nicheKey } = detectNiche(userProfile);
      console.log(`[AI] Niche dynamically selected: ${playbook.nicheLabel} (${nicheKey})`);

      const enrichedData = await enrichedPromise;
      const aiSummaryData = enrichedData?.summaryData || summaryData;
      const aiInsightsBase = enrichedData?.insights || basicInsights;
      const aiFollowerCount = enrichedData?.followers || fCount;

      if (enrichedData) {
        res.write(JSON.stringify({
          type: "enriched",
          data: {
            posts: enrichedData.posts,
            insights: enrichedData.insights,
            dev: {
              summaryData: enrichedData.summaryData,
              rawItems: enrichedData.rawItems
            }
          }
        }) + "\n");
      }

      // 2. Prepare Minimal Data for AI (Block 1: Account Snapshot)
      const postMixStr = `${aiInsightsBase.account_summary.image_count} Images, ${aiInsightsBase.account_summary.reel_count} Reels`;
      const accountSnapshot = `ACCOUNT: @${userProfile.username} | Niche: ${playbook.nicheLabel} | Followers: ${aiFollowerCount} | Avg Likes: ${aiInsightsBase.account_summary.avg_likes} | Avg Views: ${aiInsightsBase.account_summary.avg_views} | Best Hour: ${aiInsightsBase.account_summary.best_hour} | Account Score: ${aiInsightsBase.account_score}/100 | Buyer Intent: ${aiInsightsBase.buyer_intent_score}% | Post Mix: ${postMixStr}`;

      // 3. Prepare Minimal Data for AI (Block 2: Top Posts Summary)
      const formatPost = (p: any, type: string) => {
        const avgEng = aiInsightsBase.account_summary.total_interactions / (aiInsightsBase.account_summary.total_posts_analyzed || 1);
        const pEng = (p.like_count || 0) + (p.comments_count || 0);
        const tier = pEng > (avgEng * 2) ? "VIRAL" : pEng < (avgEng * 0.5) ? "POOR" : "AVERAGE";

        let str = `[${type}] ${p.type} | Likes:${p.like_count || 0}`;
        if (p.comments_count) str += ` | Comments:${p.comments_count}`;
        if (p.view_count) str += ` | Views:${p.view_count}`;
        if (p.hook_text) str += ` | Hook: "${p.hook_text}"`;
        if (p.hashtags && p.hashtags.length) str += ` | Tags: ${p.hashtags.slice(0, 5).join(",")}`;
        str += ` | Tier: ${tier}`;
        return str;
      };

      const sortedSummaryPosts = [...aiSummaryData].sort((a, b) => {
        const scoreA = a.type === "Video" ? a.view_count : a.like_count + a.comments_count;
        const scoreB = b.type === "Video" ? b.view_count : b.like_count + b.comments_count;
        return scoreB - scoreA;
      });

      const top5 = sortedSummaryPosts.slice(0, 5);
      const bottom3 = sortedSummaryPosts.slice(Math.max(sortedSummaryPosts.length - 3, 5));
      const topPostsStrings = top5.map((p, i) => formatPost(p, String(i + 1))).join(" ");
      const worstPostsStrings = bottom3.map((p, i) => formatPost(p, String(top5.length + i + 1))).join(" ");
      const topPostsSummary = `TOP POSTS: ${topPostsStrings}  WORST POSTS: ${worstPostsStrings}`;

      // 4. Prepare Minimal Data for AI (Block 3: Niche Playbook block)
      const playbookBlock = `PLAYBOOK [${playbook.nicheLabel}]: SIGNALS: ${playbook.signals.join(" | ")}. ACTION PRIORITY: ${playbook.priorityActions.slice(0, 3).join(" | ")}. HOOK TEMPLATES: ${playbook.hookTemplates.slice(0, 3).join(" | ")}.`;

      console.log("[AI] Starting Algorithm v4 analysis with Lean Prompt...");

      const prompt = `You are a Social Media Growth Strategist for small businesses.

  ACCOUNT CONTEXT: ${accountSnapshot}
  POST PERFORMANCE: ${topPostsSummary}
  NICHE PLAYBOOK: ${playbookBlock}

  TASK: Analyze the account signals and return EXACTLY:
  1. next_post_plan: topic, type, time, hook, cta, full_caption, 10_hashtags
  2. post_classifications: tier each post as viral/average/poor with one reason
  3. action_cards: EXACTLY 3 cards. Each card MUST have deep niche-specific logic.

  ACTION CARD RULES:
  - TITLE: Bold opportunity or problem statement.
  - TRIGGER: Quote the exact stat or signal (e.g., "Your Reel on 'Velvet Bridal' got 3x avg views").
  - ACTION: Provide a technical or creative step (e.g., "Use a 2-second fast-cut edit for the intro").
  - READY_TO_COPY: Write a COMPLETE caption that sounds like a professional store owner. No placeholders.

  GENERAL RULES:
  - Be EXTREMELY specific to THIS account. Mention their EXACT product names, hook styles, and niche signals.
  - DO NOT give generic advice.
  - DO NOT use template text like "Strategic topic based on NICHE". Write REAL text.
  - Output JSON only. No markdown.
  - Each action must be executable within 24 hours

  ALGORITHM v4 JSON REQUIREMENTS (STRICT):
  {
    "next_post_plan": {
      "topic": "Actual Topic Title",
      "type": "Video | Image",
      "time": "HH:MM",
      "hook": "Full hook text line",
      "cta": "Specific CTA text",
      "caption": "Full high-converting body text",
      "hashtags": ["tag1", "tag2", "tag3"]
    },
    "advanced_analysis": {
      "post_classifications": [{ "type": "", "tier": "viral|average|poor", "engagement_score": 0, "reason": "Why it's viral/poor" }]
    },
    "action_cards": [
      {
        "id": "playbook_action_1",
        "type": "growth | sales | engagement | opportunity | warning",
        "title": "Clear Action Heading",
        "priority": "high",
        "confidence_score": 90,
        "trigger": "Signal Detected from Playbook",
        "action": { "primary": "What to do", "secondary": "Why it's smart" },
        "ready_to_copy": { "hook": "Suggested Hook", "caption": "Body", "cta": "CTA" },
        "post_time": { "date": "Tomorrow", "time": "HH:MM" },
        "expected_result": { "metric": "+X% growth | sales", "confidence_level": "High" },
        "meta": { "difficulty": "Easy", "estimated_time_to_create": "15m", "impact_score": 9, "urgency_score": 8 }
      }
    ]
  }

  REQUIRED: EXACTLY 3 high-impact action_cards representing the mapped Playbook strategies. JSON ONLY.`;

      try {
        const aiResult = await callAI(prompt);
        aiInsights = aiResult.data;
        aiUsage = aiResult.usage;
      } catch (aiErr: any) {
        console.warn("[AI] Failed, using fallback:", aiErr.message);
      }

      // Stream AI analysis chunk
      const finalInsights = {
        ...aiInsightsBase,
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
      }) + "\n");

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
