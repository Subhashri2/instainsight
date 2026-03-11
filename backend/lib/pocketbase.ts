/**
 * pocketbase.ts
 * PocketBase client singleton and auth helpers.
 * Works in both local dev and GitHub Codespaces.
 */

import "../env.js";
import PocketBase from "pocketbase";

const POCKETBASE_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";

// Singleton PocketBase client for server-side usage
const pb = new PocketBase(POCKETBASE_URL);

// Disable auto-cancellation so concurrent requests don't cancel each other
pb.autoCancellation(false);

export { pb, POCKETBASE_URL };

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

/**
 * Register a new user via PocketBase auth collection
 */
export async function registerUser(email: string, password: string, name: string) {
    const record = await pb.collection("users").create({
        email,
        password,
        passwordConfirm: password,
        name,
    });
    // Auto-login after registration
    const authData = await pb.collection("users").authWithPassword(email, password);
    return {
        user: {
            id: authData.record.id,
            email: authData.record.email,
            name: (authData.record as any).name || "",
        },
        token: authData.token,
    };
}

/**
 * Login an existing user
 */
export async function loginUser(email: string, password: string) {
    const authData = await pb.collection("users").authWithPassword(email, password);
    return {
        user: {
            id: authData.record.id,
            email: authData.record.email,
            name: (authData.record as any).name || "",
        },
        token: authData.token,
    };
}

/**
 * Validate a PB auth token and return the user.
 * Creates a fresh PB instance to avoid polluting the singleton.
 */
export async function validateToken(token: string) {
    const tempPb = new PocketBase(POCKETBASE_URL);
    tempPb.authStore.save(token, { id: "authenticated" } as any);

    try {
        const authData = await tempPb.collection("users").authRefresh();
        return {
            id: authData.record.id,
            email: authData.record.email,
            name: (authData.record as any).name || "",
        };
    } catch {
        return null;
    }
}
