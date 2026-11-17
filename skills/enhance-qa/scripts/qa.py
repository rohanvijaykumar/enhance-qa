#!/usr/bin/env python3
"""enhance-qa helper: deterministic bookkeeping for the qa/ folder, so agents spend no tokens on it.

No dependencies (Python 3.8+). scripts/qa.mjs implements the same commands with the same output.
Run from the project root:  python <skill>/scripts/qa.py <command> [options]   (help: `qa.py help`)
"""
import csv
import datetime
import hashlib
import html
import io
import json
import math
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile

VERSION = "0.1.0"
SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATES = os.path.join(SKILL_DIR, "templates")

RISKS = ["high", "medium", "low"]
TYPES = ["auto", "agent", "human", "device", "gate"]
BUG_STATUSES = ["new", "open", "fixed", "verified", "reopened", "needs-decision", "deferred",
                "wont-fix", "by-design", "duplicate", "cant-reproduce"]
OPEN_STATUSES = ["new", "open", "fixed", "reopened", "needs-decision"]
SEVERITIES = ["S1", "S2", "S3", "S4"]
SEV_NAMES = {"S1": "S1 blocker", "S2": "S2 major", "S3": "S3 minor", "S4": "S4 cosmetic"}
PRIORITIES = ["fix-now", "before-release", "later"]
RESULTS = ["pass", "fail", "blocked", "skip", "flaky", "human-pending", "pass-human", "waived", "not-run"]
WORST_FIRST = ["fail", "flaky", "blocked", "human-pending", "not-run", "skip", "waived", "pass-human", "pass"]
STAGES = ["prototype", "building", "near-release", "rc", "live", "hotfix"]
AUTONOMY = ["guided", "balanced", "autopilot"]
BUDGETS = ["lean", "standard", "thorough"]
ROLES = ["lead", "scout", "tester", "verifier", "fixer"]
CHECK_KEYS = ["Risk", "Type", "Tags", "Steps", "Command", "Expect", "Source", "Env", "Data", "Replay",
              "Assumed", "Question", "Retired"]
HEADER_KEYS = ["Area", "Paths", "Modules", "Notes"]
CHECK_ID = r"[A-Z][A-Z0-9]{1,11}-\d{3,}"
CHECK_ID_RE = re.compile(r"^" + CHECK_ID + r"$")
BUG_ID_RE = re.compile(r"^BUG-\d{3,}$")
ANY_ID_RE = re.compile(r"\b(BUG-\d{3,}|" + CHECK_ID + r")\b")
HEAD_RE = re.compile(r"^###\s+(" + CHECK_ID + r")\s*(?:·|—|–|-|:)?\s*(.*?)\s*$")
RUN_FILE_RE = re.compile(r"^(\d{3,})-(.+)\.md$")
STALE_LOCK_HOURS = 6
STALE_PHASE_HOURS = 12
DEFAULT_ROTATION = {"live": 15}
COST_PER_AGENT_CHECK = 0.03
OVERHEAD = 1.4

ALLOWED = {
    "tester": ["{qa}/runs/**", "{qa}/evidence/**"],
    "verifier": ["{qa}/runs/**", "{qa}/evidence/**"],
    "scout": ["{qa}/plan.md", "{qa}/notes.md", "{qa}/checklist/**", "{qa}/evidence/**", "{qa}/README.md", "{qa}/runs/**"],
    "lead": ["{qa}/**"],
    "fixer": ["**"],
}
DENIED = {
    "fixer": ["{qa}/checklist/**", "{qa}/plan.md", "{qa}/notes.md", "{qa}/STATUS.md", "{qa}/coverage.md",
              ".github/workflows/**", ".gitlab-ci.yml", ".circleci/**", "azure-pipelines.yml", "Jenkinsfile",
              "Dockerfile*", "docker-compose*", "*.tf", "vercel.json", "netlify.toml", "fly.toml", "render.yaml",
              ".env", ".env.*", "*.pem", "*.key", "*.p12", "*.pfx"],
}
NEEDS_OK = {
    "fixer": ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "requirements*.txt",
              "pyproject.toml", "poetry.lock", "Pipfile", "Pipfile.lock", "Cargo.toml", "Cargo.lock", "go.mod", "go.sum",
              "Gemfile", "Gemfile.lock", "*.csproj", "pom.xml", "build.gradle", "build.gradle.kts"],
}
TEST_GLOBS = ["**/test/**", "**/tests/**", "**/__tests__/**", "**/spec/**", "**/e2e/**", "*.test.*", "*.spec.*",
              "*_test.*", "test_*.py", "*Test.java", "*Tests.cs", "*Test.kt", "*.snap", "**/__snapshots__/**"]
TEST_CONFIG_GLOBS = [".eslintrc*", "eslint.config.*", "tsconfig*.json", "jest.config.*", "vitest.config.*",
                     "playwright.config.*", "pytest.ini", "setup.cfg", "tox.ini", ".coveragerc", "mypy.ini",
                     "ruff.toml", ".ruff.toml", "pyproject.toml", "phpunit.xml*", "karma.conf.*"]
WIDE_FILES = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", "Gemfile", "pom.xml", "build.gradle",
              "build.gradle.kts", "*.csproj", "*.sln", "CMakeLists.txt", "vite.config.*", "next.config.*",
              "webpack.config.*", "nuxt.config.*", "angular.json", "svelte.config.*", "astro.config.*",
              "tsconfig.json", "Makefile", "Dockerfile"]
SKIP_WALK = {".git", "node_modules", "dist", "build", ".next", "out", "target", "__pycache__", ".venv", "venv",
             ".turbo", ".cache", ".pytest_cache", ".mypy_cache", "coverage", ".svelte-kit", ".nuxt", ".parcel-cache"}
TEST_CARDS = {"4242424242424242", "4000056655665556", "5555555555554444", "2223003122003222", "5200828282828210",
              "5105105105105100", "378282246310005", "371449635398431", "6011111111111117", "3056930009020004",
              "36227206271667", "3566002020360505", "6200000000000005", "4000000000003220", "4000002500003155",
              "4000000000009995", "4000000000000002", "4000000000000069", "4000000000000127", "4111111111111111"}
SAFE_EMAIL_DOMAINS = ("example.com", "example.org", "example.net", "example.test", "localhost")
SAFE_EMAIL_SUFFIXES = (".test", ".example", ".invalid", ".localhost")


class QAError(Exception):
    def __init__(self, msg, code=2):
        super().__init__(msg)
        self.code = code


# ---------------------------------------------------------------- basics

def now_str():
    fixed = os.environ.get("QA_NOW")
    if fixed:
        return fixed
    return datetime.datetime.now().strftime("%Y-%m-%dT%H:%M")


def parse_time(s):
    try:
        return datetime.datetime.strptime(str(s)[:16], "%Y-%m-%dT%H:%M")
    except (TypeError, ValueError):
        return None


def now_dt():
    return parse_time(now_str()) or datetime.datetime.now()


