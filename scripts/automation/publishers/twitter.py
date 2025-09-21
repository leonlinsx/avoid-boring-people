import os
import tweepy
from dotenv import load_dotenv

load_dotenv()  # ✅ load .env if present

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
    response = client.create_tweet(text=text)
    print("✅ Posted single tweet:", text)
    return response

def post_thread(client, tweets: list[str]):
    if not tweets:
        print("⚠️ No tweets to post.")
        return None

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
