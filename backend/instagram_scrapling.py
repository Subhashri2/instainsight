import sys
import json
import os
import re
import time
import tempfile
import inspect
import random
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from scrapling.fetchers import StealthyFetcher, StealthySession, DynamicSession

def _collect_media_connections(node, out):
    if isinstance(node, dict):
        edges = node.get("edges")
        page_info = node.get("page_info")
        if isinstance(edges, list) and isinstance(page_info, dict):
            out.append(node)
        for v in node.values():
            if isinstance(v, (dict, list)):
                _collect_media_connections(v, out)
    elif isinstance(node, list):
        for item in node:
            if isinstance(item, (dict, list)):
                _collect_media_connections(item, out)

def _build_mobile_headers():
    app_user_agents = [
        "Instagram 275.0.0.27.98 Android",
        "Instagram 310.0.0.33.118 Android",
        "Instagram 308.0.0.40.112 Android",
        "Instagram 305.0.0.34.110 Android",
        "Instagram 300.0.0.29.110 Android",
        "Instagram 298.0.0.31.109 Android",
        "Instagram 295.0.0.32.109 Android",
        "Instagram 292.0.0.31.110 iPhone",
        "Instagram 289.0.0.77.109 iPhone",
        "Instagram 285.0.0.25.109 iPhone",
    ]
    ua = random.choice(app_user_agents)
    return {
        "User-Agent": ua,
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "X-IG-App-ID": "936619743392459",
        "x-ig-app-id": "936619743392459",
        "x-ig-www-claim": "0",
        "X-Requested-With": "XMLHttpRequest",
        "x-requested-with": "XMLHttpRequest",
        "X-IG-Device-ID": f"android-{random.getrandbits(64):016x}",
        "X-ASBD-ID": "129477",
        "X-IG-WWW-Claim": "0",
        "Referer": "https://www.instagram.com/",
    }

def _try_mobile_profile_payload(username):
    endpoints = [
        f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}",
        f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}",
    ]
    headers = _build_mobile_headers()
    for url in endpoints:
        try:
            print(f"[Scrapling] Mobile API try: {url}", file=sys.stderr)
            req = Request(url, headers=headers, method="GET")
            with urlopen(req, timeout=25) as resp:
                status = getattr(resp, "status", 200)
                print(f"[Scrapling] Mobile API status {status} for {url}", file=sys.stderr)
                if status == 200:
                    payload = json.loads(resp.read().decode("utf-8", errors="ignore"))
                    if isinstance(payload, dict):
                        return payload
        except HTTPError as e:
            print(f"[Scrapling] Mobile API HTTPError {e.code} for {url}", file=sys.stderr)
            continue
        except URLError as e:
            print(f"[Scrapling] Mobile API URLError for {url}: {e}", file=sys.stderr)
            continue
        except (TimeoutError, ValueError):
            continue
        except Exception:
            continue
    return None

def _mobile_graphql_page(user_id, cursor=None, reels=False, page_size=24):
    # Common public profile query hashes used by Instagram web.
    # They can change; we try multiple candidates and fail gracefully.
    query_hashes = [
        "e7e2f4da4b02303f74f0841279e52d76",  # profile timeline
        "003056d32c2554def87228bc3fd9668a",  # alt timeline
        "be13233562af2d229b008d2976b998b5",
        "58b6785bea111c67129decbe6a448951",
        "d6f4427fbe92d846298cf93df0b937d3",
        "9f8827793ef34641b2fb195d4d41151c",
        "ad99dd9d3646cc3c0dda65debcd266a7",
        "8c2a529969ee035a5063f2fc8602a0fd",
    ]
    if reels:
        query_hashes = [
            "c6809c9c025875ac6f02619eae97a80e",  # reels/felix timeline candidate
            "bc78b344a68ed16dd5d7f264681c4c76",
            "5f0b1f6281e72053cbc07909c8d154ae",
            "f4e2b9d0f5f2a1d8c4e7d2b6a5c3e109",
            *query_hashes,
        ]

    random.shuffle(query_hashes)
    headers = _build_mobile_headers()
    for qh in query_hashes:
        variables = {"id": str(user_id), "first": int(page_size)}
        if cursor:
            variables["after"] = cursor
        try:
            base_url = "https://www.instagram.com/graphql/query/"
            query = urlencode({
                "query_hash": qh,
                "variables": json.dumps(variables, separators=(",", ":"))
            })
            req = Request(f"{base_url}?{query}", headers=headers, method="GET")
            with urlopen(req, timeout=30) as resp:
                if getattr(resp, "status", 200) != 200:
                    continue
                payload = json.loads(resp.read().decode("utf-8", errors="ignore"))
                if isinstance(payload, dict):
                    return payload
        except (URLError, HTTPError, TimeoutError, ValueError):
            continue
        except Exception:
            continue
    return None