def rd(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def wr(path, text):
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def slash(p):
    return p.replace("\\", "/")


def out(obj, as_json, text=None):
    if as_json:
        sys.stdout.write(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")
    elif text is not None:
        sys.stdout.write(text if text.endswith("\n") else text + "\n")


def sha(s, n=16):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:n]


def norm_ws(s):
    return re.sub(r"\s+", " ", s or "").strip()


def pad3(n):
    return "%03d" % int(n)


# ---------------------------------------------------------------- args

FLAGS = {"json", "write", "record", "verify", "show", "force", "revert", "quick", "check", "done", "keep", "all"}


def parse_args(argv):
    pos, opts = [], {}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a.startswith("--"):
            k = a[2:]
            if "=" in k:
                k, v = k.split("=", 1)
                opts[k] = v
            elif k in FLAGS:
                opts[k] = True
            elif i + 1 < len(argv):
                opts[k] = argv[i + 1]
                i += 1
            else:
                opts[k] = True
        else:
            pos.append(a)
        i += 1
    return pos, opts


# ---------------------------------------------------------------- front matter (flat YAML subset)

def split_fm(text):
    if not text.startswith("---"):
        return None, text
    lines = text.split("\n")
    if lines[0].strip() != "---":
        return None, text
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return lines[1:i], "\n".join(lines[i + 1:])
    return None, text


def strip_comment(v):
    q, res = None, []
    for i, ch in enumerate(v):
        if q:
            if ch == q:
                q = None
        elif ch in "\"'":
            q = ch
        elif ch == "#" and (i == 0 or v[i - 1] in " \t"):
            break
        res.append(ch)
    return "".join(res).rstrip()


def unq(v):
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        inner = v[1:-1]
        if v[0] == '"':
            inner = inner.replace('\\"', '"').replace("\\\\", "\\")
        return inner
    return v


def split_commas(s):
    parts, q, cur = [], None, []
    for ch in s:
        if q:
            cur.append(ch)
            if ch == q:
                q = None
        elif ch in "\"'":
            q = ch
            cur.append(ch)
        elif ch == ",":
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    parts.append("".join(cur))
    return [p for p in (x.strip() for x in parts) if p != ""]


def parse_value(v):
    v = v.strip()
    if v.startswith("[") and v.endswith("]"):
        return [unq(x) for x in split_commas(v[1:-1])]
    return unq(v)


FM_LINE = re.compile(r"^([A-Za-z_][A-Za-z0-9_\-]*)\s*:\s?(.*)$")


def parse_fm(lines):
    d = {}
    for ln in lines or []:
        if not ln.strip() or ln.lstrip().startswith("#"):
            continue
        m = FM_LINE.match(ln)
        if m:
            d[m.group(1)] = parse_value(strip_comment(m.group(2)))
    return d


def fmt_value(v):
    if isinstance(v, list):
        return "[" + ", ".join(str(x) for x in v) + "]"
    s = "" if v is None else str(v)
    if s and (": " in s or " #" in s or s[0] in "[{>|*&!%@`'\"" or s.strip() != s):
        return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return s


def fm_set(text, updates):
    lines, body = split_fm(text)
    if lines is None:
        lines, body = [], text
    done = set()
    for i, ln in enumerate(lines):
        m = FM_LINE.match(ln)
        if m and m.group(1) in updates:
            k, rest = m.group(1), m.group(2)
            kept = strip_comment(rest)
            comment = rest[len(kept):] if len(kept) < len(rest.rstrip()) else ""
            lines[i] = "%s: %s%s" % (k, fmt_value(updates[k]), comment if comment.strip() else "")
            done.add(k)
    for k, v in updates.items():
        if k not in done:
            lines.append("%s: %s" % (k, fmt_value(v)))
    return "---\n" + "\n".join(lines) + "\n---\n" + body


# ---------------------------------------------------------------- project context

class Ctx:
    def __init__(self, opts):
        self.opts = opts
        self.root = os.getcwd()
        self.qa = slash(opts.get("qa") or os.environ.get("QA_DIR") or "qa").rstrip("/")
        self.qa_abs = os.path.join(self.root, self.qa)
        self._git = None

    def p(self, *parts):
        return os.path.join(self.qa_abs, *parts)

    def exists(self):
        return os.path.isdir(self.qa_abs)

    def state(self, name):
        return self.p(".state", name)

    def load_json(self, name, default):
        path = self.state(name)
        if not os.path.exists(path):
            return default
        try:
            return json.loads(rd(path))
        except ValueError:
            return default

    def save_json(self, name, obj):
        wr(self.state(name), json.dumps(obj, indent=2, ensure_ascii=False) + "\n")

    @property
    def git(self):
        if self._git is None:
            self._git = Git(self.root)
        return self._git


def run_cmd(args, cwd=None, env=None, input_text=None, binary=False):
    try:
        p = subprocess.run(args, cwd=cwd, env=env, input=(input_text.encode("utf-8") if input_text is not None else None),
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except FileNotFoundError:
        return 127, (b"" if binary else ""), "not found"
    if binary:
        return p.returncode, p.stdout, p.stderr.decode("utf-8", "replace")
    return p.returncode, p.stdout.decode("utf-8", "replace"), p.stderr.decode("utf-8", "replace")


class Git:
    def __init__(self, cwd):
        self.cwd = cwd
        rc, o, _ = run_cmd(["git", "rev-parse", "--show-toplevel"], cwd=cwd)
        self.ok = rc == 0 and bool(o.strip())
        self.top = os.path.normpath(o.strip()) if self.ok else None
        self.prefix = ""
        if self.ok:
            rc, o, _ = run_cmd(["git", "rev-parse", "--show-prefix"], cwd=cwd)
            self.prefix = slash(o.strip())

    def run(self, args, env=None, input_text=None, binary=False):
        return run_cmd(["git"] + args, cwd=self.top or self.cwd, env=env, input_text=input_text, binary=binary)

    def out(self, args, env=None):
        rc, o, e = self.run(args, env=env)
        if rc != 0:
            raise QAError("git %s failed: %s" % (" ".join(args[:3]), e.strip()[:200]), 1)
        return o

    def head(self):
        rc, o, _ = self.run(["rev-parse", "--verify", "-q", "HEAD"])
        return o.strip() if rc == 0 else ""

    def to_cwd(self, path):
        """Repo-root-relative path -> cwd-relative path, or None if outside cwd."""
        path = slash(path)
        if self.prefix and not path.startswith(self.prefix):
            return None
        return path[len(self.prefix):]

    def from_cwd(self, path):
        return self.prefix + slash(path)

    def tree(self, exclude):
        """Tree object of the working tree (tracked + untracked, honouring .gitignore), without touching the
        real index. `exclude` is a list of cwd-relative paths to leave out."""
        rc, idx, _ = self.run(["rev-parse", "--git-path", "index"])
        idx_path = idx.strip()
        if idx_path and not os.path.isabs(idx_path):
            idx_path = os.path.join(self.top, idx_path)
        fd, tmp = tempfile.mkstemp(prefix="enhance-qa-index-")
        os.close(fd)
        try:
            env = dict(os.environ)
            env["GIT_INDEX_FILE"] = tmp
            if idx_path and os.path.exists(idx_path):
                shutil.copyfile(idx_path, tmp)
            else:
                os.remove(tmp)
                if self.head():
                    self.out(["read-tree", "HEAD"], env=env)
            self.out(["add", "-A", "--", "."], env=env)
            for ex in exclude:
                self.run(["rm", "-r", "--cached", "-q", "--ignore-unmatch", "--", self.from_cwd(ex)], env=env)
            return self.out(["write-tree"], env=env).strip()
        finally:
            for f in (tmp, tmp + ".lock"):
                if os.path.exists(f):
                    try:
                        os.remove(f)
                    except OSError:
                        pass

    def diff_trees(self, a, b):
        o = self.out(["diff-tree", "-r", "--name-only", "--no-commit-id", a, b])
        res = []
        for ln in o.splitlines():
            if not ln.strip():
                continue
            c = self.to_cwd(unquote_git(ln))
            if c is not None:
                res.append(c)
        return res

    def show_bytes(self, treeish, path):
        rc, data, _ = self.run(["show", "%s:%s" % (treeish, self.from_cwd(path))], binary=True)
        return data if rc == 0 else None

    def exists_in(self, treeish, path):
        rc, _, _ = self.run(["cat-file", "-e", "%s:%s" % (treeish, self.from_cwd(path))])
        return rc == 0


def unquote_git(p):
    if p.startswith('"') and p.endswith('"'):
        try:
            return p[1:-1].encode("latin-1").decode("unicode_escape").encode("latin-1").decode("utf-8")
        except (UnicodeDecodeError, UnicodeEncodeError):
            return p[1:-1]
    return p


# ---------------------------------------------------------------- globs

_glob_cache = {}


def glob_re(pattern):
    if pattern in _glob_cache:
        return _glob_cache[pattern]
    p = slash(pattern.strip())
    anchored = "/" in p.rstrip("/")
    if p.startswith("/"):
        p = p[1:]
    if p.endswith("/"):
        p = p + "**"
    i, rx = 0, ""
    while i < len(p):
        c = p[i]
        if p.startswith("**/", i):
            rx += "(?:.*/)?"
            i += 3
        elif p.startswith("**", i):
            rx += ".*"
            i += 2
        elif c == "*":
            rx += "[^/]*"
            i += 1
        elif c == "?":
            rx += "[^/]"
            i += 1
        elif c == "[":
            j = p.find("]", i)
            if j == -1:
                rx += "\\["
                i += 1
            else:
                rx += p[i:j + 1]
                i = j + 1
        else:
            rx += re.escape(c)
            i += 1
    if not any(ch in p for ch in "*?["):
        rx += "(?:/.*)?"
    full = re.compile(("^" if anchored else "^(?:.*/)?") + rx + "$")
    _glob_cache[pattern] = full
    return full


def match_any(path, patterns):
    path = slash(path)
    return any(glob_re(p).match(path) for p in patterns if p.strip())


def role_patterns(table, role, qa):
    return [p.replace("{qa}", qa) for p in table.get(role, [])]


# ---------------------------------------------------------------- checklist

def split_dots(s):
    return [x for x in re.split(r"\s+·\s+", s)]


def parse_area(path, ctx):
    text = rd(path)
    stem = os.path.splitext(os.path.basename(path))[0]
    area = {"file": slash(os.path.relpath(path, ctx.root)), "name": stem, "title": "", "header": {}, "checks": [],
            "problems": []}
    cur, last_key, in_header = None, None, True
    for idx, ln in enumerate(text.split("\n"), 1):
        if ln.startswith("# ") and not area["title"] and in_header:
            area["title"] = ln[2:].strip()
            continue
        m = HEAD_RE.match(ln)
        if m:
            in_header = False
            cur = {"id": m.group(1), "title": m.group(2), "fields": {}, "line": idx, "file": area["file"], "area": stem}
            area["checks"].append(cur)
            last_key = None
            continue
        if ln.startswith("### "):
            area["problems"].append(("error", idx, "Check heading isn't in the form '### AREA-001 · Title': %s" % ln.strip()[:70]))
            in_header, cur, last_key = False, None, None
            continue
        if ln.startswith("#"):
            if not in_header:
                cur = None
            last_key = None
            continue
        target = area["header"] if in_header else (cur["fields"] if cur else None)
        keys = HEADER_KEYS if in_header else CHECK_KEYS
        lm = re.match(r"^ {0,3}[-*]\s+(.*)$", ln)
        if lm and target is not None:
            for part in split_dots(lm.group(1)):
                km = re.match(r"^([A-Za-z][A-Za-z ]{0,20}?)\s*:\s*(.*)$", part.strip())
                key = km.group(1).strip().capitalize() if km else None
                if km and key in keys:
                    target[key] = km.group(2).strip()
                    last_key = key
                elif last_key:
                    target[last_key] = (target[last_key] + " · " + part.strip()).strip()
            continue
        if ln.startswith("  ") and ln.strip() and last_key and target is not None:
            target[last_key] = (target[last_key] + " " + ln.strip()).strip()
            continue
        if not ln.strip():
            last_key = None
    return area


def load_areas(ctx):
    d = ctx.p("checklist")
    if not os.path.isdir(d):
        return []
    files = sorted(f for f in os.listdir(d) if f.endswith(".md") and not f.startswith("_"))
    return [parse_area(os.path.join(d, f), ctx) for f in files]


def all_checks(areas, include_retired=False):
    res = []
    for a in areas:
        for c in a["checks"]:
            if include_retired or not c["fields"].get("Retired"):
                res.append(c)
    return res


def tags_of(c):
    return [t.strip().lower() for t in c["fields"].get("Tags", "").split(",") if t.strip()]


def area_paths(area):
    return [p.strip() for p in area["header"].get("Paths", "").split(",") if p.strip()]


# ---------------------------------------------------------------- bugs, runs, plan

def load_bugs(ctx):
    d = ctx.p("bugs")
    if not os.path.isdir(d):
        return []
    res = []
    for f in sorted(os.listdir(d)):
        if not re.match(r"^BUG-\d{3,}\.md$", f):
            continue
        path = os.path.join(d, f)
        text = rd(path)
        lines, body = split_fm(text)
        res.append({"file": slash(os.path.relpath(path, ctx.root)), "name": f[:-3], "fm": parse_fm(lines),
                    "has_fm": lines is not None, "sections": re.findall(r"(?m)^##\s+(.+?)\s*$", body), "body": body})
    return res


def split_row(ln):
    s = ln.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|") and not s.endswith("\\|"):
        s = s[:-1]
    cells, cur, i = [], [], 0
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s) and s[i + 1] == "|":
            cur.append("|")
            i += 2
            continue
        if s[i] == "|":
            cells.append("".join(cur).strip())
            cur = []
        else:
            cur.append(s[i])
        i += 1
    cells.append("".join(cur).strip())
    return cells


def section_bounds(lines, title):
    """(start, end) line indexes of a '## title' section's content, or None."""
    start = None
    for i, ln in enumerate(lines):
        if re.match(r"^##\s+" + re.escape(title) + r"\s*$", ln):
            start = i + 1
            continue
        if start is not None and re.match(r"^#{1,2}\s", ln):
            return start, i
    return (start, len(lines)) if start is not None else None


def parse_results(body):
    lines = body.split("\n")
    b = section_bounds(lines, "Results")
    if not b:
        return []
    rows, header = [], None
    for ln in lines[b[0]:b[1]]:
        if not ln.strip().startswith("|"):
            continue
        cells = split_row(ln)
        if header is None:
            header = [c.strip().lower() for c in cells]
            continue
        if all(re.match(r"^:?-{2,}:?$", c) for c in cells if c):
            continue
        row = dict(zip(header, cells + [""] * (len(header) - len(cells))))
        res = (row.get("result") or "").strip()
        rows.append({"check": (row.get("check") or "").strip(), "result": res.split(" ")[0].lower() if res else "",
                     "result_raw": res, "note": (row.get("note") or "").strip(),
                     "evidence": (row.get("evidence") or "").strip(), "bug": (row.get("bug") or "").strip()})
    return rows


def load_runs(ctx):
    d = ctx.p("runs")
    if not os.path.isdir(d):
        return []
    res = []
    for f in os.listdir(d):
        m = RUN_FILE_RE.match(f)
        if not m or f.startswith("_"):
            continue
        path = os.path.join(d, f)
        text = rd(path)
        lines, body = split_fm(text)
        fm = parse_fm(lines)
        res.append({"n": int(m.group(1)), "mode": fm.get("mode") or m.group(2), "file": slash(os.path.relpath(path, ctx.root)),
                    "path": path, "fm": fm, "body": body, "text": text, "results": parse_results(body)})
    res.sort(key=lambda r: r["n"])
    return res


def load_plan(ctx):
    path = ctx.p("plan.md")
    if not os.path.exists(path):
        return {}
    lines, _ = split_fm(rd(path))
    return parse_fm(lines)


def setting(plan, key, default):
    v = plan.get(key)
    if v is None or v == "" or v == []:
        return default
    return v


def to_int(v, default):
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return default


def to_float(v, default):
    try:
        return float(str(v).strip().lstrip("$"))
    except (TypeError, ValueError):
        return default


def default_priority(stage, severity):
    table = {
        "prototype": {"S1": "fix-now", "S2": "later", "S3": "later", "S4": "later"},
        "building": {"S1": "fix-now", "S2": "fix-now", "S3": "before-release", "S4": "later"},
        "near-release": {"S1": "fix-now", "S2": "fix-now", "S3": "before-release", "S4": "later"},
        "rc": {"S1": "fix-now", "S2": "before-release", "S3": "later", "S4": "later"},
        "live": {"S1": "fix-now", "S2": "before-release", "S3": "later", "S4": "later"},
        "hotfix": {"S1": "fix-now", "S2": "before-release", "S3": "later", "S4": "later"},
    }
    return table.get(stage, table["building"]).get(severity, "later")


# ---------------------------------------------------------------- validate

def validate(ctx):
    probs = []

    def add(level, file, line, msg):
        probs.append({"level": level, "file": file, "line": line, "message": msg})

    if not ctx.exists():
        add("error", ctx.qa, 0, "No %s/ folder. Run `qa init` first." % ctx.qa)
        return probs
    plan = load_plan(ctx)
    pf = ctx.qa + "/plan.md"
    if not os.path.exists(ctx.p("plan.md")):
        add("warning", pf, 0, "No plan.md yet.")
    for key, allowed in (("stage", STAGES), ("autonomy", AUTONOMY), ("budget", BUDGETS)):
        v = plan.get(key)
        if v and v not in allowed:
            add("error", pf, 0, "%s '%s' isn't one of %s" % (key, v, ", ".join(allowed)))
    for key in ("parallel_testers", "checks_per_tester", "agent_turns", "fixes_per_batch", "max_loop_rounds", "rotation"):
        v = plan.get(key)
        if v not in (None, "", []) and to_int(v, None) is None:
            add("warning", pf, 0, "%s should be a whole number (is '%s')" % (key, v))
    for key in ("confirm_over_usd", "max_usd_per_run"):
        v = plan.get(key)
        if v not in (None, "", []) and v != "never" and to_float(v, None) is None:
            add("warning", pf, 0, "%s should be a number (is '%s')" % (key, v))
    areas = load_areas(ctx)
    seen_prefix, seen_ids = {}, {}
    for a in areas:
        for level, line, msg in a["problems"]:
            add(level, a["file"], line, msg)
        pre = a["header"].get("Area", "")
        if not pre:
            add("error", a["file"], 1, "Missing '- Area: PREFIX' in the header")
        elif not re.match(r"^[A-Z][A-Z0-9]{1,11}$", pre):
            add("error", a["file"], 1, "Area prefix '%s' must be 2–12 capital letters or digits" % pre)
        elif pre in seen_prefix:
            add("error", a["file"], 1, "Area prefix '%s' is also used by %s" % (pre, seen_prefix[pre]))
        else:
            seen_prefix[pre] = a["file"]
        if not a["header"].get("Paths"):
            add("error", a["file"], 1, "Missing '- Paths:' in the header (use * for app-wide areas)")
        for c in a["checks"]:
            f, cid = c["fields"], c["id"]
            if cid in seen_ids:
                add("error", c["file"], c["line"], "%s is a duplicate ID (also in %s)" % (cid, seen_ids[cid]))
            else:
                seen_ids[cid] = "%s:%d" % (c["file"], c["line"])
            if pre and not cid.startswith(pre + "-"):
                add("warning", c["file"], c["line"], "%s doesn't use this area's prefix %s" % (cid, pre))
            if f.get("Retired"):
                continue
            if f.get("Risk", "").lower() not in RISKS:
                add("error", c["file"], c["line"], "%s: Risk '%s' isn't one of %s" % (cid, f.get("Risk", ""), ", ".join(RISKS)))
            t = f.get("Type", "").lower()
            if t not in TYPES:
                add("error", c["file"], c["line"], "%s: Type '%s' isn't one of %s" % (cid, f.get("Type", ""), ", ".join(TYPES)))
            if t == "auto":
                if not f.get("Command") and not f.get("Steps"):
                    add("error", c["file"], c["line"], "%s: an auto check needs Command (or Steps)" % cid)
            elif not f.get("Steps"):
                add("error", c["file"], c["line"], "%s: missing Steps" % cid)
            if not f.get("Expect"):
                add("error", c["file"], c["line"], "%s: missing Expect" % cid)
            if not f.get("Source"):
                add("warning", c["file"], c["line"], "%s: missing Source (the oracle)" % cid)
            if not c["title"]:
                add("warning", c["file"], c["line"], "%s: missing title after the ID" % cid)
    bug_ids = {}
    area_names = set(a["name"] for a in areas)
    for b in load_bugs(ctx):
        fm, fname = b["fm"], b["file"]
        if not b["has_fm"]:
            add("error", fname, 1, "Missing front matter (--- … ---)")
            continue
        for k in ("id", "title", "status", "severity", "priority", "found", "repro", "area"):
            if not fm.get(k):
                add("error", fname, 1, "Missing '%s'" % k)
        bid = fm.get("id", "")
        if bid and bid != b["name"]:
            add("error", fname, 1, "id '%s' doesn't match the file name %s" % (bid, b["name"]))
        if bid in bug_ids:
            add("error", fname, 1, "%s is also used by %s" % (bid, bug_ids[bid]))
        bug_ids[bid] = fname
        if fm.get("status") and fm["status"] not in BUG_STATUSES:
            add("error", fname, 1, "status '%s' isn't one of %s" % (fm["status"], ", ".join(BUG_STATUSES)))
        if fm.get("severity") and fm["severity"] not in SEVERITIES:
            add("error", fname, 1, "severity '%s' isn't one of S1, S2, S3, S4" % fm["severity"])
        if fm.get("priority") and fm["priority"] not in PRIORITIES:
            add("error", fname, 1, "priority '%s' isn't one of %s" % (fm["priority"], ", ".join(PRIORITIES)))
        if fm.get("area") and area_names and fm["area"] not in area_names:
            add("warning", fname, 1, "area '%s' has no checklist file" % fm["area"])
        if fm.get("status") == "duplicate" and not fm.get("duplicate_of"):
            add("warning", fname, 1, "a duplicate should name duplicate_of")
        for sec in ("What a user sees", "Steps", "Expected", "Actual", "Evidence"):
            if sec not in b["sections"]:
                add("warning", fname, 1, "missing section '## %s'" % sec)
        if fm.get("status") not in (None, "", "new") and "(fill in:" in b["body"]:
            add("warning", fname, 1, "still has '(fill in: …)' placeholders")
    known = set(seen_ids)
    for r in load_runs(ctx):
        for k in ("run", "mode", "build"):
            if r["fm"].get(k) in (None, ""):
                add("warning", r["file"], 1, "front matter is missing '%s'" % k)
        for row in r["results"]:
            if row["result"] and row["result"] not in RESULTS:
                add("error", r["file"], 0, "%s: result '%s' isn't one of %s" % (row["check"], row["result_raw"], ", ".join(RESULTS)))
            if known and row["check"] and CHECK_ID_RE.match(row["check"]) and row["check"] not in known:
                add("warning", r["file"], 0, "%s isn't in the checklist" % row["check"])
            if row["result"] in ("pass", "fail", "flaky") and not row["evidence"] and not has_quote(row["note"]):
                add("warning", r["file"], 0, "%s: %s without evidence counts as not-run" % (row["check"], row["result"]))
    return probs


def has_quote(s):
    return bool(re.search(r"[\"“”'`].{2,}[\"“”'`]|\bexit\s*\d+|\b[1-5]\d\d\b", s or ""))


def cmd_validate(ctx, pos, opts):
    probs = validate(ctx)
    errs = [p for p in probs if p["level"] == "error"]
    if opts.get("json"):
        out({"ok": not errs, "errors": len(errs), "warnings": len(probs) - len(errs), "problems": probs}, True)
    else:
        lines = ["%-7s %s%s  %s" % (p["level"], p["file"], (":%d" % p["line"]) if p["line"] else "", p["message"]) for p in probs]
        lines.append("%d error(s), %d warning(s)" % (len(errs), len(probs) - len(errs)))
        out(None, False, "\n".join(lines))
    return 1 if errs else 0


# ---------------------------------------------------------------- ids

def next_check_id(ctx, prefix):
    prefix = prefix.upper()
    n = 0
    d = ctx.p("checklist")
    if os.path.isdir(d):
        for f in os.listdir(d):
            if f.endswith(".md"):
                for m in re.finditer(r"\b" + re.escape(prefix) + r"-(\d{3,})\b", rd(os.path.join(d, f))):
                    n = max(n, int(m.group(1)))
    return "%s-%s" % (prefix, pad3(n + 1))


def next_bug_id(ctx):
    n = 0
    d = ctx.p("bugs")
    if os.path.isdir(d):
        for f in os.listdir(d):
            m = re.match(r"^BUG-(\d{3,})\.md$", f)
            if m:
                n = max(n, int(m.group(1)))
    return "BUG-%s" % pad3(n + 1)


def next_run_n(ctx):
    n = 0
    d = ctx.p("runs")
    if os.path.isdir(d):
        for f in os.listdir(d):
            m = re.match(r"^(\d{3,})(?:-|$)", f)
            if m:
                n = max(n, int(m.group(1)))
    return n + 1


def cmd_next_id(ctx, pos, opts):
    if not pos:
        raise QAError("usage: qa next-id check <PREFIX> | bug | run")
    kind = pos[0]
    if kind == "check":
        if len(pos) < 2:
            raise QAError("usage: qa next-id check <PREFIX>")
        v = next_check_id(ctx, pos[1])
    elif kind == "bug":
        v = next_bug_id(ctx)
    elif kind == "run":
        v = pad3(next_run_n(ctx))
    else:
        raise QAError("usage: qa next-id check <PREFIX> | bug | run")
    out({"id": v}, opts.get("json"), v)
    return 0


# ---------------------------------------------------------------- builds and snapshots

def builds(ctx):
    return ctx.load_json("builds.json", {"builds": []}).get("builds", [])


def manifest(ctx, exclude):
    files = {}
    for dirpath, dirnames, filenames in os.walk(ctx.root):
        rel_dir = slash(os.path.relpath(dirpath, ctx.root))
        rel_dir = "" if rel_dir == "." else rel_dir + "/"
        dirnames[:] = [d for d in dirnames if d not in SKIP_WALK and not any(
            (rel_dir + d) == ex or (rel_dir + d).startswith(ex + "/") for ex in exclude)]
        for fn in filenames:
            rel = rel_dir + fn
            if any(rel == ex or rel.startswith(ex + "/") for ex in exclude):
                continue
            try:
                st = os.stat(os.path.join(dirpath, fn))
            except OSError:
                continue
            files[rel] = [st.st_size, int(st.st_mtime)]
    return files


AGENT_DIRS = [".claude", ".agents", ".codex"]


def current_tree(ctx, include_qa=False):
    # Build identity leaves out qa/ and agent tooling folders (not product code); phase trees keep them so
    # edits there during a phase are still caught.
    exclude = [ctx.qa + "/.state", ctx.qa + "/evidence"] if include_qa else [ctx.qa] + AGENT_DIRS
    if ctx.git.ok:
        return ctx.git.tree(exclude), None
    m = manifest(ctx, exclude)
    return "m" + sha(json.dumps(m, sort_keys=True), 40), m


def changed_between(ctx, a, b):
    """Changed cwd-relative files between two build entries (or phase records)."""
    if a.get("tree", "").startswith("m") or b.get("tree", "").startswith("m"):
        ma, mb = a.get("manifest") or {}, b.get("manifest") or {}
        return sorted(k for k in set(ma) | set(mb) if ma.get(k) != mb.get(k))
    if a["tree"] == b["tree"]:
        return []
    return ctx.git.diff_trees(a["tree"], b["tree"])


def dirty_files(ctx):
    if not ctx.git.ok:
        return []
    rc, o, _ = ctx.git.run(["status", "--porcelain=v1", "--untracked-files=all"])
    res = []
    for ln in o.splitlines():
        if len(ln) < 4:
            continue
        path = ln[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        c = ctx.git.to_cwd(unquote_git(path))
        if c is not None and not any(c == d or c.startswith(d + "/") for d in [ctx.qa] + AGENT_DIRS):
            res.append(c)
    return sorted(res)


def snapshot(ctx):
    tree, man = current_tree(ctx, include_qa=False)
    reg = builds(ctx)
    last = reg[-1] if reg else None
    if last and last["tree"] == tree:
        e = dict(last)
        e["same"] = True
        return e
    n = (last["build"] + 1) if last else 1
    head, commit = "", ""
    if ctx.git.ok:
        head = ctx.git.head()
        env = dict(os.environ)
        env.update({"GIT_AUTHOR_NAME": "enhance-qa", "GIT_AUTHOR_EMAIL": "enhance-qa@localhost",
                    "GIT_COMMITTER_NAME": "enhance-qa", "GIT_COMMITTER_EMAIL": "enhance-qa@localhost"})
        args = ["commit-tree", tree, "-m", "enhance-qa build %d" % n] + (["-p", head] if head else [])
        commit = ctx.git.out(args, env=env).strip()
        ctx.git.out(["update-ref", "refs/enhance-qa/builds/%d" % n, commit])
    entry = {"build": n, "commit": commit, "head": head, "tree": tree, "created": now_str(),
             "included": dirty_files(ctx)}
    if man is not None:
        wr(ctx.state(os.path.join("manifests", "%d.json" % n)), json.dumps(man, sort_keys=True))
    reg.append(entry)
    ctx.save_json("builds.json", {"builds": reg})
    e = dict(entry)
    e["same"] = False
    return e


def build_entry(ctx, n):
    if not re.match(r"^\d+$", str(n).strip()):
        raise QAError("Build numbers are whole numbers, like 3.", 2)
    for b in builds(ctx):
        if b["build"] == int(n):
            e = dict(b)
            if e["tree"].startswith("m"):
                path = ctx.state(os.path.join("manifests", "%d.json" % b["build"]))
                e["manifest"] = json.loads(rd(path)) if os.path.exists(path) else {}
            return e
    return None


def tested_builds(ctx, runs=None):
    runs = load_runs(ctx) if runs is None else runs
    return sorted(set(to_int(r["fm"].get("build"), 0) for r in runs if to_int(r["fm"].get("build"), 0) > 0))


def cmd_snapshot(ctx, pos, opts):
    if not ctx.exists():
        raise QAError("No %s/ folder. Run `qa init` first." % ctx.qa)
    e = snapshot(ctx)
    short = (e["commit"] or e["tree"])[:9]
    text = "Build %d%s · %s%s" % (e["build"], " (unchanged)" if e["same"] else "", short,
                                  (" · includes uncommitted: " + ", ".join(e["included"][:8]) + (" …" if len(e["included"]) > 8 else "")) if e["included"] else "")
    out(e, opts.get("json"), text)
    return 0


def cmd_diff(ctx, pos, opts):
    reg = builds(ctx)
    if not reg:
        raise QAError("No builds yet. Run `qa snapshot`.", 1)
    tested = [b for b in tested_builds(ctx) if b != reg[-1]["build"]]
    a_n = to_int(opts.get("from"), tested[-1] if tested else None)
    b_n = to_int(opts.get("to"), reg[-1]["build"])
    if a_n is None:
        out({"from": None, "to": b_n, "changed": []}, opts.get("json"), "No earlier tested build to compare with.")
        return 0
    a, b = build_entry(ctx, a_n), build_entry(ctx, b_n)
    if not a or not b:
        raise QAError("Unknown build number.", 2)
    ch = [f for f in changed_between(ctx, a, b) if not any(f == d or f.startswith(d + "/") for d in [ctx.qa] + AGENT_DIRS)]
    out({"from": a_n, "to": b_n, "changed": ch}, opts.get("json"),
        "Build %d → %d: %d file(s) changed\n%s" % (a_n, b_n, len(ch), "\n".join(ch)))
    return 0


# ---------------------------------------------------------------- lock

def cmd_lock(ctx, pos, opts):
    sub = pos[0] if pos else "status"
    path = ctx.state("lock.json")
    cur = ctx.load_json("lock.json", None)
    stale = False
    if cur:
        t = parse_time(cur.get("started"))
        stale = t is not None and (now_dt() - t).total_seconds() > STALE_LOCK_HOURS * 3600
    if sub == "acquire":
        if cur and not stale and not opts.get("force"):
            out({"acquired": False, "lock": cur}, opts.get("json"),
                "Another QA run holds the lock (run %s, started %s on %s)." % (cur.get("run", "?"), cur.get("started"), cur.get("host")))
            return 2
        lock = {"run": opts.get("run", ""), "started": now_str(), "host": socket.gethostname(), "pid": os.getpid()}
        ctx.save_json("lock.json", lock)
        out({"acquired": True, "took_over_stale": bool(cur and stale), "lock": lock}, opts.get("json"),
            "Lock acquired" + (" (took over a stale lock)" if cur and stale else "") + ".")
        return 0
    if sub == "release":
        if os.path.exists(path):
            os.remove(path)
        out({"released": True}, opts.get("json"), "Lock released.")
        return 0
    out({"held": bool(cur) and not stale, "stale": stale, "lock": cur}, opts.get("json"),
        ("Held by run %s since %s%s." % (cur.get("run", "?"), cur.get("started"), " (stale)" if stale else "")) if cur else "Not locked.")
    return 0


# ---------------------------------------------------------------- hash

def fingerprints(ctx):
    res = {}
    for c in all_checks(load_areas(ctx)):
        f = c["fields"]
        basis = "\x1f".join([f.get("Type", "").lower(), f.get("Risk", "").lower(), norm_ws(f.get("Steps")),
                             norm_ws(f.get("Command")), norm_ws(f.get("Expect"))])
        res[c["id"]] = sha(basis)
    return res


def hash_compare(ctx):
    rec = ctx.load_json("hash.json", None)
    if not rec:
        return None
    cur, old = fingerprints(ctx), rec.get("checks", {})
    return {"recorded": rec.get("recorded"),
            "changed": sorted(k for k in cur if k in old and cur[k] != old[k]),
            "added": sorted(k for k in cur if k not in old),
            "removed": sorted(k for k in old if k not in cur)}


def cmd_hash(ctx, pos, opts):
    if opts.get("record"):
        fp = fingerprints(ctx)
        ctx.save_json("hash.json", {"recorded": now_str(), "checks": fp})
        out({"recorded": True, "checks": len(fp), "hash": sha(json.dumps(fp, sort_keys=True))}, opts.get("json"),
            "Recorded the checklist fingerprint (%d checks)." % len(fp))
        return 0
    if opts.get("verify"):
        cmp_ = hash_compare(ctx)
        if cmp_ is None:
            out({"ok": False, "error": "no recorded hash"}, opts.get("json"), "No recorded hash. Run `qa hash --record` first.")
            return 1
        ok = not (cmp_["changed"] or cmp_["added"] or cmp_["removed"])
        cmp_["ok"] = ok
        out(cmp_, opts.get("json"), "Checklist unchanged since %s." % cmp_["recorded"] if ok else
            "Checklist changed since %s: changed %s; added %s; removed %s" % (
                cmp_["recorded"], ", ".join(cmp_["changed"]) or "none", ", ".join(cmp_["added"]) or "none",
                ", ".join(cmp_["removed"]) or "none"))
        return 0 if ok else 1
    fp = fingerprints(ctx)
    out({"checks": len(fp), "hash": sha(json.dumps(fp, sort_keys=True))}, opts.get("json"),
        "%d checks · fingerprint %s" % (len(fp), sha(json.dumps(fp, sort_keys=True))))
    return 0


# ---------------------------------------------------------------- phases and gate

def cmd_phase(ctx, pos, opts):
    sub = pos[0] if pos else "status"
    if sub == "start":
        role = opts.get("role")
        if role not in ROLES:
            raise QAError("usage: qa phase start --role %s [--run N]" % "|".join(ROLES))
        tree, man = current_tree(ctx, include_qa=True)
        ph = {"role": role, "run": opts.get("run", ""), "started": now_str(), "tree": tree,
              "allowed": role_patterns(ALLOWED, role, ctx.qa), "denied": role_patterns(DENIED, role, ctx.qa)}
        if man is not None:
            ph["manifest"] = man
        ctx.save_json("phase.json", ph)
        out({"started": True, "role": role, "run": ph["run"]}, opts.get("json"), "Phase started: %s." % role)
        return 0
    if sub == "end":
        path = ctx.state("phase.json")
        if os.path.exists(path):
            os.remove(path)
        out({"ended": True}, opts.get("json"), "Phase ended.")
        return 0
    ph = ctx.load_json("phase.json", None)
    out({"active": bool(ph), "phase": {k: v for k, v in (ph or {}).items() if k != "manifest"}}, opts.get("json"),
        ("Active phase: %s (run %s, since %s)." % (ph["role"], ph.get("run"), ph["started"])) if ph else "No active phase.")
    return 0


def classify(ctx, role, files):
    allowed, denied = role_patterns(ALLOWED, role, ctx.qa), role_patterns(DENIED, role, ctx.qa)
    needs = role_patterns(NEEDS_OK, role, ctx.qa)
    violations, flagged = [], []
    for f in files:
        if f.startswith(ctx.qa + "/.state/") or f.startswith(ctx.qa + "/evidence/"):
            continue
        if match_any(f, denied) or not match_any(f, allowed):
            violations.append(f)
        elif match_any(f, needs):
            flagged.append(f)
    return violations, flagged


def tamper(ctx, role, since_tree=None):
    ph = ctx.load_json("phase.json", None)
    if since_tree is None:
        if not ph:
            raise QAError("No active phase. Run `qa phase start --role <role>` first, or pass --since <tree>.", 1)
        start = {"tree": ph["tree"], "manifest": ph.get("manifest")}
    else:
        start = {"tree": since_tree}
    tree, man = current_tree(ctx, include_qa=True)
    now = {"tree": tree, "manifest": man}
    changed = changed_between(ctx, start, now)
    v, f = classify(ctx, role, changed)
    return {"role": role, "changed": changed, "violations": v, "needs_ok": f, "start_tree": start["tree"]}


def cmd_tamper(ctx, pos, opts):
    ph = ctx.load_json("phase.json", None)
    role = opts.get("role") or (ph or {}).get("role")
    if role not in ROLES:
        raise QAError("usage: qa tamper --role <role> [--since <tree>]")
    t = tamper(ctx, role, opts.get("since"))
    out(t, opts.get("json"), "Changed: %d · outside %s's files: %s%s" % (
        len(t["changed"]), role, ", ".join(t["violations"]) or "none",
        ("\nNeeds the user's OK (dependencies): " + ", ".join(t["needs_ok"])) if t["needs_ok"] else ""))
    return 1 if t["violations"] else 0


def evidence_gaps(ctx, role, run):
    if role not in ("tester", "verifier") or not run:
        return []
    d = ctx.p("runs", pad3(run)) if str(run).isdigit() else ctx.p("runs", str(run))
    gaps = []
    if os.path.isdir(d):
        for f in sorted(os.listdir(d)):
            if f.startswith(role) and f.endswith(".md"):
                for row in parse_results(split_fm(rd(os.path.join(d, f)))[1]):
                    if row["result"] in ("pass", "fail", "flaky") and not row["evidence"] and not has_quote(row["note"]):
                        gaps.append("%s (%s)" % (row["check"], f))
    return gaps


def revert_paths(ctx, start_tree, paths, start_manifest=None):
    """Restore QA-owned files to their phase-start content. Keeps a backup of what was replaced."""
    stamp = now_str().replace(":", "").replace("-", "")
    done = []
    for f in paths:
        if not (f == ctx.qa or f.startswith(ctx.qa + "/")):
            continue
        absf = os.path.join(ctx.root, f)
        if os.path.exists(absf):
            bk = ctx.state(os.path.join("reverted", stamp, f))
            os.makedirs(os.path.dirname(bk), exist_ok=True)
            shutil.copyfile(absf, bk)
        if ctx.git.ok and ctx.git.exists_in(start_tree, f):
            data = ctx.git.show_bytes(start_tree, f)
            if data is not None:
                os.makedirs(os.path.dirname(absf) or ".", exist_ok=True)
                with open(absf, "wb") as fh:
                    fh.write(data)
                done.append(f)
        elif ctx.git.ok and os.path.exists(absf):
            os.remove(absf)
            done.append(f)
    return done


def cmd_gate(ctx, pos, opts):
    ph = ctx.load_json("phase.json", None)
    role = opts.get("role") or (ph or {}).get("role")
    if role not in ROLES:
        raise QAError("usage: qa gate [--role <role>] [--revert] [--keep]")
    report = {"role": role, "ok": True}
    if ph:
        t = tamper(ctx, role)
        report.update({"changed": t["changed"], "violations": t["violations"], "needs_ok": t["needs_ok"]})
        product = [f for f in t["violations"] if not (f == ctx.qa or f.startswith(ctx.qa + "/"))]
        report["product_changes"] = product
        if opts.get("revert") and t["violations"]:
            report["reverted"] = revert_paths(ctx, ph["tree"], t["violations"], ph.get("manifest"))
        if t["violations"]:
            report["ok"] = False
    else:
        report["note"] = "No active phase: skipped the tamper check."
    if role not in ("scout", "lead"):
        cmp_ = hash_compare(ctx)
        if cmp_ is not None and (cmp_["changed"] or cmp_["added"] or cmp_["removed"]):
            report["checklist_changed"] = cmp_
            report["ok"] = False
    probs = [p for p in validate(ctx) if p["level"] == "error"]
    if probs:
        report["validation_errors"] = probs[:20]
        report["ok"] = False
    gaps = evidence_gaps(ctx, role, (ph or {}).get("run") or opts.get("run"))
    if gaps:
        report["evidence_gaps"] = gaps
    if ph and not opts.get("keep"):
        os.remove(ctx.state("phase.json"))
        report["phase_ended"] = True
    lines = ["Gate (%s): %s" % (role, "OK" if report["ok"] else "PROBLEMS")]
    if report.get("violations"):
        lines.append("Outside %s's files: %s" % (role, ", ".join(report["violations"])))
        if report.get("product_changes"):
            lines.append("Product files changed during the phase (not reverted; could be the user's own edits): " + ", ".join(report["product_changes"]))
    if report.get("reverted"):
        lines.append("Reverted (backups in %s/.state/reverted/): %s" % (ctx.qa, ", ".join(report["reverted"])))
    if report.get("needs_ok"):
        lines.append("Needs the user's OK (dependency files): " + ", ".join(report["needs_ok"]))
    if report.get("checklist_changed"):
        c = report["checklist_changed"]
        lines.append("Checklist changed during the phase: %s" % ", ".join(c["changed"] + c["added"] + c["removed"]))
    if report.get("validation_errors"):
        lines.append("Validation errors: %d (run `qa validate`)" % len(report["validation_errors"]))
    if gaps:
        lines.append("Results without evidence (count as not-run): " + ", ".join(gaps))
    if report.get("note"):
        lines.append(report["note"])
    out(report, opts.get("json"), "\n".join(lines))
    return 0 if report["ok"] else 1


# ---------------------------------------------------------------- tamper-tests

SKIP_PAT = re.compile(r"\.(skip|only)\s*\(|\b(xit|xdescribe|fit|fdescribe|xtest)\s*\(|@pytest\.mark\.(skip|xfail)|@unittest\.skip|#\[ignore\]|\bt\.Skip\(|@Disabled\b|@Ignore\b|\bpending\s*\(|test\.todo|it\.todo")
DISABLE_PAT = re.compile(r"eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck|#\s*type:\s*ignore|#\s*noqa|#\s*pylint:\s*disable|//\s*nolint|#\s*pragma:\s*no\s*cover|@SuppressWarnings")
ASSERT_PAT = re.compile(r"\b(assert\w*|expect|should|assertEqual|assertTrue|assertFalse|toBe\w*|toEqual|toMatch\w*|toHave\w*|toThrow\w*|verify|ensure)\b")
TIMEOUT_PAT = re.compile(r"(timeout\w*\s*[:=(]\s*\d{4,}|setTimeout\s*\(\s*\d{4,}|retries\s*[:=]\s*[1-9]|\.retry\s*\(|flaky)", re.I)


def cmd_tamper_tests(ctx, pos, opts):
    if not ctx.git.ok:
        raise QAError("tamper-tests needs git.", 1)
    since = opts.get("since")
    if not since:
        raise QAError("usage: qa tamper-tests --since <build number|git ref>")
    ref = since
    if str(since).isdigit():
        b = build_entry(ctx, since)
        if not b:
            raise QAError("Unknown build %s." % since, 2)
        ref = b["commit"] or b["tree"]
    rc, o, e = ctx.git.run(["diff", "--name-status", ref, "--"])
    if rc != 0:
        raise QAError("git diff failed: %s" % e.strip()[:200], 1)
    entries = []
    for ln in o.splitlines():
        parts = ln.split("\t")
        if len(parts) >= 2:
            entries.append((parts[0][0], unquote_git(parts[-1])))
    rc, o2, _ = ctx.git.run(["ls-files", "--others", "--exclude-standard"])
    for ln in o2.splitlines():
        if ln.strip():
            entries.append(("A", unquote_git(ln.strip())))
    flags = []
    for st, path in entries:
        c = ctx.git.to_cwd(path)
        if c is None or c.startswith(ctx.qa + "/"):
            continue
        is_test, is_cfg = match_any(c, TEST_GLOBS), match_any(c, TEST_CONFIG_GLOBS)
        if not (is_test or is_cfg):
            continue
        if is_cfg and not is_test:
            flags.append({"file": c, "kind": "test or lint config changed", "text": ""})
            continue
        if c.endswith(".snap") or "/__snapshots__/" in "/" + c:
            flags.append({"file": c, "kind": "snapshot changed: check it matches a product reason", "text": ""})
            continue
        if st == "D":
            flags.append({"file": c, "kind": "test file deleted", "text": ""})
            continue
        if st == "A" and not ctx.git.exists_in(ref, c):
            absf = os.path.join(ctx.root, c)
            try:
                content = rd(absf)
            except (OSError, UnicodeDecodeError):
                continue
            for i, ln in enumerate(content.split("\n"), 1):
                if SKIP_PAT.search(ln):
                    flags.append({"file": c, "line": i, "kind": "skip or only in a new test", "text": ln.strip()[:120]})
            continue
        rc, d, _ = ctx.git.run(["diff", "-U0", ref, "--", ctx.git.from_cwd(c)])
        line_no = 0
        for ln in d.splitlines():
            m = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)", ln)
            if m:
                line_no = int(m.group(1))
                continue
            if ln.startswith("+++") or ln.startswith("---"):
                continue
            if ln.startswith("-") and ASSERT_PAT.search(ln):
                flags.append({"file": c, "line": line_no, "kind": "assertion removed or changed", "text": ln[1:].strip()[:120]})
            elif ln.startswith("+"):
                body = ln[1:]
                if SKIP_PAT.search(body):
                    flags.append({"file": c, "line": line_no, "kind": "test skipped or focused", "text": body.strip()[:120]})
                if DISABLE_PAT.search(body):
                    flags.append({"file": c, "line": line_no, "kind": "lint or type check disabled", "text": body.strip()[:120]})
                if TIMEOUT_PAT.search(body):
                    flags.append({"file": c, "line": line_no, "kind": "timeout raised or retries added", "text": body.strip()[:120]})
                line_no += 1
    out({"since": since, "flags": flags}, opts.get("json"),
        ("%d possible test-tampering flag(s) since %s:\n" % (len(flags), since)) +
        "\n".join("%s%s: %s %s" % (f["file"], (":%d" % f["line"]) if f.get("line") else "", f["kind"],
                                    ("— " + f["text"]) if f["text"] else "") for f in flags) if flags else
        "No test-tampering flags since %s." % since)
    return 0


# ---------------------------------------------------------------- coverage

def latest_results(runs):
    last = {}
    for r in runs:
        for row in r["results"]:
            if row["check"] and row["result"]:
                last[row["check"]] = {"result": row["result"], "build": to_int(r["fm"].get("build"), 0), "run": r["n"],
                                      "date": str(r["fm"].get("started") or "")[:10]}
    return last


def cmd_coverage(ctx, pos, opts):
    areas = load_areas(ctx)
    runs = load_runs(ctx)
    last = latest_results(runs)
    rows = []
    for c in all_checks(areas):
        l = last.get(c["id"], {})
        rows.append({"check": c["id"], "area": c["area"], "risk": c["fields"].get("Risk", "").lower(),
                     "type": c["fields"].get("Type", "").lower(), "result": l.get("result", ""),
                     "build": l.get("build", ""), "run": l.get("run", ""), "date": l.get("date", "")})
    total = len(rows)
    passed = sum(1 for r in rows if r["result"] in ("pass", "pass-human"))
    failed = sum(1 for r in rows if r["result"] in ("fail", "flaky"))
    never = sum(1 for r in rows if not r["result"])
    summary = {"checks": total, "passed": passed, "failed": failed, "never_run": never}
    lines = ["# Coverage", "",
             "Generated by `qa coverage` on %s. %d checks · %d passed · %d failed · %d never run." % (now_str()[:10], total, passed, failed, never),
             "", "| Check | Area | Risk | Type | Last result | Build | Run | Date |", "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        lines.append("| %s | %s | %s | %s | %s | %s | %s | %s |" % (
            r["check"], r["area"], r["risk"], r["type"], r["result"] or "never run", r["build"],
            pad3(r["run"]) if r["run"] != "" else "", r["date"]))
    if ctx.exists():
        wr(ctx.p("coverage.md"), "\n".join(lines) + "\n")
    out({"summary": summary, "rows": rows} if opts.get("json") else None, opts.get("json"),
        "Coverage written: %d checks, %d passed, %d failed, %d never run." % (total, passed, failed, never))
    return 0


