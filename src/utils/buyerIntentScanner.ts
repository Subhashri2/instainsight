/**
 * buyerIntentScanner.ts
 * Scans post comments for buyer intent signals without any external NLP library.
 * Works entirely on keyword matching — no API calls needed.
 */

"use strict";

// ─── KEYWORD BANKS ───────────────────────────────────────────────────────────

const PRICE_SIGNALS = [
    "price", "cost", "how much", "rate", "pricing", "kitna", "kiti",
    "charges", "fees", "budget", "affordable", "expensive", "worth it",
    "₹", "rs.", "inr",
];

const AVAILABILITY_SIGNALS = [
    "available", "in stock", "do you have", "stock", "left", "still available",
    "order", "book", "reserve", "pre-order", "when will", "restock",
];

const PURCHASE_SIGNALS = [
    "where to buy", "how to buy", "purchase", "want this", "i need this",
    "dm me", "dm'd you", "sent dm", "whatsapp", "contact", "website",
    "link", "shop now", "add to cart", "shipping", "deliver", "cod",
    "cash on delivery", "online order",
];

const SIZE_FIT_SIGNALS = [
    "size", "sizing", "measurements", "custom", "customise", "stitch",
    "tailored", "fit", "plus size", "xl", "xxl", "small", "medium",
];

const LOCATION_SIGNALS = [
    "where are you", "located", "location", "address", "store", "visit",
    "bangalore", "mumbai", "delhi", "chennai", "hyderabad", "pune", "kolkata",
    "near me",
];

const GIFT_SIGNALS = [
    "gift", "gifting", "for my", "for her", "for him", "wedding", "bride",
    "trousseau", "anniversary", "occasion",
];

// ─── SCORING ─────────────────────────────────────────────────────────────────

const SIGNAL_WEIGHTS: Record<string, number> = {
    price: 3,
    availability: 2,
    purchase: 4,
    size: 2,
    location: 2,
    gift: 1,
};

function detectSignalsInText(text: string): string[] {
    const lower = text.toLowerCase();
    const found: string[] = [];

    if (PRICE_SIGNALS.some(kw => lower.includes(kw))) found.push("price");
    if (AVAILABILITY_SIGNALS.some(kw => lower.includes(kw))) found.push("availability");
    if (PURCHASE_SIGNALS.some(kw => lower.includes(kw))) found.push("purchase");
    if (SIZE_FIT_SIGNALS.some(kw => lower.includes(kw))) found.push("size");
    if (LOCATION_SIGNALS.some(kw => lower.includes(kw))) found.push("location");
    if (GIFT_SIGNALS.some(kw => lower.includes(kw))) found.push("gift");

    return found;
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export interface BuyerIntentResult {
    intentScore: number;
    totalCommentsScanned: number;
    topSignals: string[];
    signalBreakdown: Record<string, number>;
    hotPosts: any[];
    recommendation: string | null;
}

/**
 * @param {Array} posts - Array of post objects (each may have latest_comments)
 * @returns {Object} buyer intent analysis result
 */
export function scanBuyerIntent(posts: any[]): BuyerIntentResult {
    let totalScore = 0;
    let totalComments = 0;
    const signalCounts: Record<string, number> = {};
    const hotPosts: any[] = [];

    for (const post of posts) {
        const comments = post.latest_comments || [];
        if (comments.length === 0) continue;

        let postScore = 0;
        const postSignals: string[] = [];

        for (const comment of comments) {
            const text = typeof comment === "string" ? comment : (comment.text || comment.comment || "");
            if (!text) continue;

            totalComments++;
            const signals = detectSignalsInText(text);

            for (const signal of signals) {
                const weight = SIGNAL_WEIGHTS[signal] || 1;
                postScore += weight;
                postSignals.push(signal);
                signalCounts[signal] = (signalCounts[signal] || 0) + 1;
            }
        }

        if (postScore > 0) {
            totalScore += postScore;
            hotPosts.push({
                hook: (post.caption || "").split("\n")[0].slice(0, 60),
                type: post.type,
                buyerSignals: [...new Set(postSignals)],
                signalScore: postScore,
            });
        }
    }

    // Normalize intent score 0–100
    const maxPossible = totalComments * Math.max(...Object.values(SIGNAL_WEIGHTS));
    const intentScore = maxPossible > 0
        ? Math.min(Math.round((totalScore / maxPossible) * 100), 100)
        : 0;

    // Sort hot posts by signal score
    hotPosts.sort((a, b) => b.signalScore - a.signalScore);

    // Build human-readable signal summary
    const topSignals = Object.entries(signalCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([signal, count]) => `${signal} (${count}× mentioned)`);

    // Generate recommendation
    let recommendation: string | null = null;
    if (intentScore === 0 && totalComments === 0) {
        recommendation = "No comments available to scan. Add 'ask a question' CTAs to collect comments.";
    } else if (intentScore === 0) {
        recommendation = "Comments exist but no buying signals detected. Add price, availability, or DM CTAs to drive intent comments.";
    } else if (signalCounts["price"] > 0) {
        recommendation = "Price questions detected — add price directly in caption or first comment to reduce friction.";
    } else if (signalCounts["purchase"] > 0) {
        recommendation = "Purchase intent detected — pin a comment with WhatsApp/order link on these posts immediately.";
    } else if (signalCounts["availability"] > 0) {
        recommendation = "Availability questions detected — add 'DM to check availability' CTA to your top posts.";
    }

    return {
        intentScore,
        totalCommentsScanned: totalComments,
        topSignals,
        signalBreakdown: signalCounts,
        hotPosts: hotPosts.slice(0, 3),
        recommendation,
    };
}
