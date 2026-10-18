#!/usr/bin/env python3
"""Real Git archive/files/HTTP, fake npm/PM2. No production DB or credentials."""
import contextlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="points-release-test-")
        self.root = Path(self.tmp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        self.live = self.source / "restored-frontend"
        (self.live / "dist/assets").mkdir(parents=True)
        (self.live / "backups").mkdir()
        (self.live / ".env").write_text("test fixture only")
        self.old_page = b'<script src="/assets/old.js"></script>'
        (self.live / "dist/index.html").write_bytes(self.old_page)
        (self.live / "dist/assets/old.js").write_text("old working javascript")
        (self.live / "package.json").write_text('{}')
        (self.live / "package-lock.json").write_text('{}')
        (self.source / ".gitignore").write_text(".env\ndist/\nbackups/\n")
        self.git("init")
        self.git("checkout", "-b", "main")
        self.git("add", ".")
        self.git("-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture")
        self.git("remote", "add", "origin", str(self.source))
        self.git("fetch", "origin", "main")
        self.spec = {"name":"class-pet-garden", "cwd":str(self.live), "script":"npm", "args":["start"], "interpreter":"node", "env":{"PORT":3001,"NODE_ENV":"production"}}
        self.active = self.root / "active.json"
        self.active.write_text(json.dumps(self.spec))
        bin_dir = self.root / "bin"
        bin_dir.mkdir()
        npm = bin_dir / "npm"
        npm.write_text('''#!/usr/bin/env python3
import os,sys
from pathlib import Path
if sys.argv[1]=='ci':
 Path('node_modules').mkdir(exist_ok=True)
else:
 Path('dist/assets').mkdir(parents=True,exist_ok=True)
 if os.environ.get('FAKE_BUILD_FAIL'): raise SystemExit(2)
 Path('dist/index.html').write_text('<script src="/assets/new.js"></script>')
 Path('dist/assets/new.js').write_text('new working javascript')
''')
        npm.chmod(0o755)
        pm2 = bin_dir / "pm2"
        pm2.write_text('''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
state=Path(os.environ['FAKE_PM2_STATE'])
if sys.argv[1]=='jlist':
 s=json.loads(state.read_text())
 print(json.dumps([{'name':'class-pet-garden','pm2_env':{'pm_cwd':s['cwd'],'pm_exec_path':s['script'],'args':s['args'],'exec_interpreter':s['interpreter'],**s['env']}}]))
elif sys.argv[1]=='startOrReload':
 assert sys.argv[sys.argv.index('--only')+1]=='class-pet-garden'
 s=json.loads(Path(sys.argv[2]).read_text())['apps'][0]
 if os.environ.get('FAKE_START_FAIL') and '/releases/' in s['cwd']: raise SystemExit(3)
 state.write_text(json.dumps(s))
elif sys.argv[1]!='save': raise SystemExit(4)
''')
        pm2.chmod(0o755)
        active = self.active
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == '/api/health':
                    content=b'{"success":true,"data":{"ok":true}}'
                else:
                    spec=json.loads(active.read_text())
                    p=Path(spec['cwd'])/'dist'/('index.html' if self.path=='/' else self.path.lstrip('/'))
                    if not p.exists(): self.send_error(404); return
                    content=p.read_bytes()
                self.send_response(200);self.end_headers();self.wfile.write(content)
            def log_message(self,*_): pass
        self.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
        self.env=patch.dict(os.environ, {'POINTS_SOURCE_ROOT':str(self.source),'POINTS_RELEASE_ROOT':str(self.root/'releases-root'),
             'POINTS_HEALTH_ORIGIN':f'http://127.0.0.1:{self.server.server_port}', 'FAKE_PM2_STATE':str(active),
             'PATH':str(bin_dir)+os.pathsep+os.environ['PATH']})
        self.env.start()
        spec=importlib.util.spec_from_file_location('points_release',HERE/'deploy-points.py')
        self.module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)

    def git(self,*args):
        subprocess.run(['git',*args],cwd=self.source,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

    def tearDown(self):
        self.env.stop();self.server.shutdown();self.server.server_close();self.thread.join();self.tmp.cleanup()

    def assert_legacy(self):
        self.assertEqual(json.loads(self.active.read_text())['cwd'],str(self.live))
        self.assertEqual((self.live/'dist/index.html').read_bytes(),self.old_page)
        self.assertFalse((self.module.ROOT/'pending.json').exists())
        self.assertFalse((self.live/'node_modules').exists())

    def test_build_failure_leaves_live_files_and_process(self):
        with patch.dict(os.environ,{'FAKE_BUILD_FAIL':'1'}):
            with self.assertRaises(subprocess.CalledProcessError): self.module.main('--deploy')
        self.assert_legacy()

    def test_start_failure_rolls_back(self):
        with patch.dict(os.environ,{'FAKE_START_FAIL':'1'}):
            with self.assertRaises(subprocess.CalledProcessError): self.module.main('--deploy')
        self.assert_legacy()

    def test_health_failure_rolls_back(self):
        verify=self.module.verify
        def fail_candidate(spec):
            if spec['cwd']!=str(self.live): raise RuntimeError('injected health failure')
            verify(spec)
        with patch.object(self.module,'verify',fail_candidate):
            with self.assertRaisesRegex(RuntimeError,'injected'): self.module.main('--deploy')
        self.assert_legacy()

    def test_success_manual_rollback_and_dirty_checkout_preserved(self):
        (self.live/'package-lock.json').write_text('local change stays here')
        self.module.main('--deploy')
        spec=json.loads(self.active.read_text())
        self.assertNotEqual(spec['cwd'],str(self.live))
        self.assertEqual((Path(spec['cwd'])/'package-lock.json').read_text(),'{}')
        self.assertEqual((self.live/'package-lock.json').read_text(),'local change stays here')
        self.assertTrue((Path(spec['cwd'])/'.env').is_symlink())
        self.assertTrue((Path(spec['cwd'])/'backups').is_symlink())
        self.assertEqual((self.live/'dist/index.html').read_bytes(),self.old_page)
        self.module.main('--rollback')
        self.assert_legacy()

    def test_interrupted_switch_recovered_before_next_action(self):
        self.module.ROOT.mkdir()
        self.module.atomic_json(self.module.ROOT/'pending.json',{'old_spec':self.spec,'old_link':None,'old_state':{}})
        self.module.link_current(self.root/'missing-release')
        with patch.dict(os.environ,{'FAKE_BUILD_FAIL':'1'}):
            with self.assertRaises(subprocess.CalledProcessError): self.module.main('--deploy')
        self.assert_legacy()

    def test_missing_flag_and_lock(self):
        import fcntl
        result=subprocess.run(['python3',str(HERE/'deploy-points.py')],capture_output=True)
        self.assertEqual(result.returncode,64)
        self.module.ROOT.mkdir(exist_ok=True)
        with open(self.module.ROOT/'deploy.lock','a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            result=subprocess.run(['python3',str(HERE/'deploy-points.py'),'--deploy'],capture_output=True)
            self.assertEqual(result.returncode,75)


if __name__=='__main__': unittest.main(verbosity=2)