# ---------------------------------------------------------------- select

def calibrated_cost(runs):
    vals = []
    for r in runs[-5:]:
        lines = r["body"].split("\n")
        b = section_bounds(lines, "Cost")
        if not b:
            continue
        total = None
        for ln in lines[b[0]:b[1]]:
            if ln.strip().startswith("|") and "total" in ln.lower():
                m = re.findall(r"\$\s*([0-9]+(?:\.[0-9]+)?)", ln)
                if m:
                    total = float(m[-1])
        agent_checks = sum(1 for row in r["results"] if row["result"] in ("pass", "fail", "flaky", "blocked"))
        if total is not None and agent_checks:
            vals.append(total / agent_checks)
    return (sum(vals) / len(vals)) if len(vals) >= 2 else None


def major(v):
    m = re.search(r"(\d+)", str(v or ""))
    return int(m.group(1)) if m else None


def package_major_bumps(ctx, base_entry):
    bumps = []
    if not ctx.git.ok or not base_entry or base_entry.get("tree", "").startswith("m"):
        return bumps
    for pkg in ("package.json",):
        old = ctx.git.show_bytes(base_entry["tree"], pkg)
        if old is None or not os.path.exists(os.path.join(ctx.root, pkg)):
            continue
        try:
            a = json.loads(old.decode("utf-8"))
            b = json.loads(rd(os.path.join(ctx.root, pkg)))
        except ValueError:
            continue
        for sec in ("dependencies", "devDependencies"):
            for name, ver in (b.get(sec) or {}).items():
                ov = (a.get(sec) or {}).get(name)
                if ov and major(ov) is not None and major(ver) is not None and major(ver) > major(ov):
                    bumps.append("%s %s → %s" % (name, ov, ver))
    return bumps