def map_to_apify_format(user_data, username_context=None):
    data = user_data.get('data', {})
    user = (
        data.get('user', {})
        or data.get('xdt_api__v1__users__web_profile_info', {}).get('data', {}).get('user', {})
        or user_data.get('user', {})
        or user_data
    )
    media = user.get('edge_owner_to_timeline_media', {})
    if not media and 'edge_owner_to_timeline_media' in data:
        media = data.get('edge_owner_to_timeline_media')
    reels_media = user.get('edge_felix_video_timeline', {}) or data.get('edge_felix_video_timeline', {})
    if not media and not reels_media and 'edges' in user:
        media = user

    if (not media and not reels_media) or (
        'edges' not in media and 'edges' not in reels_media and not user.get('username')
    ):
        return [], {}, None

    username = user.get('username') or username_context
    followers = user.get('edge_followed_by', {}).get('count') or user.get('follower_count') or 0
    following = user.get('edge_follow', {}).get('count') or user.get('following_count') or 0
    posts_total = (
        media.get('count')
        or reels_media.get('count')
        or user.get('media_count')
        or 0
    )
    pic = user.get('profile_pic_url_hd') or user.get('profile_pic_url')
    
    common_info = {
        "ownerUsername": username,
        "ownerFullName": user.get('full_name'),
        "followersCount": followers,
        "followsCount": following,
        "postsCount": posts_total,
        "profilePicUrl": pic,
        "biography": user.get('biography'),
    }

    items = []
    edges = list(media.get('edges', []))
    reels_edges = list(reels_media.get('edges', []))
    if reels_edges:
        edges.extend(reels_edges)
    # Capture alternate GraphQL connection payloads (xdt/mobile style).
    discovered_connections = []
    _collect_media_connections(data, discovered_connections)
    for conn in discovered_connections:
        conn_edges = conn.get("edges") or []
        if isinstance(conn_edges, list):
            edges.extend(conn_edges)

    page_info = media.get('page_info', {}) or reels_media.get('page_info', {}) or {}
    if not page_info and discovered_connections:
        for conn in discovered_connections:
            pi = conn.get("page_info") or {}
            if isinstance(pi, dict) and (pi.get("end_cursor") or "has_next_page" in pi):
                page_info = pi
                break
    
    # Debug: save the first non-empty payload we see to raw_data_debug.json
    if not os.path.exists('raw_data_debug.json') and (edges or user.get('id')):
        try:
            with open('raw_data_debug.json', 'w', encoding='utf-8') as f:
                json.dump(user_data, f, indent=2, ensure_ascii=False)
        except:
            pass

    seen_ids = set()
    for edge in edges:
        node = edge.get('node', {})
        if not node: continue
        node_id = node.get('id')
        if node_id and node_id in seen_ids:
            continue
        if node_id:
            seen_ids.add(node_id)
        caption = ""
        caption_edges = node.get('edge_media_to_caption', {}).get('edges', [])
        if caption_edges: caption = caption_edges[0].get('node', {}).get('text', "")

        items.append({
            **common_info,
            "id": node.get('id'),
            "shortCode": node.get('shortcode'),
            "type": "Video" if node.get('is_video') else "Image",
            "caption": caption,
            "likesCount": node.get('edge_media_preview_like', {}).get('count', 0) or node.get('like_count', 0),
            "commentsCount": node.get('edge_media_to_comment', {}).get('count', 0) or node.get('comment_count', 0),
            "videoViewCount": node.get('video_view_count', 0) or node.get('view_count', 0) or 0,
            "playCount": node.get('play_count') or node.get('video_play_count') or 0,
            "saveCount": node.get('edge_media_to_save', {}).get('count', 0) or node.get('save_count') or 0,
            "shareCount": node.get('edge_media_to_reshare', {}).get('count', 0) or node.get('reshare_count') or 0,
            "displayUrl": node.get('display_url'),
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime(node.get('taken_at_timestamp', 0) or node.get('taken_at', 0))),
            "latestComments": [],
            "hashtags": re.findall(r'#(\w+)', caption),
            "url": f"https://www.instagram.com/p/{node.get('shortcode') or node.get('code')}/"
        })
    return items, page_info, user.get('id')

