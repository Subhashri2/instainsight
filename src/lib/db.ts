/**
 * db.ts
 * PocketBase database helper functions for persistent data storage.
 * Collections: profiles, posts, comments, analyses
 */

import PocketBase from "pocketbase";
import dotenv from "dotenv";

dotenv.config();

const POCKETBASE_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";

// Cache for the admin instance
let adminPbInstance: PocketBase | null = null;

/**
 * Get an Admin-authenticated PocketBase instance.
 * Using Admin (Superuser) context for server-side ingestion is the most reliable way 
 * to ensure relation fields (like user and profile) are correctly linked every time.
 */
async function getAdminPb(): Promise<PocketBase> {
    if (adminPbInstance && adminPbInstance.authStore.isValid) return adminPbInstance;

    const instance = new PocketBase(POCKETBASE_URL);
    instance.autoCancellation(false);

    const email = process.env.PB_ADMIN_EMAIL;
    const pass = process.env.PB_ADMIN_PASSWORD;

    if (!email || !pass) {
        console.warn("[DB] WARNING: PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD missing. Falling back to public context.");
        return instance;
    }

    try {
        // Try v0.23+ superuser auth first
        await instance.collection("_superusers").authWithPassword(email, pass);
    } catch {
        // Legacy admin fallback
        try {
            await instance.admins.authWithPassword(email, pass);
        } catch (err: any) {
            console.error("[DB] Admin authentication failed:", err.message);
        }
    }

    adminPbInstance = instance;
    return instance;
}

/**
 * Get a user-specific PB instance for reading data if needed.
 */
function getUserPb(token: string, userId: string): PocketBase {
    const instance = new PocketBase(POCKETBASE_URL);
    instance.autoCancellation(false);
    instance.authStore.save(token, {
        id: userId,
        collectionId: "_pb_users_auth_",
        collectionName: "users",
    } as any);
    return instance;
}

// ─── Profile Operations ───────────────────────────────────────────────────────

export interface ProfileData {
    ig_username: string;
    full_name: string;
    followers_count: number;
    following_count: number;
    posts_count: number;
    profile_pic_url: string;
    category_name: string;
    biography: string;
}

export async function saveProfile(userId: string, profileData: ProfileData) {
    const pb = await getAdminPb();

    try {
        const existing = await pb.collection("profiles").getList(1, 1, {
            filter: `user = "${userId}" && ig_username = "${profileData.ig_username}"`,
        });

        const payload = {
            user: userId,
            ...profileData,
        };

        if (existing.items.length > 0) {
            return await pb.collection("profiles").update(existing.items[0].id, payload);
        } else {
            return await pb.collection("profiles").create(payload);
        }
    } catch (err: any) {
        console.error("[DB] saveProfile failed:", err.message);
        throw err;
    }
}

// ─── Post Operations ──────────────────────────────────────────────────────────

export interface PostData {
    ig_post_id: string;
    short_code: string;
    type: string;
    caption: string;
    likes_count: number;
    comments_count: number;
    video_view_count: number;
    play_count: number;
    save_count: number;
    share_count: number;
    display_url: string;
    timestamp: string;
    hashtags: string[];
    url: string;
    duration: number;
    music_info: string | null;
    tagged_users: string[];
}

export async function savePosts(userId: string, profileId: string, posts: PostData[]) {
    const pb = await getAdminPb();
    let newCount = 0;
    let updatedCount = 0;

    try {
        const existingRecords = await pb.collection("posts").getFullList({
            filter: `user = "${userId}" && profile = "${profileId}"`,
            fields: "id,ig_post_id"
        });

        const existingMap = new Map(existingRecords.map((r: any) => [r.ig_post_id, r]));

        for (const post of posts) {
            const existing = existingMap.get(post.ig_post_id) as any;
            const payload = {
                user: userId,
                profile: profileId,
                ...post,
            };

            if (existing) {
                await pb.collection("posts").update(existing.id, payload);
                updatedCount++;
            } else {
                await pb.collection("posts").create(payload);
                newCount++;
            }
        }
    } catch (err: any) {
        console.error("[DB] savePosts failed:", err.message);
    }

    return { newCount, updatedCount };
}

