import importlib.util
import io
import json
from pathlib import Path
import sqlite3
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('upgrade', Path(__file__).parents[1]/'deploy.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Backend:
    owner = False
    origin = 'fixture'

    def __init__(self, app, failure=None):
        self.app, self.failure, self.actions = app, failure, []

    def service(self, action):
        self.actions.append(action)

    def publish(self, release):
        if self.failure == 'build':
            raise RuntimeError('Build failed')
        return b'{"release":"new-publication"}\n'

    def probe(self, origin):
        if self.failure == 'health' and (self.app/'current').resolve().name == 'new':
            # Simulate a request committing new data before the failure is detected.
            with sqlite3.connect(self.app/'shared/data/data.db') as db:
                db.execute("INSERT INTO workspace_store VALUES ('new-record')")
            (self.app/'shared/source/upload.txt').write_text('new upload')
            raise RuntimeError('Health failed')


class DeploymentTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.app = Path(self.temp.name).resolve()
        for folder in ('shared/data', 'shared/source', 'shared/publications', 'backups',
                       'releases/old', 'releases/new/.validation/publications', 'releases/new/source'):
            (self.app/folder).mkdir(parents=True, exist_ok=True)
        try:
            (self.app/'current').symlink_to(self.app/'releases/old', target_is_directory=True)
        except OSError:
            self.skipTest('Directory symlinks require Windows developer mode; run on Linux CI')
        self.release = self.app/'releases/new'
        (self.release/'.releases').symlink_to(self.release/'.validation/publications', target_is_directory=True)
        (self.app/'shared/source/post.md').write_text('latest server content')
        (self.release/'source/post.md').write_text('outdated validation content')
        self.marker = self.app/'shared/publications/current.json'
        self.marker.write_bytes(b'{"release":"old-publication"}\n')
        (self.app/'shared/site.env').write_text('PORT=39016\n')
        self.key = self.app/'shared/data/data.db.auth-key'
        self.key.write_bytes(b'existing login key')
        self.db = self.app/'shared/data/data.db'
        with sqlite3.connect(self.db) as db:
            for table in module.TABLES:
                db.execute(f'CREATE TABLE {table} (value TEXT)')
                db.execute(f'INSERT INTO {table} VALUES (?)', ('original',))

    def test_success_uses_latest_content_and_backs_up_data(self):
        before = module.database_hashes(self.db)
        backend = Backend(self.app)
        upgrade = module.Upgrade(self.app, self.release, backend)
        upgrade.cutover()
        self.assertEqual((self.app/'current').resolve(), self.release)
        self.assertEqual((self.release/'source').resolve(), self.app/'shared/source')
        self.assertEqual(json.loads(self.marker.read_bytes())['release'], 'new-publication')
        self.assertEqual(module.database_hashes(self.db), before)
        self.assertEqual(module.database_hashes(upgrade.backup/'data.db'), before)
        self.assertEqual((upgrade.backup/'data.db.auth-key').read_bytes(), self.key.read_bytes())
        with tarfile.open(upgrade.backup/'source.tar.gz') as bundle:
            self.assertEqual(bundle.extractfile('source/post.md').read(), b'latest server content')
        self.assertEqual(backend.actions, ['stop', 'start'])

    def test_build_failure_restores_old_publication_and_service(self):
        before, marker = module.database_hashes(self.db), self.marker.read_bytes()
        backend = Backend(self.app, 'build')
        with self.assertRaisesRegex(RuntimeError, 'Build failed'):
            module.Upgrade(self.app, self.release, backend).cutover()
        self.assertEqual((self.app/'current').resolve().name, 'old')
        self.assertEqual(self.marker.read_bytes(), marker)
        self.assertEqual(module.database_hashes(self.db), before)
        self.assertEqual(backend.actions[-1], 'start')

    def test_health_failure_keeps_newly_committed_rows_and_uploads(self):
        marker = self.marker.read_bytes()
        with self.assertRaisesRegex(RuntimeError, 'Health failed'):
            module.Upgrade(self.app, self.release, Backend(self.app, 'health')).cutover()
        self.assertEqual((self.app/'current').resolve().name, 'old')
        self.assertEqual(self.marker.read_bytes(), marker)
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM workspace_store').fetchone()[0], 2)
        self.assertEqual((self.app/'shared/source/upload.txt').read_text(), 'new upload')
        self.assertEqual(self.key.read_bytes(), b'existing login key')


class ArchiveTest(unittest.TestCase):
    def bundle(self, root, entries):
        path = root/'archive.tar.gz'
        with tarfile.open(path, 'w:gz') as archive:
            for name, payload, kind in entries:
                member = tarfile.TarInfo(name)
                member.type = kind
                member.size = len(payload)
                archive.addfile(member, io.BytesIO(payload))
        return path

    def test_initial_content_is_skipped_and_only_code_is_extracted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = self.bundle(root, [('source/post.md', b'seed', tarfile.REGTYPE),
                                         ('server/server.js', b'code', tarfile.REGTYPE)])
            target = root/'output'
            target.mkdir()
            module.extract_code(archive, target)
            self.assertFalse((target/'source').exists())
            self.assertEqual((target/'server/server.js').read_bytes(), b'code')

    def test_rejects_traversal_links_and_runtime_secrets_before_extracting(self):
        for name, kind in (('../escape', tarfile.REGTYPE), ('/escape', tarfile.REGTYPE),
                           ('server/link', tarfile.SYMTYPE), ('.env', tarfile.REGTYPE),
                           ('data/data.db', tarfile.REGTYPE), ('server/key.auth-key', tarfile.REGTYPE)):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                target = root/'output'
                target.mkdir()
                archive = self.bundle(root, [('safe.js', b'safe', tarfile.REGTYPE), (name, b'bad', kind)])
                with self.assertRaises(ValueError):
                    module.extract_code(archive, target)
                self.assertEqual(list(target.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
