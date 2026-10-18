#!/usr/bin/env python3
"""Explicit-only releases. Build away from live files; rollback only this app."""
import hashlib
import fcntl
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone

APP = "class-pet-garden"
SOURCE = Path(os.environ.get("POINTS_SOURCE_ROOT", "/www/zhuxuejifenxitong")).resolve()
ROOT = Path(os.environ.get("POINTS_RELEASE_ROOT", "/www/zhuxue-points")).resolve()
HEALTH = os.environ.get("POINTS_HEALTH_ORIGIN", "http://127.0.0.1:3001").rstrip("/")


def run(*args, cwd=None, capture=False, timeout=900):
    return subprocess.run(args, cwd=cwd, check=True, text=True,
                          stdout=subprocess.PIPE if capture else None,
                          timeout=timeout).stdout


def atomic_json(target, value):
    tmp = target.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as stream:
        os.chmod(tmp, 0o600)
        json.dump(value, stream, ensure_ascii=False, indent=2)
    os.replace(tmp, target)


def link_current(target):
    link = ROOT / "current"
    if target is None:
        if link.is_symlink():
            link.unlink()
        return
    tmp = ROOT / "current.next"
    if tmp.is_symlink():
        tmp.unlink()
    tmp.symlink_to(target, target_is_directory=True)
    os.replace(tmp, link)


def existing_spec():
    apps = json.loads(run("pm2", "jlist", capture=True))
    app = next(p for p in apps if p["name"] == APP)
    env = app["pm2_env"]
    return {"name": APP, "cwd": env["pm_cwd"], "script": env["pm_exec_path"],
            "args": env.get("args", []), "interpreter": env.get("exec_interpreter", "node"),
            "env": {"NODE_ENV": env.get("NODE_ENV", "production"), "PORT": env.get("PORT", 3001)}}


def activate(spec):
    config = ROOT / "active.ecosystem.json"
    atomic_json(config, {"apps": [spec]})
    run("pm2", "startOrReload", str(config), "--only", APP, "--update-env")


def get(url):
    with urllib.request.urlopen(url, timeout=3) as response:
        if response.status != 200:
            raise RuntimeError("HTTP health check failed")
        return response.read()


def verify(spec):
    end = time.monotonic() + 40
    while True:
        try:
            if existing_spec()["cwd"] != spec["cwd"]:
                raise RuntimeError("PM2 did not select the requested release")
            result = json.loads(get(HEALTH + "/api/health"))
            if result.get("success") is not True or result.get("data", {}).get("ok") is not True:
                raise RuntimeError("Unexpected health response")
            expected = Path(spec["cwd"]) / "dist" / "index.html"
            page = get(HEALTH + "/")
            if page != expected.read_bytes():
                raise RuntimeError("Served index does not match selected release")
            assets = re.findall(r'(?:src|href)=["\'](/assets/[^"\']+\.(?:js|css))["\']', page.decode())
            if not assets:
                raise RuntimeError("No entry assets in built page")
            for asset in assets:
                disk = Path(spec["cwd"]) / "dist" / asset.lstrip("/")
                if hashlib.sha256(get(HEALTH + asset)).digest() != hashlib.sha256(disk.read_bytes()).digest():
                    raise RuntimeError("Served entry asset mismatch")
            return
        except Exception:
            if time.monotonic() >= end:
                raise
            time.sleep(1)


def restore(journal):
    link_current(journal["old_link"])
    activate(journal["old_spec"])
    verify(journal["old_spec"])
    run("pm2", "save")
    if journal.get("old_state"):
        atomic_json(ROOT / "state.json", journal["old_state"])
    elif (ROOT / "state.json").exists():
        (ROOT / "state.json").unlink()


