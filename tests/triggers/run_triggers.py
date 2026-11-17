#!/usr/bin/env python3
"""Trigger tests: does enhance-qa start when it should, and stay out of the way when it shouldn't?

For each row of prompts.csv, a fresh copy of the bug zoo's clean control app gets the skill as a project skill,
and Claude Code runs the prompt headless for a few turns with read-only tools. A prompt counts as triggered
when the session invokes the enhance-qa skill (a Skill tool call naming it, or the skill's instructions loaded
by a slash command). Nothing is changed in the project: the tools allowed can't write.

  python -I tests/triggers/run_triggers.py --work <empty folder outside the repo> [--model sonnet] [--only id1,id2] [--max-turns 8]

Cost: a few cents per prompt with a mid-size model. Codex isn't covered yet: its JSON event stream would need
its own parser (see tests/README.md).
"""
import csv
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
APP = os.path.join(REPO, "tests", "bug-zoo", "cli-wordcount")
SKILL_MARKER = "You are the **QA lead**"
SKILL_PATH = re.compile(r"skills[\\/]+enhance-qa[\\/]+(SKILL\.md|references|scripts)")


def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


def _force_remove(func, path, _exc):
    os.chmod(path, 0o666)
    func(path)


def fresh_project(work, with_note=False):
    if os.path.exists(work):
        shutil.rmtree(work, onerror=_force_remove)
    shutil.copytree(APP, work, ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copytree(SKILL, os.path.join(work, ".claude", "skills", "enhance-qa"))
    if with_note:
        # A project that went through setup: the coding-agent note is in CLAUDE.md and AGENTS.md.
        with open(os.path.join(SKILL, "templates", "snippets", "agents-note.md"), encoding="utf-8") as fh:
            note = "# wordcount\n" + fh.read()
        for name in ("CLAUDE.md", "AGENTS.md"):
            with open(os.path.join(work, name), "w", encoding="utf-8") as fh:
                fh.write(note)
    subprocess.run(["git", "init", "-q"], cwd=work, check=True)


def triggered(events):
    """(invoked, tool calls before it): whether the session invoked enhance-qa, and how many other tool calls
    came first. 0 means the skill was the first thing it reached for, which is what a good description gets."""
    calls = 0
    for ev in events:
        if not isinstance(ev, dict):
            continue
        if ev.get("type") == "user" and SKILL_MARKER.replace("*", "") in json.dumps(ev).replace("*", ""):
            return True, calls
        msg = ev.get("message")
        content = msg.get("content") if isinstance(msg, dict) else None
        for block in content if isinstance(content, list) else []:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                name = block.get("name", "")
                inp = json.dumps(block.get("input", {}))
                if name == "Skill" and "enhance-qa" in inp:
                    return True, calls
                # A slash command loads the skill without an event, so also count the skill's own actions:
                # reading its files or running its scripts.
                if name in ("Read", "Bash", "PowerShell") and SKILL_PATH.search(inp):
                    return True, calls
                calls += 1
    return False, calls


def run_prompt(work, prompt, model, max_turns):
    cmd = ["claude", "-p", prompt, "--output-format", "stream-json", "--verbose", "--max-turns", str(max_turns),
           "--allowedTools", "Skill,Read,Glob,Grep"]
    if model:
        cmd += ["--model", model]
    if "--clean" in sys.argv:
        # Only project settings: leaves out the user's own plugins and their skills, which compete for the
        # skill-listing budget. Shows how the skill triggers on a machine without many other skills.
        cmd += ["--setting-sources", "project"]
    started = time.time()
    p = subprocess.run(cmd, cwd=work, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)
    raw = p.stdout.decode("utf-8", "replace")
    with open(os.path.join(work, ".trigger-events.jsonl"), "w", encoding="utf-8") as fh:
        fh.write(raw)
    events, cost = [], None
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            ev = json.loads(line)
        except ValueError:
            continue
        events.append(ev)
        if ev.get("type") == "result":
            cost = ev.get("total_cost_usd")
    hit, before = triggered(events)
    return hit, before, cost, round(time.time() - started), p.returncode


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    work = arg("--work")
    if not work:
        print(__doc__)
        return 2
    model = arg("--model", "sonnet")
    max_turns = int(arg("--max-turns", "8"))
    only = set((arg("--only") or "").split(",")) - {""}
    with open(os.path.join(HERE, "prompts.csv"), encoding="utf-8", newline="") as fh:
        rows = [r for r in csv.DictReader(fh) if not only or r["id"] in only]
    results, total_cost = [], 0.0
    for r in rows:
        proj = os.path.join(work, r["id"])
        fresh_project(proj, with_note="--with-note" in sys.argv)
        hit, before, cost, secs, code = run_prompt(proj, r["prompt"], model, max_turns)
        want = r["should_trigger"].strip().lower() == "true"
        total_cost += cost or 0.0
        results.append((r, want, hit))
        when = ("first" if before == 0 else "after %d other tool call%s" % (before, "" if before == 1 else "s")) if hit else "-"
        print("%-20s should=%-5s triggered=%-5s %-5s %-28s (%ss, %s)" % (
            r["id"], want, hit, "ok" if want == hit else "WRONG", when, secs, "$%.2f" % cost if cost is not None else "cost unknown"), flush=True)
    tp = sum(1 for _, w, h in results if w and h)
    fn = sum(1 for _, w, h in results if w and not h)
    fp = sum(1 for _, w, h in results if not w and h)
    tn = sum(1 for _, w, h in results if not w and not h)
    print("\nShould trigger: %d of %d did. Should not: %d of %d stayed quiet. Total cost: $%.2f (model %s)" % (
        tp, tp + fn, tn, tn + fp, total_cost, model))
    return 0 if fn == 0 and fp == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
