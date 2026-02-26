import express from "express";
import { createServer as createViteServer } from "vite";
import { ApifyClient } from 'apify-client';
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

dotenv.config();

// ─── Load instruction markdown files once at startup ─────────────────────────
const loadFile = (filePath: string) => {
  try { return fs.readFileSync(path.resolve(filePath), "utf-8"); }
  catch { return ""; }
};
const brain = loadFile("src/brain.md");
const instruction = loadFile("src/instruction.md");
const analysis = loadFile("src/analysis_instruction.md");

// ─── AI call helper: tries providers in order ────────────────────────────────
async function callAI(prompt: string): Promise<any> {
  const hfKey = process.env.HF_TOKEN || process.env.HF_API_KEY || "";

  // 1. Gemini
  if (process.env.GEMINI_API_KEY) {
    console.log("AI Provider: Gemini");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    let txt = result.response.text();
    if (txt.includes("```json")) txt = txt.split("```json")[1].split("```")[0];
    else if (txt.includes("```")) txt = txt.split("```")[1].split("```")[0];
    return JSON.parse(txt.trim());
  }

  // 2. Real Groq key (starts with gsk_)
  if (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.startsWith("hf_")) {
    console.log("AI Provider: Groq (direct)");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
    });
    return JSON.parse(completion.choices[0]?.message?.content || "{}");
  }

  // 3. HF Router → Groq (free HF key, no Groq account needed)
  if (hfKey) {
    console.log("AI Provider: HF Router → Groq (llama-3.3-70b)");
    const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/Llama-3.3-70B-Instruct:groq",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`HF Router error (${res.status}): ${errText.substring(0, 200)}`);
      // Fall through to fallback
    } else {
      const data: any = await res.json();
      let txt: string = data.choices?.[0]?.message?.content || "{}";
      if (txt.includes("```json")) txt = txt.split("```json")[1].split("```")[0];
      else if (txt.includes("```")) txt = txt.split("```")[1].split("```")[0];
      return JSON.parse(txt.trim());
    }
  }

  throw new Error("No valid AI provider found. Set GEMINI_API_KEY, GROQ_API_KEY, or HF_API_KEY.");
}

