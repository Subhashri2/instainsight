import sys
import json
import os
import re
import time
import tempfile
from scrapling.fetchers import FetcherSession, StealthyFetcher

def map_to_apify_format(user_data):
    """
    Maps Instagram web_profile_info JSON to Apify instagram-scraper format.
    """
    user = user_data.get('data', {}).get('user', {})
    if not user:
        # Check for alternative key names
        user = user_data.get('user', {})
        if not user:
            return []

    followers = user.get('edge_followed_by', {}).get('count') or user.get('follower_count') or 0
    following = user.get('edge_follow', {}).get('count') or user.get('following_count') or 0
    posts = user.get('edge_owner_to_timeline_media', {}).get('count') or user.get('media_count') or 0
    pic = user.get('profile_pic_url_hd') or user.get('profile_pic_url')

    common_info = {
        "ownerUsername": user.get('username'),
        "ownerFullName": user.get('full_name'),
        "followersCount": followers,
        "followsCount": following,
        "postsCount": posts,
        "profilePicUrl": pic,
        "businessCategoryName": user.get('category_name'),
        "isBusinessAccount": user.get('is_business_account'),
        "biography": user.get('biography'),
        "user": {
            "username": user.get('username'),
            "fullName": user.get('full_name'),
            "followersCount": followers,
            "followingCount": following,
            "postsCount": posts,
            "profilePicUrl": pic,
            "categoryName": user.get('category_name'),
            "biography": user.get('biography'),
        },
        "owner": {
            "username": user.get('username'),
            "fullName": user.get('full_name'),
            "followersCount": followers,
            "followingCount": following,
            "profilePicUrl": pic,
            "categoryName": user.get('category_name'),
            "biography": user.get('biography'),
        }
    }

    items = []
    edges = user.get('edge_owner_to_timeline_media', {}).get('edges', [])
    for edge in edges:
        node = edge.get('node', {})
        
        caption = ""
        caption_edges = node.get('edge_media_to_caption', {}).get('edges', [])
        if caption_edges:
            caption = caption_edges[0].get('node', {}).get('text', "")

        latest_comments = []
        comment_edges = node.get('edge_media_to_parent_comment', {}).get('edges', [])
        for c_edge in comment_edges:
            c_node = c_edge.get('node', {})
            latest_comments.append({
                "text": c_node.get('text'),
                "ownerUsername": c_node.get('owner', {}).get('username')
            })

        item = {
            **common_info,
            "id": node.get('id'),
            "shortCode": node.get('shortcode'),
            "type": "Video" if node.get('is_video') else "Image",
            "caption": caption,
            "likesCount": node.get('edge_media_preview_like', {}).get('count', 0) or node.get('like_count', 0),
            "commentsCount": node.get('edge_media_to_comment', {}).get('count', 0) or node.get('comment_count', 0),
            "videoViewCount": node.get('video_view_count') or node.get('play_count') or 0,
            "displayUrl": node.get('display_url'),
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime(node.get('taken_at_timestamp', 0))),
            "latestComments": latest_comments,
            "hashtags": re.findall(r'#(\w+)', caption),
            "url": f"https://www.instagram.com/p/{node.get('shortcode')}/"
        }
        items.append(item)
    
    return items