def tracked_count(ctx):
    if ctx.git.ok:
        rc, o, _ = ctx.git.run(["ls-files"])
        n = 0
        for ln in o.splitlines():
            c = ctx.git.to_cwd(unquote_git(ln))
            if c is not None and not (c == ctx.qa or c.startswith(ctx.qa + "/")):
                n += 1
        return n
    return len(manifest(ctx, [ctx.qa]))


def select(ctx, opts):
    plan = load_plan(ctx)
    areas = load_areas(ctx)
    checks = all_checks(areas)
    by_id = {c["id"]: c for c in checks}
    runs = load_runs(ctx)
    reg = builds(ctx)
    budget = opts.get("budget") or setting(plan, "budget", "standard")
    stage = setting(plan, "stage", "building")
    quick = bool(opts.get("quick"))
    head = reg[-1] if reg else None
    tested = [b for b in tested_builds(ctx, runs) if not head or b != head["build"]]
    base_n = to_int(opts.get("base"), tested[-1] if tested else None)
    base = build_entry(ctx, base_n) if base_n else None
    head_e = build_entry(ctx, head["build"]) if head else None
    if base and head_e:
        changed = changed_between(ctx, base, head_e)
    else:
        changed = []
    changed = [f for f in changed if not any(f == d or f.startswith(d + "/") for d in [ctx.qa] + AGENT_DIRS)]
    affected, mapped = {}, set()
    for a in areas:
        pats = [p for p in area_paths(a) if p != "*"]
        if not pats:
            continue
        hits = [f for f in changed if match_any(f, pats)]
        if hits:
            affected[a["name"]] = hits
            mapped.update(hits)
    docs = [f for f in changed if f not in mapped and re.search(r"(?i)\.(md|mdx|txt|rst)$", f)]
    unmapped = [f for f in changed if f not in mapped and f not in docs]
    selected = {}

    def pick(c, reason):
        if c["fields"].get("Type", "").lower() not in ("agent", "auto"):
            return
        selected.setdefault(c["id"], [])
        if reason not in selected[c["id"]]:
            selected[c["id"]].append(reason)

    for c in checks:
        if "smoke" in tags_of(c):
            pick(c, "smoke")
    bugs = load_bugs(ctx)
    to_verify = [b["fm"].get("id") for b in bugs if b["fm"].get("status") == "fixed"]
    for b in bugs:
        if b["fm"].get("status") != "fixed":
            continue
        bid = b["fm"].get("id", "")
        refs = set(ANY_ID_RE.findall(str(b["fm"].get("found", "")) + " " + str(b["fm"].get("check", ""))))
        for c in checks:
            if c["id"] in refs or bid and bid in c["fields"].get("Source", ""):
                pick(c, "verify %s" % bid)
    risks = ["high"] if quick else (["high", "medium", "low"] if budget == "thorough" else ["high", "medium"])
    for c in checks:
        if c["area"] in affected and c["fields"].get("Risk", "").lower() in risks:
            pick(c, "changed area")
        elif c["area"] in affected and "regression" in tags_of(c):
            pick(c, "regression in changed area")
    human = [c["id"] for c in checks if c["area"] in affected and c["fields"].get("Type", "").lower() in ("human", "device", "gate")]
    rotation_pct = to_int(setting(plan, "rotation", DEFAULT_ROTATION.get(stage, 10)), 10)
    if budget == "thorough":
        rotation_pct = max(rotation_pct, 25)
    if budget == "lean" or quick or not base:
        rotation_pct = 0
    pool = [c for c in checks if c["fields"].get("Type", "").lower() in ("agent", "auto")]
    last = latest_results(runs)
    rot_n = int(math.ceil(len(pool) * rotation_pct / 100.0)) if rotation_pct else 0
    candidates = sorted([c for c in pool if c["id"] not in selected],
                        key=lambda c: (last.get(c["id"], {}).get("run", 0), c["id"]))
    for c in candidates[:rot_n]:
        pick(c, "rotation")
    order = {"high": 0, "medium": 1, "low": 2}
    ids = sorted(selected, key=lambda i: (0 if "smoke" in selected[i] else 1, order.get(by_id[i]["fields"].get("Risk", "").lower(), 3), i))
    if quick:
        ids = ids[:10]
    wide_reasons = []
    total_files = tracked_count(ctx)
    if base and total_files and len(changed) >= 10 and len(changed) / float(total_files) > 0.3:
        wide_reasons.append("%d of %d files changed" % (len(changed), total_files))
    build_files = [f for f in changed if match_any(f, WIDE_FILES)]
    bumps = package_major_bumps(ctx, base)
    if bumps:
        wide_reasons.append("major upgrade: " + ", ".join(bumps[:5]))
    elif build_files:
        wide_reasons.append("build or dependency files changed: " + ", ".join(build_files[:5]))
    agent_n = sum(1 for i in ids if by_id[i]["fields"].get("Type", "").lower() == "agent")
    per = calibrated_cost(runs) or COST_PER_AGENT_CHECK
    testers = max(1, to_int(setting(plan, "parallel_testers", 3), 3))
    est_usd = round(agent_n * per * OVERHEAD, 2)
    est_min = int(math.ceil(agent_n * 1.5 / testers)) + 2 if agent_n else 1
    res = {"base": base_n, "head": head["build"] if head else None, "no_baseline": base is None,
           "changed": changed, "areas": affected, "docs_changed": docs, "unmapped": unmapped,
           "to_verify": to_verify, "selected": [{"id": i, "area": by_id[i]["area"], "risk": by_id[i]["fields"].get("Risk", "").lower(),
                                                 "type": by_id[i]["fields"].get("Type", "").lower(), "reasons": selected[i]} for i in ids],
           "human": human, "wide": bool(wide_reasons), "wide_reasons": wide_reasons,
           "estimate": {"agent_checks": agent_n, "auto_checks": len(ids) - agent_n, "usd": est_usd, "minutes": est_min,
                        "calibrated": per != COST_PER_AGENT_CHECK}}
    return res


