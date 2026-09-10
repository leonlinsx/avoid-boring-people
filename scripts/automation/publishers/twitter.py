import os
import tweepy
from dotenv import load_dotenv

load_dotenv()  # ✅ load .env if present

TWEET_CHAR_LIMIT = 280


def _validate_tweet(text: str) -> None:
    if len(text) > TWEET_CHAR_LIMIT:
        raise ValueError(
            f"Tweet exceeds the {TWEET_CHAR_LIMIT}-character limit ({len(text)} characters)"
        )


def get_twitter_client():
    client = tweepy.Client(
        consumer_key=os.getenv("TWITTER_API_KEY"),
        consumer_secret=os.getenv("TWITTER_API_SECRET"),
        access_token=os.getenv("TWITTER_ACCESS_TOKEN"),
        access_token_secret=os.getenv("TWITTER_ACCESS_SECRET"),
    )
    return client

def post_single(client, post):
    text = f"{post['title']}\n\n{post['url']}"
    _validate_tweet(text)
    response = client.create_tweet(text=text)
    print("✅ Posted single tweet:", text)
    return response

def post_thread(client, tweets: list[str]):
    if not tweets:
        print("⚠️ No tweets to post.")
        return None

    # Validate every tweet before the first API call so a late
    # over-length tweet can never leave a partially posted thread.
    for text in tweets:
        _validate_tweet(text)

    responses = []

    # First tweet
    first = client.create_tweet(text=tweets[0])
    first_id = first.data["id"]
    responses.append(first)
    print(f"✅ Tweet 1 posted: {tweets[0]}")

    # Replies
    last_id = first_id
    for i, text in enumerate(tweets[1:], start=2):
        resp = client.create_tweet(text=text, in_reply_to_tweet_id=last_id)
        last_id = resp.data["id"]
        responses.append(resp)
        print(f"✅ Tweet {i} posted: {text}")

    return responses