def load_cookies(cookie_path):
    if not cookie_path:
        return []
    if not os.path.exists(cookie_path):
        print(f"[Scrapling] Cookie file not found: {cookie_path}", file=sys.stderr)
        return []
    try:
        with open(cookie_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except Exception as e:
        print(f"[Scrapling] Failed to parse cookie file: {e}", file=sys.stderr)
        return []

    if isinstance(raw, dict):
        cookies = raw.get("cookies", [])
    elif isinstance(raw, list):
        cookies = raw
    else:
        cookies = []

    normalized = []
    for c in cookies:
        if not isinstance(c, dict):
            continue
        name = c.get("name")
        value = c.get("value")
        if not name or value is None:
            continue
        normalized.append({
            "name": name,
            "value": value,
            "domain": c.get("domain", ".instagram.com"),
            "path": c.get("path", "/"),
            "expires": c.get("expires", -1),
            "httpOnly": c.get("httpOnly", False),
            "secure": c.get("secure", True),
            "sameSite": c.get("sameSite", "Lax"),
        })
    return normalized

def extract_comments_from_payload(payload):
    seen = set()
    collected = []

    def add_comment(text, owner_username="unknown"):
        if not isinstance(text, str):
            return
        cleaned = text.strip()
        if len(cleaned) < 2 or len(cleaned) > 500:
            return
        key = (owner_username or "unknown", cleaned)
        if key in seen:
            return
        seen.add(key)
        collected.append({
            "text": cleaned,
            "ownerUsername": owner_username or "unknown"
        })

    def walk(node):
        if isinstance(node, list):
            for item in node:
                walk(item)
            return

        if not isinstance(node, dict):
            return

        # Common Instagram comment object signatures.
        text = node.get("text")
        if isinstance(text, str):
            has_comment_shape = any(
                k in node for k in (
                    "comment_id",
                    "comment_like_count",
                    "created_at",
                    "did_report_as_spam",
                    "edge_liked_by",
                    "owner",
                    "user",
                )
            )
            if has_comment_shape:
                owner = node.get("owner") or node.get("user") or {}
                owner_username = owner.get("username") if isinstance(owner, dict) else "unknown"
                add_comment(text, owner_username)

        # Explicit comment containers seen in graphql/mobile API responses.
        for key in (
            "edge_media_to_parent_comment",
            "edge_threaded_comments",
            "edge_media_preview_comment",
            "preview_comments",
            "comments",
        ):
            container = node.get(key)
            if isinstance(container, dict):
                edges = container.get("edges")
                if isinstance(edges, list):
                    for e in edges:
                        if isinstance(e, dict):
                            walk(e.get("node", e))
                nodes = container.get("nodes")
                if isinstance(nodes, list):
                    for n in nodes:
                        walk(n)
                data = container.get("data")
                if isinstance(data, list):
                    for d in data:
                        walk(d)
            elif isinstance(container, list):
                for item in container:
                    walk(item)

        for v in node.values():
            if isinstance(v, (dict, list)):
                walk(v)

    walk(payload)
    return collected

def filter_items(items, content_type):
    ct = (content_type or "all").lower().strip()
    if ct == "reels":
        return [i for i in items if i.get("type") == "Video"]
    if ct == "posts":
        return [i for i in items if i.get("type") == "Image"]
    return items

def _call_fetch_with_supported(callable_obj, url, **kwargs):
    try:
        signature = inspect.signature(callable_obj)
        params = signature.parameters
        supports_var_kwargs = any(
            p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values()
        )
        if supports_var_kwargs:
            filtered = kwargs
        else:
            supported = set(params.keys())
            filtered = {k: v for k, v in kwargs.items() if k in supported}
    except Exception:
        filtered = kwargs
    return callable_obj(url, **filtered)

def _is_login_wall(page):
    try:
        current_url = (page.url or "").lower()
    except Exception:
        current_url = ""

    try:
        body_text = page.evaluate("() => (document.body && document.body.innerText) ? document.body.innerText.toLowerCase() : ''")
    except Exception:
        body_text = ""

    markers = (
        "log in",
        "login",
        "see instagram photos and videos",
        "sign up",
    )
    return (
        "/accounts/login" in current_url
        or "/challenge/" in current_url
        or any(m in body_text for m in markers)
    )

def _warmup_instagram(page, target_url):
    page.goto("https://www.instagram.com/", wait_until="domcontentloaded", timeout=45000)
    time.sleep(random.uniform(1.2, 2.5))
    page.evaluate("window.scrollBy(0, Math.floor(window.innerHeight * 0.5))")
    time.sleep(random.uniform(0.8, 1.8))
    page.goto("https://www.instagram.com/explore/", wait_until="domcontentloaded", timeout=45000)
    time.sleep(random.uniform(1.0, 2.0))
    page.goto(target_url, wait_until="domcontentloaded", timeout=45000)
    time.sleep(random.uniform(1.5, 3.0))

def scrape_instagram(username, count=20, cookie_path=None, content_type="all", include_comments=True, existing_posts=None, scrape_mode="advanced"):
    if existing_posts is None:
        existing_posts = set()
    mode = (scrape_mode or "advanced").strip().lower()
    print(f"[Scrapling] Targeting {username} for {count} items... (Skipping {len(existing_posts)} existing) [mode={mode}]", file=sys.stderr)
    items_map = {}
    last_page_info = {}
    session_cookies = load_cookies(cookie_path)
    target_url = f"https://www.instagram.com/{username}/"
    run_mode = {"name": "single", "warmup": False}
    active_post = {"shortCode": None}
    network_comments = []
    comments_processed_posts = set()
    profile_user_id = {"value": None}
    graphql_template = {"base_url": None, "params": None}
    seen_first_page_fingerprints = []
    stop_all_attempts = {"value": False}

    def update_items(new_items, pinfo):
        nonlocal last_page_info
        if isinstance(pinfo, dict) and (pinfo.get("end_cursor") or "has_next_page" in pinfo):
            last_page_info = pinfo
        for it in new_items:
            # Only log if it's actually new
            if it['id'] not in items_map:
                items_map[it['id']] = it
                # Optional: print(f"[Scrapling] New item: {it['id']}", file=sys.stderr)

    # Step 1: Headless session to handle everything
    def run_browser(page):
        attempt_initial_ids = set(items_map.keys())
        comments_processed_this_attempt = 0
        cursor_exhausted = False
        scroll_exhausted = False

        def capture_graphql_template(url):
            try:
                if "graphql/query" not in url:
                    return
                parsed = urlparse(url)
                q = parse_qs(parsed.query)
                flat = {k: (v[0] if isinstance(v, list) and len(v) > 0 else v) for k, v in q.items()}
                if "variables" not in flat:
                    return
                variables = json.loads(flat["variables"])
                if not isinstance(variables, dict):
                    return
                if not variables.get("id"):
                    variables["id"] = profile_user_id["value"]
                graphql_template["base_url"] = urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))
                flat["variables"] = json.dumps(variables, separators=(",", ":"))
                graphql_template["params"] = flat
            except Exception:
                pass

        def fetch_next_page_by_cursor(cursor):
            if not cursor:
                return None
            if not graphql_template.get("base_url") or not graphql_template.get("params"):
                return None
            try:
                params = dict(graphql_template["params"])
                variables = json.loads(params.get("variables", "{}"))
                if not isinstance(variables, dict):
                    return None
                variables["after"] = cursor
                variables["first"] = max(12, min(50, count))
                if not variables.get("id") and profile_user_id["value"]:
                    variables["id"] = profile_user_id["value"]
                params["variables"] = json.dumps(variables, separators=(",", ":"))
                next_url = f"{graphql_template['base_url']}?{urlencode(params)}"
                response = page.request.get(next_url, timeout=45000)
                if not response or not response.ok:
                    return None
                payload = response.json()
                if not isinstance(payload, dict):
                    return None
                items, pinfo, uid = map_to_apify_format(payload, username_context=username)
                if uid and not profile_user_id["value"]:
                    profile_user_id["value"] = uid
                if isinstance(pinfo, dict) and (pinfo.get("end_cursor") or "has_next_page" in pinfo):
                    # Advance cursor state even when parser finds zero items.
                    update_items([], pinfo)
                if items:
                    update_items(items, pinfo)
                else:
                    try:
                        with open("cursor_debug.json", "w", encoding="utf-8") as f:
                            json.dump(payload, f, ensure_ascii=False)
                    except Exception:
                        pass
                return pinfo if isinstance(pinfo, dict) else {}
            except Exception as e:
                print(f"[Scrapling] Cursor pagination request failed: {e}", file=sys.stderr)
                return None

        # Intercept XHR
        def on_response(response):
            try:
                if response.status != 200:
                    return
                url = response.url

                # Capture profile info from network responses
                if "graphql/query" in url or "web_profile_info" in url:
                    capture_graphql_template(url)
                    body = response.json()
                    if isinstance(body, dict):
                        items, pinfo, uid = map_to_apify_format(body, username_context=username)
                        if uid and not profile_user_id["value"]:
                            profile_user_id["value"] = uid
                        if items:
                            # Avoid duplicate logging
                            new_count = len([i for i in items if i['id'] not in items_map])
                            if new_count > 0:
                                print(f"[Scrapling] Caught data from network: {new_count} new items", file=sys.stderr)
                            update_items(items, pinfo)
                            capture_graphql_template(url)
                
                # Capture comments (can also appear in network JSON)
                if active_post["shortCode"] and (
                    "graphql/query" in url
                    or "/comments/" in url
                    or "xdt_api__v1__media" in url
                ):
                    body = response.json()
                    extracted = extract_comments_from_payload(body)
                    if extracted:
                        network_comments.extend(extracted)
            except: pass
        
        page.on("response", on_response)
        print(f"[Scrapling] Active fetch mode: {run_mode.get('name', 'single')}", file=sys.stderr)

        if run_mode.get("warmup"):
            try:
                print("[Scrapling] Running pre-warm navigation sequence...", file=sys.stderr)
                _warmup_instagram(page, target_url)
            except Exception as e:
                print(f"[Scrapling] Warm-up sequence failed: {e}", file=sys.stderr)

        if include_comments:
            print("[Scrapling] Comment extractor initialized and monitoring network...", file=sys.stderr)

        # Human-like initial delay
        time.sleep(3.5)

        if _is_login_wall(page):
            run_mode["login_wall"] = True
            print("[Scrapling] Login wall/checkpoint detected for current attempt.", file=sys.stderr)
            return

        # LOGINLESS FALLBACK: If network intercept missed the initial payload, 
        # try extracting from the scripts injected in the HTML.
        if not items_map:
            try:
                print("[Scrapling] Checking HTML script tags for initial payload...", file=sys.stderr)
                script_content = page.evaluate('''() => {
                    const scripts = Array.from(document.querySelectorAll('script'));
                    // Look for segments commonly found in shared data or initial data
                    return scripts.find(s => s.textContent.includes('profile_pic_url') || s.textContent.includes('edge_owner_to_timeline_media'))?.textContent || "";
                }''')
                if script_content:
                    # Look for JSON structure in the script
                    match = re.search(r'(\{.*\})', script_content)
                    if match:
                        data = json.loads(match.group(1))
                        items, pinfo, _ = map_to_apify_format(data, username_context=username)
                        if items:
                            print(f"[Scrapling] Caught data from HTML: {len(items)} items", file=sys.stderr)
                            update_items(items, pinfo)
            except Exception as e:
                print(f"[Scrapling] HTML fallback error: {e}", file=sys.stderr)

        # Reels tab warm capture: helps when profile grid only returns photos.
        if content_type in ("all", "reels") and len(items_map) < count:
            try:
                reels_url = f"https://www.instagram.com/{username}/reels/"
                page.goto(reels_url, wait_until="domcontentloaded", timeout=45000)
                time.sleep(2.0)
                page.evaluate("window.scrollBy(0, Math.floor(window.innerHeight * 0.8))")
                time.sleep(1.0)
                page.goto(target_url, wait_until="domcontentloaded", timeout=45000)
                time.sleep(1.2)
            except Exception as e:
                print(f"[Scrapling] Reels-tab warm capture failed: {e}", file=sys.stderr)
        
        # Scroll loop
        cursor_round = 0
        cursor_stale = 0
        cursor_stalled = False
        while len(items_map) < count and last_page_info.get("end_cursor"):
            cursor_round += 1
            if cursor_round > 20:
                cursor_stalled = True
                break
            before = len(items_map)
            next_info = fetch_next_page_by_cursor(last_page_info.get("end_cursor"))
            after = len(items_map)
            print(
                f"[Scrapling] {run_mode.get('name', 'single')} | Cursor {cursor_round}: Total {after} items captured",
                file=sys.stderr
            )
            if after <= before:
                cursor_stale += 1
            else:
                cursor_stale = 0
            if not next_info:
                if after <= before:
                    cursor_stalled = True
                    break
                continue
            if cursor_stale >= 2:
                print(f"[Scrapling] Cursor pagination stalled. Falling back to scroll...", file=sys.stderr)
                cursor_stalled = True
                break
        if len(items_map) >= count:
            cursor_exhausted = True
        elif not last_page_info.get("end_cursor"):
            cursor_exhausted = True
        elif cursor_stalled:
            cursor_exhausted = True

        max_scrolls = max(8, min(40, count * 2)) if count > 6 else 6
        stale_rounds = 0
        hit_existing = False
        scroll_stalled = False
        
        current_items = items_map 

        for i in range(max_scrolls):
            if len(current_items) >= count: break
            
            # Check if we hit an existing post
            for it in items_map.values():
                if it.get('shortCode') in existing_posts or it.get('id') in existing_posts:
                    print(f"[Scrapling] Reached already scraped post: {it.get('shortCode')}. Stopping scroll.", file=sys.stderr)
                    hit_existing = True
                    break
            if hit_existing:
                break

            before = len(current_items)
            # More natural scrolling
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(1.5)
            page.evaluate("window.scrollBy(0, -200)")
            time.sleep(0.5)
            
            after = len(current_items)
            if after <= before:
                stale_rounds += 1
            else:
                stale_rounds = 0
            # If pagination is stuck on same set, rotate to next session quickly.
            if stale_rounds >= 3:
                print(
                    f"[Scrapling] {run_mode.get('name', 'single')} | "
                    f"Pagination stalled for {stale_rounds} scrolls. Rotating session.",
                    file=sys.stderr
                )
                scroll_stalled = True
                break
            print(f"[Scrapling] {run_mode.get('name', 'single')} | Scroll {i}: Total {len(current_items)} items captured", file=sys.stderr)
        if len(items_map) >= count or hit_existing or scroll_stalled or stale_rounds >= 3:
            scroll_exhausted = True

        if include_comments:
            # Comment extraction
            sorted_items = sorted(list(current_items.values()), key=lambda x: x['timestamp'], reverse=True)
            new_items_this_attempt = [
                it for it in sorted_items
                if it.get("id") not in attempt_initial_ids
            ]
            target_items = new_items_this_attempt[0:count]
            print(
                f"[Scrapling] Extracting comments for {len(target_items)} newly captured posts...",
                file=sys.stderr
            )
            for it in target_items:
                if it.get('shortCode') in existing_posts or it.get('id') in existing_posts:
                    continue
                if it.get('id') in comments_processed_posts or it.get('shortCode') in comments_processed_posts:
                    continue

                try:
                    active_post["shortCode"] = it.get("shortCode")
                    network_comments.clear()

                    # Navigation with slightly longer timeout
                    page.goto(it['url'], wait_until="domcontentloaded", timeout=45000)
                    time.sleep(2.5)

                    # Try opening more comments if a button is visible.
                    # FIXED: Added async to the evaluator function
                    page.evaluate('''async () => {
                        const wanted = [/view all/i, /more comments/i, /view more/i, /load more/i];
                        for (let i = 0; i < 5; i++) {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            const btn = buttons.find(b => {
                                const t = (b.innerText || '').trim();
                                return wanted.some(r => r.test(t));
                            });
                            if (!btn) break;
                            btn.click();
                            await new Promise(resolve => setTimeout(resolve, 1500));
                        }
                    }''')
                    time.sleep(2)

                    MAX_COMMENTS = 50
                    comment_objs = network_comments[0:MAX_COMMENTS]
                    if not comment_objs or len(comment_objs) < 3:
                        # Fallback 1: Embedded JSON scripts (often present in unauthenticated view)
                        script_comments = page.evaluate('''() => {
                            const scripts = Array.from(document.querySelectorAll('script[type="application/json"]'));
                            // Just return the contents to avoid huge transfers, we will parse them locally
                            return scripts.map(s => s.textContent).filter(t => t.includes('"text":"') && (t.includes('comment') || t.includes('xdt_api')));
                        }''')
                        for content in script_comments:
                            try:
                                j = json.loads(content)
                                extracted = extract_comments_from_payload(j)
                                if extracted:
                                    for ec in extracted:
                                        if not any(co['text'] == ec['text'] for co in comment_objs):
                                            comment_objs.append(ec)
                                            if len(comment_objs) >= MAX_COMMENTS: break
                            except: pass
                            if len(comment_objs) >= MAX_COMMENTS: break

                    if not comment_objs:
                        # Fallback 2: DOM fallback when everything else fails.
                        comment_objs = page.evaluate('''(max_c) => {
                            const out = [];
                            const seen = new Set();
                            const ban = [/^follow$/i, /^reply$/i, /^liked by/i, /^view replies/i];
                            const rows = Array.from(document.querySelectorAll('article ul ul li'));
                            for (const row of rows) {
                                const userEl = row.querySelector('h3 a, h3, a[href^="/"]');
                                const ownerUsername = (userEl?.textContent || 'unknown').trim().replace(/^@/, '') || 'unknown';
                                const spans = Array.from(row.querySelectorAll('span'));
                                let text = '';
                                for (const s of spans) {
                                    const t = (s.textContent || '').trim();
                                    if (!t) continue;
                                    if (ban.some(r => r.test(t))) continue;
                                    if (t.length < 2 || t.length > 500) continue;
                                    // Keep the longest candidate in the row; usually actual comment text.
                                    if (t.length > text.length) text = t;
                                }
                                if (!text) continue;
                                const key = ownerUsername + '|' + text;
                                if (seen.has(key)) continue;
                                seen.add(key);
                                out.push({ text, ownerUsername });
                                if (out.length >= max_c) break;
                            }
                            return out;
                        }''', MAX_COMMENTS) or []

                    if comment_objs:
                        it['latestComments'] = comment_objs[0:MAX_COMMENTS]
                        comments_processed_this_attempt += 1
                        print(f"[Scrapling] Captured {len(it['latestComments'])} comments for {it.get('shortCode')}", file=sys.stderr)
                    else:
                        print(f"[Scrapling] No comments captured for {it.get('shortCode')}", file=sys.stderr)
                except Exception as e:
                    print(f"[Scrapling] Comment extraction failed for {it.get('shortCode')}: {e}", file=sys.stderr)
                finally:
                    if it.get("id"):
                        comments_processed_posts.add(it.get("id"))
                    if it.get("shortCode"):
                        comments_processed_posts.add(it.get("shortCode"))
                    active_post["shortCode"] = None

        attempt_final_ids = set(items_map.keys())
        new_posts_this_attempt = len(attempt_final_ids - attempt_initial_ids)
        run_mode["new_posts_this_run"] = new_posts_this_attempt
        run_mode["session_exhausted_this_pass"] = bool(cursor_exhausted and scroll_exhausted)
        print(
            f"[Scrapling] Batch summary ({run_mode.get('name', 'single')}): "
            f"new_posts={new_posts_this_attempt}, "
            f"comments_processed={comments_processed_this_attempt}, "
            f"total_collected={len(items_map)}/{count}, "
            f"cursor_exhausted={cursor_exhausted}, "
            f"scroll_exhausted={scroll_exhausted}",
            file=sys.stderr
        )

    if mode == "advanced":
        # Mobile API first: use web_profile_info + GraphQL cursor pagination without browser UI.
        try:
            print("[Scrapling] Mobile API phase starting...", file=sys.stderr)
            mobile_payload = _try_mobile_profile_payload(username)
            if mobile_payload:
                m_items, m_pinfo, m_uid = map_to_apify_format(mobile_payload, username_context=username)
                if m_uid:
                    profile_user_id["value"] = m_uid
                if m_items:
                    update_items(m_items, m_pinfo)
                    print(f"[Scrapling] Mobile API seed captured {len(m_items)} items.", file=sys.stderr)

                # Cursor-driven pagination via mobile/web GraphQL endpoint
                mobile_cursor = last_page_info.get("end_cursor")
                rounds = 0
                while len(items_map) < count and mobile_cursor and rounds < 12:
                    rounds += 1
                    before = len(items_map)
                    page_payload = _mobile_graphql_page(
                        profile_user_id["value"] or "",
                        cursor=mobile_cursor,
                        reels=False,
                        page_size=min(50, max(12, count))
                    )
                    if not page_payload:
                        break
                    p_items, p_info, _ = map_to_apify_format(page_payload, username_context=username)
                    if isinstance(p_info, dict) and (p_info.get("end_cursor") or "has_next_page" in p_info):
                        update_items([], p_info)
                    if p_items:
                        update_items(p_items, p_info)
                    after = len(items_map)
                    next_cursor = (p_info or {}).get("end_cursor") if isinstance(p_info, dict) else None
                    print(f"[Scrapling] Mobile Cursor {rounds}: Total {after} items captured", file=sys.stderr)
                    # Hard guard: no growth + same cursor => exhausted
                    if after <= before and (not next_cursor or next_cursor == mobile_cursor):
                        break
                    mobile_cursor = next_cursor or mobile_cursor

                # Reels API pagination pass when all/reels requested
                if content_type in ("all", "reels") and profile_user_id["value"] and len(items_map) < count:
                    reels_cursor = last_page_info.get("end_cursor")
                    reels_round = 0
                    while len(items_map) < count and reels_round < 8:
                        reels_round += 1
                        before = len(items_map)
                        reels_payload = _mobile_graphql_page(
                            profile_user_id["value"],
                            cursor=reels_cursor,
                            reels=True,
                            page_size=min(50, max(12, count))
                        )
                        if not reels_payload:
                            break
                        r_items, r_info, _ = map_to_apify_format(reels_payload, username_context=username)
                        if isinstance(r_info, dict) and (r_info.get("end_cursor") or "has_next_page" in r_info):
                            update_items([], r_info)
                        if r_items:
                            update_items(r_items, r_info)
                        after = len(items_map)
                        next_cursor = (r_info or {}).get("end_cursor") if isinstance(r_info, dict) else None
                        print(f"[Scrapling] Mobile Reels Cursor {reels_round}: Total {after} items captured", file=sys.stderr)
                        if after <= before and (not next_cursor or next_cursor == reels_cursor):
                            break
                        reels_cursor = next_cursor or reels_cursor
            else:
                print("[Scrapling] Mobile API phase returned no seed payload.", file=sys.stderr)
        except Exception as e:
            print(f"[Scrapling] Mobile API phase failed: {e}", file=sys.stderr)

    if len(items_map) >= count:
        res = list(items_map.values())
        res.sort(key=lambda x: x['timestamp'], reverse=True)
        res = filter_items(res, content_type)
        return res[0:count]

    # Use a persistent temp dir per user to build trust with Instagram
    tmp_dir = os.path.join(tempfile.gettempdir(), f"instainsight_{username}")

    proxy_env = os.environ.get("SCRAPLING_PROXIES") or os.environ.get("SCRAPLING_PROXY")
    proxy_pool = [p.strip() for p in (proxy_env or "").split(",") if p.strip()]

    attempts = [
        {
            "name": "stealth_headless_prewarm",
            "session_cls": StealthySession,
            "headless": True,
            "google_search": False,
            "warmup": True,
            "real_chrome": False,
            "rotations": 3,
        },
        {
            "name": "stealth_headless_search_bootstrap",
            "session_cls": StealthySession,
            "headless": True,
            "google_search": True,
            "warmup": True,
            "real_chrome": False,
            "rotations": 2,
        },
        {
            "name": "stealth_headful_prewarm",
            "session_cls": StealthySession,
            "headless": False,
            "google_search": False,
            "warmup": True,
            "real_chrome": True,
            "rotations": 2,
        },
        {
            "name": "dynamic_headless_fallback",
            "session_cls": DynamicSession,
            "headless": True,
            "google_search": False,
            "warmup": True,
            "real_chrome": False,
            "rotations": 2,
        },
    ]

    for idx, attempt in enumerate(attempts):
        if stop_all_attempts["value"]:
            break
        if len(items_map) >= count:
            break

        for rotation in range(attempt["rotations"]):
            if stop_all_attempts["value"]:
                break
            if len(items_map) >= count:
                break

            label = f"{attempt['name']}#{rotation + 1}"
            run_mode.update({"name": label, "warmup": attempt["warmup"], "login_wall": False})
            print(
                f"[Scrapling] Fetch attempt {idx + 1}/{len(attempts)} "
                f"(session {rotation + 1}/{attempt['rotations']}): {attempt['name']}",
                file=sys.stderr
            )

            session_dir = f"{tmp_dir}_{attempt['name']}_{rotation + 1}"
            session_kwargs = {
                "headless": attempt["headless"],
                "user_data_dir": session_dir,
                "timeout": 180000,
                "solve_cloudflare": True,
                "google_search": attempt["google_search"],
                "real_chrome": attempt["real_chrome"],
            }

            # Preserve behavior if caller passes valid cookies.
            if session_cookies:
                session_kwargs["cookies"] = session_cookies

            if proxy_pool:
                proxy = proxy_pool[(idx + rotation) % len(proxy_pool)]
                session_kwargs["proxy"] = proxy
                print(f"[Scrapling] Using configured proxy for session rotation {rotation + 1}.", file=sys.stderr)

            try:
                with attempt["session_cls"](**session_kwargs) as session:
                    entry_urls = [target_url]
                    if content_type in ("all", "reels"):
                        entry_urls.append(f"https://www.instagram.com/{username}/reels/")
                    max_passes = 4
                    for pass_idx in range(max_passes):
                        if len(items_map) >= count:
                            break
                        before_pass = len(items_map)
                        entry_url = entry_urls[pass_idx % len(entry_urls)]
                        run_mode.update({
                            "name": f"{label}/pass{pass_idx + 1}",
                            "warmup": attempt["warmup"] if (pass_idx == 0 and mode != "legacy") else False,
                            "login_wall": False,
                            "new_posts_this_run": 0,
                            "session_exhausted_this_pass": False,
                        })
                        _call_fetch_with_supported(
                            session.fetch,
                            entry_url,
                            page_action=run_browser,
                            timeout=180000
                        )
                        after_pass = len(items_map)
                        gained = after_pass - before_pass
                        print(
                            f"[Scrapling] Session progress ({run_mode.get('name')}): "
                            f"gained={gained}, total={after_pass}/{count}",
                            file=sys.stderr
                        )
                        if after_pass >= count:
                            break
                        if run_mode.get("login_wall"):
                            break
                        if gained <= 0 and run_mode.get("session_exhausted_this_pass"):
                            break
            except Exception as e:
                print(f"[Scrapling] Attempt '{label}' failed: {e}", file=sys.stderr)

            # Hard guard: if we keep getting same first-page IDs with no net growth, stop looping attempts.
            current_sorted_ids = sorted([str(x.get("id")) for x in items_map.values() if x.get("id")])
            first_page_fp = tuple(current_sorted_ids[:12])
            if first_page_fp:
                seen_first_page_fingerprints.append(first_page_fp)
                if len(seen_first_page_fingerprints) >= 2:
                    if seen_first_page_fingerprints[-1] == seen_first_page_fingerprints[-2] and len(items_map) < count:
                        print(
                            "[Scrapling] Guard triggered: repeated identical first-page fingerprint across sessions. "
                            "Stopping further session rotations.",
                            file=sys.stderr
                        )
                        stop_all_attempts["value"] = True
                        break

            if len(items_map) >= count:
                print(f"[Scrapling] Attempt '{label}' reached target with {len(items_map)} items.", file=sys.stderr)
                break

            if run_mode.get("login_wall"):
                print(f"[Scrapling] Block/login wall detected on '{label}'. Rotating session...", file=sys.stderr)
            else:
                print(
                    f"[Scrapling] Session '{label}' exhausted/stalled below target "
                    f"({len(items_map)}/{count}). Rotating session...",
                    file=sys.stderr
                )
            time.sleep(1.0 + (rotation * 0.8))

    res = list(items_map.values())
    res.sort(key=lambda x: x['timestamp'], reverse=True)
    res = filter_items(res, content_type)
    
    if last_page_info:
        with open('pagination_info.json', 'w') as f:
            json.dump(last_page_info, f)
            
    return res[0:count]