def cmd_select(ctx, pos, opts):
    r = select(ctx, opts)
    if opts.get("json"):
        out(r, True)
        return 0
    lines = []
    if r["no_baseline"]:
        lines.append("No earlier tested build: this needs a baseline (setup or full). Smoke checks listed below.")
    else:
        lines.append("Build %s → %s: %d file(s) changed in %d area(s)%s" % (
            r["base"], r["head"], len(r["changed"]), len(r["areas"]), (" · unmapped: " + ", ".join(r["unmapped"][:6])) if r["unmapped"] else ""))
    lines.append("Selected %d checks (%d agent, %d auto) · ~$%.2f · ~%d min" % (
        len(r["selected"]), r["estimate"]["agent_checks"], r["estimate"]["auto_checks"], r["estimate"]["usd"], r["estimate"]["minutes"]))
    for s in r["selected"]:
        lines.append("  %s  %s · %s · %s" % (s["id"], s["risk"], s["type"], ", ".join(s["reasons"])))
    if r["to_verify"]:
        lines.append("Fixes to verify: " + ", ".join(r["to_verify"]))
    if r["human"]:
        lines.append("Human checks in changed areas: " + ", ".join(r["human"]))
    if r["wide"]:
        lines.append("Wide change, consider a full pass: " + "; ".join(r["wide_reasons"]))
    out(None, False, "\n".join(lines))
    return 0


# ---------------------------------------------------------------- results

RESULTS_HEADER = ["| Check | Result | Note | Evidence | Bug |", "|---|---|---|---|---|"]


def esc_cell(s):
    return (s or "").replace("|", "\\|").replace("\n", " ")


def find_run(ctx, run):
    if not re.match(r"^\d+$", str(run).strip()):
        raise QAError("Run numbers are whole numbers, like 7.", 2)
    n = int(run)
    for r in load_runs(ctx):
        if r["n"] == n:
            return r
    raise QAError("No run file for run %s in %s/runs/." % (run, ctx.qa), 1)


def write_results(r, rows):
    text = r["text"]
    lines, body = split_fm(text)
    blines = body.split("\n")
    table = RESULTS_HEADER + ["| %s | %s | %s | %s | %s |" % (esc_cell(x["check"]), esc_cell(x["result_raw"] or x["result"]),
                                                             esc_cell(x["note"]), esc_cell(x["evidence"]), esc_cell(x["bug"])) for x in rows]
    b = section_bounds(blines, "Results")
    if b:
        start, end = b
        content = blines[start:end]
        first = next((i for i, ln in enumerate(content) if ln.strip().startswith("|")), None)
        if first is None:
            new_content = [""] + table + [""]
        else:
            last = first
            while last < len(content) and content[last].strip().startswith("|"):
                last += 1
            new_content = content[:first] + table + content[last:]
        blines = blines[:start] + new_content + blines[end:]
    else:
        blines += ["", "## Results"] + table
    new_body = "\n".join(blines)
    if lines is not None:
        return "---\n" + "\n".join(lines) + "\n---\n" + new_body
    return new_body


def rank(result):
    return WORST_FIRST.index(result) if result in WORST_FIRST else len(WORST_FIRST)


