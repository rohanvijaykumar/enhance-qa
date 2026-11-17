#!/usr/bin/env python3
"""Bug-zoo runner: copies a fixture app to a fresh folder outside the repo (with the planted-bug comments
stripped), installs the enhance-qa skill as a project skill, runs Claude Code headless with a prompt, then
scores the bugs QA filed against the answer key.

  python -I tests/bug-zoo/run_zoo.py prepare --app web-shop --work DIR
  python -I tests/bug-zoo/run_zoo.py run --work DIR --prompt "..." [--timeout 5400]
  python -I tests/bug-zoo/run_zoo.py score --app web-shop --work DIR [--out results/web-shop.md]
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SKILL = os.path.join(REPO, "skills", "enhance-qa")
STRIP = re.compile(r"\s*(//|#)\s*BUG\([^)]*\).*$")


def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


def copy_app(src, dst):
    for dp, dn, fn in os.walk(src):
        dn[:] = [d for d in dn if d not in ("node_modules", "qa", ".git")]
        rel = os.path.relpath(dp, src)
        os.makedirs(os.path.join(dst, rel), exist_ok=True)
        for f in fn:
            s, d = os.path.join(dp, f), os.path.join(dst, rel, f)
            try:
                with open(s, encoding="utf-8") as fh:
                    lines = fh.read().split("\n")
            except UnicodeDecodeError:
                shutil.copyfile(s, d)
                continue
            out = []
            for ln in lines:
                if "bug-zoo" in ln or "enhance-qa" in ln:
                    continue
                stripped = STRIP.sub("", ln)
                if stripped.strip() == "" and ln.strip() != "":
                    continue
                out.append(stripped)
            with open(d, "w", encoding="utf-8", newline="\n") as fh:
                fh.write("\n".join(out))


def _force_remove(func, path, _exc):
    os.chmod(path, 0o666)
    func(path)


def prepare(app, work):
    if os.path.exists(work):
        shutil.rmtree(work, onerror=_force_remove)
    copy_app(os.path.join(HERE, app), work)
    shutil.copytree(SKILL, os.path.join(work, ".claude", "skills", "enhance-qa"))
    env = dict(os.environ, GIT_AUTHOR_NAME="zoo", GIT_AUTHOR_EMAIL="zoo@example.test",
               GIT_COMMITTER_NAME="zoo", GIT_COMMITTER_EMAIL="zoo@example.test")
    for args in (["init", "-q"], ["add", "-A"], ["commit", "-qm", "Initial version"]):
        subprocess.run(["git"] + args, cwd=work, env=env, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    with open(os.path.join(work, ".git", "info", "exclude"), "a", encoding="utf-8") as fh:
        fh.write("\n.zoo/\n")
    leaks = []
    for dp, dn, fn in os.walk(work):
        if ".claude" in dp or ".git" in dp:
            continue
        for f in fn:
            try:
                with open(os.path.join(dp, f), encoding="utf-8") as fh:
                    if "BUG(" in fh.read():
                        leaks.append(f)
            except UnicodeDecodeError:
                pass
    print(json.dumps({"prepared": work, "answer_leaks": leaks}))


def run(work, prompt, timeout):
    started = time.time()
    os.makedirs(os.path.join(work, ".zoo"), exist_ok=True)
    cmd = ["claude", "-p", prompt, "--output-format", "json", "--permission-mode", "acceptEdits",
           "--allowedTools", "Bash", "Read", "Edit", "Write", "Glob", "Grep", "Agent", "Skill", "TodoWrite", "PowerShell"]
    env = dict(os.environ)
    pw = arg("--node-path")
    if pw:
        env["NODE_PATH"] = pw
    try:
        p = subprocess.run(cmd, cwd=work, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
        out, err, code = p.stdout.decode("utf-8", "replace"), p.stderr.decode("utf-8", "replace"), p.returncode
    except subprocess.TimeoutExpired as e:
        out = (e.stdout or b"").decode("utf-8", "replace")
        err, code = "timeout", -1
    with open(os.path.join(work, ".zoo", "claude-output.json"), "w", encoding="utf-8") as fh:
        fh.write(out)
    with open(os.path.join(work, ".zoo", "claude-stderr.txt"), "w", encoding="utf-8") as fh:
        fh.write(err)
    summary = {"exit": code, "seconds": round(time.time() - started)}
    try:
        j = json.loads(out)
        summary.update({"cost_usd": j.get("total_cost_usd"), "turns": j.get("num_turns"), "is_error": j.get("is_error"),
                        "result": (j.get("result") or "")[:4000], "usage": j.get("usage"), "modelUsage": j.get("modelUsage")})
    except ValueError:
        summary["raw_tail"] = out[-2000:]
    with open(os.path.join(work, ".zoo", "run-summary.json"), "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2)
    print(json.dumps({k: v for k, v in summary.items() if k not in ("usage", "modelUsage")}, indent=2)[:6000])


def bug_texts(work):
    d = os.path.join(work, "qa", "bugs")
    res = []
    if not os.path.isdir(d):
        return res
    for f in sorted(os.listdir(d)):
        if re.match(r"^BUG-\d+\.md$", f):
            with open(os.path.join(d, f), encoding="utf-8") as fh:
                text = fh.read()
            m = re.search(r"(?m)^title:\s*(.+)$", text)
            st = re.search(r"(?m)^status:\s*(\S+)", text)
            sev = re.search(r"(?m)^severity:\s*(\S+)", text)
            res.append({"id": f[:-3], "title": (m.group(1).strip().strip('"') if m else ""), "status": st.group(1) if st else "",
                        "severity": sev.group(1) if sev else "", "text": text.lower()})
    return res


def score(app, work, out_path):
    key = json.load(open(os.path.join(HERE, "answers", app + ".json"), encoding="utf-8"))
    bugs = bug_texts(work)
    matched, used = [], set()
    for pb in key["planted"]:
        best = None
        for b in bugs:
            hits = sum(1 for k in pb["match"] if k.lower() in b["text"])
            if hits >= pb["need"] and (best is None or hits > best[1]):
                best = (b, hits)
        if best:
            matched.append((pb, best[0]))
            used.add(best[0]["id"])
        else:
            matched.append((pb, None))
    extra = [b for b in bugs if b["id"] not in used]
    summ = {}
    sp = os.path.join(work, ".zoo", "run-summary.json")
    if os.path.exists(sp):
        summ = json.load(open(sp, encoding="utf-8"))
    found = sum(1 for _, b in matched if b)
    lines = ["# Bug zoo: %s" % app, "",
             "Found %d of %d planted bugs (keyword match; review below). Filed: %d bugs. Unmatched filings: %d." % (found, len(key["planted"]), len(bugs), len(extra)),
             "Time: %s s · cost reported: %s · turns: %s · exit: %s" % (summ.get("seconds"), summ.get("cost_usd"), summ.get("turns"), summ.get("exit")), "",
             "| Planted | Severity | Matched filing | Filed severity | Status |", "|---|---|---|---|---|"]
    for pb, b in matched:
        lines.append("| %s | %s | %s | %s | %s |" % (pb["id"], pb["severity"], ("%s %s" % (b["id"], b["title"])) if b else "**missed**",
                                                   b["severity"] if b else "", b["status"] if b else ""))
    lines += ["", "## Filings that matched no planted bug (review: real extra finding or false alarm?)"]
    lines += ["- %s (%s, %s): %s" % (b["id"], b["severity"], b["status"], b["title"]) for b in extra] or ["- none"]
    lines += ["", "## Final summary from the run", "", "```", (summ.get("result") or "").strip()[:3000], "```"]
    text = "\n".join(lines) + "\n"
    if out_path:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
    print(text)


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "prepare":
        prepare(arg("--app"), arg("--work"))
    elif cmd == "run":
        run(arg("--work"), arg("--prompt"), int(arg("--timeout", "5400")))
    elif cmd == "score":
        score(arg("--app"), arg("--work"), arg("--out"))
    else:
        print(__doc__)
