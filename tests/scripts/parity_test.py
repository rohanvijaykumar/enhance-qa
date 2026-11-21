#!/usr/bin/env python3
"""Runs one scenario against scripts/qa.py and scripts/qa.mjs in fresh fixture projects and compares
every exit code, normalised output and key file. Also checks the scenario's expectations.

Usage:  python -I tests/scripts/parity_test.py            (both, then compare)
        python -I tests/scripts/parity_test.py --only py  (just run the Python one and check expectations)
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SCRIPTS = os.path.join(REPO, "skills", "enhance-qa", "scripts")
IMPLS = {"py": [sys.executable, "-I", os.path.join(SCRIPTS, "qa.py")],
         "node": ["node", os.path.join(SCRIPTS, "qa.mjs")]}

CART = """# Cart
- Area: CART
- Paths: src/cart/**
- Notes: test

### CART-001 · Adding an item updates the badge
- Risk: high · Type: agent · Tags: smoke
- Steps: Open a product → click "Add to cart"
- Expect: The badge shows 1
- Source: README (cart)

### CART-002 · Empty cart message
- Risk: medium · Type: agent
- Steps: Open the cart with no items
- Expect: "Your cart is empty"
  and a link back
- Source: base: empty states

### CART-003 · Looks right
- Risk: low · Type: human
- Steps: Look at the cart
- Expect: It looks good
- Source: user decision
"""
AUTH = """# Auth
- Area: AUTH
- Paths: src/auth/**

### AUTH-001 · Wrong password message
- Risk: high · Type: agent · Tags: smoke
- Steps: Log in with a wrong password
- Expect: "Incorrect email or password"
- Source: README
"""
BAD = """# Bad
- Area: bad

### BAD-1 · not a valid id
- Risk: huge · Type: robot

### OOPS-001
- Risk: high · Type: agent
"""


def norm(s, root):
    s = s.replace("\\\\", "/").replace("\\", "/")
    for r in {root, root.replace("\\", "/"), os.path.realpath(root).replace("\\", "/")}:
        s = s.replace(r, "<root>")
    s = re.sub(r"\b[0-9a-f]{7,40}\b", "<sha>", s)
    s = re.sub(r"\bm[0-9a-f]{40}\b", "<sha>", s)
    s = re.sub(r'"host": "[^"]*"', '"host": "<host>"', s)
    s = re.sub(r'"pid": \d+', '"pid": 0', s)
    s = re.sub(r"on [^ ]+\)\.", "on <host>).", s)
    s = s.replace("\r\n", "\n")
    try:
        return json.dumps(json.loads(s), indent=2, sort_keys=True, ensure_ascii=False)
    except ValueError:
        return s.strip()


def git(cwd, *args):
    subprocess.run(["git"] + list(args), cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)


def write(root, rel, text):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def read(root, rel):
    p = os.path.join(root, rel)
    if not os.path.exists(p):
        return "<missing>"
    with open(p, encoding="utf-8-sig") as f:
        return f.read()


def scenario(impl):
    root = tempfile.mkdtemp(prefix="eqa-parity-%s-" % impl)
    env = dict(os.environ, QA_NOW="2026-11-16T21:30", GIT_CONFIG_GLOBAL=os.devnull)
    env.pop("QA_DIR", None)
    rec, expect_fail = [], []

    def run(step, args, stdin=None, now=None):
        e = dict(env)
        if now:
            e["QA_NOW"] = now
        p = subprocess.run(IMPLS[impl] + args, cwd=root, env=e, input=(stdin or "").encode("utf-8"),
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        o = p.stdout.decode("utf-8", "replace") + p.stderr.decode("utf-8", "replace")
        rec.append({"step": step, "exit": p.returncode, "out": norm(o, root)})
        return p.returncode, o

    def snap(step, rel):
        rec.append({"step": step, "file": rel, "out": norm(read(root, rel), root)})

    def check(cond, msg):
        if not cond:
            expect_fail.append(msg)

    git(root, "init", "-q")
    git(root, "config", "user.email", "t@example.test")
    git(root, "config", "user.name", "T")
    git(root, "config", "core.autocrlf", "false")
    write(root, "package.json", '{"name":"shop","dependencies":{"react":"^18.2.0"}}\n')
    write(root, "src/cart/cart.js", "export const add=1\n")
    write(root, "src/auth/auth.js", "export const login=1\n")
    git(root, "add", "-A")
    git(root, "commit", "-qm", "init")

    c, o = run("init", ["init", "--app", "Shop", "--json"])
    check(c == 0 and os.path.isdir(os.path.join(root, "qa", "checklist")), "init creates qa/")
    snap("gitignore", ".gitignore")
    write(root, "qa/checklist/cart.md", CART)
    write(root, "qa/checklist/auth.md", AUTH)
    c, o = run("validate-ok", ["validate", "--json"])
    check(c == 0, "valid checklist validates")
    run("next-check", ["next-id", "check", "CART", "--json"])
    run("next-bug", ["next-id", "bug", "--json"])
    run("next-run", ["next-id", "run", "--json"])
    c, o = run("snapshot-1", ["snapshot", "--json"])
    check('"build": 1' in o, "first snapshot is build 1")
    c, o = run("snapshot-same", ["snapshot", "--json"])
    check('"same": true' in o, "unchanged tree is the same build")
    run("run-new", ["run", "new", "--mode", "setup", "--json"])
    run("result-1", ["result", "add", "1", "CART-001", "pass", "--evidence", "evidence/001/cart-001.txt", "--json"])
    run("result-2", ["result", "add", "1", "CART-002", "fail", "--note", '"Cart is empty" missing link', "--bug", "BUG-001", "--json"])
    run("result-3", ["result", "add", "1", "AUTH-001", "pass", "--note", 'shows "Incorrect email or password"', "--json"])
    run("result-4", ["result", "add", "1", "CART-003", "human-pending", "--json"])
    c, o = run("result-bad", ["result", "add", "1", "CART-003", "maybe", "--json"])
    check(c != 0, "invalid result value is rejected")
    snap("run-1-file", "qa/runs/001-setup.md")
    run("bug-new", ["bug", "new", "--title", "Empty cart has no link back", "--area", "cart", "--severity", "S3",
                    "--found", "build 1 · CART-002 · Chromium", "--repro", "3/3", "--check", "CART-002", "--json"])
    run("bug-set", ["bug", "set", "BUG-001", "status=open", "--json"])
    c, o = run("bug-set-bad", ["bug", "set", "BUG-001", "status=nope", "--json"])
    check(c != 0, "invalid status is rejected")
    snap("bug-file", "qa/bugs/BUG-001.md")
    run("coverage", ["coverage", "--json"])
    snap("coverage-file", "qa/coverage.md")
    run("status-json", ["status", "--json"])
    run("status-write", ["status", "--write", "--json"])
    snap("status-file", "qa/STATUS.md")

    write(root, "src/cart/cart.js", "export const add=2 // changed\n")
    write(root, "src/promo/new.js", "x\n")
    c, o = run("snapshot-2", ["snapshot", "--json"], now="2026-11-16T22:00")
    check('"build": 2' in o, "changed tree is build 2")
    run("diff", ["diff", "--json"])
    c, o = run("select", ["select", "--json"])
    check("CART-002" in o and "src/promo/new.js" in o, "select picks the changed area and reports unmapped files")
    run("select-quick", ["select", "--quick", "--json"])
    c, o = run("select-halo", ["select", "--halo", "--json"])
    check("CART-002" in o and "AUTH-001" not in o, "select --halo keeps to the changed code, without smoke checks elsewhere")
    c, o = run("select-halo-max", ["select", "--halo", "--max", "1"])
    check("Halo: 1 checks" in o and "CART-001" in o and "CART-002" not in o, "select --halo --max caps the halo, highest risk first")
    run("run-new-2", ["run", "new", "--mode", "check", "--json"], now="2026-11-16T22:05")
    run("hash-record", ["hash", "--record", "--json"])
    run("hash-verify", ["hash", "--verify", "--json"])
    run("phase-start", ["phase", "start", "--role", "tester", "--run", "2", "--json"])
    write(root, "qa/runs/002/tester-1.md", "# Run 002 · tester 1\n## Results\n| Check | Result | Note | Evidence | Bug |\n|---|---|---|---|---|\n| CART-001 | pass | Badge 1 | evidence/002/c1.txt | |\n| CART-002 | fail | no link | evidence/002/c2.png | candidate C1 |\n")
    write(root, "qa/runs/002/tester-2.md", "# Run 002 · tester 2\n## Results\n| Check | Result | Note | Evidence | Bug |\n|---|---|---|---|---|\n| CART-001 | fail | badge stayed 0 | evidence/002/c1b.png | |\n| AUTH-001 | pass | looked fine | | |\n")
    c, o = run("gate-clean", ["gate", "--json"])
    check(c == 0, "gate passes when the tester wrote only its notes")
    run("phase-start-2", ["phase", "start", "--role", "tester", "--run", "2", "--json"])
    with open(os.path.join(root, "src/auth/auth.js"), "a", encoding="utf-8") as f:
        f.write("// tester edit\n")
    write(root, "qa/checklist/cart.md", CART.replace("The badge shows 1", "The badge shows 2"))
    c, o = run("gate-violations", ["gate", "--revert", "--json"])
    check(c == 1, "gate fails on violations")
    check("The badge shows 1" in read(root, "qa/checklist/cart.md"), "gate --revert restores the checklist")
    check("tester edit" in read(root, "src/auth/auth.js"), "gate never reverts product files")
    run("phase-status", ["phase", "status", "--json"])

    run("results-merge", ["results", "merge", "2", "--json"])
    snap("run-2-file", "qa/runs/002-check.md")

    run("phase-start-3", ["phase", "start", "--role", "tester", "--run", "2", "--json"])
    rootj = root.replace("\\", "/")
    hooks = [
        ("hook-tester-src", "pre-tool-use", {"cwd": rootj, "tool_name": "Edit", "agent_type": "enhance-qa:enhance-qa-tester", "tool_input": {"file_path": "src/cart/cart.js"}}),
        ("hook-tester-notes", "pre-tool-use", {"cwd": rootj, "tool_name": "Write", "agent_type": "enhance-qa:enhance-qa-tester", "tool_input": {"file_path": rootj + "/qa/runs/002/tester-1.md"}}),
        ("hook-tester-git", "pre-tool-use", {"cwd": rootj, "tool_name": "Bash", "agent_type": "enhance-qa-tester", "tool_input": {"command": "git commit -am x"}}),
        ("hook-fixer-push", "pre-tool-use", {"cwd": rootj, "tool_name": "Bash", "agent_type": "enhance-qa-fixer", "tool_input": {"command": "git push origin main"}}),
        ("hook-fixer-commit", "pre-tool-use", {"cwd": rootj, "tool_name": "Bash", "agent_type": "enhance-qa-fixer", "tool_input": {"command": "git commit -m 'fix(qa): BUG-001 x'"}}),
        ("hook-fixer-checklist", "pre-tool-use", {"cwd": rootj, "tool_name": "Write", "agent_type": "enhance-qa-fixer", "tool_input": {"file_path": "qa/checklist/cart.md"}}),
        ("hook-main-checklist", "pre-tool-use", {"cwd": rootj, "tool_name": "Edit", "tool_input": {"file_path": "qa/checklist/cart.md"}}),
        ("hook-main-src", "pre-tool-use", {"cwd": rootj, "tool_name": "Edit", "tool_input": {"file_path": "src/cart/cart.js"}}),
        ("hook-codex-patch", "pre-tool-use", {"cwd": rootj, "tool_name": "apply_patch", "tool_input": {"command": "*** Begin Patch\n*** Update File: qa/plan.md\n@@\n-a\n+b\n*** End Patch"}}),
        ("hook-stop-gap", "subagent-stop", {"cwd": rootj, "agent_type": "enhance-qa:enhance-qa-tester", "last_assistant_message": "done: qa/runs/002/tester-2.md"}),
        ("hook-stop-ok", "subagent-stop", {"cwd": rootj, "agent_type": "enhance-qa:enhance-qa-tester", "last_assistant_message": "done: qa/runs/002/tester-1.md"}),
        ("hook-stop-active", "subagent-stop", {"cwd": rootj, "stop_hook_active": True, "agent_type": "enhance-qa-tester", "last_assistant_message": "x"}),
        ("hook-garbage", "pre-tool-use", None),
    ]
    for step, kind, data in hooks:
        c, o = run(step, ["hook", kind], stdin=("{not json" if data is None else json.dumps(data)))
        check(c == 0, "hooks always exit 0 (%s)" % step)
    check('"deny"' in [r for r in rec if r["step"] == "hook-tester-src"][0]["out"], "tester can't edit product code")
    check('"deny"' not in [r for r in rec if r["step"] == "hook-tester-notes"][0]["out"], "tester can write its notes")
    check('"deny"' not in [r for r in rec if r["step"] == "hook-fixer-commit"][0]["out"], "fixer can commit")
    check('"deny"' not in [r for r in rec if r["step"] == "hook-main-src"][0]["out"], "the user's own session is never blocked from product code")
    check('"block"' in [r for r in rec if r["step"] == "hook-stop-gap"][0]["out"], "a result without evidence blocks a tester's stop")
    run("phase-end", ["phase", "end", "--json"])
    c, o = run("hook-no-phase", ["hook", "pre-tool-use"], stdin=json.dumps({"cwd": rootj, "tool_name": "Edit", "agent_type": "enhance-qa-tester", "tool_input": {"file_path": "src/x.js"}}))
    check(o.strip() == "", "hooks are silent when no QA phase is active")

    git(root, "add", "-A")
    git(root, "commit", "-qm", "work")
    write(root, "tests/cart.test.js", 'test("adds", () => {\n  expect(add).toBe(1)\n})\n')
    git(root, "add", "-A")
    git(root, "commit", "-qm", "add test")
    run("snapshot-3", ["snapshot", "--json"], now="2026-11-16T22:10")
    write(root, "tests/cart.test.js", 'test.skip("adds", () => {\n  // expect(add).toBe(1)\n})\n// eslint-disable-next-line\n')
    c, o = run("tamper-tests", ["tamper-tests", "--since", "3", "--json"])
    check("skipped" in o and "assertion" in o and "disabled" in o, "tamper-tests flags skip, removed assertion and disabled lint")

    write(root, "qa/runs/002/verifier-1.md", "### BUG-001\n- Log: 2026-11-16 · build 3 · Verified. Link shown (2/2).\n- Verdict: Verified\n")
    run("bug-log", ["bug", "log", "BUG-001", "--from", "qa/runs/002/verifier-1.md", "--json"])
    snap("bug-file-logged", "qa/bugs/BUG-001.md")
    run("result-human", ["result", "add", "2", "CART-003", "human-pending", "--json"])
    run("status-write-2", ["status", "--write", "--json"])
    snap("status-file-2", "qa/STATUS.md")
    st = read(root, "qa/STATUS.md").replace("- [ ] CART-003 Looks right", "- [x] CART-003 Looks right → fine on my phone")
    write(root, "qa/STATUS.md", st)
    c, o = run("ingest", ["ingest", "--json"])
    check("fine on my phone" in o, "ingest reads answers")
    run("ingest-done", ["ingest", "--done", "--json"])
    run("status-write-3", ["status", "--write", "--json"])

    write(root, "qa/evidence/log.txt", "Authorization: Bearer abc.def\npassword=hunter2&user=a\nemail: jane.doe@gmail.com and qa-user-a@example.test\ncard 4242 4242 4242 4242 and 4539 1488 0343 6467\ntoken " + "sk-ant-" + "api03-ABCDEFGHIJKLMNOPQRSTUV\nkey " + "AK" + "IAABCDEFGHIJKLMNOP\n")
    c, o = run("redact-check", ["redact", "qa/evidence/log.txt", "--check", "--json"])
    check(c == 1, "redact --check exits 1 when it finds something")
    run("redact", ["redact", "qa/evidence/log.txt", "--json"])
    snap("redacted", "qa/evidence/log.txt")
    red = read(root, "qa/evidence/log.txt")
    check("hunter2" not in red and "jane.doe" not in red and "4539" not in red and "4242 4242 4242 4242" in red and "qa-user-a@example.test" in red,
          "redact masks secrets and real emails but keeps test cards and test accounts")

    run("export-csv", ["export", "csv", "--json"])
    snap("csv-checklist", "qa/exports/checklist.csv")
    snap("csv-bugs", "qa/exports/bugs.csv")
    run("export-html", ["export", "html", "--json"])
    snap("html", "qa/exports/qa-report.html")
    c, o = run("lock-1", ["lock", "acquire", "--run", "3", "--json"])
    c, o = run("lock-2", ["lock", "acquire", "--run", "4", "--json"])
    check(c == 2, "a second lock is refused")
    run("lock-status", ["lock", "status", "--json"])
    run("lock-release", ["lock", "release", "--json"])

    write(root, "qa/checklist/bad.md", BAD)
    c, o = run("validate-bad", ["validate", "--json"])
    check(c == 1, "invalid checklist fails validation")
    os.remove(os.path.join(root, "qa/checklist/bad.md"))
    run("help", ["help"])
    c, o = run("unknown", ["frobnicate"])
    check(c == 2, "unknown command exits 2")
    shutil.rmtree(root, ignore_errors=True)
    return rec, expect_fail


def main():
    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1]
    impls = [only] if only else ["py", "node"]
    results = {}
    ok = True
    for impl in impls:
        if impl == "node" and not os.path.exists(os.path.join(SCRIPTS, "qa.mjs")):
            print("qa.mjs not found; skipping node")
            continue
        rec, fails = scenario(impl)
        results[impl] = rec
        print("%s: %d steps, %d expectation failure(s)" % (impl, len(rec), len(fails)))
        for f in fails:
            print("  EXPECTATION FAILED (%s): %s" % (impl, f))
            ok = False
    if "py" in results and "node" in results:
        diffs = 0
        for a, b in zip(results["py"], results["node"]):
            if a.get("exit") != b.get("exit") or a["out"] != b["out"]:
                diffs += 1
                print("\n--- DIFF at step %s%s (exit py=%s node=%s)" % (a["step"], (" file " + a["file"]) if a.get("file") else "", a.get("exit"), b.get("exit")))
                al, bl = a["out"].split("\n"), b["out"].split("\n")
                shown = 0
                for i in range(max(len(al), len(bl))):
                    x = al[i] if i < len(al) else "<eof>"
                    y = bl[i] if i < len(bl) else "<eof>"
                    if x != y:
                        print("  py:   %s\n  node: %s" % (x[:160], y[:160]))
                        shown += 1
                        if shown >= 6:
                            break
        if len(results["py"]) != len(results["node"]):
            diffs += 1
            print("step count differs: py %d, node %d" % (len(results["py"]), len(results["node"])))
        print("\nparity: %s (%d differing step(s))" % ("OK" if diffs == 0 else "DIFFERENT", diffs))
        ok = ok and diffs == 0
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