// ─── Comment Operations ───────────────────────────────────────────────────────

export interface CommentData {
    text: string;
    owner_username: string;
}

export async function saveComments(userId: string, profileId: string, postRecordId: string, comments: CommentData[]) {
    const pb = await getAdminPb();
    let savedCount = 0;
    let skippedCount = 0;

    try {
        // Fetch existing comments for this post to avoid duplicates
        // Note: Using getFullList on a post's comments is usually safe as top posts rarely have >10,000 comments fetched at once.
        const existingComments = await pb.collection("comments").getFullList({
            filter: `post = "${postRecordId}"`,
            fields: "owner_username,text"
        });

        // Create a simple lookup key: username + text
        const existingMap = new Set(existingComments.map(c => `${c.owner_username}:${c.text}`));

        for (const comment of comments) {
            if (!comment.text?.trim()) continue;

            const commentKey = `${comment.owner_username || "unknown"}:${comment.text}`;
            if (existingMap.has(commentKey)) {
                skippedCount++;
                continue;
            }

            try {
                await pb.collection("comments").create({
                    "user": String(userId),
                    "profile": String(profileId),
                    "post": String(postRecordId),
                    "text": comment.text,
                    "owner_username": comment.owner_username || "unknown",
                });
                savedCount++;
                // Add to map to prevent duplicates within the same batch if any
                existingMap.add(commentKey);
            } catch (err: any) {
                console.error(`[DB] saveComments individual error:`, err.message);
                if (err.data) console.error(`[DB] Error Data:`, JSON.stringify(err.data));
            }
        }
    } catch (err: any) {
        console.error(`[DB] saveComments batch error:`, err.message);
    }

    console.log(`[DB] saveComments: ${savedCount} saved, ${skippedCount} skipped (duplicates)`);
    return savedCount;
}

// ─── Analysis Operations ──────────────────────────────────────────────────────

export interface AnalysisData {
    insights: any;
    ai_response: any;
    action_cards: any[];
    next_post_plan: any;
}

export async function saveAnalysis(userId: string, profileId: string, analysisData: AnalysisData) {
    const pb = await getAdminPb();

    try {
        // Simple deduplication: Check if an analysis for this user+profile was created in the last 60 seconds
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString().replace('T', ' ').split('.')[0];
        const recent = await pb.collection("analyses").getList(1, 1, {
            filter: `user = "${userId}" && profile = "${profileId}" && created >= "${oneMinuteAgo}"`,
        });

        if (recent.items.length > 0) {
            console.log(`[DB] saveAnalysis: Skipped (already saved an analysis for this profile in the last 60 seconds)`);
            return recent.items[0];
        }

        return await pb.collection("analyses").create({
            user: userId,
            profile: profileId,
            insights: analysisData.insights,
            ai_response: analysisData.ai_response,
            action_cards: analysisData.action_cards,
            next_post_plan: analysisData.next_post_plan,
        });
    } catch (err: any) {
        console.error("[DB] saveAnalysis failed:", err.message);
        throw err;
    }
}

// ─── Fetching (User Scoped) ───────────────────────────────────────────────────

