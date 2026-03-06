/**
 * PocketBase Schema Setup Script
 * 
 * Run this ONCE to create the required collections in PocketBase.
 * Usage: npx tsx pb_setup.ts
 * 
 * Requires PocketBase to be running and POCKETBASE_URL set in .env
 * You'll need to create an admin account in PocketBase first:
 * Visit http://127.0.0.1:8090/_/ and follow the setup wizard.
 * 
 * IMPORTANT: After running this script, you can also manually create
 * these collections via the PocketBase admin UI at /_/
 */

import PocketBase from "pocketbase";
import dotenv from "dotenv";

dotenv.config();

const POCKETBASE_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";

async function setup() {
    const pb = new PocketBase(POCKETBASE_URL);

    // You need to authenticate as admin
    const adminEmail = process.env.PB_ADMIN_EMAIL;
    const adminPassword = process.env.PB_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
        console.log("═══════════════════════════════════════════════════════════");
        console.log("  PocketBase Schema Setup — Manual Instructions");
        console.log("═══════════════════════════════════════════════════════════");
        console.log("");
        console.log("Since no admin credentials were provided, please create");
        console.log("the following collections manually in the PocketBase Admin UI:");
        console.log(`  → ${POCKETBASE_URL}/_/`);
        console.log("");
        console.log("──── Collection: profiles ────────────────────────────────");
        console.log("  Type: Base");
        console.log("  Fields:");
        console.log("    - user        : Relation → users");
        console.log("    - ig_username  : Text (required)");
        console.log("    - full_name    : Text");
        console.log("    - followers_count : Number");
        console.log("    - following_count : Number");
        console.log("    - posts_count  : Number");
        console.log("    - profile_pic_url : URL");
        console.log("    - category_name : Text");
        console.log("    - biography    : Text");
        console.log("");
        console.log("  API Rules: Set List/View/Create/Update/Delete to:");
        console.log('    @request.auth.id != ""');
        console.log("");
        console.log("──── Collection: posts ──────────────────────────────────");
        console.log("  Type: Base");
        console.log("  Fields:");
        console.log("    - user         : Relation → users");
        console.log("    - profile      : Relation → profiles");
        console.log("    - ig_post_id   : Text (required)");
        console.log("    - short_code   : Text");
        console.log("    - type         : Text (Video/Image)");
        console.log("    - caption      : Text");
        console.log("    - likes_count  : Number");
        console.log("    - comments_count : Number");
        console.log("    - video_view_count : Number");
        console.log("    - play_count   : Number");
        console.log("    - save_count   : Number");
        console.log("    - share_count  : Number");
        console.log("    - display_url  : URL");
        console.log("    - timestamp    : Text");
        console.log("    - hashtags     : JSON");
        console.log("    - url          : URL");
        console.log("    - duration     : Number");
        console.log("    - music_info   : Text");
        console.log("    - tagged_users : JSON");
        console.log("");
        console.log("  API Rules: Set List/View/Create/Update/Delete to:");
        console.log('    @request.auth.id != ""');
        console.log("");
        console.log("──── Collection: comments ──────────────────────────────");
        console.log("  Type: Base");
        console.log("  Fields:");
        console.log("    - post           : Relation → posts");
        console.log("    - user           : Relation → users");
        console.log("    - profile        : Relation → profiles");
        console.log("    - text           : Text (required)");
        console.log("    - owner_username : Text");
        console.log("");
        console.log("  API Rules: Set List/View/Create/Update/Delete to:");
        console.log('    @request.auth.id != ""');
        console.log("");
        console.log("──── Collection: analyses ─────────────────────────────");
        console.log("  Type: Base");
        console.log("  Fields:");
        console.log("    - user          : Relation → users");
        console.log("    - profile       : Relation → profiles");
        console.log("    - insights      : JSON");
        console.log("    - ai_response   : JSON");
        console.log("    - action_cards  : JSON");
        console.log("    - next_post_plan : JSON");
        console.log("");
        console.log("  API Rules: Set List/View/Create/Update/Delete to:");
        console.log('    @request.auth.id != ""');
        console.log("");
        console.log("═══════════════════════════════════════════════════════════");
        console.log("  After creating all collections, your app is ready!");
        console.log("═══════════════════════════════════════════════════════════");
        return;
    }

    try {
        // Try v0.23+ superuser auth first, fallback to legacy admin auth
        try {
            await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
            console.log("[Setup] Authenticated as Superuser (v0.23+)");
        } catch {
            await pb.admins.authWithPassword(adminEmail, adminPassword);
            console.log("[Setup] Authenticated as Admin (Legacy)");
        }

        // Dynamically get the real ID of the users collection
        let usersCollectionId = "";
        try {
            const usersCol = await pb.collections.getOne("users");
            usersCollectionId = usersCol.id;
            console.log(`[Setup] Found users collection id: ${usersCollectionId}`);
        } catch (err: any) {
            console.error("[Setup] Could not find 'users' collection. This is a fatal error for relation setup.");
            return;
        }

        // We'll define the collections in order of dependency
        // 1. Profiles (depends on users)
        // 2. Posts (depends on profiles)
        // 3. Comments (depends on posts)
        // 4. Analyses (depends on users, profiles)

        const definitions: any[] = [
            {
                name: "profiles",
                type: "base",
                fields: [
                    { name: "user", type: "relation", collectionId: usersCollectionId, maxSelect: 1, required: false },
                    { name: "ig_username", type: "text", required: true },
                    { name: "full_name", type: "text" },
                    { name: "followers_count", type: "number" },
                    { name: "following_count", type: "number" },
                    { name: "posts_count", type: "number" },
                    { name: "profile_pic_url", type: "text" },
                    { name: "category_name", type: "text" },
                    { name: "biography", type: "text" },
                ],
                listRule: '@request.auth.id != ""',
                viewRule: '@request.auth.id != ""',
                createRule: '@request.auth.id != ""',
                updateRule: '@request.auth.id != ""',
                deleteRule: '@request.auth.id != ""',
            },
            {
                name: "posts",
                type: "base",
                fields: [
                    { name: "user", type: "relation", collectionId: usersCollectionId, maxSelect: 1, required: false },
                    { name: "profile", type: "relation", collectionId: "profiles", maxSelect: 1, required: false },
                    { name: "ig_post_id", type: "text", required: true },
                    { name: "short_code", type: "text" },
                    { name: "type", type: "text" },
                    { name: "caption", type: "text" },
                    { name: "likes_count", type: "number" },
                    { name: "comments_count", type: "number" },
                    { name: "video_view_count", type: "number" },
                    { name: "play_count", type: "number" },
                    { name: "save_count", type: "number" },
                    { name: "share_count", type: "number" },
                    { name: "display_url", type: "text" },
                    { name: "timestamp", type: "text" },
                    { name: "hashtags", type: "json" },
                    { name: "url", type: "text" },
                    { name: "duration", type: "number" },
                    { name: "music_info", type: "text" },
                    { name: "tagged_users", type: "json" },
                ],
                listRule: '@request.auth.id != ""',
                viewRule: '@request.auth.id != ""',
                createRule: '@request.auth.id != ""',
                updateRule: '@request.auth.id != ""',
                deleteRule: '@request.auth.id != ""',
            },
            {
                name: "comments",
                type: "base",
                fields: [
                    { name: "user", type: "relation", collectionId: usersCollectionId, maxSelect: 1, required: false },
                    { name: "profile", type: "relation", collectionId: "profiles", maxSelect: 1, required: false },
                    { name: "post", type: "relation", collectionId: "posts", maxSelect: 1, required: false },
                    { name: "text", type: "text", required: true },
                    { name: "owner_username", type: "text" },
                ],
                listRule: '@request.auth.id != ""',
                viewRule: '@request.auth.id != ""',
                createRule: '@request.auth.id != ""',
                updateRule: '@request.auth.id != ""',
                deleteRule: '@request.auth.id != ""',
            },
            {
                name: "analyses",
                type: "base",
                fields: [
                    { name: "user", type: "relation", collectionId: usersCollectionId, maxSelect: 1, required: false },
                    { name: "profile", type: "relation", collectionId: "profiles", maxSelect: 1, required: false },
                    { name: "insights", type: "json" },
                    { name: "ai_response", type: "json" },
                    { name: "action_cards", type: "json" },
                    { name: "next_post_plan", type: "json" },
                ],
                listRule: '@request.auth.id != ""',
                viewRule: '@request.auth.id != ""',
                createRule: '@request.auth.id != ""',
                updateRule: '@request.auth.id != ""',
                deleteRule: '@request.auth.id != ""',
            },
        ];

        // Helper to resolve collection names to IDs in relation fields
        async function resolveIds(colDef: any) {
            for (const field of colDef.fields) {
                if (field.type === 'relation' && field.collectionId !== usersCollectionId) {
                    try {
                        const target = await pb.collections.getOne(field.collectionId);
                        field.collectionId = target.id;
                    } catch {
                        // If it fails, the collection likely hasn't been created yet.
                        // Since we process in order of dependency, this shouldn't happen 
                        // for existing collections we just created.
                    }
                }
            }
        }

        for (const col of definitions) {
            try {
                // Resolve IDs for any relation fields
                await resolveIds(col);

                try {
                    const existing = await pb.collections.getOne(col.name);
                    await pb.collections.update(existing.id, col);
                    console.log(`[Setup] Updated collection: ${col.name} (ID: ${existing.id})`);
                } catch {
                    const created = await pb.collections.create(col);
                    console.log(`[Setup] Created collection: ${col.name} (ID: ${created.id})`);
                }
            } catch (err: any) {
                console.error(`[Setup] Failed to setup ${col.name}:`, err.message, err.data || "");
            }
        }

        console.log("[Setup] Done! Collections are ready and API Rules are set.");
    } catch (err: any) {
        console.error("[Setup] Authentication failed:", err.message);
        console.log("Check PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in your .env file.");
    }

}

setup();
