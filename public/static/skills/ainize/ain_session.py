#!/usr/bin/env python3
"""Act in AIN Teams and Ainmem as the person who approved an AIN SSO device login.

AIN Teams and Ainmem take a browser session, not an Ainize API key. This helper turns one approved device login
into a session for either product and makes JSON calls with it. It prints the status and the JSON answer with
token-like values masked, and writes the unmasked answer to ./last.json (mode 600) for the next step to read.

  1. curl -fsSLO https://auth.comcom.ai/login.sh && bash login.sh --label "ainize skill" --out sso.cookie
     (open the printed https://auth.comcom.ai/device?code=… link and approve it)
  2. python3 ain_session.py login teams      # or: ainmem
  3. python3 ain_session.py call teams POST /api/channels '{"workspaceId":"…","name":"qa-myapp"}'

A Teams session lasts about an hour; run `login teams` again on 401 `expired`.
"""
import json, os, sys, urllib.parse, warnings
warnings.filterwarnings('ignore')
import requests

SSO = 'https://auth.comcom.ai'
APPS = {'teams': 'https://ainteams.ainetwork.ai', 'ainmem': 'https://ainmem.ainetwork.ai'}
MASK = ('token', 'secret', 'key', 'value', 'password')


def jar(app): return f'{app}.session.json'


def login(app):
    name, value = open('sso.cookie').read().strip().split('=', 1)
    sso, own = requests.Session(), requests.Session()
    sso.cookies.set(name, value, domain='auth.comcom.ai', secure=True)
    url = APPS[app] + '/api/auth/sso/start'
    for _ in range(25):
        on_sso = urllib.parse.urlsplit(url).netloc == 'auth.comcom.ai'
        r = (sso if on_sso else own).get(url, allow_redirects=False, timeout=30)
        loc = r.headers.get('location')
        if not loc: break
        url = urllib.parse.urljoin(url, loc)
        if '/interaction/' in url and urllib.parse.urlsplit(url).netloc == 'auth.comcom.ai':
            uid = url.split('/interaction/')[1].split('/')[0].split('?')[0]
            sso.get(url, allow_redirects=False, timeout=30)
            c = sso.post(f'{SSO}/api/interaction/{uid}/continue', json={}, headers={'Origin': SSO}, timeout=30)
            if c.status_code != 200: sys.exit(f'sign-in refused ({c.status_code}): is the device login still valid?')
            url = urllib.parse.urljoin(SSO, c.json()['redirectTo'])
    cookies = [{'name': c.name, 'value': c.value, 'domain': c.domain, 'path': c.path} for c in own.cookies]
    if not cookies: sys.exit('no session cookie came back')
    with open(jar(app), 'w') as f: json.dump(cookies, f)
    os.chmod(jar(app), 0o600)
    print(f'signed in to {app}')


def mask(v, k=''):
    if isinstance(v, dict): return {a: mask(b, a) for a, b in v.items()}
    if isinstance(v, list): return [mask(x, k) for x in v]
    if isinstance(v, str) and len(v) > 12 and any(t in k.lower() for t in MASK): return v[:6] + '…'
    return v


def call(app, method, path, body=None):
    s = requests.Session()
    for c in json.load(open(jar(app))): s.cookies.set(c['name'], c['value'], domain=c['domain'], path=c['path'])
    # Ainmem refuses a write without its own Origin; AIN Teams refuses one that names another origin.
    headers = {'Origin': APPS[app]} if app == 'ainmem' else {}
    r = s.request(method, APPS[app] + path, json=json.loads(body) if body else None, headers=headers, timeout=120)
    try: data = r.json()
    except ValueError: print(r.status_code, r.text[:300]); return
    with open('last.json', 'w') as f: json.dump(data, f)
    os.chmod('last.json', 0o600)
    print(r.status_code, json.dumps(mask(data), ensure_ascii=False)[:3000])


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) == 2 and a[0] == 'login' and a[1] in APPS: login(a[1])
    elif len(a) >= 4 and a[0] == 'call' and a[1] in APPS: call(a[1], a[2].upper(), a[3], a[4] if len(a) > 4 else None)
    else: sys.exit(__doc__)
