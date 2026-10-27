"""Deploy the request service using a securely injected Cloudflare API token."""
import json
import os
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://api.cloudflare.com/client/v4'
NAME = 'johan-music-requests-mp3-2'
TAG = 'johan-music-mp3-2'


def api(path, token, method='GET', data=None, multipart=None):
    headers = {'Authorization': f'Bearer {token}', 'User-Agent': 'JohanMusic-Deployment'}
    if multipart:
        body, content_type = multipart
        headers['Content-Type'] = content_type
    elif data is not None:
        body = json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
    else:
        body = None
    request = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'Cloudflare request {method} {path} returned HTTP {error.code}') from None
    if not result.get('success'):
        codes = [item.get('code') for item in result.get('errors', [])]
        raise RuntimeError(f'Cloudflare rejected {method} {path}; error codes: {codes}')
    return result.get('result')


def worker_payload(database_id):
    metadata = {'main_module': 'worker.mjs', 'compatibility_date': '2025-01-01', 'tags': [TAG],
                'bindings': [{'type': 'd1', 'name': 'CATALOG', 'id': database_id},
                             {'type': 'plain_text', 'name': 'ALLOWED_ORIGIN', 'text': 'https://albertojohan88.github.io'}]}
    boundary = '----JohanMusic' + uuid.uuid4().hex
    parts = []
    for name, filename, content_type, contents in [
        ('metadata', None, 'application/json', json.dumps(metadata).encode()),
        ('worker.mjs', 'worker.mjs', 'application/javascript+module', (ROOT / 'cloudflare/worker.mjs').read_bytes())
    ]:
        disposition = f'Content-Disposition: form-data; name="{name}"'
        if filename:
            disposition += f'; filename="{filename}"'
        parts.append(f'--{boundary}\r\n{disposition}\r\nContent-Type: {content_type}\r\n\r\n'.encode() + contents + b'\r\n')
    parts.append(f'--{boundary}--\r\n'.encode())
    return b''.join(parts), 'multipart/form-data; boundary=' + boundary


def main():
    token = os.environ.get('CLOUDFLARE_API_TOKEN')
    if not token:
        raise RuntimeError('CLOUDFLARE_API_TOKEN is missing. Add it in secure environment settings, never in chat or source code.')
    account = os.environ.get('CLOUDFLARE_ACCOUNT_ID')
    if not account:
        accounts = api('/accounts?per_page=50', token)
        if len(accounts) != 1:
            raise RuntimeError('Token can access multiple/no accounts; set non-secret CLOUDFLARE_ACCOUNT_ID to choose the intended account.')
        account = accounts[0]['id']
    if not account.isalnum():
        raise RuntimeError('Invalid account ID')
    prefix = f'/accounts/{account}'
    # Do not silently replace an unrelated service with the same name.
    scripts = api(prefix + '/workers/scripts', token)
    existing = next((script for script in scripts if script.get('id') == NAME), None)
    if existing and TAG not in existing.get('tags', []):
        raise RuntimeError('Worker name already exists and is not managed by this project. Review it before deployment.')
    subdomain = api(prefix + '/workers/subdomain', token).get('subdomain')
    if not subdomain:
        raise RuntimeError('Enable a workers.dev subdomain in Cloudflare Workers dashboard, then retry.')
    databases = api(prefix + '/d1/database?name=johan-music-catalog', token)
    matching = [db for db in databases if db['name'] == 'johan-music-catalog']
    if len(matching) > 1:
        raise RuntimeError('Multiple matching databases; review before deployment.')
    database = matching[0] if matching else api(prefix + '/d1/database', token, 'POST', {'name': 'johan-music-catalog'})
    database_id = database['uuid']
    statements = [statement.strip() for statement in (ROOT / 'cloudflare/schema.sql').read_text().split(';') if statement.strip()]
    for statement in statements:
        api(prefix + f'/d1/database/{database_id}/query', token, 'POST', {'sql': statement, 'params': []})
    api(prefix + f'/workers/scripts/{NAME}', token, 'PUT', multipart=worker_payload(database_id))
    api(prefix + f'/workers/scripts/{NAME}/subdomain', token, 'POST', {'enabled': True})
    url = f'https://{NAME}.{subdomain}.workers.dev'
    # workers.dev may reject the default Python User-Agent before reaching the Worker.
    browser_headers = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'}
    with urllib.request.urlopen(urllib.request.Request(url + '/api/health', headers=browser_headers), timeout=30) as response:
        if json.load(response).get('service') != 'JohanMusic':
            raise RuntimeError('Deployed service failed health check; frontend configuration was not changed.')
    with urllib.request.urlopen(urllib.request.Request(url + '/api/tracks', headers=browser_headers), timeout=30) as response:
        if not isinstance(json.load(response).get('tracks'), list):
            raise RuntimeError('Database readiness check failed; frontend configuration was not changed.')
    (ROOT / 'site-config.json').write_text(json.dumps({'apiBase': url}) + '\n')
    print('Service deployed and database checked. Frontend endpoint saved in site-config.json:', url)
    print('Publish site-config.json to connect the site. Test a real song request before claiming catalog playback works.')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError) as error:
        raise SystemExit(str(error)) from None
