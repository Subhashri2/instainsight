import express from "express";
import { createServer as createViteServer } from "vite";
import { ApifyClient } from 'apify-client';
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/insights", async (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    if (!process.env.APIFY_API_TOKEN) {
      return res.status(500).json({ error: "APIFY_API_TOKEN is not configured on the server. Please add it to your environment variables." });
    }

    try {
      const client = new ApifyClient({
        token: process.env.APIFY_API_TOKEN,
      });

      console.log(`Starting Apify actor for username: ${username}`);
      // Switched to 'apify/instagram-profile-scraper' as requested
      // This actor handles proxies and cookies internally for better reliability
      const run = await client.actor("apify/instagram-profile-scraper").call({
        usernames: [username],
      });

      console.log(`Apify run finished. Fetching dataset: ${run.defaultDatasetId}`);
      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      if (!items || items.length === 0) {
        return res.status(404).json({
          error: "User not found or profile is private.",
          details: "The profile scraper couldn't find any data for this username."
        });
      }

      // Handle the structure of instagram-profile-scraper
      // It typically returns profile objects which may contain latestPosts
      let posts = [];
      const profile = items[0];

      if (profile.latestPosts && Array.isArray(profile.latestPosts)) {
        posts = profile.latestPosts;
      } else if (items.length > 1 || (items[0] && items[0].type)) {
        // If items are already posts (some configurations/versions)
        posts = items;
      }

      // Filter for Reels (Videos) if possible, otherwise use what we have
      let filteredPosts = posts.filter((item: any) => item.type === 'Video' || item.isReel === true || item.productType === 'clips');

      // If no reels found but we have posts, maybe the type naming is different or we should just show posts
      if (filteredPosts.length === 0 && posts.length > 0) {
        filteredPosts = posts;
      }

      if (filteredPosts.length === 0) {
        return res.status(404).json({
          error: "No posts found.",
          details: "The scraper found the profile but couldn't retrieve any recent posts or Reels."
        });
      }

      const summaryData = filteredPosts.slice(0, 20).map((item: any) => ({
        type: item.type || item.productType,
        likes: item.likesCount || item.displayResources?.[0]?.config_width, // Fallback or specific field
        comments: item.commentsCount,
        videoViews: item.videoViewCount || item.videoPlayCount,
        timestamp: item.timestamp,
        caption: item.caption ? item.caption.substring(0, 100) : "",
      }));

      res.json({
        posts: filteredPosts.slice(0, 20),
        summaryData: summaryData,
        profile: profile
      });

    } catch (error: any) {
      console.error("Error fetching Instagram data:", error);
      const status = error.status || 500;
      const message = error.message || "Failed to fetch Instagram data";

      res.status(status).json({
        error: "Scraping failed",
        details: message,
        suggestion: "Please verify your Apify API token and try again later."
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
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
