import os
from pathlib import Path
from dotenv import load_dotenv
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH, override=True)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

if not YOUTUBE_API_KEY:
    raise RuntimeError(f"YOUTUBE_API_KEY is missing. Please check {ENV_PATH}")


def search_youtube_videos(query: str, max_results: int = 5):
    try:
        youtube = build(
            "youtube",
            "v3",
            developerKey=YOUTUBE_API_KEY,
            cache_discovery=False
        )

        request = youtube.search().list(
            q=query,
            part="snippet",
            type="video",
            maxResults=max_results
        )

        response = request.execute()

        videos = []

        for item in response.get("items", []):
            video_id = item["id"]["videoId"]
            snippet = item["snippet"]

            videos.append({
                "video_id": video_id,
                "title": snippet.get("title", ""),
                "description": snippet.get("description", ""),
                "channel_title": snippet.get("channelTitle", ""),
                "published_at": snippet.get("publishedAt", ""),
                "thumbnail_url": snippet.get("thumbnails", {})
                    .get("medium", {})
                    .get("url", ""),
                "url": f"https://www.youtube.com/watch?v={video_id}"
            })

        return {
            "query": query,
            "videos": videos
        }

    except HttpError as e:
        raise RuntimeError(f"YouTube API error: {e}")