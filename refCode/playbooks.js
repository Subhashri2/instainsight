/**
 * playbooks.js
 * Niche-specific strategy playbooks injected into AI prompts.
 * Each playbook contains: signals to detect, priority actions, hook templates, expected outcomes.
 *
 * Auto-detected from account.profile_category or passed manually.
 */

"use strict";

const PLAYBOOKS = {

  // ─── BRIDAL / ETHNIC WEAR ────────────────────────────────────────────────
  "bridal": {
    nicheLabel: "Bridal & Ethnic Wear Store",
    detectionKeywords: ["bridal", "lehenga", "ethnic", "wedding", "trousseau", "saree", "dupatta", "bride"],

    signals: [
      "High engagement on ethnic/traditional posts but low DMs or purchase signals",
      "Seasonal spike expected: wedding season Oct–Feb and May–Jun",
      "Audience saves product posts but does not comment or DM",
      "Video posts underperforming vs image posts — likely hook issue",
    ],

    priorityActions: [
      "Post a 30s reel: model wearing the lehenga in 3 different styling ways — add price overlay in first 5 seconds",
      "Create a 'Bridal Budget Guide' carousel: ₹15k / ₹30k / ₹50k+ lehenga options",
      "Add to every caption: 'Video call shopping available. Book your slot — DM or WhatsApp'",
      "Run a 48hr limited offer: 'First 5 brides to DM get a free blouse customisation'",
      "Post a real bride testimonial or try-on reel — UGC converts 3x better than product shots",
    ],

    hookTemplates: [
      "The lehenga that made her cry (in the best way) 🥹",
      "₹{price} and it looks like a lakh — here's why 👇",
      "She said yes to THIS lehenga. Here's what it takes.",
      "Don't buy a bridal lehenga without watching this first.",
      "3 ways to style this one lehenga 🔥 (outfit 2 is our favourite)",
      "If your budget is ₹{price}, THIS is what we'd pick for you.",
    ],

    captionCTAs: [
      "DM us 'BRIDE' to see our full bridal collection 💌",
      "Video call shopping available weekdays — book your slot in DM",
      "Shipping across India 🇮🇳 | WhatsApp: {phone}",
      "Visit us at Commercial Street, Bangalore or shop from anywhere 📍",
    ],

    hashtagStrategy: {
      local: ["#bangaloreshopping", "#commercialstreet", "#bridalshopinbangalore", "#bridesofbangalore"],
      niche: ["#bridallehenga", "#indianbride", "#bridalwear", "#lehengalove", "#bridaltrousseau"],
      discovery: ["#indowestern", "#ethnicwear", "#indianfashion", "#bridalshopping", "#weddingoutfit"],
      avoid: ["Using 25+ hashtags — Instagram now penalises hashtag stuffing. Max 8–12 targeted tags."],
    },

    expectedWins: {
      reelVsImage: "+300–500% reach increase by switching top image posts to Reels format",
      priceInCaption: "+40–60% DM rate when price is visible vs hidden",
      videoCallCTA: "+25% conversion for stores offering video call shopping",
    },
  },

  // ─── BOUTIQUE / FASHION ──────────────────────────────────────────────────
  "boutique": {
    nicheLabel: "Fashion Boutique / Clothing Store",
    detectionKeywords: ["boutique", "fashion", "clothing", "outfit", "ootd", "style", "collection", "western", "co-ord", "jumpsuit"],

    signals: [
      "Indo-western and fusion outfits getting higher engagement than traditional wear",
      "Audience is style-conscious — aspirational hooks outperform product-description hooks",
      "Trending audio can 3x reach for outfit reveal Reels",
      "Collab posts and brand shoots drive more saves than solo shoots",
    ],

    priorityActions: [
      "Create a 'Outfit of the Week' Reel series — same format every week builds loyal return viewers",
      "Post a 'how to style 1 piece 3 ways' Reel — high save rate = high reach",
      "Partner with a local micro-influencer (5k–50k followers) for a collab post",
      "Add product code + price to every post to reduce the DM friction",
      "Test trending audio on your next 3 Reels — even 1 trending sound can 10x views",
    ],

    hookTemplates: [
      "POV: You just found your new favourite outfit 😍",
      "3 ways to wear this ONE piece — outfit 3 will surprise you",
      "This sold out the last time we posted it. Here's why. 👇",
      "What ₹{price} looks like when you shop smart.",
      "She walked in wanting something basic. She left with THIS.",
      "The outfit everyone's been DMing us about 🔥",
    ],

    captionCTAs: [
      "Shop the look — link in bio 🔗",
      "DM us the product code for price and availability",
      "New drops every {day} — follow so you don't miss it 🔔",
      "Available in sizes S–XXL | DM to order",
    ],

    hashtagStrategy: {
      local: ["#bangalorefashion", "#chennaifashion", "#mumbaifashion", "#boutiqueshopping"],
      niche: ["#indowestern", "#fusionwear", "#ootdindia", "#indianfashionblogger", "#styleinspo"],
      discovery: ["#ethnicfusion", "#westernwear", "#fashionreels", "#outfitideas", "#newcollection"],
      avoid: ["Generic tags like #fashion and #style — too broad, zero discovery value"],
    },

    expectedWins: {
      seriesContent: "+60% follower retention when posting a weekly series vs random one-off posts",
      trendingAudio: "+200–400% reach boost when using audio from Instagram's trending list",
      influencerCollab: "+15–30% new followers per collab post with local micro-influencer",
    },
  },

  // ─── JEWELLERY ───────────────────────────────────────────────────────────
  "jewellery": {
    nicheLabel: "Jewellery Store / Accessories Brand",
    detectionKeywords: ["jewellery", "jewelry", "necklace", "earrings", "bangles", "gold", "silver", "kundan", "polki", "diamond", "ring", "pendant"],

    signals: [
      "Jewellery audiences are highly visual — lighting and close-up styling is the #1 engagement driver",
      "Occasion-based posts (wedding, festive, gifting) convert 2× better than generic product shots",
      "Price transparency builds more trust in jewellery than any other category",
      "Short Reels showing the jewellery on a model — hands, neck, ears — outperform flat lays",
    ],

    priorityActions: [
      "Post a 15s close-up Reel of the jewellery on skin — show texture, shine, movement",
      "Create a 'Complete the Look' post: jewellery paired with a specific outfit type",
      "Add occasion tags to every caption: 'Perfect for: wedding / festival / daily wear'",
      "Launch a 'Jewellery of the Day' story series — drives daily profile visits",
      "For gifting season, post 'Gift under ₹{price}' carousel posts — extremely high save rate",
    ],

    hookTemplates: [
      "The earrings that complete any bridal look 👑",
      "₹{price} and it looks like a lakhs worth of jewellery.",
      "She wore this to her best friend's wedding. Everyone asked where it's from.",
      "3 ways to style kundan — office to wedding in 60 seconds",
      "The one piece you'll wear forever. And here's why.",
      "Gold or silver? We settled the debate with THIS piece.",
    ],

    captionCTAs: [
      "DM 'DETAILS' for price and availability 💌",
      "Gifting? We do custom boxes — DM us for gifting orders",
      "Ships within 3 days across India 🇮🇳",
      "Visit us at {location} or order online — DM to start",
    ],

    hashtagStrategy: {
      local: ["#bangalorejewellery", "#jewelleryindia", "#bangalorejewels"],
      niche: ["#kundan", "#polkijewellery", "#bridaljewellery", "#ethnicjewellery", "#indianjewels"],
      discovery: ["#jewelleryofinstagram", "#accessories", "#jewellerylovers", "#ootdjewellery", "#goldenjewellery"],
      avoid: ["#jewellery alone — too competitive with 50M+ posts, no discovery value"],
    },

    expectedWins: {
      closeUpReels: "+250% engagement vs flat lay images for jewellery",
      priceTransparency: "+35% DM rate when price is stated vs 'DM for price'",
      occasionTagging: "+45% saves on occasion-specific posts vs generic product posts",
    },
  },

};

// ─── AUTO-DETECT NICHE ───────────────────────────────────────────────────────

/**
 * Detects which playbook to use based on account category and bio keywords.
 * @param {Object} account - Raw account data from scraper
 * @returns {Object} Matching playbook or null
 */
function detectNiche(account) {
  const searchText = [
    String(account.profile_category || ""),
    String(account.bio || ""),
    String(account.username || ""),
    String(account.full_name || ""),
  ].join(" ").toLowerCase();

  for (const [key, playbook] of Object.entries(PLAYBOOKS)) {
    if (playbook.detectionKeywords.some(kw => searchText.includes(kw))) {
      return { nicheKey: key, playbook };
    }
  }

  // Fallback to boutique (most generic fashion)
  return { nicheKey: "boutique", playbook: PLAYBOOKS["boutique"] };
}

/**
 * Get playbook by explicit key.
 * @param {string} key - "bridal" | "boutique" | "jewellery"
 */
function getPlaybook(key) {
  return PLAYBOOKS[key] || PLAYBOOKS["boutique"];
}

export { detectNiche, getPlaybook, PLAYBOOKS };
