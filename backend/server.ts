import "./env.js";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { scrapeInstagramProfile } from "./scraper.ts";
import { scanBuyerIntent } from "./utils/buyerIntentScanner.ts";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI, SubjectReferenceImage, SubjectReferenceType } from "@google/genai";

// Supabase
import { registerUser, loginUser, validateToken } from "./lib/supabase.ts";
import {
  saveProfile, savePosts, saveComments, saveAnalysis,
  getAnalyses, getPostRecordId,
  type ProfileData, type PostData, type CommentData,
} from "./lib/db.ts";

// ─── Load instruction markdown files once at startup ─────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname);
const loadFile = (relativePath: string) => {
  try { return fs.readFileSync(path.resolve(backendDir, relativePath), "utf-8"); }
  catch { return ""; }
};
const brain = loadFile("brain.md");
const instruction = loadFile("instruction.md");
const analysis = loadFile("analysis_instruction.md");
const imagenClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─── Load playbooks for Niche Auto-Detection ───────────────────────────────
import { detectNiche } from "./refCode/playbooks.js";

const parseReferenceImage = (data?: string) => {
  if (!data) return null;
  const match = data.match(/^data:(.*?);base64,(.*)$/);
  return {
    mimeType: match?.[1] || "image/png",
    imageBytes: match?.[2] || data,
  };
};

// ─── AI call helper: uses Gemini 2.0 Flash ──────────────────────────────
async function callAI(prompt: string, expectJson: boolean = true): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }

  console.log(`[AI] Attempting analysis with Gemini API (JSON: ${expectJson})...`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: expectJson ? { responseMimeType: "application/json" } : undefined
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let txt = response.text();

    if (expectJson) {
      // Standard markdown cleaning if model ignores JSON mode (though application/json should handle it)
      if (txt.includes("```json")) txt = txt.split("```json")[1].split("```")[0];
      else if (txt.includes("```")) txt = txt.split("```")[1].split("```")[0];
    }

    const usage = response.usageMetadata || {};
    return {
      data: expectJson ? JSON.parse(txt.trim()) : txt.trim(),
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
  const effectiveViewsOf = (p: any) => {
    const directViews = Number(p.view_count || 0);
    if (directViews > 0) return directViews;
    // Image posts do not expose view_count reliably, so use likes as reach proxy.
    return Number(p.like_count || 0);
  };
  const totalViews = summaryData.reduce((s, p) => s + effectiveViewsOf(p), 0);
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
    // WES (Weighted Engagement Score) = likes + (comments * 2.5)
    // No division by views, no * 100
    const wes = p.like_count + (p.comments_count * 2.5);

    return {
      ...p,
      engagement_metric: wes,
      engagement_metric_type: "score",
      eng: wes,
    };
  });
  scored.sort((a, b) => b.eng - a.eng);

  // ── Viral Potential (% of posts > 2x average engagement) ──────────────────
  const avgEngAcrossPosts = (totalLikes + totalComments) / total;
  const viralPostsCount = summaryData.filter(p => effectiveViewsOf(p) > (avgViews * 1.5)).length;
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
      potential_clients: intentResult.potentialClients || [],
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
      post_classifications: scored.map((p) => ({
        ...p,
        tier: p.view_count > (avgViews * 1.5) ? "viral" : p.view_count < (avgViews * 0.5) ? "poor" : "average",
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
      id: item.id || item.shortCode || "",
      shortCode: item.shortCode || "",
      type: type,
      caption: item.caption || "",
      likesCount: item.likesCount ?? item.likes ?? 0,
      commentsCount: item.commentsCount ?? item.comments ?? 0,
      videoViewCount: item.videoViewCount ?? item.videoPlayCount ?? item.views ?? 0,
      playCount: item.playCount || item.videoPlayCount || 0,
      saveCount: item.saveCount || 0,
      shareCount: item.shareCount || 0,
      displayUrl: item.displayUrl || item.thumbnailUrl || item.previewUrl || item.url || "",
      url: item.url || `https://www.instagram.com/p/${item.shortCode}/`,
      timestamp: (item.timestamp ?? item.taken_at_timestamp) || "",
      videoDuration: item.videoDuration || 0,
      music_info: item.musicArtist ? `${item.musicArtist} - ${item.musicName}` : (item.music_info || null),
      tagged_users: (item.taggedUsers || item.tagged_users || []).map((u: any) => typeof u === 'string' ? u : u.username),
      latestComments: item.latestComments || item.latest_comments || [],
    };
  });
}

