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
      // Added proxyConfiguration to avoid BLOCKED errors and removed conflicting search parameters
      const run = await client.actor("apify/instagram-scraper").call({
          usernames: [username],
          resultsType: "posts",
          resultsLimit: 20,
          proxyConfiguration: {
              useApifyProxy: true,
              groups: ['RESIDENTIAL'] // Residential proxies are less likely to be blocked
          }
      });

      console.log(`Apify run finished. Fetching dataset: ${run.defaultDatasetId}`);
      let { items } = await client.dataset(run.defaultDatasetId).listItems();
      
      // Filter for Reels (Videos) as requested
      items = items.filter((item: any) => item.type === 'Video' || item.type === 'Sidecar' || item.isReel === true);

      if (!items || items.length === 0) {
         return res.status(404).json({ 
           error: "No Reels found.",
           details: "The scraper couldn't find any Reels for this username. They might only have static images or a private profile."
         });
      }

      const summaryData = items.map((item: any) => ({
          type: item.type,
          likes: item.likesCount,
          comments: item.commentsCount,
          videoViews: item.videoViewCount,
          timestamp: item.timestamp,
          caption: item.caption ? item.caption.substring(0, 100) : "",
      }));

      res.json({
          posts: items,
          summaryData: summaryData
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
