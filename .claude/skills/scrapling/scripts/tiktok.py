"""Scrape public TikTok data with Scrapling (no login).

Usage:
  python -I tiktok.py profile <handle>                 -> profile + stats JSON
  python -I tiktok.py videos <ids_file> <out.json>     -> full caption + stats per video id

What works logged-out (verified 2026-10): the profile page and single video pages
embed JSON in #__UNIVERSAL_DATA_FOR_REHYDRATION__, so plain HTTP with browser
impersonation is enough. The profile's video grid, playlists and item_list APIs
come back empty to anonymous sessions, so get video ids from a search engine
(site:tiktok.com/@<handle>/video) and fetch them one by one.
"""
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from scrapling.fetchers import Fetcher


def rehydration(url):
    page = Fetcher.get(url, impersonate="chrome", stealthy_headers=True, timeout=30)
    blob = page.css("#__UNIVERSAL_DATA_FOR_REHYDRATION__::text").get()
    if not blob:
        raise RuntimeError(f"no rehydration data (status {page.status})")
    return json.loads(blob)["__DEFAULT_SCOPE__"]


def profile(handle):
    info = rehydration(f"https://www.tiktok.com/@{handle}")["webapp.user-detail"]["userInfo"]
    user = info["user"]
    return {
        "handle": handle,
        "nickname": user.get("nickname"),
        "bio": user.get("signature"),
        "link": (user.get("bioLink") or {}).get("link"),
        "stats": info.get("stats"),
    }


def video(vid, handle="_"):
    err = ""
    for _ in range(2):
        try:
            item = rehydration(f"https://www.tiktok.com/@{handle}/video/{vid}")[
                "webapp.video-detail"]["itemInfo"]["itemStruct"]
            s = item.get("statsV2") or item.get("stats") or {}
            return {
                "id": vid,
                "created": time.strftime("%Y-%m-%d", time.gmtime(int(item.get("createTime", 0)))),
                "plays": int(s.get("playCount", 0)),
                "likes": int(s.get("diggCount", 0)),
                "comments": int(s.get("commentCount", 0)),
                "shares": int(s.get("shareCount", 0)),
                "saves": int(s.get("collectCount", 0) or 0),
                "duration": (item.get("video") or {}).get("duration"),
                "desc": item.get("desc", ""),
            }
        except Exception as e:  # rate limit or transient block: retry once
            err = str(e)[:120]
            time.sleep(2)
    return {"id": vid, "error": err}


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "profile":
        print(json.dumps(profile(sys.argv[2]), indent=1, ensure_ascii=False))
    elif cmd == "videos":
        ids = sorted(set(open(sys.argv[2]).read().split()))
        with ThreadPoolExecutor(6) as ex:
            rows = list(ex.map(video, ids))
        json.dump(rows, open(sys.argv[3], "w"), indent=1, ensure_ascii=False)
        print(f"fetched {sum('error' not in r for r in rows)}/{len(rows)} -> {sys.argv[3]}")
    else:
        print(__doc__)