def cmd_results(ctx, pos, opts):
    if len(pos) < 2 or pos[0] != "merge":
        raise QAError("usage: qa results merge <run>")
    r = find_run(ctx, pos[1])
    folder = ctx.p("runs", pad3(r["n"]))
    existing = {row["check"]: row for row in r["results"] if row["check"]}
    order = [row["check"] for row in r["results"] if row["check"]]
    incoming = {}
    if os.path.isdir(folder):
        for f in sorted(os.listdir(folder)):
            if not f.endswith(".md"):
                continue
            for row in parse_results(split_fm(rd(os.path.join(folder, f)))[1]):
                if row["check"]:
                    row = dict(row)
                    row["source"] = f[:-3]
                    incoming.setdefault(row["check"], []).append(row)
    merged = dict(existing)
    for cid, rows in incoming.items():
        rows = sorted(rows, key=lambda x: rank(x["result"]))
        best = dict(rows[0])
        kinds = sorted(set(x["result"] for x in rows))
        if len(kinds) > 1 and ("pass" in kinds) and any(k in ("fail", "flaky") for k in kinds):
            best["note"] = (best["note"] + " · " if best["note"] else "") + "disagreement: " + ", ".join(
                "%s %s" % (x["source"], x["result"]) for x in rows)
        best.pop("source", None)
        if cid in merged and rank(merged[cid]["result"]) < rank(best["result"]):
            continue
        merged[cid] = best
        if cid not in order:
            order.append(cid)
    rows = [merged[c] for c in sorted(order)]
    wr(r["path"], write_results(r, rows))
    counts = {}
    for row in rows:
        counts[row["result"]] = counts.get(row["result"], 0) + 1
    out({"run": r["n"], "rows": len(rows), "counts": counts}, opts.get("json"),
        "Merged %d result(s) into %s: %s" % (len(rows), r["file"], ", ".join("%s %d" % (k, v) for k, v in sorted(counts.items()))))
    return 0


def cmd_result(ctx, pos, opts):
    if len(pos) < 4 or pos[0] != "add":
        raise QAError("usage: qa result add <run> <check> <result> [--note …] [--evidence …] [--bug …]")
    run, check, result = pos[1], pos[2], pos[3]
    res_word = result.split(" ")[0].lower()
    if res_word not in RESULTS:
        raise QAError("result must be one of %s" % ", ".join(RESULTS))
    r = find_run(ctx, run)
    rows = [row for row in r["results"] if row["check"] != check]
    rows.append({"check": check, "result": res_word, "result_raw": result, "note": opts.get("note", "") if opts.get("note") is not True else "",
                 "evidence": opts.get("evidence", "") if opts.get("evidence") is not True else "", "bug": opts.get("bug", "") if opts.get("bug") is not True else ""})
    rows.sort(key=lambda x: x["check"])
    wr(r["path"], write_results(r, rows))
    out({"run": r["n"], "check": check, "result": result}, opts.get("json"), "Recorded %s = %s in %s." % (check, result, r["file"]))
    return 0


# ---------------------------------------------------------------- run files

def fill(template, values):
    def rep(m):
        k = m.group(1).strip()
        if k in values:
            return str(values[k])
        return "(fill in: %s)" % k
    return re.sub(r"\{\{\s*([^}]+?)\s*\}\}", rep, template)


def cmd_run(ctx, pos, opts):
    if not pos or pos[0] != "new":
        raise QAError("usage: qa run new --mode <mode> [--budget <preset>]")
    mode = opts.get("mode") or "check"
    plan = load_plan(ctx)
    n = next_run_n(ctx)
    reg = builds(ctx)
    b = reg[-1] if reg else {"build": "", "commit": "", "head": "", "tree": ""}
    slug = re.sub(r"[^a-z0-9]+", "-", str(mode).lower()).strip("-") or "run"
    path = ctx.p("runs", "%s-%s.md" % (pad3(n), slug))
    tpl = rd(os.path.join(TEMPLATES, "qa", "runs", "_template.md"))
    text = fill(tpl, {"run": n, "run3": pad3(n), "mode": mode, "build": b["build"], "commit": (b["commit"] or "")[:12],
                      "head": (b["head"] or "")[:12], "tree": (b["tree"] or "")[:12], "started": now_str(),
                      "budget": opts.get("budget") or setting(plan, "budget", "standard")})
    wr(path, text)
    os.makedirs(ctx.p("runs", pad3(n)), exist_ok=True)
    rel = slash(os.path.relpath(path, ctx.root))
    out({"run": n, "path": rel, "folder": slash(os.path.relpath(ctx.p("runs", pad3(n)), ctx.root))}, opts.get("json"), rel)
    return 0


# ---------------------------------------------------------------- bugs

def bug_path(ctx, bid):
    if not BUG_ID_RE.match(bid or ""):
        raise QAError("Bug IDs look like BUG-001.")
    path = ctx.p("bugs", bid + ".md")
    if not os.path.exists(path):
        raise QAError("No such bug: %s" % bid, 1)
    return path


def cmd_bug(ctx, pos, opts):
    sub = pos[0] if pos else ""
    if sub == "new":
        title = opts.get("title")
        if not title or title is True:
            raise QAError('usage: qa bug new --title "…" --area <area> [--severity S1-S4] [--priority …] [--found "…"] [--repro 3/3] [--check ID] [--tags a,b] [--status new]')
        plan = load_plan(ctx)
        sev = (opts.get("severity") or "S3").upper()
        if sev not in SEVERITIES:
            raise QAError("severity must be S1, S2, S3 or S4")
        status = opts.get("status") or "new"
        if status not in BUG_STATUSES:
            raise QAError("status must be one of %s" % ", ".join(BUG_STATUSES))
        pri = opts.get("priority") or default_priority(setting(plan, "stage", "building"), sev)
        if pri not in PRIORITIES:
            raise QAError("priority must be one of %s" % ", ".join(PRIORITIES))
        bid = next_bug_id(ctx)
        tpl = rd(os.path.join(TEMPLATES, "qa", "bugs", "_template.md"))
        text = fill(tpl, {"id": bid, "title": title, "severity": sev, "priority": pri,
                          "found": opts.get("found") or "", "repro": opts.get("repro") or "1/1", "area": opts.get("area") or ""})
        upd = {"title": title, "status": status}
        if opts.get("tags") and opts.get("tags") is not True:
            upd["tags"] = [t.strip() for t in opts["tags"].split(",") if t.strip()]
        if opts.get("check") and opts.get("check") is not True:
            upd["check"] = opts["check"]
        if opts.get("source") and opts.get("source") is not True:
            upd["source"] = opts["source"]
        text = fm_set(text, upd)
        path = ctx.p("bugs", bid + ".md")
        wr(path, text)
        rel = slash(os.path.relpath(path, ctx.root))
        out({"id": bid, "path": rel, "priority": pri}, opts.get("json"), "%s %s" % (bid, rel))
        return 0
    if sub == "set":
        if len(pos) < 3:
            raise QAError("usage: qa bug set BUG-001 key=value [key=value …]")
        path = bug_path(ctx, pos[1])
        upd = {}
        for kv in pos[2:]:
            if "=" not in kv:
                raise QAError("expected key=value, got '%s'" % kv)
            k, v = kv.split("=", 1)
            k = k.strip()
            if k == "status" and v not in BUG_STATUSES:
                raise QAError("status must be one of %s" % ", ".join(BUG_STATUSES))
            if k == "severity" and v.upper() not in SEVERITIES:
                raise QAError("severity must be S1, S2, S3 or S4")
            if k == "priority" and v not in PRIORITIES:
                raise QAError("priority must be one of %s" % ", ".join(PRIORITIES))
            if k == "tags":
                v = [t.strip() for t in v.strip("[]").split(",") if t.strip()]
            if k == "severity":
                v = v.upper()
            upd[k] = v
        before = parse_fm(split_fm(rd(path))[0])
        wr(path, fm_set(rd(path), upd))
        changes = {k: [before.get(k, ""), upd[k]] for k in upd}
        out({"id": pos[1], "changes": changes}, opts.get("json"),
            "%s: %s" % (pos[1], "; ".join("%s %s → %s" % (k, fmt_value(a) or "(empty)", fmt_value(b)) for k, (a, b) in changes.items())))
        return 0
    if sub == "log":
        if len(pos) < 2:
            raise QAError('usage: qa bug log BUG-001 --from <verifier notes> | --text "…"')
        bid = pos[1]
        path = bug_path(ctx, bid)
        entry = opts.get("text") if opts.get("text") not in (None, True) else None
        if entry is None:
            src = opts.get("from")
            if not src or src is True or not os.path.exists(src):
                raise QAError("--from must name the verifier's notes file")
            lines = rd(src).split("\n")
            in_sec = False
            for ln in lines:
                if re.match(r"^###\s+" + re.escape(bid) + r"\b", ln):
                    in_sec = True
                    continue
                if in_sec and re.match(r"^#{1,3}\s", ln):
                    break
                m = re.match(r"^\s*-\s*Log:\s*(.+)$", ln) if in_sec else None
                if m:
                    entry = m.group(1).strip()
                    break
            if entry is None:
                raise QAError("No '- Log:' line under '### %s' in %s" % (bid, src), 1)
        text = rd(path)
        lines = text.split("\n")
        b = section_bounds(lines, "Verification log")
        new_line = "- " + entry
        if not b:
            lines += ["", "## Verification log", new_line]
        else:
            start, end = b
            content = [ln for ln in lines[start:end] if not re.match(r"^\(written (from|by) the verifier", ln.strip())]
            while content and not content[-1].strip():
                content.pop()
            content.append(new_line)
            lines = lines[:start] + content + ([""] if end < len(lines) else []) + lines[end:]
        text = "\n".join(lines)
        wr(path, text if text.endswith("\n") else text + "\n")
        out({"id": bid, "logged": entry}, opts.get("json"), "Logged on %s: %s" % (bid, entry))
        return 0
    raise QAError("usage: qa bug new|set|log …")


# ---------------------------------------------------------------- status

def run_counts(r):
    c = {}
    for row in r["results"]:
        c[row["result"]] = c.get(row["result"], 0) + 1
    return c


def section_items(body, title):
    lines = body.split("\n")
    b = section_bounds(lines, title)
    if not b:
        return []
    return [ln.rstrip() for ln in lines[b[0]:b[1]] if re.match(r"^\s*-\s*\[[ xX]\]", ln)]


def status_data(ctx):
    if not ctx.exists():
        return {"qa": False, "qa_dir": ctx.qa, "git": ctx.git.ok,
                "message": "No %s/ folder yet: run setup (`/enhance-qa` or `$enhance-qa`)." % ctx.qa}
    plan = load_plan(ctx)
    areas = load_areas(ctx)
    checks = all_checks(areas)
    bugs = load_bugs(ctx)
    runs = load_runs(ctx)
    reg = builds(ctx)
    last = runs[-1] if runs else None
    open_bugs = [b for b in bugs if b["fm"].get("status") in OPEN_STATUSES]
    sev = {s: [b["fm"].get("id") for b in open_bugs if b["fm"].get("severity") == s] for s in SEVERITIES}
    tested = tested_builds(ctx, runs)
    last_tested = build_entry(ctx, tested[-1]) if tested else None
    code_changed = None
    if last_tested:
        tree, man = current_tree(ctx, include_qa=False)
        if man is not None:
            code_changed = bool(changed_between(ctx, last_tested, {"tree": tree, "manifest": man}))
        else:
            code_changed = tree != last_tested["tree"]
    lock = ctx.load_json("lock.json", None)
    phase = ctx.load_json("phase.json", None)
    human = [row["check"] for row in (last["results"] if last else []) if row["result"] == "human-pending"]
    return {
        "qa": True, "qa_dir": ctx.qa, "git": ctx.git.ok, "app": plan.get("app", ""), "stage": plan.get("stage", ""),
        "autonomy": plan.get("autonomy", ""), "budget": plan.get("budget", ""),
        "checks": {"total": len(checks), "by_type": {t: sum(1 for c in checks if c["fields"].get("Type", "").lower() == t) for t in TYPES},
                   "areas": len(areas), "questions": [c["id"] for c in checks if c["fields"].get("Question")]},
        "bugs": {"open": len(open_bugs), "by_severity": sev,
                 "awaiting_verification": [b["fm"].get("id") for b in bugs if b["fm"].get("status") == "fixed"],
                 "needs_decision": [b["fm"].get("id") for b in bugs if b["fm"].get("status") == "needs-decision"],
                 "fix_now": [b["fm"].get("id") for b in open_bugs if b["fm"].get("priority") == "fix-now" and b["fm"].get("status") in ("open", "reopened")]},
        "last_run": {"run": last["n"], "mode": last["mode"], "build": last["fm"].get("build"), "verdict": last["fm"].get("verdict", ""),
                     "started": last["fm"].get("started", ""), "finished": last["fm"].get("finished", ""),
                     "interrupted": last["fm"].get("interrupted", "no") or "no", "progress": last["fm"].get("progress", ""),
                     "file": last["file"], "counts": run_counts(last)} if last else None,
        "builds": {"latest": reg[-1]["build"] if reg else None, "last_tested": tested[-1] if tested else None},
        "code_changed_since_last_tested": code_changed,
        "human_pending": human,
        "lock": lock, "phase": {k: v for k, v in phase.items() if k != "manifest"} if phase else None,
    }


def bug_title(bugs, bid):
    for b in bugs:
        if b["fm"].get("id") == bid:
            return b["fm"].get("title", "")
    return ""