/**
 * Extracts a meaningful hook from a caption, skipping emoji-only or too short lines.
 */
function extractHook(caption: string) {
  if (!caption) return "";
  const lines = caption.split("\n").map(l => l.trim());
  // Skip lines that are mostly emojis or too short
  const meaningful = lines.find(l =>
    l.replace(/[\p{Emoji}\s]/gu, "").length > 5
  );
  return (meaningful || lines[0] || "").slice(0, 80);
}

function buildSummaryData(normalizedPosts: any[]) {
  if (!normalizedPosts || !Array.isArray(normalizedPosts)) return [];
  return normalizedPosts.map((item: any) => ({
    type: item.type,
    like_count: item.likesCount,
    comments_count: item.commentsCount,
    view_count: item.videoViewCount,
    timestamp: item.timestamp,
    caption: (item.caption || "").substring(0, 300),
    hook_text: extractHook(item.caption),
    hashtags: item.hashtags || [],
    duration: item.videoDuration || 0,
    music: item.music_info,
    tagged_users: item.tagged_users || [],
    is_collab: (item.tagged_users || []).length > 0,
    latest_comments: (item.latestComments || []).map((c: any) => ({
      text: typeof c === 'string' ? c : (c.text || ""),
      ownerUsername: typeof c === 'string' ? 'unknown' : (c.ownerUsername || c.owner_username || "unknown")
    })),
  }));
}

