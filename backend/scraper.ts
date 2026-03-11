import "./env.js";
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ApifyClient } from 'apify-client';

function envFlag(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined || value === null || value === "") return defaultValue;
    const v = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(v)) return true;
    if (["0", "false", "no", "off"].includes(v)) return false;
    return defaultValue;
}

function readFlag(names: string[], defaultValue: boolean): boolean {
    for (const n of names) {
        if (process.env[n] !== undefined) return envFlag(process.env[n], defaultValue);
    }
    return defaultValue;
}

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
    includeComments: boolean,
    existingPostIds: string[] = [],
    scrapeMode: string = "advanced"
): Promise<string> {
    return new Promise((resolve, reject) => {
        const args = [
            pythonScript,
            username,
            cookiePathOrNone,
            contentType,
            String(count),
            includeComments ? "1" : "0",
            existingPostIds.length > 0 ? existingPostIds.join(',') : "NONE",
            scrapeMode
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
    includeComments: boolean = true,
    existingPostIds: string[] = []
): Promise<any[]> {
    const scraplingEnabled = readFlag(["SCRAPLING_ENABLE", "SCRAPLING_ENABLED"], true);
    const apifyEnabled = readFlag(["APIFY_ENABLE", "APIFY_ENABLED"], true);
    const legacyStableMode = String(process.env.SCRAPLING_LEGACY_STABLE_MODE || "0") === "1";
    const advancedMode = String(process.env.SCRAPLING_ADVANCED_MODE || "1") !== "0";
    const apifyFallbackAllowed = envFlag(process.env.SCRAPLING_ENABLE_APIFY_FALLBACK, true);
    const apifyFallbackEnabled = apifyEnabled && apifyFallbackAllowed;
    const scrapeMode = legacyStableMode ? "legacy" : (advancedMode ? "advanced" : "legacy");

    console.log(`[Scrapling] Starting data extraction for: ${username} (Type: ${contentType}, Count: ${count}, Comments: ${includeComments}, Existing: ${existingPostIds.length})`);
    console.log(
        `[Scrapling] Modes => scrapling=${scraplingEnabled ? "on" : "off"}, ` +
        `legacy_stable=${legacyStableMode ? "on" : "off"}, advanced=${advancedMode ? "on" : "off"}, ` +
        `apify=${apifyEnabled ? "on" : "off"}, apify_fallback=${apifyFallbackEnabled ? "on" : "off"}`
    );

    if (!scraplingEnabled && !apifyEnabled) {
        throw new Error("Invalid scraper config: both SCRAPLING_ENABLE and APIFY_ENABLE are off.");
    }
    if (!scraplingEnabled && apifyEnabled) {
        console.log(`[Scrapling] SCRAPLING_ENABLE=0, using Apify directly.`);
        return await scrapeWithApify(username, count, includeComments);
    }

    // Attempt to locate standard cookie file
    const cookiePath = path.resolve('instagram_cookies.json');
    const pythonScript = path.resolve('backend', 'instagram_scrapling.py');

    try {
        const cookieArg = fs.existsSync(cookiePath) ? cookiePath : "NONE";
        console.log(`[Scrapling] Executing python scraper...`);
        const stdout = await runPythonScraper(
            pythonScript,
            username,
            cookieArg,
            contentType,
            count,
            includeComments,
            existingPostIds,
            scrapeMode
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
            if (apifyFallbackEnabled) {
                console.warn(`[Scrapling] Only basic metadata extracted (likely 302 login wall). Triggering Apify fallback...`);
                try {
                    return await scrapeWithApify(username, count, includeComments);
                } catch (apifyError: any) {
                    throw new Error(
                        `Scrapling returned no usable posts and Apify fallback failed for ${username}: ${apifyError?.message || apifyError}`
                    );
                }
            }
            console.warn(`[Scrapling] Only basic metadata extracted and Apify fallback is OFF.`);
            return [];
        }

        return resultItems;

    } catch (error: any) {
        const scraplingMessage = error?.message || String(error);
        console.warn(`[Scraper] Scrapling failed. Trying Apify fallback... (${scraplingMessage})`);
        if (apifyFallbackEnabled) {
            try {
                return await scrapeWithApify(username, count, includeComments);
            } catch (apifyError: any) {
                const apifyMessage = apifyError?.message || String(apifyError);
                throw new Error(
                    `Both Scrapling and Apify fallback failed for ${username}. ` +
                    `Scrapling error: ${scraplingMessage}. Apify error: ${apifyMessage}`
                );
            }
        }
        throw error;
    }
}

/**
 * Fallback scraping using official Apify API
 */
async function scrapeWithApify(username: string, count: number, includeComments: boolean): Promise<any[]> {
    console.log(`[Apify] Starting fallback data extraction for: ${username} (Count: ${count}, Comments: ${includeComments})`);

    if (!process.env.APIFY_API_TOKEN) {
        throw new Error("Cannot run Apify fallback: APIFY_API_TOKEN is not defined in the environment.");
    }

    const client = new ApifyClient({
        token: process.env.APIFY_API_TOKEN,
    });

    // Use apify/instagram-scraper instead of profile scraper to get exactly N items including reels
    const input = {
        "directUrls": [`https://www.instagram.com/${username}/`],
        "resultsLimit": count,
        "resultsType": "posts",
        "searchType": "user",
        "searchLimit": 1,
        "addParentData": true, // This ensures we get followersCount, biography etc.
        "includeComments": includeComments,
    };

    try {
        console.log(`[Apify] Calling apify/instagram-scraper...`);
        const run = await client.actor("apify/instagram-scraper").call(input);

        console.log(`[Apify] Fetching results from dataset ${run.defaultDatasetId}...`);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items || items.length === 0) {
            console.warn(`[Apify] No data returned from Apify.`);
            return [];
        }

        console.log(`[Apify] Found ${items.length} items.`);

        // Map items to our internal format
        const formattedItems = items.map((item: any) => {
            const owner = item.owner || {};
            // Instagram Scraper labels Reels as 'Video' or sometimes 'clips' in productType
            let type = item.type || (item.productType === 'clips' ? 'Video' : (item.isVideo ? "Video" : "Image"));
            
            return {
                ...item,
                type: type,
                ownerUsername: item.ownerUsername || owner.username || username,
                ownerFullName: item.ownerFullName || owner.fullName || "",
                followersCount: item.followersCount ?? owner.followersCount ?? 0,
                followsCount: item.followsCount ?? owner.followsCount ?? 0,
                postsCount: item.postsCount ?? owner.postsCount ?? 0,
                profilePicUrl: item.profilePicUrl ?? owner.profilePicUrl ?? "",
                biography: item.biography ?? owner.biography ?? "",
                isBusinessAccount: item.isBusinessAccount ?? owner.isBusinessAccount ?? false,
                businessCategoryName: item.businessCategoryName ?? owner.businessCategoryName ?? "",
            };
        });

        return formattedItems.slice(0, count);
    } catch (err: any) {
        console.error(`[Apify] Fallback failed:`, err.message);
        throw new Error(`Apify fallback failed for ${username}: ${err.message}`);
    }
}
