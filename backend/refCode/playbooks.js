"use strict";

const PLAYBOOKS = {

  "saree": {
    nicheLabel: "Saree Manufacturer & Seller",
    priority: 10,
    detectionKeywords: [
      "saree", "sari", "silk saree", "cotton saree", "kanjivaram",
      "manufacturer", "wholesale", "handloom", "weaver",
      "sirumugai", "tusser", "pattu", "banarasi", "kaadhi",
    ],
    signals: [
      "Price is shown in captions but 0% buyer intent from comments — DM friction is high",
      "Emoji-only hooks are killing reach — algorithm cannot read context",
      "Product reels get views but no DMs — missing WhatsApp/contact CTA",
      "Posting frequently but engagement not growing — quality over quantity needed",
    ],
    priorityActions: [
      "Replace emoji-only hooks with product name + price in first line: 'Pure Silk Saree ₹1999 — limited stock'",
      "Add WhatsApp number directly in every caption — reduce DM friction completely",
      "Film a 30s reel: drape the saree on a real model, show texture close-up, state price in first 3 seconds",
      "Post one 'Saree of the Day' reel at your best hour with consistent format every day",
      "Add location hashtags for your city — buyers search locally before purchasing",
    ],
    hookTemplates: [
      "Pure silk saree ₹{price} — only {qty} pieces left 🪡",
      "This saree sold out in 2 days last time. Back in stock now 👇",
      "₹{price} for handloom quality — watch the texture closely 🧵",
      "From our loom to your wardrobe — {type} silk saree at factory price",
    ],
    captionCTAs: [
      "WhatsApp us: {phone} to order now 📱",
      "DM 'SAREE' for full catalogue and price list 💌",
      "Shipping across India | COD available | DM to order",
    ],
    hashtagStrategy: {
      local: ["#bangaloresaree", "#chennasilk", "#sareeseller", "#onlinesaree"],
      niche: ["#silksarees", "#handloomsaree", "#kanjivaramsaree", "#puresaree"],
      discovery: ["#sareelover", "#indiansaree", "#sareecollection", "#sareeoftheday"],
      avoid: ["Emoji-only hashtags, #trendingreels alone without niche tags"],
    },
    expectedWins: {
      hookFix: "+200% views when first line has product name vs emoji-only",
      whatsappCTA: "+50% direct orders when WhatsApp number is in caption",
      modelReel: "+300% engagement when saree is shown on a model vs flat product shot",
    },
  },

  "bridal": {
    nicheLabel: "Bridal & Ethnic Wear Store",
    priority: 9,
    detectionKeywords: [
      "bridal", "lehenga", "bride", "trousseau", "wedding wear",
      "ethnic wear", "ethnic", "dupatta", "anarkali", "sharara",
      "bridalwear", "bridalstore", "bridalshop",
    ],
    signals: [
      "High engagement on ethnic posts but low DMs or purchase signals",
      "Seasonal spike expected: wedding season Oct–Feb and May–Jun",
      "Audience saves product posts but does not comment or DM",
      "Video posts underperforming vs image posts — likely hook issue",
    ],
    priorityActions: [
      "Post a 30s reel: model wearing the lehenga in 3 different styling ways — add price overlay in first 5 seconds",
      "Create a Bridal Budget Guide carousel: ₹15k / ₹30k / ₹50k+ lehenga options",
      "Add to every caption: Video call shopping available. Book your slot — DM or WhatsApp",
      "Run a 48hr limited offer: First 5 brides to DM get a free blouse customisation",
      "Post a real bride testimonial or try-on reel — UGC converts 3x better than product shots",
    ],
    hookTemplates: [
      "The lehenga that made her cry (in the best way) 🥹",
      "₹{price} and it looks like a lakh — here's why 👇",
      "She said yes to THIS lehenga. Here's what it takes.",
      "Don't buy a bridal lehenga without watching this first.",
    ],
    captionCTAs: [
      "DM us 'BRIDE' to see our full bridal collection 💌",
      "Video call shopping available weekdays — book your slot in DM",
      "Shipping across India 🇮🇳 | WhatsApp: {phone}",
    ],
    hashtagStrategy: {
      local: ["#bangaloreshopping", "#bridalshopinbangalore", "#bridesofbangalore"],
      niche: ["#bridallehenga", "#indianbride", "#bridalwear", "#lehengalove"],
      discovery: ["#indowestern", "#ethnicwear", "#indianfashion", "#bridalshopping"],
      avoid: ["Using 25+ hashtags — Instagram penalises hashtag stuffing. Max 8–12."],
    },
    expectedWins: {
      reelVsImage: "+300–500% reach increase switching top image posts to Reels",
      priceInCaption: "+40–60% DM rate when price is visible vs hidden",
      videoCallCTA: "+25% conversion for stores offering video call shopping",
    },
  },

  "boutique": {
    nicheLabel: "Fashion Boutique / Clothing Store",
    priority: 6,
    detectionKeywords: [
      "boutique", "indo-western", "indowestern", "fusion wear",
      "co-ord", "jumpsuit", "ootd", "western wear", "kurta set", "palazzo",
    ],
    signals: [
      "Indo-western and fusion outfits getting higher engagement than traditional wear",
      "Audience is style-conscious — aspirational hooks outperform product-description hooks",
      "Trending audio can 3x reach for outfit reveal Reels",
      "Collab posts and brand shoots drive more saves than solo shoots",
    ],
    priorityActions: [
      "Create an Outfit of the Week Reel series — same format every week builds loyal return viewers",
      "Post a 'how to style 1 piece 3 ways' Reel — high save rate = high reach",
      "Partner with a local micro-influencer (5k–50k followers) for a collab post",
      "Add product code + price to every post to reduce DM friction",
      "Test trending audio on your next 3 Reels — even 1 trending sound can 10x views",
    ],
    hookTemplates: [
      "POV: You just found your new favourite outfit 😍",
      "3 ways to wear this ONE piece — outfit 3 will surprise you",
      "This sold out the last time we posted it. Here's why. 👇",
      "The outfit everyone's been DMing us about 🔥",
    ],
    captionCTAs: [
      "Shop the look — link in bio 🔗",
      "DM us the product code for price and availability",
      "Available in sizes S–XXL | DM to order",
    ],
    hashtagStrategy: {
      local: ["#bangalorefashion", "#chennaifashion", "#mumbaifashion"],
      niche: ["#indowestern", "#fusionwear", "#ootdindia", "#styleinspo"],
      discovery: ["#fashionreels", "#outfitideas", "#newcollection"],
      avoid: ["Generic #fashion and #style — too broad, zero discovery value"],
    },
    expectedWins: {
      seriesContent: "+60% follower retention with a weekly series vs random posts",
      trendingAudio: "+200–400% reach boost with trending audio",
      influencerCollab: "+15–30% new followers per collab post",
    },
  },

  "jewellery": {
    nicheLabel: "Jewellery Store / Accessories Brand",
    priority: 9,
    detectionKeywords: [
      "jewellery", "jewelry", "jewels", "necklace", "earrings",
      "bangles", "kundan", "polki", "diamond", "ring", "pendant",
      "oxidised", "imitation", "gold plated", "silver jewellery",
    ],
    signals: [
      "Jewellery audiences are highly visual — lighting and close-up styling is the #1 driver",
      "Occasion-based posts convert 2x better than generic product shots",
      "Price transparency builds more trust in jewellery than any other category",
      "Short Reels showing jewellery on a model outperform flat lays",
    ],
    priorityActions: [
      "Post a 15s close-up Reel of the jewellery on skin — show texture, shine, movement",
      "Create a Complete the Look post: jewellery paired with a specific outfit",
      "Add occasion tags to every caption: Perfect for: wedding / festival / daily wear",
      "Launch a Jewellery of the Day story series — drives daily profile visits",
      "Post Gift under ₹{price} carousel posts during festive season — extremely high save rate",
    ],
    hookTemplates: [
      "The earrings that complete any bridal look 👑",
      "₹{price} and it looks like a lakh worth of jewellery.",
      "She wore this to her best friend's wedding. Everyone asked where it's from.",
      "Gold or silver? We settled the debate with THIS piece.",
    ],
    captionCTAs: [
      "DM 'DETAILS' for price and availability 💌",
      "Gifting? We do custom boxes — DM us for gifting orders",
      "Ships within 3 days across India 🇮🇳",
    ],
    hashtagStrategy: {
      local: ["#bangalorejewellery", "#jewelleryindia"],
      niche: ["#kundan", "#bridaljewellery", "#ethnicjewellery", "#indianjewels"],
      discovery: ["#jewelleryofinstagram", "#jewellerylovers", "#ootdjewellery"],
      avoid: ["#jewellery alone — 50M+ posts, zero discovery value"],
    },
    expectedWins: {
      closeUpReels: "+250% engagement vs flat lay images for jewellery",
      priceTransparency: "+35% DM rate when price is stated vs DM for price",
      occasionTagging: "+45% saves on occasion-specific posts",
    },
  },

  "restaurant": {
    nicheLabel: "Restaurant / Cafe / Food Business",
    priority: 10,
    detectionKeywords: [
      "restaurant", "cafe", "food", "biryani", "hotel", "dhaba",
      "tiffin", "mess", "bakery", "sweets", "mithai", "catering",
      "chef", "kitchen", "menu", "dine", "delivery", "zomato", "swiggy",
    ],
    signals: [
      "Food content gets highest engagement when shown being made or eaten — not just plated",
      "Lunch and dinner hours (12–1pm, 7–9pm) are peak discovery times for food content",
      "Behind-the-scenes kitchen reels outperform menu photos 3:1",
      "Combo deals and limited-time offers in captions drive immediate orders",
    ],
    priorityActions: [
      "Post a 15s 'making of' reel — show the dish being prepared from raw to plate",
      "Create a weekly Special of the Day story at 11am before lunch rush",
      "Add Zomato/Swiggy link or phone number to every caption",
      "Post a customer reaction video — UGC food content goes viral fastest",
      "Run a 'Tag a friend you'd eat this with' CTA — drives shares and discovery",
    ],
    hookTemplates: [
      "This is what ₹{price} gets you at {place} 🔥",
      "We made {qty} plates of this today. Gone by 1pm. Here's why 👇",
      "The dish everyone's been asking about — finally on camera 📸",
      "POV: You just found your new favourite lunch spot in {city}",
    ],
    captionCTAs: [
      "Order now on Zomato / Swiggy 🛵 | Link in bio",
      "Call us: {phone} | Open {hours}",
      "Tag a friend you'd share this with 👇",
    ],
    hashtagStrategy: {
      local: ["#bangalorefood", "#chennaifood", "#mumbaifood", "#foodieindia"],
      niche: ["#homemade", "#streetfood", "#biryanilover", "#indianfood"],
      discovery: ["#foodreels", "#foodphotography", "#instafood", "#foodie"],
      avoid: ["#food alone — 500M+ posts, completely useless for discovery"],
    },
    expectedWins: {
      makingOfReel: "+400% reach vs static food photo",
      lunchTimePost: "+60% profile visits when posted at 11:30am",
      tagAFriend: "+80% shares vs posts without tag CTA",
    },
  },

  "salon": {
    nicheLabel: "Salon / Beauty / Skincare",
    priority: 10,
    detectionKeywords: [
      "salon", "beauty", "skincare", "skin care", "makeup", "mua",
      "haircut", "bridal makeup", "nails", "spa", "facial",
      "waxing", "threading", "lashes", "brows", "glow",
    ],
    signals: [
      "Before/after transformation content is the highest performing format in beauty",
      "Booking friction is the #1 conversion killer — add direct booking link or WhatsApp",
      "Trending makeup looks and tutorials drive 5x more saves than service announcements",
      "Customer testimonial reels convert better than any promotional content",
    ],
    priorityActions: [
      "Post a before/after reel of a client transformation — face reveal format gets highest saves",
      "Add 'Book now — WhatsApp {phone}' to every post and story",
      "Create a Get Ready With Me or Day in the Salon reel — builds personal connection",
      "Post client testimonials with their permission — video testimonials convert 3x better",
      "Launch a monthly offer: 10% off for Instagram followers — show this post at reception",
    ],
    hookTemplates: [
      "She came in nervous. She left like THIS 😍",
      "What {service} looks like when done right — watch till the end",
      "₹{price} for a look that lasts {duration} — is it worth it? 👇",
      "Bridal makeup in {time} minutes — full transformation 👰",
    ],
    captionCTAs: [
      "Book your slot — WhatsApp: {phone} 📱",
      "Limited slots this {month} — DM to reserve yours",
      "Walk-ins welcome | {location} | Open {hours}",
    ],
    hashtagStrategy: {
      local: ["#bangaloresalon", "#bangaloremakeup", "#chennaibride"],
      niche: ["#bridalmakeup", "#makeupindia", "#indianmakeup", "#skincareindia"],
      discovery: ["#makeuptransformation", "#beforeandafter", "#glowup"],
      avoid: ["#beauty alone — use niche + location tags instead"],
    },
    expectedWins: {
      beforeAfter: "+500% saves vs regular service post",
      whatsappCTA: "+45% booking rate when WhatsApp number is in caption",
      clientTestimonial: "+3x conversion rate vs promotional post",
    },
  },

};

