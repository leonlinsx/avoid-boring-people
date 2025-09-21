import os
import tweepy
from dotenv import load_dotenv

load_dotenv()  # loads .env into environment

def main():
    client = tweepy.Client(
        consumer_key=os.getenv("TWITTER_API_KEY"),
        consumer_secret=os.getenv("TWITTER_API_SECRET"),
        access_token=os.getenv("TWITTER_ACCESS_TOKEN"),
        access_token_secret=os.getenv("TWITTER_ACCESS_SECRET"),
    )

    # Dry-run: just try to post a test tweet
    try:
        response = client.create_tweet(text="Test tweet from automation script 🚀 (delete me)")
        print("✅ Tweet posted:", response.data)
    except Exception as e:
        print("❌ Error:", e)

if __name__ == "__main__":
    main()
