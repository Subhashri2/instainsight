import "./env.js";
import PocketBase from "pocketbase";

const PB_URL = process.env.POCKETBASE_URL as string;
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL as string;
const ADMIN_PASS = process.env.PB_ADMIN_PASSWORD as string;

async function run() {
  const pb = new PocketBase(PB_URL);

  // authenticate
  try {
    await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
    console.log("[Setup] Authenticated as Superuser");
  } catch {
    await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
    console.log("[Setup] Authenticated as Admin (Legacy)");
  }

  const users = await pb.collections.getOne("users");
  const usersId = users.id;

  console.log("[Setup] users collection:", usersId);

  const definitions: any[] = [
    {
      name: "profiles",
      type: "base",
      schema: [
        {
          name: "user",
          type: "relation",
          options: { collectionId: usersId, maxSelect: 1 }
        },
        { name: "ig_username", type: "text", required: true, options: {} },
        { name: "full_name", type: "text", options: {} },
        { name: "followers_count", type: "number", options: {} },
        { name: "following_count", type: "number", options: {} },
        { name: "posts_count", type: "number", options: {} },
        { name: "profile_pic_url", type: "text", options: {} },
        { name: "category_name", type: "text", options: {} },
        { name: "biography", type: "text", options: {} }
      ]
    },

    {
      name: "posts",
      type: "base",
      schema: [
        {
          name: "user",
          type: "relation",
          options: { collectionId: usersId, maxSelect: 1 }
        },
        {
          name: "profile",
          type: "relation",
          options: { collectionId: "profiles", maxSelect: 1 }
        },
        { name: "ig_post_id", type: "text", required: true, options: {} },
        { name: "short_code", type: "text", options: {} },
        { name: "type", type: "text", options: {} },
        { name: "caption", type: "text", options: {} },
        { name: "likes_count", type: "number", options: {} },
        { name: "comments_count", type: "number", options: {} },
        { name: "video_view_count", type: "number", options: {} },
        { name: "play_count", type: "number", options: {} },
        { name: "save_count", type: "number", options: {} },
        { name: "share_count", type: "number", options: {} },
        { name: "display_url", type: "text", options: {} },
        { name: "timestamp", type: "text", options: {} },
        { name: "hashtags", type: "text", options: {} },
        { name: "url", type: "text", options: {} },
        { name: "duration", type: "number", options: {} },
        { name: "music_info", type: "text", options: {} },
        { name: "tagged_users", type: "text", options: {} }
      ]
    },

    {
      name: "comments",
      type: "base",
      schema: [
        {
          name: "user",
          type: "relation",
          options: { collectionId: usersId, maxSelect: 1 }
        },
        {
          name: "profile",
          type: "relation",
          options: { collectionId: "profiles", maxSelect: 1 }
        },
        {
          name: "post",
          type: "relation",
          options: { collectionId: "posts", maxSelect: 1 }
        },
        { name: "text", type: "text", required: true, options: {} },
        { name: "owner_username", type: "text", options: {} }
      ]
    },

    {
      name: "analyses",
      type: "base",
      schema: [
        {
          name: "user",
          type: "relation",
          options: { collectionId: usersId, maxSelect: 1 }
        },
        {
          name: "profile",
          type: "relation",
          options: { collectionId: "profiles", maxSelect: 1 }
        },
        { name: "insights", type: "text", options: {} },
        { name: "ai_response", type: "text", options: {} },
        { name: "action_cards", type: "text", options: {} },
        { name: "next_post_plan", type: "text", options: {} }
      ]
    }
  ];

  async function resolveIds(col: any) {
    for (const field of col.schema) {
      if (field.type === "relation" && field.options.collectionId !== usersId) {
        try {
          const target = await pb.collections.getOne(field.options.collectionId);
          field.options.collectionId = target.id;
        } catch {}
      }
    }
  }

  for (const col of definitions) {
    await resolveIds(col);

    try {
      const existing = await pb.collections.getOne(col.name);
      await pb.collections.update(existing.id, col);
      console.log(`[Setup] Updated collection: ${col.name}`);
    } catch {
      const created = await pb.collections.create(col);
      console.log(`[Setup] Created collection: ${col.name}`);
    }
  }

  console.log("[Setup] DONE");
}

run();