def main(mode):
    ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
    pending = ROOT / "pending.json"
    state_path = ROOT / "state.json"
    # Recover an interrupted switch on the next explicit invocation, never via cron.
    if pending.exists():
        restore(json.loads(pending.read_text()))
        pending.unlink()
        print("Recovered interrupted points switch")
    old_spec = existing_spec()
    old_link = str((ROOT / "current").resolve()) if (ROOT / "current").is_symlink() else None
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    if mode == "--rollback":
        if not state.get("previous_spec"):
            raise RuntimeError("No previous release recorded")
        spec = state["previous_spec"]
        commit = state.get("previous_commit")
        target_link = state.get("previous_link")
    else:
        pinned = os.environ.get("POINTS_DEPLOY_COMMIT")
        if pinned and not re.fullmatch(r"[0-9a-f]{40}", pinned):
            raise RuntimeError("POINTS_DEPLOY_COMMIT must be a full Git commit")
        bundle_path = os.environ.get("POINTS_SOURCE_BUNDLE")
        source_bundle_hash = None
        if bundle_path:
            # The operator verifies origin/main locally, then transports an
            # exact commit bundle. Do not rewrite remote-tracking refs or HEAD.
            bundle = Path(bundle_path).resolve()
            source_bundle_hash = hashlib.sha256(bundle.read_bytes()).hexdigest()
            if not pinned or source_bundle_hash != os.environ.get("POINTS_SOURCE_BUNDLE_SHA256"):
                raise RuntimeError("Uploaded bundle needs its reviewed commit and SHA-256")
            run("git", "bundle", "verify", str(bundle), cwd=SOURCE, timeout=60)
            heads = run("git", "bundle", "list-heads", str(bundle), cwd=SOURCE, capture=True).splitlines()
            ref = next((line.split()[1] for line in heads if line.split()[0] == pinned), None)
            if not ref:
                raise RuntimeError("Bundle does not contain the reviewed tip")
            run("git", "fetch", str(bundle), ref, cwd=SOURCE, timeout=60)
        else:
            run("git", "fetch", "origin", "main", cwd=SOURCE, timeout=60)
        commit = run("git", "rev-parse", "--verify", (pinned or "origin/main") + "^{commit}", cwd=SOURCE, capture=True).strip()
        if not bundle_path:
            run("git", "merge-base", "--is-ancestor", commit, "origin/main", cwd=SOURCE)
        # Never roll back another release accidentally. Legacy baseline uses the
        # checkout commit; its old dist is retained verbatim for runtime rollback.
        baseline = state.get("commit") or run("git", "rev-parse", "HEAD", cwd=SOURCE, capture=True).strip()
        run("git", "merge-base", "--is-ancestor", baseline, commit, cwd=SOURCE)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        release = ROOT / "releases" / (stamp + "-" + commit[:12])
        release.mkdir(parents=True)
        archive = release / "source.tar"
        run("git", "archive", "--format=tar", "-o", str(archive), commit, "restored-frontend", cwd=SOURCE)
        run("tar", "-xf", str(archive), "--strip-components=1", "-C", str(release))
        archive.unlink()
        # Do not copy .env into build input or install into live node_modules.
        run("npm", "ci", "--no-audit", "--no-fund", cwd=release)
        run("nice", "-n", "10", "npm", "run", "build", cwd=release)
        if not (release / "dist/index.html").is_file():
            raise RuntimeError("Build produced no index.html")
        live = SOURCE / "restored-frontend"
        if not (live / ".env").is_file():
            raise RuntimeError("Shared runtime .env is missing")
        (release / ".env").symlink_to(live / ".env")
        (release / "backups").symlink_to(live / "backups", target_is_directory=True)
        spec = {**old_spec, "cwd": str(release)}
        target_link = str(release)
        atomic_json(release / ".deploy-info.json", {"commit": commit, "built_at": stamp,
                    "source": "git-archive", "source_bundle_sha256": source_bundle_hash, "working_tree_used": False})
    journal = {"old_spec": old_spec, "old_link": old_link, "old_state": state}
    atomic_json(pending, journal)
    try:
        link_current(target_link)
        activate(spec)
        verify(spec)
        run("pm2", "save")
        atomic_json(state_path, {"commit": commit, "spec": spec, "previous_spec": old_spec,
                    "previous_link": old_link, "previous_commit": state.get("commit"),
                    "verified_at": datetime.now(timezone.utc).isoformat()})
        pending.unlink()
    except BaseException:
        try:
            restore(journal)
            pending.unlink()
            print("Points switch failed; previous page and entry assets verified after rollback", file=sys.stderr)
        except BaseException:
            print("Points rollback needs attention; recovery journal retained", file=sys.stderr)
        raise
    print(f"Points {mode[2:]} verified: {commit or 'legacy'}; only {APP} changed")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("--deploy", "--rollback"):
        print("Explicit invocation required: deploy-points.py --deploy|--rollback", file=sys.stderr)
        sys.exit(64)
    # Lock also protects direct helper invocations, build, switch and recovery.
    ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock = open(ROOT / "deploy.lock", "a")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("Points deployment already running", file=sys.stderr)
        sys.exit(75)
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(InterruptedError("Deployment terminated")))
    main(sys.argv[1])
