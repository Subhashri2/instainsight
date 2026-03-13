/**
 * db.ts
 * Supabase database helper functions for persistent data storage.
 * Tables: profiles, posts, comments, analyses
 */

import "../env.js";
import { supabaseAdmin } from "./supabase.ts";

const supabase = supabaseAdmin;

const safeParseJson = <T>(value: unknown, fallback: any = null): T | any => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value;
    }
  }
  return fallback;
};

const parseArrayField = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const stringifyIfNeeded = (value: any) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

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
  const payload = {
    user_id: userId,
    ...profileData,
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "user_id,ig_username" })
    .select()
    .single();

  if (error) {
    console.error("[DB] saveProfile failed:", error.message);
    throw new Error(error.message);
  }

  return data;
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
  if (posts.length === 0) return { newCount: 0, updatedCount: 0 };

  const { data: existingRecords } = await supabase
    .from("posts")
    .select("ig_post_id")
    .eq("user_id", userId)
    .eq("profile_id", profileId);

  const existingSet = new Set((existingRecords || []).map((r: any) => r.ig_post_id));

  let newCount = 0;
  let updatedCount = 0;

  const payload = posts.map((post) => {
    if (existingSet.has(post.ig_post_id)) updatedCount++; else newCount++;
    return {
      user_id: userId,
      profile_id: profileId,
      ...post,
      hashtags: stringifyIfNeeded(post.hashtags),
      tagged_users: stringifyIfNeeded(post.tagged_users),
      music_info: stringifyIfNeeded(post.music_info),
    };
  });

  const { error } = await supabase
    .from("posts")
    .upsert(payload, { onConflict: "user_id,profile_id,ig_post_id" });

  if (error) {
    console.error("[DB] savePosts failed:", error.message);
    throw new Error(error.message);
  }

  return { newCount, updatedCount };
}

// ─── Comment Operations ───────────────────────────────────────────────────────

export interface CommentData {
  text: string;
  owner_username: string;
}

export async function saveComments(userId: string, profileId: string, postRecordId: string, comments: CommentData[]) {
  if (comments.length === 0) return 0;

  const { data: existingComments, error: fetchError } = await supabase
    .from("comments")
    .select("owner_username,text")
    .eq("post_id", postRecordId);

  if (fetchError) {
    console.error("[DB] saveComments fetch failed:", fetchError.message);
    throw new Error(fetchError.message);
  }

  const existingMap = new Set((existingComments || []).map((c: any) => `${c.owner_username}:${c.text}`));

  const inserts = [] as any[];
  let savedCount = 0;

  for (const comment of comments) {
    if (!comment.text?.trim()) continue;
    const owner = comment.owner_username || "unknown";
    const key = `${owner}:${comment.text}`;
    if (existingMap.has(key)) continue;
    existingMap.add(key);
    inserts.push({
      user_id: userId,
      profile_id: profileId,
      post_id: postRecordId,
      text: comment.text,
      owner_username: owner,
    });
    savedCount++;
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from("comments").insert(inserts);
    if (error) {
      console.error("[DB] saveComments insert failed:", error.message);
      throw new Error(error.message);
    }
  }

  console.log(`[DB] saveComments: ${savedCount} saved, ${comments.length - savedCount} skipped (duplicates)`);
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
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

  const { data: recent } = await supabase
    .from("analyses")
    .select("id")
    .eq("user_id", userId)
    .eq("profile_id", profileId)
    .gte("created_at", oneMinuteAgo)
    .limit(1)
    .maybeSingle();

  if (recent) {
    console.log("[DB] saveAnalysis: Skipped duplicate within 60 seconds");
    return recent;
  }

  const payload = {
    user_id: userId,
    profile_id: profileId,
    insights: stringifyIfNeeded(analysisData.insights),
    ai_response: stringifyIfNeeded(analysisData.ai_response),
    action_cards: stringifyIfNeeded(analysisData.action_cards),
    next_post_plan: stringifyIfNeeded(analysisData.next_post_plan),
  };

  const { data, error } = await supabase.from("analyses").insert(payload).select().single();

  if (error) {
    console.error("[DB] saveAnalysis failed:", error.message);
    throw new Error(error.message);
  }

  return data;
}

// ─── Fetching (User Scoped) ───────────────────────────────────────────────────

export async function getAnalyses(userId: string) {
  const { data: analysisRecords, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[DB] getAnalyses failed:", error.message);
    return [];
  }

  const profileIds = Array.from(new Set((analysisRecords || []).map((a: any) => a.profile_id).filter(Boolean)));

  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("*").in("id", profileIds)
    : { data: [] } as any;

  const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));

  const { data: postsData } = profileIds.length
    ? await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .in("profile_id", profileIds)
    : { data: [] } as any;

  const postsByProfile = new Map<string, any[]>();
  (postsData || []).forEach((post: any) => {
    const arr = postsByProfile.get(post.profile_id) || [];
    arr.push(post);
    postsByProfile.set(post.profile_id, arr);
  });

  return (analysisRecords || []).map((item: any) => {
    const profileRecord = profileMap.get(item.profile_id) as any;
    const profileId = item.profile_id;
    const normalizedPosts = (postsByProfile.get(profileId) || [])
      .sort((a, b) => {
        const timeA = a.timestamp ?? "";
        const timeB = b.timestamp ?? "";
        return timeA > timeB ? -1 : timeA < timeB ? 1 : 0;
      })
      .map((p: any) => ({
        id: p.ig_post_id || p.id,
        caption: p.caption || "",
        likesCount: p.likes_count || 0,
        commentsCount: p.comments_count || 0,
        videoViewCount: p.video_view_count || 0,
        displayUrl: p.display_url || "",
        timestamp: p.timestamp || "",
        type: p.type || "Image",
        hashtags: parseArrayField(p.hashtags),
        videoDuration: p.duration || 0,
        music_info: safeParseJson(p.music_info),
        tagged_users: parseArrayField(p.tagged_users),
      }));

    const defaultProfile = {
      full_name: "",
      followers_count: 0,
      following_count: 0,
      posts_count: 0,
      category_name: "",
      biography: "",
    };

    const profileInfo = profileRecord
      ? {
          full_name: profileRecord.full_name || "",
          followers_count: Number(profileRecord.followers_count ?? 0),
          following_count: Number(profileRecord.following_count ?? 0),
          posts_count: Number(profileRecord.posts_count ?? 0),
          category_name: profileRecord.category_name || "",
          biography: profileRecord.biography || "",
        }
      : defaultProfile;

    return {
      id: item.id,
      created: item.created_at || item.created,
      ig_username: profileRecord?.ig_username || item.ig_username || "unknown",
      profile_pic_url: profileRecord?.profile_pic_url || "",
      profile: profileInfo,
      posts: normalizedPosts,
      insights: safeParseJson(item.insights, {}),
      action_cards: safeParseJson(item.action_cards, []),
      next_post_plan: safeParseJson(item.next_post_plan, {}),
    };
  });
}

export async function getExistingPostIds(userId: string, profileId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("ig_post_id")
    .eq("user_id", userId)
    .eq("profile_id", profileId);

  if (error) return [];
  return (data || []).map((item: any) => item.ig_post_id);
}

export async function getPostRecordId(userId: string, profileId: string, igPostId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("id")
    .eq("user_id", userId)
    .eq("profile_id", profileId)
    .eq("ig_post_id", igPostId)
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
}