// ─── Express Server ───────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  const fallbackOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ];
  const envOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const optionalOrigins = [process.env.APP_URL, process.env.FRONTEND_URL].filter(Boolean);
  const corsAllowList = new Set([...fallbackOrigins, ...envOrigins, ...optionalOrigins]);
  const allowAllOrigins = process.env.ALLOW_EVERYONE === "1" || corsAllowList.size === 0;

  const handleCors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const origin = req.headers.origin;
    if (!origin) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (allowAllOrigins || corsAllowList.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      res.setHeader("Access-Control-Allow-Origin", "null");
    }
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  };

  app.use(handleCors);

  // ─── Auth Endpoints ───────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    try {
      const result = await registerUser(email, password, name || "");
      return res.json(result);
    } catch (err: any) {
      console.error("[Auth] Register failed:", err.message);
      return res.status(400).json({ error: err.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    try {
      const result = await loginUser(email, password);
      return res.json(result);
    } catch (err: any) {
      console.error("[Auth] Login failed:", err.message);
      return res.status(401).json({ error: "Invalid email or password" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token provided" });
    try {
      const user = await validateToken(token);
      if (!user) return res.status(401).json({ error: "Invalid token" });
      return res.json({ user });
    } catch {
      return res.status(401).json({ error: "Token validation failed" });
    }
  });

  // ─── Save Endpoint (triggered by Save button) ──────────────────────────────

  app.post("/api/save", async (req, res) => {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const user = await validateToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const { profile: profileData, posts: postsData, insights, aiResponse } = req.body;
    if (!profileData || !postsData) return res.status(400).json({ error: "Profile and posts data are required" });

    try {
      // 1. Save/update profile
      const pbProfile: ProfileData = {
        ig_username: profileData.username || "",
        full_name: profileData.fullName || "",
        followers_count: profileData.followersCount || 0,
        following_count: profileData.followingCount || 0,
        posts_count: profileData.postsCount || 0,
        profile_pic_url: profileData.profilePicUrl || "",
        category_name: profileData.categoryName || "",
        biography: profileData.biography || "",
      };
      console.log("\n\n#################################################");
      console.log("### [CRITICAL DEBUG] SAVE ENDPOINT HIT        ###");
      console.log(`### User ID:    ${user.id}`);
      console.log(`### Profile ID: ${pbProfile.ig_username}`);

      const savedProfile = await saveProfile(user.id, pbProfile);
      const ACTUAL_PROFILE_ID = savedProfile.id;

      console.log(`### RESOLVED PROFILE RECORD ID: ${ACTUAL_PROFILE_ID}`);
      console.log("#################################################\n");

      // 2. Save posts (smart aggregation)
      const pbPosts: PostData[] = postsData.map((p: any) => ({
        ig_post_id: p.id || p.shortCode || "",
        short_code: p.shortCode || "",
        type: p.type || "Image",
        caption: (p.caption || "").substring(0, 5000),
        likes_count: p.likesCount || p.likes_count || 0,
        comments_count: p.commentsCount || p.comments_count || 0,
        video_view_count: p.videoViewCount || p.video_view_count || 0,
        play_count: p.playCount || p.play_count || 0,
        save_count: p.saveCount || p.save_count || 0,
        share_count: p.shareCount || p.share_count || 0,
        display_url: p.displayUrl || p.display_url || "",
        timestamp: p.timestamp || "",
        hashtags: p.hashtags || [],
        url: p.url || "",
        duration: p.videoDuration || p.duration || 0,
        music_info: p.music_info || null,
        tagged_users: p.tagged_users || [],
      }));
      const { newCount, updatedCount } = await savePosts(user.id, savedProfile.id, pbPosts);
      console.log(`[Save] Posts: ${newCount} new, ${updatedCount} updated`);

      // 3. Save comments for each post
      let totalCommentsSaved = 0;
      for (const p of postsData) {
        const comments = p.latestComments || p.latest_comments || [];
        if (comments.length === 0) continue;

        const igPostId = p.id || p.shortCode || "";
      const postRecordId = await getPostRecordId(user.id, savedProfile.id, igPostId);
        if (!postRecordId) continue;

        const pbComments: CommentData[] = comments.map((c: any) => ({
          text: typeof c === "string" ? c : (c.text || ""),
          owner_username: typeof c === "string" ? "unknown" : (c.ownerUsername || c.owner_username || "unknown"),
        }));
        console.log(`[Save] Saving batch of ${pbComments.length} comments for post ${postRecordId}...`);
        totalCommentsSaved += await saveComments(user.id, ACTUAL_PROFILE_ID, postRecordId, pbComments);
      }
      console.log(`[Save] Comments saved: ${totalCommentsSaved}`);

      // 4. Save analysis
      if (insights) {
        await saveAnalysis(user.id, savedProfile.id, {
          insights: insights,
          ai_response: aiResponse || null,
          action_cards: insights.action_cards || [],
          next_post_plan: insights.next_post_plan || {},
        });
        console.log(`[Save] Analysis saved for ${pbProfile.ig_username}`);
      }

      return res.json({
        success: true,
        profileId: savedProfile.id,
        posts: { new: newCount, updated: updatedCount },
        commentsSaved: totalCommentsSaved,
      });
    } catch (err: any) {
      console.error("[Save] Failed:", err.message);
      return res.status(500).json({ error: "Save failed: " + err.message });
    }
  });

  // ─── History Endpoint ──────────────────────────────────────────────────────

  app.get("/api/history", async (req, res) => {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const user = await validateToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    try {
      const analyses = await getAnalyses(user.id);
      return res.json({ analyses });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

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

  // New endpoint for image generation prompt
  app.post("/api/generate-thumbnail-prompt", async (req, res) => {
    console.log("[Thumbnail] Request received. DryRun:", req.body.dryRun);
    const { niche, productName, caption, keyDetails, dryRun } = req.body;

    const prompt = `You are an AI image prompt engineer for Indian fashion e-commerce.

SELLER INPUT:
- Niche: ${niche}
- Product: ${productName}
- Caption: ${caption}
- Details: ${keyDetails}

Based on the product type, generate one professional catalogue-style image prompt.

PRODUCT TYPE → POSE & SETTING:
- Saree/Lehenga → full body, traditional drape, elegant studio backdrop
- Jewellery → model close-up, focus on the jewellery piece, soft bokeh, warm skin contrast
- Kurta/Suit → three-quarter pose, clean white or pastel background, soft daylight
- Indo-western/Fusion → lifestyle setting, dynamic pose, natural outdoor or urban light

ALWAYS:
- Single adult Indian woman model, realistic skin tones
- Product clearly visible, well-lit, fabric texture visible
- No celebrities, brand names, camera gear, or children

Return JSON only:
{
  "prompt": "...",
  "negative_prompt": "celebrities, minors, blur, overexposed, clutter, camera brands, text, watermark"
}`;

    if (dryRun) {
      return res.json({ dryRun: true, prompt });
    }

    try {
      const aiResult = await callAI(prompt, true);
      // Normalize keys to uppercase for frontend compatibility
      const data = aiResult.data;
      const normalizedData = {
        PROMPT: data.PROMPT || data.prompt || "",
        NEGATIVE_PROMPT: data.NEGATIVE_PROMPT || data.negative_prompt || ""
      };
      return res.json(normalizedData);
    } catch (err: any) {
      console.error("[Thumbnail] generation failed:", err.message);
      return res.status(500).json({ error: "Failed to generate thumbnail prompt" });
    }
  });

  app.post("/api/generate-thumbnail-image", async (req, res) => {
    const { prompt, referenceImage, negativePrompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    try {
      let generatedResponse;
      const imageConfig: Record<string, any> = {
        numberOfImages: 1,
        outputMimeType: "image/png",
      };
      if (negativePrompt) imageConfig.negativePrompt = negativePrompt;
      if (referenceImage) {
        const parsed = parseReferenceImage(referenceImage);
        if (!parsed) {
          return res.status(400).json({ error: "Invalid reference image" });
        }
        const subjectReference = new SubjectReferenceImage();
        subjectReference.referenceImage = {
          mimeType: parsed.mimeType,
          imageBytes: parsed.imageBytes,
        };
        subjectReference.config = {
          subjectType: SubjectReferenceType.SUBJECT_TYPE_DEFAULT,
        };

        generatedResponse = await imagenClient.models.editImage({
          model: "Gemini 3.1 Flash Image",
          prompt,
          referenceImages: [subjectReference],
          config: imageConfig,
        });
      } else {
        generatedResponse = await imagenClient.models.generateImages({
          model: "Gemini 3.1 Flash Image",
          prompt,
          config: imageConfig,
        });
      }

      const generatedImage = generatedResponse?.generatedImages?.[0]?.image;
      if (!generatedImage) {
        return res.status(500).json({ error: "No image returned from model" });
      }
      const imageBytes = generatedImage.imageBytes;
      const imageMime = generatedImage.mimeType || "image/png";
      const imageUrl = generatedImage.gcsUri
        ? generatedImage.gcsUri
        : imageBytes
          ? `data:${imageMime};base64,${imageBytes}`
          : null;

      if (!imageUrl) {
        return res.status(500).json({ error: "Generated image is empty" });
      }

      return res.json({ imageUrl });
    } catch (err: any) {
      console.error("[Thumbnail] image generation failed:", err.message);
      return res.status(500).json({ error: "Failed to generate thumbnail image" });
    }
  });

  app.post("/api/insights", async (req, res) => {
    const { username, contentType, enableAI, dryRun, existingPosts = [] } = req.body;
    const count = 30; // Hardcoded default as per v4.md requirements
    if (!username) return res.status(400).json({ error: "Username is required" });
    let streamedBasic = false;
    let heartbeat: NodeJS.Timeout | null = null;
    const sendChunk = (payload: any) => {
      if (!res.writableEnded) {
        res.write(JSON.stringify(payload) + "\n");
      }
    };

    try {
      // Start streaming immediately so long scrape/fallback runs do not get dropped by proxy idle timeouts.
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      (res as any).flushHeaders?.();
      sendChunk({ type: "progress", stage: "scrape_started", username });
      heartbeat = setInterval(() => {
        sendChunk({ type: "keepalive", ts: Date.now() });
      }, 10000);

      // ── STEP 1: Scrape latest content ──
      // Consolidate into ONE call with includeComments=true to avoid double browser launch 
      const existingPostIds = existingPosts.map((p: any) => p.shortCode || p.id).filter(Boolean);
      
      console.log(`[Scraper] Starting single-pass extraction for ${username}...`);
      // Always include comments for now to populate the dashboard correctly
      const items = await scrapeInstagramProfile(username, contentType, count, true, existingPostIds);

      if ((!items || items.length === 0) && existingPosts.length === 0) {
        if (heartbeat) clearInterval(heartbeat);
        sendChunk({
          type: "error",
          error: "No posts found or profile is private.",
          details: "The scraper couldn't find any recent posts for this username.",
          suggestion: "Check that the account is public and the username is correct.",
        });
        return res.end();
      }

      // Profile extraction
      const first: any = items.length > 0 ? items[0] : (existingPosts.length > 0 ? existingPosts[0] : {});
      const pInfo = first?.owner || first?.user || {};
      const fCount = pInfo.followersCount ?? pInfo.followers ?? first.followersCount ?? 0;

      const userProfile = {
        username: first.ownerUsername || pInfo.username || username,
        fullName: first.ownerFullName || pInfo.fullName || first.ownerFullName || "",
        followersCount: fCount,
        followingCount: pInfo.followingCount ?? first.followsCount ?? first.followingCount ?? 0,
        postsCount: pInfo.postsCount ?? first.postsCount ?? (items.length + existingPosts.length),
        profilePicUrl: first.profilePicUrl || pInfo.profilePicUrl || null,
        categoryName: [first.businessCategoryName, pInfo.categoryName, first.categoryName].find(c => c && typeof c === 'string' && c.toLowerCase() !== 'none') || (first.isBusinessAccount ? "Business" : "Creator"),
        biography: first.biography || pInfo.biography || "",
      };

      // 1. Detect Niche via Playbooks
      const { playbook, nicheKey } = detectNiche(userProfile);

      // ── STEP 2: Normalize and Enhance ────────────────────────────────────
      const newlyNormalizedPosts = normalizePosts(items);
      const allPostsMap = new Map();
      existingPosts.forEach((p: any) => allPostsMap.set(p.shortCode || p.id, p));
      newlyNormalizedPosts.forEach((p: any) => {
        const key = p.shortCode || p.id;
        if (allPostsMap.has(key)) {
          const existing = allPostsMap.get(key);
          if (!p.latestComments || p.latestComments.length === 0) {
            p.latestComments = existing.latestComments || existing.latest_comments || [];
          }
        }
        allPostsMap.set(key, p);
      });

      const normalizedPosts = Array.from(allPostsMap.values())
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, count);

      const summaryData = buildSummaryData(normalizedPosts);

      // ── STEP 3: Basic Baseline Dashboard ────────────────────────────────
      const basicInsights = computeBasicInsights(summaryData, fCount, playbook);
      
      // Stream the response back
      sendChunk({
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
      });
      streamedBasic = true;

      // ── STEP 4: AI Strategic Analysis ───────────────────────────────────
      if (enableAI === false) {
        console.log("[AI] Skipping AI analysis as requested by user.");
        if (heartbeat) clearInterval(heartbeat);
        return res.end();
      }

      let aiInsights: any = null;
      let aiUsage: any = null;

      // 1. Log Niche (Already detected early)
      console.log(`[AI] Niche dynamically selected: ${playbook.nicheLabel} (${nicheKey})`);

      // 2. Prepare Minimal Data for AI (Block 1: Account Snapshot)
      const aiInsightsBase = basicInsights;
      const aiSummaryData = summaryData;
      const aiFollowerCount = fCount;

      const postMixStr = `${aiInsightsBase.account_summary.image_count} Images, ${aiInsightsBase.account_summary.reel_count} Reels`;
      const accountSnapshot = `@${userProfile.username} | Niche: ${playbook.nicheLabel} | Followers: ${aiFollowerCount} | Avg Likes: ${aiInsightsBase.account_summary.avg_likes} | Avg Views: ${aiInsightsBase.account_summary.avg_views} | Best Hour: ${aiInsightsBase.account_summary.best_hour} | Account Score: ${aiInsightsBase.account_score}/100 | Buyer Intent: ${aiInsightsBase.buyer_intent_score}% | Post Mix: ${postMixStr}`;

      // 3. Prepare Minimal Data for AI (Block 2: Top Posts Summary)
      const formatPost = (p: any, type: string) => {
        const avgViews = aiInsightsBase.account_summary.avg_views;
        const tier = (p.view_count || 0) > (avgViews * 1.5) ? "VIRAL" : (p.view_count || 0) < (avgViews * 0.5) ? "POOR" : "AVERAGE";

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

  ACCOUNT: ${accountSnapshot}
  POST PERFORMANCE: ${topPostsSummary}
  ${playbookBlock}

  TASK: Analyze the account signals and return EXACTLY:
  1. next_post_plan: topic, type, time, hook, cta, caption, hashtags (return as JSON)
  2. advanced_analysis: post_classifications: tier each post as viral/average/poor with one reason
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
  - Use Gemini's JSON mode.
  - Each action must be executable within 24 hours
  - HASHTAGS: Search for and include currently trending tags (both overall and niche-specific) along with relevant user-specific tags.

  REQUIRED: Return your analysis as JSON with keys: next_post_plan, advanced_analysis, action_cards.
  
  JSON STRUCTURE:
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
    ...
  }
`;

      if (dryRun) {
        sendChunk({
          type: "ai",
          data: {
            insights: aiInsightsBase,
            aiUsed: false,
            dev: {
              prompt: prompt,
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
            }
          }
        });
        if (heartbeat) clearInterval(heartbeat);
        return res.end();
      }

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

      sendChunk({
        type: "ai",
        data: {
          insights: finalInsights,
          aiUsed: !!aiInsights,
          dev: {
            prompt: prompt,
            usage: aiUsage
          }
        }
      });

      if (heartbeat) clearInterval(heartbeat);
      return res.end();

    } catch (error: any) {
      console.error("[Error]", error);
      if (heartbeat) clearInterval(heartbeat);
      if (!res.headersSent) {
        return res.status(500).json({
          error: "Analysis failed",
          details: error.message,
          suggestion: "Verify API keys and try again.",
        });
      } else {
        // If we already streamed usable basic data, don't send a terminal error chunk.
        // This preserves successful scrape/fallback results in the UI.
        if (!streamedBasic) {
          res.write(JSON.stringify({ type: "error", error: "Analysis failed", details: error.message }) + "\n");
        }
        return res.end();
      }
    }
  });

  app.post("/api/generate-specific-plan", async (req, res) => {
    console.log("[SpecificPlan] Request received. Product:", req.body.productDetails, "DryRun:", req.body.dryRun);
    let { userProfile, summaryData, playbook, productDetails, dryRun, posts } = req.body;

    if (!userProfile) return res.status(400).json({ error: "UserProfile missing" });
    if (!productDetails) return res.status(400).json({ error: "Product details missing" });

    if (!summaryData) {
      if (posts && Array.isArray(posts)) {
        summaryData = buildSummaryData(posts);
      } else {
        return res.status(400).json({ error: "Data missing (summaryData or posts required)" });
      }
    }

    const effectivePlaybook = playbook || detectNiche(userProfile).playbook;
    const followers = userProfile.followersCount || 0;

    // Safety check for summaryData format
    const safeSummaryData = Array.isArray(summaryData) ? summaryData : (Array.isArray(posts) ? buildSummaryData(posts) : []);
    const basicInsights = computeBasicInsights(safeSummaryData, followers, effectivePlaybook);

    if (!basicInsights.account_summary) {
      console.warn("[SpecificPlan] Could not compute basic insights, using defaults");
      basicInsights.account_summary = {
        image_count: 0, reel_count: 0, avg_likes: 0, avg_views: 0,
        total_posts_analyzed: 0, avg_comments: 0, total_likes: 0, total_comments: 0,
        total_views: 0, total_interactions: 0, total_views_fmt: "0",
        total_interactions_fmt: "0", avg_views_fmt: "0", avg_likes_fmt: "0",
        best_hour: "12", top_hashtags: [], engagement_rate_avg: "0%",
        viral_potential_score: 0, posting_frequency: 0
      } as any;
    }

    const postMixStr = `${basicInsights.account_summary.image_count} Images, ${basicInsights.account_summary.reel_count} Reels`;
    const accountSnapshot = `@${userProfile.username} | Niche: ${effectivePlaybook?.nicheLabel || 'Fashion'} | Followers: ${followers} | Avg Likes: ${basicInsights.account_summary.avg_likes} | Avg Views: ${basicInsights.account_summary.avg_views}`;

    const sortedSummaryPosts = [...safeSummaryData].sort((a, b) => {
      const scoreA = a.type === "Video" ? a.view_count : a.like_count + a.comments_count;
      const scoreB = b.type === "Video" ? b.view_count : b.like_count + b.comments_count;
      return scoreB - scoreA;
    });
    const top5 = sortedSummaryPosts.slice(0, 5);

    const formatPost = (p: any, type: string) => {
      return `[${type}] ${p.type} | Likes:${p.like_count || 0} | Views:${p.view_count || 0} | Hook: "${p.hook_text}"`;
    };

    const topPostsSummary = `TOP PERFORMANCE CONTEXT: ${top5.map((p, i) => formatPost(p, String(i + 1))).join(" ")}`;
    const playbookBlock = `NICHE STRATEGY [${effectivePlaybook?.nicheLabel}]: SIGNALS: ${effectivePlaybook?.signals?.join(" | ")}.`;

    const prompt = `You are a Social Media Growth Strategist.
CONTEXT:
ACCOUNT: ${accountSnapshot}
${topPostsSummary}
${playbookBlock}

USER'S SPECIFIC PRODUCT FOR NEXT POST:
"${productDetails}"

TASK: Generate a high-converting NEXT POST PLAN specifically for the product mentioned above. Use the account context and niche strategy to ensure it aligns with what works for this audience. Include currently trending tags (both overall and niche-specific) along with relevant account tags in the "hashtags" field.

OUTPUT: Return ONLY a JSON object with the key "next_post_plan".
Structure:
{
  "next_post_plan": {
    "topic": "Topic Title",
    "type": "Video | Image",
    "time": "HH:MM",
    "hook": "Compelling hook line",
    "cta": "Specific call to action",
    "caption": "Full high-converting caption text",
    "hashtags": ["tag1", "tag2", "tag3"]
  }
}`;

    if (dryRun) {
      return res.json({ dryRun: true, prompt });
    }

    try {
      const aiResult = await callAI(prompt, true);
      return res.json({
        next_post_plan: aiResult.data.next_post_plan,
        usage: aiResult.usage
      });
    } catch (err: any) {
      console.error("[SpecificPlan] generation failed:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Dedicated analysis-only endpoint
  app.post("/api/analyze-existing", async (req, res) => {
    console.log("[Strategy] Request received. DryRun:", req.body.dryRun);
    let { userProfile, summaryData, playbook, dryRun, posts } = req.body;

    if (!userProfile) return res.status(400).json({ error: "UserProfile missing" });

    if (!summaryData) {
      if (posts && Array.isArray(posts)) {
        console.log("[Strategy] SummaryData missing, rebuilding from posts...");
        summaryData = buildSummaryData(posts);
      } else {
        return res.status(400).json({ error: "Data missing (summaryData or posts required)" });
      }
    }

    // 0. Detect Niche if missing (crucial for existing data loads)
    const effectivePlaybook = playbook || detectNiche(userProfile).playbook;

    // 1. Re-calculate baseline insights if needed or just prepare for AI
    const followers = userProfile.followersCount || 0;
    const basicInsights = computeBasicInsights(summaryData, followers, effectivePlaybook);

    const postMixStr = `${basicInsights.account_summary.image_count} Images, ${basicInsights.account_summary.reel_count} Reels`;
    const accountSnapshot = `@${userProfile.username} | Niche: ${effectivePlaybook?.nicheLabel || 'Fashion'} | Followers: ${followers} | Avg Likes: ${basicInsights.account_summary.avg_likes} | Avg Views: ${basicInsights.account_summary.avg_views} | Best Hour: ${basicInsights.account_summary.best_hour} | Account Score: ${basicInsights.account_score}/100 | Buyer Intent: ${basicInsights.buyer_intent_score}% | Post Mix: ${postMixStr}`;

    const sortedSummaryPosts = [...summaryData].sort((a, b) => {
      const scoreA = a.type === "Video" ? a.view_count : a.like_count + a.comments_count;
      const scoreB = b.type === "Video" ? b.view_count : b.like_count + b.comments_count;
      return scoreB - scoreA;
    });
    const top5 = sortedSummaryPosts.slice(0, 5);
    const bottom3 = sortedSummaryPosts.slice(Math.max(sortedSummaryPosts.length - 3, 5));

    const formatPost = (p: any, type: string) => {
      const avgViews = basicInsights.account_summary.avg_views;
      const tier = (p.view_count || 0) > (avgViews * 1.5) ? "VIRAL" : (p.view_count || 0) < (avgViews * 0.5) ? "POOR" : "AVERAGE";
      return `[${type}] ${p.type} | Likes:${p.like_count || 0} | Views:${p.view_count || 0} | Hook: "${p.hook_text}" | Tier: ${tier}`;
    };

    const topPostsSummary = `TOP POSTS: ${top5.map((p, i) => formatPost(p, String(i + 1))).join(" ")} WORST POSTS: ${bottom3.map((p, i) => formatPost(p, String(top5.length + i + 1))).join(" ")}`;
    const playbookBlock = `PLAYBOOK [${effectivePlaybook?.nicheLabel}]: SIGNALS: ${effectivePlaybook?.signals?.join(" | ")}. ACTIONS: ${effectivePlaybook?.priorityActions?.slice(0, 3).join(" | ")}.`;

    const prompt = `You are a Social Media Growth Strategist.
ACCOUNT: ${accountSnapshot}
POSTS: ${topPostsSummary}
${playbookBlock}

TASK: Return JSON with keys: next_post_plan, advanced_analysis, action_cards.
BE SPECIFIC TO THIS STORE. NO PLACEHOLDERS.`;

    if (dryRun) {
      return res.json({ dryRun: true, prompt });
    }

    try {
      const aiResult = await callAI(prompt, true);
      return res.json({
        insights: {
          ...basicInsights,
          ...aiResult.data
        },
        aiUsed: true,
        usage: aiResult.usage
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
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