if __name__ == "__main__":
    try:
        u = sys.argv[1] if len(sys.argv) > 1 else ""
        cookie_path = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "NONE" else None
        content_type = sys.argv[3] if len(sys.argv) > 3 else "all"
        try:
            n = int(sys.argv[4]) if len(sys.argv) > 4 else 12
        except (TypeError, ValueError):
            n = 12
        include_comments = sys.argv[5] != "0" if len(sys.argv) > 5 else True
        existing_posts_arg = sys.argv[6] if len(sys.argv) > 6 else "NONE"
        scrape_mode = sys.argv[7] if len(sys.argv) > 7 else "advanced"

        existing_posts = set(existing_posts_arg.split(',')) if existing_posts_arg != "NONE" and existing_posts_arg else set()

        results = scrape_instagram(
            u,
            count=n,
            cookie_path=cookie_path,
            content_type=content_type,
            include_comments=include_comments,
            existing_posts=existing_posts,
            scrape_mode=scrape_mode
        )

        # Debug dump to local file as requested
        try:
            with open('scraped_data_debug.json', 'w', encoding='utf-8') as f:
                json.dump({
                    "username": u,
                    "timestamp": time.ctime(),
                    "count": len(results),
                    "items": results
                }, f, indent=2, ensure_ascii=False)
            print(f"[Scrapling] Debug dump saved to scraped_data_debug.json", file=sys.stderr)
        except Exception as e:
            print(f"[Scrapling] Failed to save debug dump: {e}", file=sys.stderr)

        print(json.dumps(results))
    except Exception as e:
        # Do not crash the process on scraper-side failures.
        # Returning [] allows the Node layer to trigger Apify fallback reliably.
        print(f"[Scrapling] Fatal error at entrypoint: {e}", file=sys.stderr)
        print("[]")