def scrape_instagram(username, cookie_file=None, content_type='all', count=12):
    """
    Refined Scrapling strategy for loginless Instagram scraping.
    """
    # ── Strategy 1: TLS Impersonation (Fastest/More Robust) ──
    # Uses curl_cffi via FetcherSession to mimic a real Chrome TLS/HTTP fingerprint.
    # Bypasses the 302 login wall by hititng the JSON API directly with headers.
    print(f"[Scrapling] Strategy 1: Using FetcherSession with chrome110 impersonation...", file=sys.stderr)
    api_url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"
    headers = {
        "X-IG-App-ID": "936619743392459",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"https://www.instagram.com/{username}/",
        "Accept": "*/*",
    }
    
    try:
        with FetcherSession(impersonate='chrome110', headers=headers) as session:
            response = session.get(api_url)
            if response.status == 200:
                text = response.text
                # Check if it's actually HTML (login wall)
                if "<!doctype html>" in text.lower() or "login" in text[:500].lower():
                     print("[Scrapling] Strategy 1 got HTML (login wall). Falling back...", file=sys.stderr)
                else:
                    try:
                        data = response.json()
                        if data.get('data', {}).get('user'):
                            items = map_to_apify_format(data)
                            if items:
                                print(f"[Scrapling] ✅ Strategy 1 success! Got {len(items)} posts.", file=sys.stderr)
                                return filter_and_limit_items(items, content_type, count)
                    except Exception as e:
                        print(f"[Scrapling] Strategy 1 JSON error: {e}", file=sys.stderr)
            else:
                print(f"[Scrapling] Strategy 1 API returned status {response.status}.", file=sys.stderr)
    except Exception as e:
        print(f"[Scrapling] Strategy 1 error: {e}", file=sys.stderr)

    # ── Strategy 2: Rendered XHR Interception (Headless Browser) ──
    print("[Scrapling] Strategy 2: StealthyFetcher with XHR interception...", file=sys.stderr)
    captured_data = []

    def intercept_network(page):
        def on_response(response):
            try:
                if "web_profile_info" in response.url and username.lower() in response.url.lower():
                    if response.status == 200:
                        try:
                            body = response.json()
                            if body.get('data', {}).get('user'):
                                captured_data.append(body)
                        except Exception: pass
            except Exception: pass
        page.on("response", on_response)
        try:
            page.wait_for_selector('article, ._aabd', timeout=12000)
        except Exception: pass

    try:
        # Use a fresh temporary directory to avoid profile lock issues
        scrapling_dir = os.path.join(tempfile.gettempdir(), f"scrapling_ig_{username}_{int(time.time())}")
        page = StealthyFetcher.fetch(
            f"https://www.instagram.com/{username}/",
            headless=True,
            network_idle=True,
            google_search=True,
            user_data_dir=scrapling_dir,
            page_action=intercept_network,
            timeout=25000,
        )
        
        if captured_data:
            items = map_to_apify_format(captured_data[0])
            if items:
                print(f"[Scrapling] ✅ Strategy 2 success via XHR!", file=sys.stderr)
                return filter_and_limit_items(items, content_type, count)
    except Exception as e:
        print(f"[Scrapling] Strategy 2 error: {e}", file=sys.stderr)

    # ── Strategy 3: Basic HTML metadata (Triggers Apify in server.ts) ──
    print("[Scrapling] Strategy 3: HTML metadata extraction fallback.", file=sys.stderr)
    try:
        # Re-use Strategy 1's lightweight session
        with FetcherSession(impersonate='chrome110') as session:
            url = f"https://www.instagram.com/{username}/"
            response = session.get(url)
            
            meta_desc = response.css('meta[name="description"]::attr(content)').get() or \
                        response.css('meta[property="og:description"]::attr(content)').get()
            
            profile_info = {
                "ownerUsername": username,
                "ownerFullName": username,
                "followersCount": 0,
                "followsCount": 0,
                "postsCount": 0,
            }

            if meta_desc:
                match = re.search(r'([\d\.,MKmk]+)\s+Followers?,\s+([\d\.,MKmk]+)\s+Following?,\s+([\d\.,MKmk]+)\s+Posts?', meta_desc)
                if match:
                    profile_info["followersCount"] = parse_insta_number(match.group(1))
                    profile_info["followsCount"] = parse_insta_number(match.group(2))
                    profile_info["postsCount"] = parse_insta_number(match.group(3))

            print(f"[Scrapling] Strategy 3 got profile stats: {profile_info.get('followersCount')} followers.", file=sys.stderr)
            return [profile_info]
    except Exception as e:
        print(f"[Scrapling] Strategy 3 error: {e}", file=sys.stderr)
        return []

def filter_and_limit_items(items, content_type, count):
    if content_type == 'reels':
        items = [item for item in items if item.get('type') == 'Video']
    elif content_type == 'posts':
        items = [item for item in items if item.get('type') == 'Image']
    return items[:count]

def parse_insta_number(val):
    if not val: return 0
    val = str(val).replace(',', '').lower()
    if 'm' in val:
        return int(float(val.replace('m', '')) * 1000000)
    if 'k' in val:
        return int(float(val.replace('k', '')) * 1000)
    try:
        return int(float(val))
    except:
        return 0

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python instagram_scrapling.py <username> [cookie_file] [content_type] [count]")
        sys.exit(1)
    
    user_to_scrape = sys.argv[1]
    cookies_path = sys.argv[2] if len(sys.argv) > 2 else "NONE"
    type_to_scrape = sys.argv[3] if len(sys.argv) > 3 else "all"
    num_to_scrape = int(sys.argv[4]) if len(sys.argv) > 4 else 12
    
    items = scrape_instagram(user_to_scrape, cookies_path, type_to_scrape, num_to_scrape)
    print(json.dumps(items))
