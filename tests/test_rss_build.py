"""Distribution-level checks against Astro's built RSS document."""
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET


def test_built_rss_is_distribution_quality():
    feed = Path("dist/client/rss.xml")
    if not feed.exists():
        raise AssertionError("dist/client/rss.xml is missing; run `npm run build` before pytest")
    root = ET.parse(feed).getroot()
    channel = root.find("channel")
    assert channel is not None and channel.findtext("language") == "en"
    items = channel.findall("item")
    assert len(items) >= 20
    dates = [item.findtext("pubDate") for item in items]
    from email.utils import parsedate_to_datetime
    assert [parsedate_to_datetime(value) for value in dates] == sorted(
        (parsedate_to_datetime(value) for value in dates), reverse=True
    )
    ns = {"dc": "http://purl.org/dc/elements/1.1/", "media": "http://search.yahoo.com/mrss/"}
    assert any(item.find("enclosure") is not None for item in items)
    for item in items:
        link = item.findtext("link")
        guid = item.findtext("guid")
        assert link == guid and urlparse(link).scheme == "https" and urlparse(link).netloc == "leonlins.com"
        assert item.findtext("dc:creator", namespaces=ns) == "Leon Lin"
        assert item.findtext("category")
        assert item.findtext("description")
        enclosure = item.find("enclosure")
        media = item.find("media:content", ns)
        if enclosure is not None:
            image = enclosure.attrib["url"]
            assert urlparse(image).scheme == "https" and urlparse(image).netloc
            assert media is not None and media.attrib["url"] == image


if __name__ == "__main__":
    test_built_rss_is_distribution_quality()
    print("Built RSS validation passed")
