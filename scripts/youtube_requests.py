"""Find requested songs through YouTube Data API and update the public catalog."""
import hashlib
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path


def song_request(issue):
    if 'pull_request' in issue or not (issue.get('title') or '').startswith('Petición musical:'):
        return None
    fields = {}
    for heading, content in re.findall(r'^### ([^\n]+)\n+(.*?)(?=^### |\Z)', issue.get('body') or '', re.M | re.S):
        fields[heading.strip()] = content.strip()
    title, artist = fields.get('Canción', ''), fields.get('Artista', '')
    if not title or not artist or any(len(s) > 120 or '\n' in s for s in (title, artist)):
        return None
    query = f'{title} {artist}'
    key = hashlib.sha256(query.casefold().encode()).hexdigest()
    return {'title': title, 'artist': artist, 'query': query, 'key': key, 'request': issue['number']}


def youtube_search(query, api_key):
    params = urllib.parse.urlencode({'part': 'snippet', 'type': 'video', 'q': query,
                                    'videoEmbeddable': 'true', 'videoSyndicated': 'true', 'maxResults': 1})
    request = urllib.request.Request('https://www.googleapis.com/youtube/v3/search?' + params,
                                     headers={'X-Goog-Api-Key': api_key, 'User-Agent': 'JohanMusic'})
    with urllib.request.urlopen(request, timeout=30) as response:
        items = json.load(response).get('items', [])
    if not items:
        return None
    item = items[0]
    identifier = item.get('id', {}).get('videoId', '')
    if not re.fullmatch(r'[A-Za-z0-9_-]{11}', identifier):
        raise ValueError('YouTube returned an invalid video ID')
    return {'id': identifier, 'youtubeTitle': item['snippet']['title']}


def github_requests(repository, token):
    for page in range(1, 101):
        query = urllib.parse.urlencode({'state': 'open', 'per_page': 100, 'page': page})
        request = urllib.request.Request(f'https://api.github.com/repos/{repository}/issues?{query}',
                                         headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json', 'User-Agent': 'JohanMusic'})
        with urllib.request.urlopen(request, timeout=30) as response:
            batch = json.load(response)
        yield from batch
        if len(batch) < 100:
            return
    raise RuntimeError('Too many requests; refusing incomplete scan')


def update_catalog(existing, issues, search, previous_misses=()):
    tracks = list(existing)
    keys = {entry['key'] for entry in tracks}
    misses = set(previous_misses)
    attempts = 0
    for issue in sorted(issues, key=lambda i: i['number']):
        request = song_request(issue)
        if not request or request['key'] in keys or request['key'] in misses:
            continue
        # Bound API consumption per run. Later requests remain in the queue.
        if attempts >= 10:
            break
        result = search(request['query'])
        attempts += 1
        if result:
            tracks.append({**request, **result})
            keys.add(request['key'])
        else:
            misses.add(request['key'])
    return tracks, sorted(misses)


if __name__ == '__main__':
    path = Path('videos.json')
    existing = json.loads(path.read_text())
    api_key = os.environ.get('YOUTUBE_API_KEY')
    if not api_key:
        print('::warning::YOUTUBE_API_KEY is not configured. Song search is pending; publishing existing catalog only.')
    else:
        requests = github_requests(os.environ['GITHUB_REPOSITORY'], os.environ['GITHUB_TOKEN'])
        misses_path = Path('youtube-misses.json')
        misses = json.loads(misses_path.read_text()) if misses_path.exists() else []
        result, misses = update_catalog(existing, requests, lambda q: youtube_search(q, api_key), misses)
        misses_path.write_text(json.dumps(misses) + '\n')
        if result != existing:
            path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
        print(f'{len(result)} YouTube songs in catalog')
    Path('youtube-status.json').write_text(json.dumps({'searchEnabled': bool(api_key)}) + '\n')