def render_status(ctx):
    d = status_data(ctx)
    bugs = load_bugs(ctx)
    areas = load_areas(ctx)
    checks = {c["id"]: c for c in all_checks(areas)}
    runs = load_runs(ctx)
    last = runs[-1] if runs else None
    app = d.get("app") or os.path.basename(ctx.root)
    L = ["<!-- enhance-qa: generated by `qa status --write`. Tick a box, or write \"→ your answer\" after an item. -->"]
    if not last:
        L += ["# QA status · %s" % app, "No passes yet. Run `/enhance-qa` (Claude Code) or `$enhance-qa` (Codex) to start."]
        return "\n".join(L) + "\n"
    when = str(last["fm"].get("finished") or last["fm"].get("started") or "")
    L.append("# QA status · Build %s · %s" % (last["fm"].get("build", "?"), when.replace("T", " ")))
    verdict = last["fm"].get("verdict") or "Not assessed yet"
    ob = d["bugs"]["by_severity"]
    bits = []
    for s in ("S1", "S2", "S3"):
        if ob[s]:
            bits.append("%d %s open" % (len(ob[s]), SEV_NAMES[s].split(" ")[1]))
    cost = ""
    lines = last["body"].split("\n")
    b = section_bounds(lines, "Cost")
    if b:
        for ln in lines[b[0]:b[1]]:
            if "total" in ln.lower():
                m = re.findall(r"\$\s*([0-9]+(?:\.[0-9]+)?)", ln)
                if m:
                    cost = ", ~$%s" % m[-1]
    L.append("**Verdict: %s.** %s · last pass: %s%s" % (verdict.rstrip("."), " · ".join(bits) or "No open bugs above cosmetic", last["mode"], cost))
    if str(last["fm"].get("interrupted", "no") or "no") != "no":
        L.append("")
        L.append("> The last run was interrupted (%s). Run `/enhance-qa` again to resume it." % last["fm"].get("interrupted"))
    L += ["", "## Needs you"]
    items = section_items(last["body"], "Needs you")
    mentioned = set(ANY_ID_RE.findall(" ".join(items)))
    for bid in d["bugs"]["needs_decision"]:
        if bid not in mentioned:
            items.append("- [ ] %s %s: decide (bug, by design, defer or won't fix)" % (bid, bug_title(bugs, bid)))
    for cid in d["checks"]["questions"]:
        if cid not in mentioned:
            items.append("- [ ] %s %s" % (cid, checks[cid]["fields"].get("Question", "")))
    L += items or ["Nothing right now."]
    L += ["", "## Open bugs"]
    open_rows = sorted([x for x in bugs if x["fm"].get("status") in OPEN_STATUSES and x["fm"].get("severity") in ("S1", "S2", "S3")],
                       key=lambda x: (x["fm"].get("severity"), x["fm"].get("id")))
    if open_rows:
        L += ["| Severity | Bug | Area | Status |", "|---|---|---|---|"]
        for x in open_rows:
            st = x["fm"].get("status")
            L.append("| %s | [%s](bugs/%s.md) %s | %s | %s |" % (
                SEV_NAMES.get(x["fm"].get("severity"), x["fm"].get("severity")), x["fm"].get("id"), x["fm"].get("id"),
                esc_cell(x["fm"].get("title", "")), x["fm"].get("area", ""), "fixed, awaiting verification" if st == "fixed" else st))
    else:
        L.append("None above cosmetic.")
    s4 = [x["fm"].get("id") for x in bugs if x["fm"].get("status") in OPEN_STATUSES and x["fm"].get("severity") == "S4"]
    if s4:
        L += ["", "Cosmetic (S4): %d open: %s" % (len(s4), ", ".join(s4))]
    L += ["", "## Human checks for this build"]
    hp = [row["check"] for row in last["results"] if row["result"] == "human-pending"]
    L += ["- [ ] %s %s" % (cid, checks[cid]["title"] if cid in checks else "") for cid in hp] or ["None pending."]
    L += ["", "## Coverage by area", "| Area | Checks | Passed | Failed | Not run yet | Last run |", "|---|---|---|---|---|---|"]
    latest = latest_results(runs)
    for a in areas:
        ids = [c["id"] for c in a["checks"] if not c["fields"].get("Retired")]
        res = [latest.get(i, {}) for i in ids]
        builds_seen = [r_.get("build") for r_ in res if r_.get("build")]
        L.append("| %s | %d | %d | %d | %d | %s |" % (
            a["name"], len(ids), sum(1 for r_ in res if r_.get("result") in ("pass", "pass-human")),
            sum(1 for r_ in res if r_.get("result") in ("fail", "flaky")), sum(1 for r_ in res if not r_.get("result")),
            ("build %s" % max(builds_seen)) if builds_seen else "—"))
    L += ["", "## Recent runs", "| Run | Build | Pass | Result |", "|---|---|---|---|"]
    for r in list(reversed(runs))[:5]:
        c = run_counts(r)
        new_bugs = 0
        for ln in r["body"].split("\n"):
            if re.match(r"^\s*-\s*New:", ln):
                new_bugs += len(re.findall(r"BUG-\d{3,}", ln))
        summary = "%d passed, %d failed" % (c.get("pass", 0) + c.get("pass-human", 0), c.get("fail", 0) + c.get("flaky", 0))
        if new_bugs:
            summary += ", %d new bug%s" % (new_bugs, "" if new_bugs == 1 else "s")
        L.append("| [%s](runs/%s) | %s | %s | %s |" % (pad3(r["n"]), os.path.basename(r["path"]), r["fm"].get("build", ""), r["mode"], summary))
    return "\n".join(L) + "\n"


def ingest_items(ctx):
    path = ctx.p("STATUS.md")
    if not os.path.exists(path):
        return [], ""
    text = rd(path)
    items = []
    for i, ln in enumerate(text.split("\n"), 1):
        m = re.match(r"^\s*-\s*\[( |x|X)\]\s*(.*)$", ln)
        if not m:
            continue
        rest = m.group(2)
        ticked = m.group(1).lower() == "x"
        answer = None
        for arrow in ("→", "->"):
            if arrow in rest:
                rest, answer = rest.split(arrow, 1)
                answer = answer.strip()
                break
        idm = ANY_ID_RE.search(rest)
        if ticked or answer:
            iid = idm.group(1) if idm else ""
            items.append({"line": i, "id": iid, "kind": "bug" if iid.startswith("BUG-") else ("check" if iid else "other"),
                          "ticked": ticked, "answer": answer, "text": rest.strip()})
    return items, text


def cmd_ingest(ctx, pos, opts):
    items, text = ingest_items(ctx)
    if opts.get("done"):
        ctx.save_json("ingested.json", {"hash": sha(text, 32), "at": now_str()})
        out({"done": True, "items": len(items)}, opts.get("json"), "Marked %d answer(s) as applied." % len(items))
        return 0
    out({"items": items}, opts.get("json"),
        "\n".join("%s%s%s" % ("[x] " if it["ticked"] else "[ ] ", it["text"][:70],
                              (" → " + it["answer"]) if it["answer"] else "") for it in items) or "No ticks or answers in STATUS.md.")
    return 0


def cmd_status(ctx, pos, opts):
    if opts.get("write"):
        if not ctx.exists():
            raise QAError("No %s/ folder. Run `qa init` first." % ctx.qa, 1)
        items, text = ingest_items(ctx)
        saved = None
        if items and ctx.load_json("ingested.json", {}).get("hash") != sha(text, 32):
            saved = ctx.state("answers-%s.json" % now_str().replace(":", "").replace("-", ""))
            wr(saved, json.dumps(items, indent=2, ensure_ascii=False))
        wr(ctx.p("STATUS.md"), render_status(ctx))
        msg = "Wrote %s/STATUS.md." % ctx.qa
        if saved:
            msg += " Unapplied answers were saved to %s: run `qa ingest` and apply them." % slash(os.path.relpath(saved, ctx.root))
        out({"written": True, "unapplied_answers_saved": slash(os.path.relpath(saved, ctx.root)) if saved else None}, opts.get("json"), msg)
        return 0
    d = status_data(ctx)
    if opts.get("json"):
        out(d, True)
        return 0
    if not d["qa"]:
        out(None, False, d["message"])
        return 0
    lr = d["last_run"]
    lines = ["%s · stage %s · autonomy %s" % (d["app"] or "this project", d["stage"] or "?", d["autonomy"] or "?")]
    if lr:
        lines.append("Last run %s (%s, build %s): %s" % (pad3(lr["run"]), lr["mode"], lr["build"], lr["verdict"] or "no verdict"))
        if lr["interrupted"] != "no":
            lines.append("Interrupted: %s → run again to resume" % lr["interrupted"])
    else:
        lines.append("No runs yet.")
    sv = d["bugs"]["by_severity"]
    lines.append("Open bugs: %d (S1 %d · S2 %d · S3 %d · S4 %d) · awaiting verification: %s · needs decision: %s" % (
        d["bugs"]["open"], len(sv["S1"]), len(sv["S2"]), len(sv["S3"]), len(sv["S4"]),
        ", ".join(d["bugs"]["awaiting_verification"]) or "none", ", ".join(d["bugs"]["needs_decision"]) or "none"))
    lines.append("Checks: %d in %d areas · questions waiting: %d" % (d["checks"]["total"], d["checks"]["areas"], len(d["checks"]["questions"])))
    if d["code_changed_since_last_tested"] is not None:
        lines.append("Code changed since the last tested build: %s" % ("yes" if d["code_changed_since_last_tested"] else "no"))
    if d["lock"]:
        lines.append("Locked by run %s since %s" % (d["lock"].get("run", "?"), d["lock"].get("started")))
    out(None, False, "\n".join(lines))
    return 0


# ---------------------------------------------------------------- init

def cmd_init(ctx, pos, opts):
    created = []
    app = opts.get("app") if opts.get("app") not in (None, True) else None
    if not app:
        pkg = os.path.join(ctx.root, "package.json")
        if os.path.exists(pkg):
            try:
                app = json.loads(rd(pkg)).get("name")
            except ValueError:
                app = None
        app = app or os.path.basename(ctx.root)
    for d in ("", "checklist", "bugs", "runs", "evidence", ".state"):
        p = ctx.p(d) if d else ctx.qa_abs
        if not os.path.isdir(p):
            os.makedirs(p)
            created.append(slash(os.path.relpath(p, ctx.root)) + "/")
    for name in ("README.md", "STATUS.md", "plan.md", "notes.md", "coverage.md"):
        dst = ctx.p(name)
        if not os.path.exists(dst):
            wr(dst, fill(rd(os.path.join(TEMPLATES, "qa", name)), {"app": app}))
            created.append(slash(os.path.relpath(dst, ctx.root)))
    gi = os.path.join(ctx.root, ".gitignore")
    want = [ctx.qa + "/evidence/", ctx.qa + "/.state/"]
    raw = b""
    if os.path.exists(gi):
        with open(gi, "rb") as f:
            raw = f.read()
    have = set(ln.strip() for ln in raw.decode("utf-8", "replace").splitlines())
    missing = [w for w in want if w not in have and w.rstrip("/") not in have]
    if missing:
        nl = b"\r\n" if b"\r\n" in raw else b"\n"
        add = (b"" if not raw or raw.endswith(b"\n") else nl) + nl.join([b"# enhance-qa: evidence and local state"] + [m.encode("utf-8") for m in missing]) + nl
        with open(gi, "ab") as f:
            f.write(add)
        created.append(".gitignore (+%s)" % ", ".join(missing))
    out({"created": created, "app": app}, opts.get("json"),
        ("Created: " + ", ".join(created)) if created else "%s/ already set up; nothing to do." % ctx.qa)
    return 0


# ---------------------------------------------------------------- redact

REDACT_PATTERNS = [
    ("private-key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----")),
    ("aws-key", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("github-token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b")),
    ("slack-token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b")),
    ("stripe-key", re.compile(r"\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}\b|\bwhsec_[A-Za-z0-9]{10,}\b")),
    ("anthropic-key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b")),
    ("openai-key", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b")),
    ("google-key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")),
    ("url-credentials", re.compile(r"(?<=://)[^/\s:@]+:[^/\s@]+(?=@)")),
]
REDACT_KV = re.compile(r"(?i)((?:\"|')?(?:password|passwd|pwd|secret|client_secret|api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|session[_-]?id|token)(?:\"|')?\s*[:=]\s*)(\"[^\"\n]*\"|'[^'\n]*'|[^\s,&;\"']+)")
REDACT_HEADER = re.compile(r"(?im)^(\s*(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key)\s*:\s*)(.+)$")
EMAIL = re.compile(r"\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,}|localhost)\b")
CARD = re.compile(r"\b(?:\d[ -]?){12,18}\d\b")


def luhn(digits):
    total, alt = 0, False
    for ch in reversed(digits):
        d = int(ch)
        if alt:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        alt = not alt
    return total % 10 == 0


def redact_text(s):
    counts = {}

    def bump(k, n=1):
        counts[k] = counts.get(k, 0) + n

    for kind, rx in REDACT_PATTERNS:
        s, n = rx.subn("[REDACTED:%s]" % kind, s)
        if n:
            bump(kind, n)

    def kv(m):
        if m.group(2).startswith("[REDACTED"):
            return m.group(0)
        bump("secret-field")
        q = m.group(2)[0] if m.group(2)[:1] in "\"'" else ""
        return m.group(1) + q + "[REDACTED]" + q

    s = REDACT_KV.sub(kv, s)

    def hdr(m):
        bump("header")
        return m.group(1) + "[REDACTED]"

    s = REDACT_HEADER.sub(hdr, s)

    def em(m):
        dom = m.group(2).lower()
        if dom in SAFE_EMAIL_DOMAINS or dom.endswith(SAFE_EMAIL_SUFFIXES) or m.group(1).lower().startswith("qa-"):
            return m.group(0)
        bump("email")
        return "[REDACTED:email]"

    s = EMAIL.sub(em, s)

    def card(m):
        digits = re.sub(r"\D", "", m.group(0))
        if 13 <= len(digits) <= 19 and luhn(digits) and digits not in TEST_CARDS:
            bump("card")
            return "[REDACTED:card]"
        return m.group(0)

    s = CARD.sub(card, s)
    return s, counts


def cmd_redact(ctx, pos, opts):
    if not pos:
        raise QAError("usage: qa redact <file or folder> … [--check]")
    files = []
    for p in pos:
        if os.path.isdir(p):
            for dp, dn, fn in os.walk(p):
                files += [os.path.join(dp, f) for f in fn]
        elif os.path.exists(p):
            files.append(p)
    report, total = [], 0
    for f in sorted(files):
        try:
            with open(f, "rb") as fh:
                raw = fh.read()
        except OSError:
            continue
        if b"\x00" in raw[:8000]:
            continue
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            report.append({"file": slash(f), "skipped": "not UTF-8 text"})
            continue
        new, counts = redact_text(text)
        if counts:
            n = sum(counts.values())
            total += n
            report.append({"file": slash(f), "found": counts})
            if not opts.get("check"):
                with open(f, "wb") as fh:
                    fh.write(new.encode("utf-8"))
    out({"files": report, "total": total, "changed": not opts.get("check")}, opts.get("json"),
        "\n".join("%s: %s" % (r["file"], r.get("skipped") or ", ".join("%s %d" % kv for kv in sorted(r["found"].items()))) for r in report) +
        ("\n" if report else "") + ("%d item(s) %s." % (total, "found" if opts.get("check") else "redacted")))
    return 1 if (opts.get("check") and total) else 0


