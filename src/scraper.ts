import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Scrapes an Instagram profile using Scrapling (Open Source).
 * This is a plug-and-play replacement for Apify using a local Python engine.
 * 
 * @param username The Instagram username to scrape.
 * @returns An array of scraped items (posts/reels).
 */
function runPythonScraper(
    pythonScript: string,
    username: string,
    cookiePathOrNone: string,
    contentType: string,
    count: number,
    includeComments: boolean
): Promise<string> {
    return new Promise((resolve, reject) => {
        const args = [
            pythonScript,
            username,
            cookiePathOrNone,
            contentType,
            String(count),
            includeComments ? "1" : "0",
        ];

        let stdout = "";
        let stderr = "";

        const child = spawn("python3", args, {
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
        });

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
            const line = chunk.toString();
            stderr += line;
            process.stderr.write(line);
        });

        child.on("error", (err) => {
            reject(err);
        });

        child.on("close", (code) => {
            if (code !== 0) {
                return reject(new Error(`Python scraper exited with code ${code}. ${stderr}`));
            }
            resolve(stdout);
        });
    });
}

export async function scrapeInstagramProfile(
    username: string,
    contentType: string = 'all',
    count: number = 12,
    includeComments: boolean = true
): Promise<any[]> {
    console.log(`[Scrapling] Starting data extraction for: ${username} (Type: ${contentType}, Count: ${count}, Comments: ${includeComments})`);

    // Attempt to locate standard cookie file
    const cookiePath = path.resolve('instagram_cookies.json');
    const pythonScript = path.resolve('src', 'instagram_scrapling.py');

    try {
        const cookieArg = fs.existsSync(cookiePath) ? cookiePath : "NONE";
        console.log(`[Scrapling] Executing python scraper...`);
        const stdout = await runPythonScraper(
            pythonScript,
            username,
            cookieArg,
            contentType,
            count,
            includeComments
        );

        if (!stdout || stdout.trim() === "") {
            console.warn(`[Scrapling] Empty output from python script.`);
            return [];
        }

        const items = JSON.parse(stdout.trim());
        const resultItems = Array.isArray(items) ? items : [items];

        // If the result is just the basic HTML fallback (no 'type' field meaning no post data extracted)
        // or empty, trigger Apify fallback
        if (resultItems.length === 0 || (resultItems.length === 1 && !resultItems[0].type)) {
            console.warn(`[Scrapling] Only basic metadata extracted (likely 302 login wall). Triggering Apify fallback...`);
            return await scrapeWithApify(username, count);
        }

        return resultItems;

    } catch (error: any) {
        console.error(`[Scraper] Scrapling engine failed:`, error.message);
        console.log(`[Scraper] Falling back to Apify due to Scrapling failure...`);
        return await scrapeWithApify(username, count);
    }
}

/**
 * Fallback scraping using official Apify API
 */
async function scrapeWithApify(username: string, count: number): Promise<any[]> {
    console.log(`[Apify] Starting fallback data extraction for: ${username}`);

    if (!process.env.APIFY_API_TOKEN) {
        throw new Error("Cannot run Apify fallback: APIFY_API_TOKEN is not defined in the environment.");
    }

    const client = new ApifyClient({
        token: process.env.APIFY_API_TOKEN,
    });

    const input = {
        usernames: [username],
        resultsLimit: count,
    };

    try {
        console.log(`[Apify] Calling apify/instagram-profile-scraper...`);
        const run = await client.actor("apify/instagram-profile-scraper").call(input);

        console.log(`[Apify] Fetching results from dataset ${run.defaultDatasetId}...`);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items || items.length === 0) {
            console.warn(`[Apify] No data returned from Apify.`);
            return [];
        }

        const profile: any = items[0];
        const posts = profile.latestPosts || [];
        const stories = profile.latestStories || [];

        console.log(`[Apify] Found ${posts.length} posts and ${stories.length} stories.`);

        // Map posts
        const formattedPosts = posts.map((post: any) => ({
            ...post,
            type: post.type || (post.isVideo ? "Video" : "Image"),
            ownerUsername: profile.username || profile.ownerUsername,
            ownerFullName: profile.fullName || profile.ownerFullName,
            followersCount: profile.followersCount,
            followsCount: profile.followsCount,
            postsCount: profile.postsCount,
            profilePicUrl: profile.profilePicUrl,
            businessCategoryName: profile.businessCategoryName,
            isBusinessAccount: profile.isBusinessAccount,
        }));

        // Map stories
        const formattedStories = stories.map((story: any) => ({
            ...story,
            type: "Story",
            ownerUsername: profile.username || profile.ownerUsername,
            ownerFullName: profile.fullName || profile.ownerFullName,
            followersCount: profile.followersCount,
            followsCount: profile.followsCount,
            postsCount: profile.postsCount,
            profilePicUrl: profile.profilePicUrl,
            businessCategoryName: profile.businessCategoryName,
            isBusinessAccount: profile.isBusinessAccount,
        }));

        const combinedItems = [...formattedPosts, ...formattedStories];

        // Respect the count requested limit
        const finalItems = combinedItems.slice(0, count);

        console.log(`[Apify] Extracted and formatted ${finalItems.length} items from Apify.`);
        return finalItems;
    } catch (err: any) {
        console.error(`[Apify] Fallback failed:`, err.message);
        throw new Error(`Both Scrapling and Apify fallback failed for ${username}: ${err.message}`);
    }
}
