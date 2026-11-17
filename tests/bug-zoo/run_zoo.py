#!/usr/bin/env python3
"""Bug-zoo runner: copies a fixture app to a fresh folder outside the repo (with the planted-bug comments
stripped), installs the enhance-qa skill as a project skill, runs Claude Code headless with a prompt, then
scores the bugs QA filed against the answer key.

  python -I tests/bug-zoo/run_zoo.py prepare --app web-shop --work DIR
  python -I tests/bug-zoo/run_zoo.py run --work DIR --prompt "..." [--timeout 5400] [--node-path DIR]
  python -I tests/bug-zoo/run_zoo.py trials --app web-shop --base DIR --n 3 --prompt "..." [--timeout 5400]
  python -I tests/bug-zoo/run_zoo.py score --app web-shop --work DIR[,DIR2,...] [--review FILE] [--out FILE]

Scoring follows how agent evals are usually done:
- several trials per app, reported as "found at least once" (pass@k) and "found every time" (pass^k);
- recall by stage: did a tester notice it, did the verifier confirm it (filed), was it fixed and verified;
- answer-key sets: "tuning" apps may be used while changing the skill; "held-out" apps must not be, so
  their score shows whether a change generalises; "control" apps have no planted bugs, so every filing
  is a possible false alarm;
- a review file records hand verdicts on filings that match no planted bug ("real" or "false-alarm"),
  which turns precision into a number that can be compared across versions.
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
IGNORED_STRAY = ("qa/", ".zoo/", ".claude/")


def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


def copy_app(src, dst):
    for dp, dn, fn in os.walk(src):
        dn[:] = [d for d in dn if d not in ("node_modules", "qa", ".git", "__pycache__")]
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


def prepare(app, work, quiet=False):
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
    result = {"prepared": work, "answer_leaks": leaks}
    if not quiet:
        print(json.dumps(result))
    return result


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
    return summary


def trials(app, base, n, prompt, timeout):
    """Run the same prompt on n fresh copies of the app, one after another, in <base>/t1 … <base>/tN."""
    dirs = []
    for i in range(1, n + 1):
        work = os.path.join(base, "t%d" % i)
        prepare(app, work, quiet=True)
        print("== trial %d of %d: %s" % (i, n, work))
        run(work, prompt, timeout)
        dirs.append(work)
    print("Score them together with:\n  python -I tests/bug-zoo/run_zoo.py score --app %s --work %s" % (app, ",".join(dirs)))


# ---------- scoring ----------

def read(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    except (OSError, UnicodeDecodeError):
        return ""


def bug_texts(work):
    d = os.path.join(work, "qa", "bugs")
    res = []
    if not os.path.isdir(d):
        return res
    for f in sorted(os.listdir(d)):
        if re.match(r"^BUG-\d+\.md$", f):
            text = read(os.path.join(d, f))
            m = re.search(r"(?m)^title:\s*(.+)$", text)
            st = re.search(r"(?m)^status:\s*(\S+)", text)
            sev = re.search(r"(?m)^severity:\s*(\S+)", text)
            res.append({"id": f[:-3], "title": (m.group(1).strip().strip('"') if m else ""), "status": st.group(1) if st else "",
                        "severity": sev.group(1) if sev else "", "text": text.lower()})
    return res


def tester_notes(work):
    """All tester notes of all runs, lower-cased: what the testers noticed before the verifier."""
    root = os.path.join(work, "qa", "runs")
    parts = []
    if os.path.isdir(root):
        for dp, _dn, fn in os.walk(root):
            for f in fn:
                if f.startswith("tester") and f.endswith(".md"):
                    parts.append(read(os.path.join(dp, f)))
    return "\n".join(parts).lower()


def run_progress(work):
    root = os.path.join(work, "qa", "runs")
    out = []
    if os.path.isdir(root):
        for f in sorted(os.listdir(root)):
            if re.match(r"^\d+-.+\.md$", f):
                text = read(os.path.join(root, f))
                prog = re.search(r"(?m)^progress:\s*(.+)$", text)
                intr = re.search(r"(?m)^interrupted:\s*(.+)$", text)
                out.append("%s: %s%s" % (f, (prog.group(1).strip() if prog else "no progress line"),
                                         ("" if not intr or intr.group(1).strip() in ("no", "false") else " · interrupted: " + intr.group(1).strip())))
    return out


def stray_files(work):
    """Files the run left behind outside qa/ and the skill: they should be fixes, or nothing."""
    try:
        p = subprocess.run(["git", "status", "--porcelain", "--untracked-files=all"], cwd=work,
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False)
    except OSError:
        return []
    files = []
    for ln in p.stdout.decode("utf-8", "replace").splitlines():
        path = ln[3:].strip().strip('"')
        if ln.startswith("??") and not path.startswith(IGNORED_STRAY):
            files.append(path)
    return files


def hits(entry, text):
    return sum(1 for k in entry["match"] if k.lower() in text)


def match_trial(key, work):
    bugs = bug_texts(work)
    notes = tester_notes(work)
    per_bug, used = {}, set()
    for pb in key.get("planted", []):
        best = None
        for b in bugs:
            h = hits(pb, b["text"])
            if h >= pb["need"] and (best is None or h > best[1]):
                best = (b, h)
        filed = best[0] if best else None
        if filed:
            used.add(filed["id"])
        per_bug[pb["id"]] = {
            "candidate": bool(filed) or hits(pb, notes) >= pb["need"],
            "filed": filed,
            "fixed": bool(filed) and filed["status"] == "verified",
        }
    controls = []
    for c in key.get("controls", []):
        for b in bugs:
            if hits(c, b["text"]) >= c["need"]:
                controls.append((c, b))
    extra = [b for b in bugs if b["id"] not in used]
    summ = {}
    sp = os.path.join(work, ".zoo", "run-summary.json")
    if os.path.exists(sp):
        try:
            summ = json.load(open(sp, encoding="utf-8"))
        except ValueError:
            summ = {}
    return {"work": work, "bugs": bugs, "per_bug": per_bug, "extra": extra, "controls": controls, "summary": summ,
            "progress": run_progress(work), "stray": stray_files(work)}


def verdict_for(review, trial_no, bug):
    for k in ("t%d:%s" % (trial_no, bug["id"]), bug["title"]):
        if k in review:
            return review[k]
    return "unreviewed"


def score(app, works, review_path, out_path):
    key = json.load(open(os.path.join(HERE, "answers", app + ".json"), encoding="utf-8"))
    review = json.load(open(review_path, encoding="utf-8")) if review_path else {}
    results = [match_trial(key, w) for w in works]
    n = len(results)
    planted = key.get("planted", [])
    kind = key.get("set", "tuning")
    lines = ["# Bug zoo: %s (%s set, %d trial%s)" % (app, kind, n, "" if n == 1 else "s"), ""]
    if kind == "held-out":
        lines += ["Held out: don't read these transcripts or tune the skill on them. Score only to check that a change generalises.", ""]
    if kind == "control":
        lines += ["Control app: nothing is planted, so every filing is a possible false alarm. Review each one.", ""]

    # per trial
    lines += ["## Trials", "", "| Trial | Planted found | Noticed by testers | Fixed and verified | Filed | Unmatched | Control hits | Stray files | Time | Cost |",
              "|---|---|---|---|---|---|---|---|---|---|"]
    for i, r in enumerate(results, 1):
        found = sum(1 for v in r["per_bug"].values() if v["filed"])
        cand = sum(1 for v in r["per_bug"].values() if v["candidate"])
        fixed = sum(1 for v in r["per_bug"].values() if v["fixed"])
        s = r["summary"]
        secs = "%s s" % s["seconds"] if s.get("seconds") is not None else "—"
        cost = "$%s" % s["cost_usd"] if s.get("cost_usd") is not None else "—"
        lines.append("| t%d | %d/%d | %d/%d | %d/%d | %d | %d | %d | %d | %s | %s |" % (
            i, found, len(planted), cand, len(planted), fixed, len(planted), len(r["bugs"]), len(r["extra"]),
            len(r["controls"]), len(r["stray"]), secs, cost))

    # per planted bug across trials
    if planted:
        lines += ["", "## Planted bugs across trials", "",
                  "Stages: noticed by a tester (keyword heuristic over tester notes) → confirmed and filed → fixed and verified.", "",
                  "| Planted | Severity | Noticed | Filed | Fixed | Found at least once | Found every time | Where it got lost |",
                  "|---|---|---|---|---|---|---|---|"]
        once = every = 0
        for pb in planted:
            st = [r["per_bug"][pb["id"]] for r in results]
            c, f, x = sum(v["candidate"] for v in st), sum(1 for v in st if v["filed"]), sum(v["fixed"] for v in st)
            once += f >= 1
            every += f == n
            lost = []
            if c < n:
                lost.append("not noticed %d×" % (n - c))
            if f < c:
                lost.append("noticed but not filed %d×" % (c - f))
            lines.append("| %s | %s | %d/%d | %d/%d | %d/%d | %s | %s | %s |" % (
                pb["id"], pb["severity"], c, n, f, n, x, n, "yes" if f >= 1 else "**no**", "yes" if f == n else "no", ", ".join(lost) or "—"))
        mean_recall = sum(sum(1 for v in r["per_bug"].values() if v["filed"]) for r in results) / float(n * len(planted))
        lines += ["", "Recall: %.0f%% per trial on average. Found at least once: %d of %d. Found every time: %d of %d." % (
            100 * mean_recall, once, len(planted), every, len(planted))]

    # precision from hand review
    lines += ["", "## Filings that matched no planted bug", "",
              "Mark each in a review file as \"real\" or \"false-alarm\" (keys: the exact title, or `t<trial>:BUG-NNN`), then score with `--review`."]
    real = false = unrev = 0
    for i, r in enumerate(results, 1):
        lines.append("")
        lines.append("Trial t%d:" % i)
        if not r["extra"]:
            lines.append("- none")
        for b in r["extra"]:
            v = verdict_for(review, i, b)
            real += v == "real"
            false += v == "false-alarm"
            unrev += v == "unreviewed"
            lines.append("- %s (%s, %s): %s · **%s**" % (b["id"], b["severity"], b["status"], b["title"], v))
    filed_total = sum(len(r["bugs"]) for r in results)
    matched_total = sum(sum(1 for v in r["per_bug"].values() if v["filed"]) for r in results)
    if filed_total:
        lines += ["", "Precision: %d of %d filings are planted or reviewed as real (%d false alarms, %d not yet reviewed)." % (
            matched_total + real, filed_total, false, unrev)]

    if any(r["controls"] for r in results):
        lines += ["", "## Control hits (filings about behaviour the answer key says is correct)", ""]
        for i, r in enumerate(results, 1):
            for c, b in r["controls"]:
                lines.append("- t%d %s: %s (control: %s)" % (i, b["id"], b["title"], c["title"]))

    lines += ["", "## Process and cleanliness", ""]
    for i, r in enumerate(results, 1):
        lines.append("- t%d runs: %s" % (i, "; ".join(r["progress"]) or "no run files"))
        lines.append("- t%d stray files: %s" % (i, ", ".join(r["stray"][:10]) or "none"))

    if n == 1:
        lines += ["", "## Final summary from the run", "", "```", (results[0]["summary"].get("result") or "").strip()[:3000], "```"]
    text = "\n".join(lines) + "\n"
    if out_path:
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
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
    elif cmd == "trials":
        trials(arg("--app"), arg("--base"), int(arg("--n", "3")), arg("--prompt"), int(arg("--timeout", "5400")))
    elif cmd == "score":
        score(arg("--app"), [w for w in (arg("--work") or "").split(",") if w], arg("--review"), arg("--out"))
    else:
        print(__doc__)