export async function getAnalyses(userId: string, token: string) {
    const pb = getUserPb(token, userId);

    try {
        const records = await pb.collection("analyses").getList(1, 50, {
            filter: `user = "${userId}"`,
            sort: "-id",
            expand: "profile",
        });
        
        return await Promise.all(records.items.map(async (item) => {
            let profileRecord = (item.expand as any)?.profile;
            const profileId = Array.isArray((item as any).profile) ? (item as any).profile[0] : (item as any).profile;

            // Fallback: if expand didn't populate the profile (e.g. API rule issue), fetch it directly
            if (!profileRecord && profileId) {
                try {
                    profileRecord = await pb.collection("profiles").getOne(profileId);
                } catch {
                    // profile fetch failed, continue with undefined
                }
            }

            let normalizedPosts: any[] = [];
            if (profileId) {
                try {
                    const postRecords = await pb.collection("posts").getFullList({
                        filter: `user = "${userId}" && profile = "${profileId}"`,
                        sort: "-timestamp",
                    });
                    normalizedPosts = postRecords.map((p: any) => ({
                        id: p.ig_post_id || p.id,
                        caption: p.caption || "",
                        likesCount: p.likes_count || 0,
                        commentsCount: p.comments_count || 0,
                        videoViewCount: p.video_view_count || 0,
                        displayUrl: p.display_url || "",
                        timestamp: p.timestamp || "",
                        type: p.type || "Image",
                        hashtags: p.hashtags || [],
                        videoDuration: p.duration || 0,
                        music_info: p.music_info || null,
                        tagged_users: p.tagged_users || [],
                    }));
                } catch {
                    normalizedPosts = [];
                }
            }

            if (profileRecord) {
                // Ensure we handle both snake_case (DB) and camelCase (sometimes in expanded objects)
                // and the naming mismatch between followsCount/followingCount
                const p = profileRecord;
                return {
                    id: item.id,
                    created: item.created,
                    ig_username: item.ig_username || p.ig_username || p.username || "unknown",
                    profile_pic_url: p.profile_pic_url || p.profilePicUrl || "",
                    profile: {
                        full_name: p.full_name || p.fullName || "",
                        followers_count: Number(p.followers_count ?? p.followersCount ?? 0),
                        following_count: Number(p.following_count ?? p.followingCount ?? p.follows_count ?? p.followsCount ?? 0),
                        posts_count: Number(p.posts_count ?? p.postsCount ?? p.postCount ?? 0),
                        category_name: p.category_name || p.businessCategoryName || p.categoryName || "",
                        biography: p.biography || p.bio || "",
                    },
                    posts: normalizedPosts,
                    insights: typeof item.insights === "string" ? JSON.parse(item.insights) : item.insights,
                    action_cards: typeof item.action_cards === "string" ? JSON.parse(item.action_cards) : item.action_cards,
                    next_post_plan: typeof item.next_post_plan === "string" ? JSON.parse(item.next_post_plan) : item.next_post_plan,
                };
            }

            // Fallback if no profile record found
            return {
                id: item.id,
                created: item.created,
                ig_username: item.ig_username || "unknown",
                profile_pic_url: "",
                profile: {
                    full_name: "",
                    followers_count: 0,
                    following_count: 0,
                    posts_count: 0,
                    category_name: "",
                    biography: "",
                },
                posts: normalizedPosts,
                insights: typeof item.insights === "string" ? JSON.parse(item.insights) : item.insights,
                action_cards: typeof item.action_cards === "string" ? JSON.parse(item.action_cards) : item.action_cards,
                next_post_plan: typeof item.next_post_plan === "string" ? JSON.parse(item.next_post_plan) : item.next_post_plan,
            };
        }));
    } catch (err: any) {
        console.error("[DB] getAnalyses failed:", err.message);
        return [];
    }
}

export async function getExistingPostIds(userId: string, profileId: string, token: string): Promise<string[]> {
    const pb = getUserPb(token, userId);
    try {
        const records = await pb.collection("posts").getList(1, 1000, {
            filter: `user = "${userId}" && profile = "${profileId}"`,
            fields: "ig_post_id",
        });
        return records.items.map((item) => (item as any).ig_post_id);
    } catch {
        return [];
    }
}

export async function getPostRecordId(userId: string, profileId: string, igPostId: string, token: string): Promise<string | null> {
    const pb = getUserPb(token, userId);
    try {
        const records = await pb.collection("posts").getList(1, 1, {
            filter: `user = "${userId}" && profile = "${profileId}" && ig_post_id = "${igPostId}"`,
        });
        return records.items.length > 0 ? records.items[0].id : null;
    } catch {
        return null;
    }
}
