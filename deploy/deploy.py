"""Upgrade an existing single-project installation; never initialize production data."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sqlite3
import subprocess
import tarfile
import time
import urllib.error
import urllib.request
import uuid

PAGES = ('index.html', 'blog/index.html', 'photos/index.html', 'games/index.html',
         'manage/index.html', 'admin/index.html', 'ff14/admin/index.html', 'ff14/oopsie/index.html')
TABLES = ('users', 'workspaces', 'workspace_memberships', 'workspace_invites',
          'captain_invites', 'workspace_store')


def digest(path):
    value = hashlib.sha256()
    with open(path, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            value.update(chunk)
    return value.hexdigest()


def content_hashes(root):
    return {p.relative_to(root).as_posix(): digest(p)
            for p in sorted(root.rglob('*')) if p.is_file()}


def database_hashes(path):
    with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True) as db:
        if db.execute('pragma integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Database integrity check failed')
        result = {}
        for table in TABLES:
            rows = db.execute(f'SELECT * FROM {table}').fetchall()
            # No credentials or invite codes enter the logs or manifest.
            encoded = sorted(json.dumps(row, ensure_ascii=False) for row in rows)
            result[table] = hashlib.sha256('\n'.join(encoded).encode()).hexdigest()
        return result


def copy_database(source, target):
    with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as live:
        with sqlite3.connect(target) as saved:
            live.backup(saved)
            if saved.execute('pragma integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Database backup integrity check failed')


def extract_code(archive, destination):
    with tarfile.open(archive) as bundle:
        members = bundle.getmembers()
        for member in members:
            path = PurePosixPath(member.name)
            if (path.is_absolute() or '..' in path.parts or '\\' in member.name
                    or not (member.isfile() or member.isdir()) or not path.parts):
                raise ValueError('Unsafe archive entry')
            if (path.parts[0] in {'.git', 'node_modules', 'data', 'shared', '.releases'}
                    or (path.name.startswith('.env') and path.name != '.env.example')
                    or path.name.endswith(('.db', '.db-wal', '.db-shm', '.auth-key'))):
                raise ValueError('Runtime data must not be shipped in a code archive')
        for member in members:
            path = PurePosixPath(member.name)
            # Repository content is an initial local fixture only.
            if path.parts[0] == 'source':
                continue
            output = destination.joinpath(*path.parts)
            if member.isdir():
                output.mkdir(parents=True, exist_ok=True)
            else:
                output.parent.mkdir(parents=True, exist_ok=True)
                with bundle.extractfile(member) as stream, output.open('xb') as target:
                    shutil.copyfileobj(stream, target)
                output.chmod(0o644)


def atomic_bytes(path, data, owner=False):
    temporary = path.with_name(path.name + '.' + str(uuid.uuid4()) + '.tmp')
    try:
        temporary.write_bytes(data)
        temporary.chmod(0o600)
        if owner:
            shutil.chown(temporary, user='www', group='www')
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def switch_code(app, target):
    temporary = app / ('.current-' + str(uuid.uuid4()))
    try:
        temporary.symlink_to(target)
        os.replace(temporary, app / 'current')
    finally:
        temporary.unlink(missing_ok=True)


def load_environment(path):
    result = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            key, value = line.split('=', 1)
            if not re.fullmatch(r'[A-Z_][A-Z0-9_]*', key):
                raise ValueError('Invalid environment key')
            result[key] = value.strip().strip('\"\'')
    return result


class Server:
    owner = True

    def __init__(self, app, node):
        self.app, self.node = app, node
        self.env = load_environment(app / 'shared/site.env')
        self.env.update(PATH=str(node.parent) + ':/usr/local/bin:/usr/bin:/bin',
                        ASTRO_TELEMETRY_DISABLED='1')
        self.origin = 'http://127.0.0.1:' + self.env['PORT']

    def service(self, action):
        subprocess.run(['systemctl', action, 'chiakya-home.service'], check=True)

    def own(self, path):
        subprocess.run(['chown', '-R', 'www:www', str(path)], check=True)

    def run(self, release, command, extra=None):
        env = {**os.environ, **self.env, **(extra or {})}
        subprocess.run(['runuser', '-u', 'www', '--', *map(str, command)],
                       cwd=release, env=env, check=True)

    def build(self, release):
        npm = self.node.parent / 'npm'
        for args in (['ci', '--cache', str(self.app/'shared/npm-cache'), '--no-audit', '--no-fund'],
                     ['run', 'check'], ['test'], ['run', 'build']):
            self.run(release, [npm, *args], {'DB_PATH': str(release/'.validation/data.db')})

    def publish(self, release):
        suffix = str(int(time.time()*1000)) + '-' + str(uuid.uuid4())
        destination = release / '.releases' / suffix
        self.run(release, [self.node, 'tools/publish.mjs', destination])
        for page in PAGES:
            if not (destination/page).is_file():
                raise RuntimeError('Missing public page: ' + page)
        return json.dumps({'release': suffix}).encode() + b'\n'

    def probe(self, origin):
        healthy = False
        for _ in range(80):
            try:
                with urllib.request.urlopen(origin+'/api/health', timeout=2) as response:
                    healthy = json.load(response).get('ok') is True
                if healthy:
                    break
            except (OSError, ValueError):
                time.sleep(.25)
        if not healthy:
            raise RuntimeError('Service health check failed')
        assets = set()
        for path in PAGES:
            route = '/' if path == 'index.html' else '/' + path.removesuffix('index.html')
            with urllib.request.urlopen(origin + route, timeout=10) as response:
                html = response.read().decode()
                if response.status != 200 or not html:
                    raise RuntimeError('Page check failed: ' + route)
                assets.update(re.findall(r'(?:src|href)="(/[^"?#]+\.(?:js|css))"', html))
        for path in assets:
            with urllib.request.urlopen(origin+path, timeout=10) as response:
                if response.status != 200 or not response.read():
                    raise RuntimeError('Asset check failed: ' + path)
        for path in ('/api/auth/session', '/api/site/posts', '/api/ff14/admin/captains'):
            try:
                urllib.request.urlopen(origin+path, timeout=5)
                raise RuntimeError('Unauthenticated management endpoint allowed: ' + path)
            except urllib.error.HTTPError as error:
                if error.code != 401:
                    raise

    def candidate(self, release):
        import socket
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        extra = dict(DB_PATH=str(release/'.validation/data.db'),
                     BLOG_ROOT=str(release), PORTAL_DIST_PATH=str(release/'dist'),
                     HOST='127.0.0.1', PORT=str(port), COOKIE_SECURE='false')
        with (release/'.validation/server.log').open('wb') as log:
            process = subprocess.Popen(['runuser', '-u', 'www', '--', str(self.node), 'tools/serve.mjs'],
                cwd=release, env={**os.environ, **self.env, **extra},
                stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            try:
                self.probe('http://127.0.0.1:' + str(port))
            finally:
                import signal
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()


class Upgrade:
    def __init__(self, app, release, backend):
        self.app, self.release, self.backend = app, release, backend
        self.shared = app/'shared'
        self.db = self.shared/'data/data.db'
        self.key = self.shared/'data/data.db.auth-key'
        self.marker = self.shared/'publications/current.json'
        self.source = self.shared/'source'
        self.backup = app/'backups'/release.name

    def validate(self):
        private = self.release/'.validation'
        private.mkdir(mode=0o700)
        copy_database(self.db, private/'data.db')
        shutil.copy2(self.key, private/'data.db.auth-key')
        before = database_hashes(private/'data.db')
        shutil.copytree(self.source, self.release/'source')
        (private/'publications').mkdir()
        (self.release/'.releases').symlink_to(private/'publications')
        self.backend.own(self.release)
        self.backend.build(self.release)
        self.backend.candidate(self.release)
        if database_hashes(private/'data.db') != before:
            raise RuntimeError('Candidate startup changed existing accounts or FF14 data')
        if digest(private/'data.db.auth-key') != digest(self.key):
            raise RuntimeError('Candidate authentication key changed')

    def snapshot(self):
        self.backup.mkdir(mode=0o700)
        copy_database(self.db, self.backup/'data.db')
        for path in (self.key, self.shared/'site.env', self.marker):
            shutil.copy2(path, self.backup/path.name)
        for name in ('source', 'publications'):
            with tarfile.open(self.backup/(name+'.tar.gz'), 'w:gz') as archive:
                archive.add(self.shared/name, arcname=name)
        unit = Path('/etc/systemd/system/chiakya-home.service')
        if unit.is_file():
            shutil.copy2(unit, self.backup/unit.name)
        (self.backup/'code-target.txt').write_text(str((self.app/'current').resolve())+'\n')

    def cutover(self):
        previous = (self.app/'current').resolve(strict=True)
        marker = None
        try:
            self.backend.service('stop')
            marker = self.marker.read_bytes()
            self.snapshot()
            hashes = content_hashes(self.source)
            business = database_hashes(self.db)
            key = digest(self.key)
            (self.backup/'source-hashes.json').write_text(json.dumps(hashes, ensure_ascii=False))
            (self.release/'source').rename(self.release/'.validation/source')
            (self.release/'source').symlink_to(self.source)
            (self.release/'.releases').unlink()
            (self.release/'.releases').symlink_to(self.shared/'publications')
            publication = self.backend.publish(self.release)
            if (content_hashes(self.source) != hashes or database_hashes(self.db) != business
                    or digest(self.key) != key):
                raise RuntimeError('Build changed persistent data')
            atomic_bytes(self.marker, publication, owner=self.backend.owner)
            switch_code(self.app, self.release)
            self.backend.service('start')
            self.backend.probe(self.backend.origin)
            # Production writers may have resumed: check integrity, not a frozen row count.
            database_hashes(self.db)
            if digest(self.key) != key:
                raise RuntimeError('Authentication key changed')
            (self.release/'deployment.json').write_text(json.dumps({
                'release': self.release.name, 'previous': previous.name,
                'backup': str(self.backup), 'publication': json.loads(publication)['release'],
                'deployedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())})+'\n')
        except BaseException:
            import signal
            # Complete rollback even if the CI connection has disappeared.
            if os.name == 'posix':
                for event in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
                    signal.signal(event, signal.SIG_IGN)
            self.backend.service('stop')
            switch_code(self.app, previous)
            if marker is not None:
                atomic_bytes(self.marker, marker, owner=self.backend.owner)
            self.backend.service('start')
            self.backend.probe(self.backend.origin)
            print('Rollback completed; live database, key and content retained', flush=True)
            raise
        print(json.dumps({'deployment':'ok', 'release':self.release.name,
                          'backup':str(self.backup), 'existingData':'preserved'}), flush=True)


def main():
    import signal
    def interrupted(signum, frame):
        raise InterruptedError('Deployment interrupted')
    for event in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(event, interrupted)
    parser = argparse.ArgumentParser()
    parser.add_argument('--app', type=Path, default=Path('/www/wwwroot/chiakya_home'))
    parser.add_argument('--node', type=Path, default=Path('/www/wwwroot/ff14_oopsie_dev/shared/node/bin/node'))
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--release', required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'ci-\d+-\d+-[a-f0-9]{12}', args.release):
        parser.error('Invalid release ID')
    if not re.fullmatch(r'[a-f0-9]{64}', args.sha256) or digest(args.archive) != args.sha256:
        parser.error('Archive checksum mismatch')
    app = args.app.resolve(strict=True)
    releases = app/'releases'
    previous = (app/'current').resolve(strict=True)
    if previous.parent != releases or not (previous/'tools/serve.mjs').is_file():
        raise RuntimeError('An existing single-project deployment is required')
    if (app/'shared/source').is_symlink():
        raise RuntimeError('Unexpected shared content symlink')
    import fcntl
    with (app/'shared/deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        release = releases/args.release
        release.mkdir(mode=0o755)
        extract_code(args.archive, release)
        if json.loads((release/'package.json').read_text())['name'] != 'chiakya-home':
            raise RuntimeError('Unexpected project archive')
        backend = Server(app, args.node.resolve(strict=True))
        upgrade = Upgrade(app, release, backend)
        upgrade.validate()
        upgrade.cutover()


if __name__ == '__main__':
    main()
