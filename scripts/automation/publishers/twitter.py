import os
import tweepy

def get_twitter_client():
    client = tweepy.Client(
        consumer_key=os.getenv("TWITTER_API_KEY"),
        consumer_secret=os.getenv("TWITTER_API_SECRET"),
        access_token=os.getenv("TWITTER_ACCESS_TOKEN"),
        access_token_secret=os.getenv("TWITTER_ACCESS_SECRET"),
    )
    return client

def post_single(client, post):
    """
    Post a single tweet with title + link
    """
    text = f"{post['title']}\n\n{post['url']}"
    response = client.create_tweet(text=text)
    print("✅ Posted:", text)
    return response