// ─── Compute a basic fallback dashboard from raw post data ───────────────────
function computeBasicInsights(summaryData: any[]) {
  const total = summaryData.length;
  if (total === 0) return {};

  const avgLikes = Math.round(summaryData.reduce((s, p) => s + p.like_count, 0) / total);
  const avgComments = Math.round(summaryData.reduce((s, p) => s + p.comments_count, 0) / total);
  const avgViews = Math.round(summaryData.reduce((s, p) => s + p.view_count, 0) / total);

  // Engagement = (likes + comments*2) / max(views, 1)
  const scored = summaryData.map(p => ({
    ...p,
    eng: (p.like_count + p.comments_count * 2) / Math.max(p.view_count, 1),
  }));
  scored.sort((a, b) => b.eng - a.eng);

  const engRate = avgViews > 0
    ? `${(((avgLikes + avgComments) / avgViews) * 100).toFixed(2)}%`
    : "N/A";

  // Best posting hour
  const hourCounts: Record<number, number> = {};
  summaryData.forEach(p => {
    if (p.timestamp) {
      const h = new Date(p.timestamp).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
  });
  const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "12";

  // Top hashtags
  const hashtagCount: Record<string, number> = {};
  summaryData.forEach(p => (p.hashtags || []).forEach((h: string) => { hashtagCount[h] = (hashtagCount[h] || 0) + 1; }));
  const topHashtags = Object.entries(hashtagCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

  return {
    _computed: true,  // flag so frontend knows this is math-only
    dashboard: {
      growth_score: Math.min(100, Math.round((avgLikes / 500) * 100)),
      engagement_rate_avg: engRate,
      viral_potential_score: Math.min(100, Math.round((avgViews / Math.max(avgLikes, 1)) * 1.5)),
      best_performing_post: scored[0] || {},
      worst_performing_post: scored[scored.length - 1] || {},
    },
    account_summary: {
      total_posts_analyzed: total,
      avg_likes: avgLikes,
      avg_comments: avgComments,
      avg_views: avgViews,
      top_hashtags: topHashtags,
      best_hour: `${bestHour}:00`,
    },
    advanced_analysis: {
      post_classifications: scored.map((p, i) => ({
        ...p,
        tier: i < Math.ceil(total * 0.25) ? "viral" : i < Math.ceil(total * 0.75) ? "average" : "poor",
      })),
      growth_opportunities: [
        `Post around ${bestHour}:00 for best engagement.`,
        `Top hashtags: ${topHashtags.slice(0, 3).join(", ") || "N/A"}`,
        `Average views: ${avgViews.toLocaleString()} — aim for consistency first.`,
      ],
    },
    reel_suggestions: [
      {
        title: "Content Strategy Insight",
        hook: "Here's what your top posts have in common...",
        duration: "15-30s",
        hashtags: topHashtags,
        why_it_works: "Based purely on engagement patterns. Run AI analysis for deeper suggestions.",
      }
    ],
  };
}

// ─── Express Server ───────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  app.post("/api/insights", async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username is required" });
    if (!process.env.APIFY_API_TOKEN) {
      return res.status(500).json({ error: "APIFY_API_TOKEN is not configured." });
    }

    try {
      const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

      // ── STEP 1: Scrape 10 latest posts + reels ──────────────────────────
      console.log(`[Apify] Scraping posts for: ${username}`);
      const run = await client.actor("apify/instagram-scraper").call({
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: "posts",
        resultsLimit: 10,
        addParentData: false,
      });

      console.log(`[Apify] Run done. Dataset: ${run.defaultDatasetId}`);
      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      if (!items || items.length === 0) {
        return res.status(404).json({
          error: "No posts found or profile is private.",
          details: "The scraper couldn't find any recent posts for this username.",
          suggestion: "Check that the account is public and the username is correct.",
        });
      }

      // ── STEP 2: Normalize posts ─────────────────────────────────────────
      const normalizedPosts = items.map((item: any) => ({
        ...item,
        likesCount: item.likesCount ?? item.likes ?? item.like_count ?? 0,
        commentsCount: item.commentsCount ?? item.comments ?? item.comment_count ?? 0,
        videoViewCount: item.videoViewCount ?? item.videoPlayCount ?? item.views ?? item.video_view_count ?? 0,
        displayUrl: item.displayUrl || item.thumbnailUrl || item.previewUrl || item.url,
        type: item.type || (item.isVideo ? "Video" : "Image"),
        timestamp: item.timestamp ?? item.taken_at_timestamp,
      }));

      const summaryData = normalizedPosts.map((item: any) => ({
        type: item.type,
        like_count: item.likesCount,
        comments_count: item.commentsCount,
        view_count: item.videoViewCount,
        save_count: item.saveCount ?? 0,
        share_count: item.shareCount ?? 0,
        timestamp: item.timestamp,
        caption: (item.caption || "").substring(0, 200),
        hashtags: item.hashtags || [],
        duration: item.videoDuration || 0,
      }));

      // ── STEP 3: Compute instant math-based dashboard ─────────────────────
      const basicInsights = computeBasicInsights(summaryData);
      console.log(`[Data] Computed basic dashboard for ${summaryData.length} posts.`);

      // ── STEP 4: AI Analysis (best-effort, fallback to math dashboard) ────
      let aiInsights: any = null;
      console.log("[AI] Starting AI analysis...");

      const prompt = `You are an expert Instagram growth analyst. Analyze the following data and return a structured JSON object.

DATA (${summaryData.length} recent posts/reels):
${JSON.stringify(summaryData, null, 2)}

Return ONLY a valid JSON object with this exact structure:
{
  "dashboard": {
    "growth_score": <0-100>,
    "engagement_rate_avg": "<X.XX%>",
    "viral_potential_score": <0-100>,
    "best_performing_post": { "like_count": 0, "view_count": 0, "caption": "" },
    "worst_performing_post": { "like_count": 0, "view_count": 0, "caption": "" }
  },
  "account_summary": {
    "total_posts_analyzed": ${summaryData.length},
    "avg_likes": 0,
    "avg_comments": 0,
    "avg_views": 0,
    "top_hashtags": [],
    "best_hour": ""
  },
  "advanced_analysis": {
    "post_classifications": [{ "type": "", "tier": "viral|average|poor", "engagement_score": 0 }],
    "growth_opportunities": ["<actionable insight 1>", "<actionable insight 2>", "<actionable insight 3>"]
  },
  "reel_suggestions": [
    { "title": "", "hook": "", "duration": "", "hashtags": [], "why_it_works": "" },
    { "title": "", "hook": "", "duration": "", "hashtags": [], "why_it_works": "" },
    { "title": "", "hook": "", "duration": "", "hashtags": [], "why_it_works": "" }
  ]
}

No markdown, no explanation. JSON only.`;

      try {
        aiInsights = await callAI(prompt);
        console.log("[AI] Analysis complete.");
      } catch (aiErr: any) {
        console.warn("[AI] Failed, falling back to computed insights:", aiErr.message);
        aiInsights = null;
      }

      // Return posts + best available insights
      return res.json({
        posts: normalizedPosts,
        insights: aiInsights ?? basicInsights,
        aiUsed: !!aiInsights,
      });

    } catch (error: any) {
      console.error("[Error]", error);
      return res.status(500).json({
        error: "Analysis failed",
        details: error.message,
        suggestion: "Please verify your API keys and try again.",
      });
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
