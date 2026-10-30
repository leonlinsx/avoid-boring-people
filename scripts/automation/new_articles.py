"""Detect new publication, including draft -> published; never publish anything."""
import argparse
from pathlib import PurePosixPath, Path
import subprocess
import frontmatter

CONTENT_PREFIX = 'src/content/blog/'


def is_draft(markdown: str) -> bool:
    value = frontmatter.loads(markdown).get('draft', False)
    if not isinstance(value, bool):
        raise ValueError('Article draft must be true or false')
    return value


def local_article_is_draft(post_id: str) -> bool:
    relative = PurePosixPath(post_id)
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Invalid article id')
    source = Path(CONTENT_PREFIX) / post_id
    return source.is_file() and is_draft(source.read_text(encoding='utf-8'))


def git_source(revision: str, name: str) -> str | None:
    result = subprocess.run(['git', 'show', f'{revision}:{name}'], capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else None


def newly_published(before: str, after: str) -> list[str]:
    if not before or set(before) == {'0'}:
        return []
    subprocess.run(['git', 'rev-parse', '--verify', f'{before}^{{commit}}'], check=True, capture_output=True)
    changes = iter(subprocess.check_output([
        'git', 'diff', '--name-status', '-z', '--diff-filter=AMR', before, after,
        '--', CONTENT_PREFIX,
    ], text=True).rstrip('\0').split('\0'))
    result = []
    for status in changes:
        if not status:
            continue
        previous_name = next(changes)
        name = next(changes) if status.startswith('R') else previous_name
        if not name.endswith(('/index.md', '/index.mdx')):
            continue
        current = git_source(after, name)
        previous = git_source(before, previous_name)
        if current is not None and not is_draft(current) and (previous is None or is_draft(previous)):
            result.append(name.removeprefix(CONTENT_PREFIX))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--before', default='')
    parser.add_argument('--after', required=True)
    parser.add_argument('--manual', default='')
    args = parser.parse_args()
    if args.manual:
        post_id = args.manual.removeprefix(CONTENT_PREFIX)
        if local_article_is_draft(post_id):
            raise ValueError('Draft article cannot be distributed')
        print(post_id)
    else:
        for post_id in newly_published(args.before, args.after):
            print(post_id)


if __name__ == '__main__':
    main()