# ---------------------------------------------------------------- export

def export_rows(ctx):
    areas = load_areas(ctx)
    last = latest_results(load_runs(ctx))
    checks = []
    for c in all_checks(areas, include_retired=True):
        f = c["fields"]
        l = last.get(c["id"], {})
        checks.append([c["id"], c["area"], c["title"], f.get("Risk", ""), f.get("Type", ""), f.get("Tags", ""),
                       f.get("Steps", "") or f.get("Command", ""), f.get("Expect", ""), f.get("Source", ""),
                       "retired" if f.get("Retired") else "", l.get("result", ""), l.get("build", "")])
    bugs = []
    for b in load_bugs(ctx):
        fm = b["fm"]
        bugs.append([fm.get("id", ""), fm.get("title", ""), fm.get("status", ""), fm.get("severity", ""), fm.get("priority", ""),
                     fm.get("area", ""), fm.get("found", ""), fm.get("repro", "")])
    return checks, bugs


CHECK_COLS = ["ID", "Area", "Title", "Risk", "Type", "Tags", "Steps", "Expect", "Source", "Retired", "Last result", "Last build"]
BUG_COLS = ["ID", "Title", "Status", "Severity", "Priority", "Area", "Found", "Repro"]


def cmd_export(ctx, pos, opts):
    kind = pos[0] if pos else ""
    outdir = opts.get("out") if opts.get("out") not in (None, True) else ctx.p("exports")
    os.makedirs(outdir, exist_ok=True)
    checks, bugs = export_rows(ctx)
    written = []
    if kind == "csv":
        for name, cols, rows in (("checklist.csv", CHECK_COLS, checks), ("bugs.csv", BUG_COLS, bugs)):
            p = os.path.join(outdir, name)
            with open(p, "w", encoding="utf-8-sig", newline="") as f:
                w = csv.writer(f)
                w.writerow(cols)
                w.writerows([[str(x) for x in r] for r in rows])
            written.append(p)
    elif kind == "html":
        p = os.path.join(outdir, "qa-report.html")
        d = status_data(ctx)

        def table(cols, rows):
            return "<table><thead><tr>%s</tr></thead><tbody>%s</tbody></table>" % (
                "".join("<th>%s</th>" % html.escape(c) for c in cols),
                "".join("<tr>%s</tr>" % "".join("<td>%s</td>" % html.escape(str(x)) for x in r) for r in rows))
        lr = d.get("last_run") or {}
        doc = ("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
               "<title>QA report</title><style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;color:#1b1b1f;background:#fff}"
               "h1{font-size:22px}h2{font-size:17px;margin-top:28px}table{border-collapse:collapse;width:100%%;font-size:13px}"
               "th,td{border:1px solid #d9d9e0;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f4f4f7}"
               "@media (prefers-color-scheme:dark){body{background:#16161a;color:#e8e8ee}th{background:#24242b}th,td{border-color:#3a3a44}}</style></head><body>"
               "<h1>QA report · %s</h1><p>Generated %s · last run %s (%s, build %s): <strong>%s</strong></p>"
               "<h2>Bugs</h2>%s<h2>Checklist</h2>%s</body></html>") % (
            html.escape(d.get("app") or os.path.basename(ctx.root)), html.escape(now_str()), html.escape(pad3(lr["run"]) if lr else "—"),
            html.escape(str(lr.get("mode", ""))), html.escape(str(lr.get("build", ""))), html.escape(str(lr.get("verdict", "") or "no verdict")),
            table(BUG_COLS, bugs), table(CHECK_COLS, checks))
        wr(p, doc)
        written.append(p)
    elif kind == "xlsx":
        try:
            import openpyxl  # noqa: F401  (optional)
            from openpyxl import Workbook
        except ImportError:
            raise QAError("xlsx export needs openpyxl (pip install openpyxl). `qa export csv` opens in Excel too.", 1)
        wb = Workbook()
        ws = wb.active
        ws.title = "Checklist"
        ws.append(CHECK_COLS)
        for r in checks:
            ws.append([str(x) for x in r])
        ws2 = wb.create_sheet("Bugs")
        ws2.append(BUG_COLS)
        for r in bugs:
            ws2.append([str(x) for x in r])
        p = os.path.join(outdir, "qa.xlsx")
        wb.save(p)
        written.append(p)
    else:
        raise QAError("usage: qa export csv|html|xlsx [--out DIR]")
    rel = [slash(os.path.relpath(p, ctx.root)) for p in written]
    out({"written": rel}, opts.get("json"), "Wrote " + ", ".join(rel))
    return 0


# ---------------------------------------------------------------- hooks

GIT_WRITE = re.compile(r"\bgit\s+(?:-C\s+\S+\s+)?(commit|add|push|reset|checkout|restore|rebase|merge|stash|cherry-pick|revert|rm|mv|tag|clean|apply|am|switch|update-ref|filter-branch|branch\s+-[dDmM])\b")
GIT_FIXER_DENY = re.compile(r"\bgit\s+(?:-C\s+\S+\s+)?(push|rebase|filter-branch|update-ref|switch|clean\s+-[a-z]*f|reset\s+--hard|commit\s+[^|;&]*--amend|checkout\s+(?!--)\S+\s*$|branch\s+-[dDmM])")


def role_from_agent(agent_type):
    m = re.search(r"enhance[-_]qa[-_](scout|tester|verifier|fixer)$", agent_type or "")
    return m.group(1) if m else None


def hook_paths(data, cwd):
    ti = data.get("tool_input") or {}
    paths = []
    for k in ("file_path", "notebook_path", "path"):
        if isinstance(ti.get(k), str):
            paths.append(ti[k])
    for v in ti.values():
        if isinstance(v, str) and "*** " in v:
            paths += re.findall(r"(?m)^\*\*\* (?:Add|Update|Delete) File: (.+)$", v)
            paths += re.findall(r"(?m)^\*\*\* Move to: (.+)$", v)
    res = []
    for p in paths:
        p = p.strip()
        ap = p if os.path.isabs(p) else os.path.join(cwd, p)
        rel = os.path.relpath(os.path.normpath(ap), os.path.normpath(cwd))
        res.append(slash(rel))
    return res


def deny(reason):
    sys.stdout.write(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                                                        "permissionDecisionReason": reason}}) + "\n")
    return 0


def cmd_hook(ctx, pos, opts):
    kind = pos[0] if pos else ""
    try:
        raw = sys.stdin.read() if not sys.stdin.isatty() else ""
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, OSError):
        return 0
    cwd = data.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    qa = slash(os.environ.get("QA_DIR") or "qa").rstrip("/")
    phase_file = os.path.join(cwd, qa, ".state", "phase.json")
    if not os.path.exists(phase_file):
        return 0
    try:
        ph = json.loads(rd(phase_file))
    except (ValueError, OSError):
        return 0
    t = parse_time(ph.get("started"))
    if t is None or (now_dt() - t).total_seconds() > STALE_PHASE_HOURS * 3600:
        return 0
    role = role_from_agent(data.get("agent_type", ""))
    if kind == "pre-tool-use":
        tool = data.get("tool_name") or ""
        if tool in ("Bash", "PowerShell", "shell", "exec_command") or isinstance((data.get("tool_input") or {}).get("command"), str) and tool not in ("Edit", "Write", "MultiEdit", "NotebookEdit", "apply_patch"):
            cmd = str((data.get("tool_input") or {}).get("command") or "")
            if role in ("tester", "verifier", "scout") and GIT_WRITE.search(cmd):
                return deny("enhance-qa: the %s role doesn't change git state. Report what you found instead." % role)
            if role == "fixer" and GIT_FIXER_DENY.search(cmd):
                return deny("enhance-qa: the fixer never pushes, rewrites history, switches branches or forces anything.")
            if "*** " not in cmd:
                return 0
        paths = hook_paths(data, cwd)
        if not paths:
            return 0
        protected = [qa + "/checklist/**", qa + "/plan.md"]
        for p in paths:
            if p.startswith(".."):
                if role:
                    return deny("enhance-qa: %s may only edit files inside the project." % role)
                continue
            if role is None:
                if ph.get("role") not in ("scout", "lead") and match_any(p, protected):
                    return deny("enhance-qa: a QA %s phase is running, so the checklist and plan are locked until it ends (`qa phase end`). Edit them after the phase." % ph.get("role"))
                continue
            allowed, denied = role_patterns(ALLOWED, role, qa), role_patterns(DENIED, role, qa)
            if match_any(p, denied) or not match_any(p, allowed):
                return deny("enhance-qa: the %s role may not edit %s. Allowed: %s." % (role, p, ", ".join(allowed)))
        return 0
    if kind == "subagent-stop":
        if data.get("stop_hook_active") or role not in ("tester", "verifier"):
            return 0
        msg = slash(data.get("last_assistant_message") or "")
        m = re.search(r"(" + re.escape(qa) + r"/runs/\d{3,}/(?:tester|verifier)-\d+\.md)", msg)
        notes = os.path.join(cwd, m.group(1)) if m else None
        if not notes or not os.path.exists(notes):
            sys.stdout.write(json.dumps({"decision": "block", "reason": "enhance-qa: write your notes file (qa/runs/<run>/%s-<k>.md) with your results and evidence, then finish with its path." % role}) + "\n")
            return 0
        gaps = []
        for row in parse_results(split_fm(rd(notes))[1]):
            if row["result"] in ("pass", "fail", "flaky") and not row["evidence"] and not has_quote(row["note"]):
                gaps.append(row["check"])
        if gaps:
            sys.stdout.write(json.dumps({"decision": "block", "reason": "enhance-qa: these results have no evidence: %s. Add evidence (a file under qa/evidence/ or a quoted observation) or mark them not-run, then finish." % ", ".join(gaps)}) + "\n")
        return 0
    return 0


# ---------------------------------------------------------------- main

HELP = """enhance-qa helper %s. Run from the project root.

  init [--app NAME]                       create qa/ from the templates
  status [--json] [--write]               summary; --write regenerates qa/STATUS.md
  ingest [--json] [--done]                read the user's ticks and answers in STATUS.md
  validate [--json]                       check every qa/ file's format
  next-id check PREFIX | bug | run        next free ID
  snapshot [--json]                       pin the build under test (hidden commit; never touches branches)
  diff [--from N] [--to N]                files changed between builds
  lock acquire [--run N] | release | status
  hash --record | --verify | --show       checklist fingerprint
  phase start --role ROLE [--run N] | end | status
  gate [--role ROLE] [--revert] [--keep]  tamper, checklist, validation and evidence checks after a phase
  tamper --role ROLE [--since TREE]       files changed outside a role's allowed paths
  tamper-tests --since BUILD|REF          flags weakened, skipped or deleted tests
  select [--base N] [--quick] [--budget P] [--json]   impact-based scope and estimate
  coverage [--json]                       regenerate qa/coverage.md
  run new --mode MODE [--budget P]        create the next run file
  results merge RUN                       merge role notes' results into the run file
  result add RUN CHECK RESULT [--note T] [--evidence P] [--bug ID]
  bug new --title T --area A [--severity S] [--priority P] [--found T] [--repro N/M] [--check ID] [--tags a,b]
  bug set BUG-ID key=value …              update a bug's front matter
  bug log BUG-ID --from NOTES | --text T  append a verification log line
  redact PATH … [--check]                 mask secrets and personal data in text evidence
  export csv|html|xlsx [--out DIR]        export the checklist and bugs
  hook pre-tool-use | subagent-stop       hook mode (reads the hook JSON on stdin)

Options for every command: --qa DIR (default qa, or $QA_DIR) for monorepos.
""" % VERSION

COMMANDS = {"init": cmd_init, "status": cmd_status, "ingest": cmd_ingest, "validate": cmd_validate, "next-id": cmd_next_id,
            "snapshot": cmd_snapshot, "diff": cmd_diff, "lock": cmd_lock, "hash": cmd_hash, "phase": cmd_phase, "gate": cmd_gate,
            "tamper": cmd_tamper, "tamper-tests": cmd_tamper_tests, "select": cmd_select, "coverage": cmd_coverage,
            "run": cmd_run, "results": cmd_results, "result": cmd_result, "bug": cmd_bug, "redact": cmd_redact,
            "export": cmd_export, "hook": cmd_hook}


def main(argv):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    if not argv or argv[0] in ("help", "-h", "--help"):
        sys.stdout.write(HELP)
        return 0
    if argv[0] in ("version", "--version"):
        sys.stdout.write(VERSION + "\n")
        return 0
    cmd = argv[0]
    if cmd not in COMMANDS:
        sys.stderr.write("Unknown command '%s'. Run `qa help`.\n" % cmd)
        return 2
    pos, opts = parse_args(argv[1:])
    ctx = Ctx(opts)
    try:
        return COMMANDS[cmd](ctx, pos, opts)
    except QAError as e:
        if cmd == "hook":
            return 0
        if opts.get("json"):
            sys.stdout.write(json.dumps({"error": str(e)}) + "\n")
        else:
            sys.stderr.write(str(e) + "\n")
        return e.code
    except Exception as e:  # never break a user's session from a hook
        if cmd == "hook":
            return 0
        raise


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