// ─── PRIORITY SCORING DETECTOR ───────────────────────────────────────────────

/**
 * Detects niche using weighted scoring.
 * Every keyword match adds score. Longer/more specific keywords score higher.
 * Highest total score wins — prevents generic keywords overriding specific ones.
 *
 * IMPORTANT: Scrapling scraper returns these field names:
 *   biography, ownerUsername, ownerFullName
 *   (profile_category is NOT returned by Scrapling)
 */
function detectNiche(account) {
  const searchText = [
    account.biography        || account.bio             || "",
    account.ownerUsername    || account.username        || "",
    account.ownerFullName    || account.full_name       || "",
    account.profile_category || account.categoryName   || "",
    account.topCaptions      || "",
  ].join(" ").toLowerCase();

  const scores = {};

  for (const [key, playbook] of Object.entries(PLAYBOOKS)) {
    let score = 0;
    for (const kw of playbook.detectionKeywords) {
      if (searchText.includes(kw.toLowerCase())) {
        // Multi-word keywords (e.g. "silk saree") score higher than single words
        score += kw.split(" ").length * playbook.priority;
      }
    }
    scores[key] = score;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  if (!best || best[1] === 0) {
    return { nicheKey: "boutique", playbook: PLAYBOOKS["boutique"] };
  }

  return { nicheKey: best[0], playbook: PLAYBOOKS[best[0]] };
}

/**
 * Get playbook by explicit key override.
 */
function getPlaybook(key) {
  return PLAYBOOKS[key] || PLAYBOOKS["boutique"];
}

/**
 * Builds the lean playbook block for AI prompt.
 * Keeps token count low — only sends what AI needs.
 */
function buildPlaybookPromptBlock(playbook) {
  return [
    `PLAYBOOK [${playbook.nicheLabel}]:`,
    `SIGNALS: ${playbook.signals.slice(0, 2).join(" | ")}`,
    `ACTIONS: ${playbook.priorityActions.slice(0, 3).join(" | ")}`,
    `HOOKS: ${playbook.hookTemplates.slice(0, 2).join(" | ")}`,
    `CTA: ${playbook.captionCTAs[0]}`,
    `HASHTAGS: ${[...playbook.hashtagStrategy.niche.slice(0, 3), ...playbook.hashtagStrategy.local.slice(0, 2)].join(", ")}`,
    `EXPECTED WIN: ${Object.values(playbook.expectedWins)[0]}`,
  ].join("\n");
}

export { detectNiche, getPlaybook, buildPlaybookPromptBlock, PLAYBOOKS };
