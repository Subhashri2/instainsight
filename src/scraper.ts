import { execSync } from 'child_process';
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
export async function scrapeInstagramProfile(username: string, contentType: string = 'all', count: number = 12): Promise<any[]> {
    console.log(`[Scrapling] Starting data extraction for: ${username} (Type: ${contentType}, Count: ${count})`);

    // Attempt to locate standard cookie file
    const cookiePath = path.resolve('instagram_cookies.json');
    const pythonScript = path.resolve('src', 'instagram_scrapling.py');

    try {
        const cookieArg = fs.existsSync(cookiePath) ? ` "${cookiePath}"` : " NONE";
        // Passing arguments in order: username, cookiePath, contentType, count
        const cmd = `python "${pythonScript}" "${username}"${cookieArg} "${contentType}" ${count}`;

        console.log(`[Scrapling] Executing: ${cmd}`);

        // Use a large buffer to accommodate JSON output
        const stdout = execSync(cmd, {
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 10,
            stdio: ['ignore', 'pipe', 'inherit'] // pipe stdout, inherit stderr for easier debugging
        });

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

        // Map to flat structure so server.ts can parse it consistently with Scrapling
        const formattedItems = posts.map((post: any) => ({
            ...post,
            ownerUsername: profile.username || profile.ownerUsername,
            ownerFullName: profile.fullName || profile.ownerFullName,
            followersCount: profile.followersCount,
            followsCount: profile.followsCount,
            postsCount: profile.postsCount,
            profilePicUrl: profile.profilePicUrl,
            businessCategoryName: profile.businessCategoryName,
            isBusinessAccount: profile.isBusinessAccount,
        }));

        // Respect the count requested limit
        const finalItems = formattedItems.slice(0, count);

        console.log(`[Apify] Extracted and formatted ${finalItems.length} items from Apify.`);
        return finalItems;
    } catch (err: any) {
        console.error(`[Apify] Fallback failed:`, err.message);
        throw new Error(`Both Scrapling and Apify fallback failed for ${username}: ${err.message}`);
    }
}
