#!/usr/bin/env python3
"""Read a production Run and its masked log from the official Ainize API."""
import argparse
import json
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('organization')
    parser.add_argument('project')
    parser.add_argument('revision', help='Run ID or full commit SHA')
    args = parser.parse_args()
    if not re.fullmatch(r'run_[0-9a-f]{16}|[0-9a-f]{40}', args.revision):
        parser.error('expected a Run ID or a full commit SHA')
    key = Path('.ainize_key').read_text().strip()
    opener = build_opener(NoRedirect)

    def get(path, plain=False):
        req = Request('https://ainize.ai/api/' + path, headers={
            'Authorization': 'Bearer ' + key, 'Accept': 'text/plain' if plain else 'application/json'})
        with opener.open(req, timeout=20) as response:
            content = response.read(8 * 1024 * 1024 + 1)
            if len(content) > 8 * 1024 * 1024:
                raise ValueError('Response too large. Inspect the Run in the dashboard.')
            return content.decode() if plain else json.loads(content)

    project = get('projects/by-name?' + urlencode({'org': args.organization, 'repo': args.project}))
    pid = project['id']
    if not re.fullmatch(r'prj_[0-9a-f]{16}', pid):
        raise ValueError('Invalid project ID')
    runs = get(f'projects/{pid}/runs')['runs']
    matches = [r for r in runs if r.get('executionBackend') == 'host-release'
               and args.revision in (r['id'], r['sha'])]
    if not matches:
        raise ValueError('No matching production Run in the selected project.')
    for run in sorted(matches, key=lambda r: r['createdAt'], reverse=True):
        if not re.fullmatch(r'run_[0-9a-f]{16}', run['id']):
            raise ValueError('Invalid Run ID')
        fields = ('id', 'sha', 'status', 'exitCode', 'previousFailedRunId', 'managedRelease')
        print(json.dumps({k: run[k] for k in fields if k in run}, ensure_ascii=False))
        log = get('deployments/' + run['id'] + '/log', plain=True)
        for line in log.splitlines():
            if line.startswith(('[host CI]', '[host release]', '[Ainmem host]')):
                print(line[:1500])


if __name__ == '__main__':
    try:
        main()
    except HTTPError as exc:
        sys.exit(f'Ainize returned HTTP {exc.code}. Check project access and the Run ID.')
    except (URLError, OSError, ValueError, KeyError) as exc:
        sys.exit(f'Could not read the production Run: {exc}')
