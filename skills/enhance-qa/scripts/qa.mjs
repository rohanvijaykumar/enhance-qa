#!/usr/bin/env node
/* enhance-qa helper: deterministic bookkeeping for the qa/ folder, so agents spend no tokens on it.
 *
 * No dependencies (Node 18+, only node: built-ins). scripts/qa.py implements the same commands with the same output.
 * Run from the project root:  node <skill>/scripts/qa.mjs <command> [options]   (help: `qa.mjs help`)
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "0.1.0";
const SKILL_DIR = path.dirname(path.dirname(path.resolve(fileURLToPath(import.meta.url))));
const TEMPLATES = path.join(SKILL_DIR, "templates");

const RISKS = ["high", "medium", "low"];
const TYPES = ["auto", "agent", "human", "device", "gate"];
const BUG_STATUSES = ["new", "open", "fixed", "verified", "reopened", "needs-decision", "deferred",
  "wont-fix", "by-design", "duplicate", "cant-reproduce"];
const OPEN_STATUSES = ["new", "open", "fixed", "reopened", "needs-decision"];
const SEVERITIES = ["S1", "S2", "S3", "S4"];
const SEV_NAMES = { S1: "S1 blocker", S2: "S2 major", S3: "S3 minor", S4: "S4 cosmetic" };
const PRIORITIES = ["fix-now", "before-release", "later"];
const RESULTS = ["pass", "fail", "blocked", "skip", "flaky", "human-pending", "pass-human", "waived", "not-run"];
const WORST_FIRST = ["fail", "flaky", "blocked", "human-pending", "not-run", "skip", "waived", "pass-human", "pass"];
const STAGES = ["prototype", "building", "near-release", "rc", "live", "hotfix"];
const AUTONOMY = ["guided", "balanced", "autopilot"];
const BUDGETS = ["lean", "standard", "thorough"];
const ROLES = ["lead", "scout", "tester", "verifier", "fixer"];
const CHECK_KEYS = ["Risk", "Type", "Tags", "Steps", "Command", "Expect", "Source", "Env", "Data", "Replay",
  "Assumed", "Question", "Retired"];
const HEADER_KEYS = ["Area", "Paths", "Modules", "Notes"];
const CHECK_ID = "[A-Z][A-Z0-9]{1,11}-\\d{3,}";
const CHECK_ID_RE = new RegExp("^" + CHECK_ID + "$");
const BUG_ID_RE = /^BUG-\d{3,}$/;
const ANY_ID_SRC = "\\b(BUG-\\d{3,}|" + CHECK_ID + ")\\b";
const HEAD_RE = new RegExp("^###\\s+(" + CHECK_ID + ")\\s*(?:·|—|–|-|:)?\\s*([^\\n]*?)\\s*$");
const RUN_FILE_RE = /^(\d{3,})-([^\n]+)\.md$/;
const STALE_LOCK_HOURS = 6;
const STALE_PHASE_HOURS = 12;
const DEFAULT_ROTATION = { live: 15 };
const COST_PER_AGENT_CHECK = 0.03;
const OVERHEAD = 1.4;

const ALLOWED = {
  tester: ["{qa}/runs/**", "{qa}/evidence/**"],
  verifier: ["{qa}/runs/**", "{qa}/evidence/**"],
  scout: ["{qa}/plan.md", "{qa}/notes.md", "{qa}/checklist/**", "{qa}/evidence/**", "{qa}/README.md", "{qa}/runs/**"],
  lead: ["{qa}/**"],
  fixer: ["**"],
};
const DENIED = {
  fixer: ["{qa}/checklist/**", "{qa}/plan.md", "{qa}/notes.md", "{qa}/STATUS.md", "{qa}/coverage.md",
    ".github/workflows/**", ".gitlab-ci.yml", ".circleci/**", "azure-pipelines.yml", "Jenkinsfile",
    "Dockerfile*", "docker-compose*", "*.tf", "vercel.json", "netlify.toml", "fly.toml", "render.yaml",
    ".env", ".env.*", "*.pem", "*.key", "*.p12", "*.pfx"],
};
const NEEDS_OK = {
  fixer: ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "requirements*.txt",
    "pyproject.toml", "poetry.lock", "Pipfile", "Pipfile.lock", "Cargo.toml", "Cargo.lock", "go.mod", "go.sum",
    "Gemfile", "Gemfile.lock", "*.csproj", "pom.xml", "build.gradle", "build.gradle.kts"],
};
const TEST_GLOBS = ["**/test/**", "**/tests/**", "**/__tests__/**", "**/spec/**", "**/e2e/**", "*.test.*", "*.spec.*",
  "*_test.*", "test_*.py", "*Test.java", "*Tests.cs", "*Test.kt", "*.snap", "**/__snapshots__/**"];
const TEST_CONFIG_GLOBS = [".eslintrc*", "eslint.config.*", "tsconfig*.json", "jest.config.*", "vitest.config.*",
  "playwright.config.*", "pytest.ini", "setup.cfg", "tox.ini", ".coveragerc", "mypy.ini",
  "ruff.toml", ".ruff.toml", "pyproject.toml", "phpunit.xml*", "karma.conf.*"];
const WIDE_FILES = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", "Gemfile", "pom.xml", "build.gradle",
  "build.gradle.kts", "*.csproj", "*.sln", "CMakeLists.txt", "vite.config.*", "next.config.*",
  "webpack.config.*", "nuxt.config.*", "angular.json", "svelte.config.*", "astro.config.*",
  "tsconfig.json", "Makefile", "Dockerfile"];
const SKIP_WALK = new Set([".git", "node_modules", "dist", "build", ".next", "out", "target", "__pycache__", ".venv", "venv",
  ".turbo", ".cache", ".pytest_cache", ".mypy_cache", "coverage", ".svelte-kit", ".nuxt", ".parcel-cache"]);
const TEST_CARDS = new Set(["4242424242424242", "4000056655665556", "5555555555554444", "2223003122003222", "5200828282828210",
  "5105105105105100", "378282246310005", "371449635398431", "6011111111111117", "3056930009020004",
  "36227206271667", "3566002020360505", "6200000000000005", "4000000000003220", "4000002500003155",
  "4000000000009995", "4000000000000002", "4000000000000069", "4000000000000127", "4111111111111111"]);
const SAFE_EMAIL_DOMAINS = ["example.com", "example.org", "example.net", "example.test", "localhost"];
const SAFE_EMAIL_SUFFIXES = [".test", ".example", ".invalid", ".localhost"];

class QAError extends Error {
  constructor(msg, code = 2) {
    super(msg);
    this.code = code;
  }
}

// ---------------------------------------------------------------- python-ish helpers

class PyFloat {
  constructor(v) { this.v = v; }
  repr() {
    const v = this.v;
    if (Number.isInteger(v) && Math.abs(v) < 1e16) return v.toFixed(1);
    return String(v);
  }
}

function pyrepr(v) {
  if (typeof v === "string") {
    let q = "'";
    if (v.includes("'") && !v.includes('"')) q = '"';
    let s = v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
    if (q === "'") s = s.replace(/'/g, "\\'");
    return q + s + q;
  }
  return pystr(v);
}

function pystr(v) {
  if (typeof v === "string") return v;
  if (v === true) return "True";
  if (v === false) return "False";
  if (v === null || v === undefined) return "None";
  if (v instanceof PyFloat) return v.repr();
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return "[" + v.map(pyrepr).join(", ") + "]";
  if (typeof v === "object") return "{" + Object.keys(v).map((k) => pyrepr(k) + ": " + pyrepr(v[k])).join(", ") + "}";
  return String(v);
}
const S = pystr;

function truthy(v) {
  if (v === null || v === undefined || v === false) return false;
  if (v === true) return true;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (v instanceof PyFloat) return v.v !== 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

function emptyish(v) {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

function isDict(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof PyFloat);
}

function asciiStr(s) {
  return '"' + s.replace(/[\\"]|[^ -~]/g, (ch) => {
    switch (ch) {
      case "\\": return "\\\\";
      case '"': return '\\"';
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\t": return "\\t";
      case "\b": return "\\b";
      case "\f": return "\\f";
      default: return "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
    }
  }) + '"';
}

// json.dumps(...) look-alike: o.indent, o.sortKeys, o.ensureAscii (default true, like Python)
function pyDumps(v, o = {}) {
  const ensureAscii = o.ensureAscii !== undefined ? o.ensureAscii : true;
  const indent = o.indent;
  const itemSep = indent === undefined ? ", " : ",";
  const str = (s) => (ensureAscii ? asciiStr(s) : JSON.stringify(s));
  function enc(x, level) {
    if (x === null || x === undefined) return "null";
    if (x === true) return "true";
    if (x === false) return "false";
    if (x instanceof PyFloat) return x.repr();
    if (typeof x === "number") return String(x);
    if (typeof x === "string") return str(x);
    if (Array.isArray(x)) {
      if (!x.length) return "[]";
      if (indent === undefined) return "[" + x.map((i) => enc(i, level + 1)).join(itemSep) + "]";
      const pad = " ".repeat(indent * (level + 1));
      return "[\n" + x.map((i) => pad + enc(i, level + 1)).join(",\n") + "\n" + " ".repeat(indent * level) + "]";
    }
    let keys = Object.keys(x);
    if (o.sortKeys) keys = keys.sort();
    if (!keys.length) return "{}";
    if (indent === undefined) return "{" + keys.map((k) => str(k) + ": " + enc(x[k], level + 1)).join(itemSep) + "}";
    const pad = " ".repeat(indent * (level + 1));
    return "{\n" + keys.map((k) => pad + str(k) + ": " + enc(x[k], level + 1)).join(",\n") + "\n" + " ".repeat(indent * level) + "}";
  }
  return enc(v, 0);
}

function splitlines(s) {
  const parts = s.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function cut(s, n) {
  if (s.length <= n) return s;
  return Array.from(s).slice(0, n).join("");
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\\-\/]/g, "\\$&");
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function pyInt(v) {
  const s = String(typeof v === "string" ? v : pystr(v)).trim();
  if (/^[+-]?\d+(?:_\d+)*$/.test(s)) return parseInt(s.replace(/_/g, ""), 10);
  throw new Error("ValueError: invalid literal for int() with base 10: " + pyrepr(typeof v === "string" ? v : pystr(v)));
}

function toInt(v, d) {
  if (v === null || v === undefined || typeof v === "boolean" || Array.isArray(v)) return d;
  const s = String(v).trim();
  if (/^[+-]?\d+(?:_\d+)*$/.test(s)) return parseInt(s.replace(/_/g, ""), 10);
  return d;
}

const FLOAT_RE = /^[+-]?(?:(?:\d+(?:_\d+)*\.?(?:\d+(?:_\d+)*)?|\.\d+(?:_\d+)*)(?:[eE][+-]?\d+(?:_\d+)*)?|inf|infinity|nan)$/i;
function toFloat(v, d) {
  if (v === null || v === undefined || typeof v === "boolean" || Array.isArray(v)) return d;
  const s = String(v).trim().replace(/^\$+/, "");
  if (FLOAT_RE.test(s)) return 1;
  return d;
}

// round(x, 2) as a float (round-half-even on exact ties, like Python)
function round2(x) {
  const t = x * 8;
  let r;
  if (Number.isInteger(t) && t % 2 !== 0) {
    const h = Math.floor(x * 100);
    r = (h % 2 === 0 ? h : h + 1) / 100;
  } else {
    r = Number(x.toFixed(2));
  }
  return r;
}

function fmt2(x) {
  const t = x * 8;
  if (Number.isInteger(t) && t % 2 !== 0) {
    const h = Math.floor(x * 100);
    return ((h % 2 === 0 ? h : h + 1) / 100).toFixed(2);
  }
  return x.toFixed(2);
}

// ---------------------------------------------------------------- basics

const OUT = [];
const ERR = [];
function stdout(s) { OUT.push(s); }
function stderr(s) { ERR.push(s); }

function writeAll(fd, text) {
  const buf = Buffer.from(text, "utf8");
  let off = 0;
  let spins = 0;
  while (off < buf.length) {
    try {
      off += fs.writeSync(fd, buf, off, buf.length - off);
    } catch (e) {
      if (e && e.code === "EAGAIN" && spins++ < 100000) continue;
      return;
    }
  }
}

function flush() {
  if (OUT.length) writeAll(1, OUT.join(""));
  if (ERR.length) writeAll(2, ERR.join(""));
  OUT.length = 0;
  ERR.length = 0;
}

function pad2(n) { return String(n).padStart(2, "0"); }

function nowStr() {
  const fixed = process.env.QA_NOW;
  if (fixed) return fixed;
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

const TIME_RE = /^(\d{4})-(1[0-2]|0[1-9]|[1-9])-(3[01]|[12]\d|0[1-9]|[1-9]| [1-9])T(2[0-3]|[0-1]\d|\d):([0-5]\d|\d)$/i;
function parseTime(s) {
  const m = TIME_RE.exec(cut(pystr(s), 16));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3].trim(), h = +m[4], mi = +m[5];
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d > dim || y < 1) return null;
  return Date.UTC(y, mo - 1, d, h, mi);
}

function nowDt() {
  const t = parseTime(nowStr());
  if (t !== null) return t;
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

const STRICT = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
function rd(p) {
  const raw = fs.readFileSync(p);
  let text;
  try {
    text = STRICT.decode(raw);
  } catch (e) {
    const err = new Error("UnicodeDecodeError: " + p);
    err.isValueError = true;
    throw err;
  }
  return text.replace(/\r\n?/g, "\n");
}

function wr(p, text) {
  const d = path.dirname(p);
  if (d) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(p, text, "utf8");
}

function slash(p) { return p.replace(/\\/g, "/"); }

function exists(p) { try { fs.statSync(p); return true; } catch (e) { return false; } }
function isdir(p) { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }

function listdir(p) { return fs.readdirSync(p); }

function pyjoin(a, ...rest) {
  let res = a;
  const seps = process.platform === "win32" ? "/\\" : "/";
  for (const b of rest) {
    if (path.isAbsolute(b)) { res = b; continue; }
    if (res === "") { res = b; continue; }
    const last = res[res.length - 1];
    if (seps.includes(last) || (process.platform === "win32" && last === ":")) res += b;
    else res += path.sep + b;
  }
  return res;
}

function relpath(p, start) {
  const a = path.resolve(start === undefined ? process.cwd() : start);
  const b = path.resolve(p);
  if (process.platform === "win32" && path.parse(a).root.toLowerCase() !== path.parse(b).root.toLowerCase()) {
    throw new Error("ValueError: path is on a different mount");
  }
  const r = path.relative(a, b);
  return r === "" ? "." : r;
}

function stemOf(p) {
  const base = path.basename(p);
  const i = base.lastIndexOf(".");
  if (i <= 0) return base;
  if (/^\.+$/.test(base.slice(0, i))) return base;
  return base.slice(0, i);
}

function out(obj, asJson, text) {
  if (asJson) {
    stdout(pyDumps(obj, { indent: 2, ensureAscii: false }) + "\n");
  } else if (text !== undefined && text !== null) {
    stdout(text.endsWith("\n") ? text : text + "\n");
  }
}

function sha(s, n = 16) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, n);
}

function normWs(s) { return (s || "").replace(/\s+/g, " ").trim(); }

function pad3(n) { return String(pyInt(n)).padStart(3, "0"); }

function sortedStrs(arr) { return arr.slice().sort(); }

// ---------------------------------------------------------------- args

const FLAGS = new Set(["json", "write", "record", "verify", "show", "force", "revert", "quick", "check", "done", "keep", "all"]);

function parseArgs(argv) {
  const pos = [];
  const opts = Object.create(null);
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a.startsWith("--")) {
      let k = a.slice(2);
      const eq = k.indexOf("=");
      if (eq !== -1) {
        const v = k.slice(eq + 1);
        k = k.slice(0, eq);
        opts[k] = v;
      } else if (FLAGS.has(k)) {
        opts[k] = true;
      } else if (i + 1 < argv.length) {
        opts[k] = argv[i + 1];
        i += 1;
      } else {
        opts[k] = true;
      }
    } else {
      pos.push(a);
    }
    i += 1;
  }
  return [pos, opts];
}

// ---------------------------------------------------------------- front matter (flat YAML subset)

function splitFm(text) {
  if (!text.startsWith("---")) return [null, text];
  const lines = text.split("\n");
  if (lines[0].trim() !== "---") return [null, text];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") return [lines.slice(1, i), lines.slice(i + 1).join("\n")];
  }
  return [null, text];
}

function stripComment(v) {
  let q = null;
  const res = [];
  for (let i = 0; i < v.length; i++) {
    const ch = v[i];
    if (q) {
      if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") {
      q = ch;
    } else if (ch === "#" && (i === 0 || v[i - 1] === " " || v[i - 1] === "\t")) {
      break;
    }
    res.push(ch);
  }
  return res.join("").trimEnd();
}

function unq(v) {
  v = v.trim();
  if (v.length >= 2 && v[0] === v[v.length - 1] && (v[0] === '"' || v[0] === "'")) {
    let inner = v.slice(1, -1);
    if (v[0] === '"') inner = inner.split('\\"').join('"').split("\\\\").join("\\");
    return inner;
  }
  return v;
}

function splitCommas(s) {
  const parts = [];
  let q = null;
  let cur = [];
  for (const ch of s) {
    if (q) {
      cur.push(ch);
      if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") {
      q = ch;
      cur.push(ch);
    } else if (ch === ",") {
      parts.push(cur.join(""));
      cur = [];
    } else {
      cur.push(ch);
    }
  }
  parts.push(cur.join(""));
  return parts.map((x) => x.trim()).filter((p) => p !== "");
}

function parseValue(v) {
  v = v.trim();
  if (v.startsWith("[") && v.endsWith("]")) return splitCommas(v.slice(1, -1)).map(unq);
  return unq(v);
}

const FM_LINE = /^([A-Za-z_][A-Za-z0-9_\-]*)\s*:\s?([^\n]*)$/;

function parseFm(lines) {
  const d = {};
  for (const ln of lines || []) {
    if (!ln.trim() || ln.trimStart().startsWith("#")) continue;
    const m = FM_LINE.exec(ln);
    if (m) d[m[1]] = parseValue(stripComment(m[2]));
  }
  return d;
}

function fmtValue(v) {
  if (Array.isArray(v)) return "[" + v.map((x) => pystr(x)).join(", ") + "]";
  const s = v === null || v === undefined ? "" : pystr(v);
  if (s && (s.includes(": ") || s.includes(" #") || "[{>|*&!%@`'\"".includes(s[0]) || s.trim() !== s)) {
    return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }
  return s;
}

function fmSet(text, updates) {
  let [lines, body] = splitFm(text);
  if (lines === null) { lines = []; body = text; }
  const done = new Set();
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const m = FM_LINE.exec(ln);
    if (m && Object.prototype.hasOwnProperty.call(updates, m[1])) {
      const k = m[1], rest = m[2];
      const kept = stripComment(rest);
      const comment = kept.length < rest.trimEnd().length ? rest.slice(kept.length) : "";
      lines[i] = k + ": " + fmtValue(updates[k]) + (comment.trim() ? comment : "");
      done.add(k);
    }
  }
  for (const k of Object.keys(updates)) {
    if (!done.has(k)) lines.push(k + ": " + fmtValue(updates[k]));
  }
  return "---\n" + lines.join("\n") + "\n---\n" + body;
}

// ---------------------------------------------------------------- project context

class Ctx {
  constructor(opts) {
    this.opts = opts;
    this.root = process.cwd();
    let q = opts.qa;
    if (!truthy(q)) q = process.env.QA_DIR;
    if (!truthy(q)) q = "qa";
    this.qa = slash(pystr(q)).replace(/\/+$/, "");
    this.qa_abs = pyjoin(this.root, this.qa);
    this._git = null;
  }

  p(...parts) { return pyjoin(this.qa_abs, ...parts); }
  exists() { return isdir(this.qa_abs); }
  state(name) { return this.p(".state", name); }

  loadJson(name, def) {
    const p = this.state(name);
    if (!exists(p)) return def;
    try {
      return JSON.parse(rd(p));
    } catch (e) {
      if (e instanceof SyntaxError || (e && e.isValueError)) return def;
      throw e;
    }
  }

  saveJson(name, obj) {
    wr(this.state(name), pyDumps(obj, { indent: 2, ensureAscii: false }) + "\n");
  }

  get git() {
    if (this._git === null) this._git = new Git(this.root);
    return this._git;
  }
}

function runCmd(args, cwd, env, binary = false) {
  const r = spawnSync(args[0], args.slice(1), { cwd, env, encoding: "buffer", maxBuffer: 1 << 30, windowsHide: true });
  if (r.error) {
    if (r.error.code === "ENOENT") return [127, binary ? Buffer.alloc(0) : "", "not found"];
    throw r.error;
  }
  const rc = r.status === null ? -1 : r.status;
  const so = r.stdout || Buffer.alloc(0);
  const se = (r.stderr || Buffer.alloc(0)).toString("utf8");
  if (binary) return [rc, so, se];
  return [rc, so.toString("utf8"), se];
}

class Git {
  constructor(cwd) {
    this.cwd = cwd;
    const [rc, o] = runCmd(["git", "rev-parse", "--show-toplevel"], cwd);
    this.ok = rc === 0 && o.trim() !== "";
    this.top = this.ok ? path.normalize(o.trim()) : null;
    this.prefix = "";
    if (this.ok) {
      const [, o2] = runCmd(["git", "rev-parse", "--show-prefix"], cwd);
      this.prefix = slash(o2.trim());
    }
  }

  run(args, env, binary = false) {
    return runCmd(["git", ...args], this.top || this.cwd, env, binary);
  }

  out(args, env) {
    const [rc, o, e] = this.run(args, env);
    if (rc !== 0) throw new QAError("git " + args.slice(0, 3).join(" ") + " failed: " + cut(e.trim(), 200), 1);
    return o;
  }

  head() {
    const [rc, o] = this.run(["rev-parse", "--verify", "-q", "HEAD"]);
    return rc === 0 ? o.trim() : "";
  }

  toCwd(p) {
    p = slash(p);
    if (this.prefix && !p.startsWith(this.prefix)) return null;
    return p.slice(this.prefix.length);
  }

  fromCwd(p) { return this.prefix + slash(p); }

  tree(exclude) {
    const [, idx] = this.run(["rev-parse", "--git-path", "index"]);
    let idxPath = idx.trim();
    if (idxPath && !path.isAbsolute(idxPath)) idxPath = pyjoin(this.top, idxPath);
    const tmp = path.join(os.tmpdir(), "enhance-qa-index-" + crypto.randomBytes(6).toString("hex"));
    fs.closeSync(fs.openSync(tmp, "wx"));
    try {
      const env = Object.assign({}, process.env);
      env.GIT_INDEX_FILE = tmp;
      if (idxPath && exists(idxPath)) {
        fs.copyFileSync(idxPath, tmp);
      } else {
        fs.rmSync(tmp, { force: true });
        if (this.head()) this.out(["read-tree", "HEAD"], env);
      }
      this.out(["add", "-A", "--", "."], env);
      for (const ex of exclude) {
        this.run(["rm", "-r", "--cached", "-q", "--ignore-unmatch", "--", this.fromCwd(ex)], env);
      }
      return this.out(["write-tree"], env).trim();
    } finally {
      for (const f of [tmp, tmp + ".lock"]) {
        if (exists(f)) {
          try { fs.rmSync(f); } catch (e) { /* ignore */ }
        }
      }
    }
  }

  diffTrees(a, b) {
    const o = this.out(["diff-tree", "-r", "--name-only", "--no-commit-id", a, b]);
    const res = [];
    for (const ln of splitlines(o)) {
      if (!ln.trim()) continue;
      const c = this.toCwd(unquoteGit(ln));
      if (c !== null) res.push(c);
    }
    return res;
  }

  showBytes(treeish, p) {
    const [rc, data] = this.run(["show", treeish + ":" + this.fromCwd(p)], undefined, true);
    return rc === 0 ? data : null;
  }

  existsIn(treeish, p) {
    const [rc] = this.run(["cat-file", "-e", treeish + ":" + this.fromCwd(p)]);
    return rc === 0;
  }
}

function unquoteGit(p) {
  if (p.length >= 1 && p.startsWith('"') && p.endsWith('"')) {
    const inner = p.slice(1, -1);
    try {
      const bytes = [];
      for (let i = 0; i < inner.length; i++) {
        const c = inner.charCodeAt(i);
        if (c > 255) throw new Error("not latin-1");
        if (inner[i] !== "\\") { bytes.push(c); continue; }
        i++;
        if (i >= inner.length) throw new Error("trailing backslash");
        const e = inner[i];
        const simple = { "\\": 92, "'": 39, '"': 34, a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11 };
        if (Object.prototype.hasOwnProperty.call(simple, e)) { bytes.push(simple[e]); continue; }
        if (e === "\n") continue;
        if (/[0-7]/.test(e)) {
          let oct = e;
          while (oct.length < 3 && i + 1 < inner.length && /[0-7]/.test(inner[i + 1])) { i++; oct += inner[i]; }
          bytes.push(parseInt(oct, 8) & 255);
          continue;
        }
        if (e === "x") {
          const hx = inner.slice(i + 1, i + 3);
          if (!/^[0-9a-fA-F]{2}$/.test(hx)) throw new Error("bad \\x");
          bytes.push(parseInt(hx, 16));
          i += 2;
          continue;
        }
        if (e === "u" || e === "U" || e === "N") throw new Error("unsupported escape");
        bytes.push(92, e.charCodeAt(0));
      }
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.from(bytes));
    } catch (e) {
      return inner;
    }
  }
  return p;
}

// ---------------------------------------------------------------- globs

const globCache = new Map();

function globRe(pattern) {
  if (globCache.has(pattern)) return globCache.get(pattern);
  let p = slash(pattern.trim());
  const anchored = p.replace(/\/+$/, "").includes("/");
  if (p.startsWith("/")) p = p.slice(1);
  if (p.endsWith("/")) p = p + "**";
  let i = 0;
  let rx = "";
  while (i < p.length) {
    const c = p[i];
    if (p.startsWith("**/", i)) {
      rx += "(?:[^\\n]*/)?";
      i += 3;
    } else if (p.startsWith("**", i)) {
      rx += "[^\\n]*";
      i += 2;
    } else if (c === "*") {
      rx += "[^/]*";
      i += 1;
    } else if (c === "?") {
      rx += "[^/]";
      i += 1;
    } else if (c === "[") {
      const j = p.indexOf("]", i);
      if (j === -1) {
        rx += "\\[";
        i += 1;
      } else {
        rx += p.slice(i, j + 1);
        i = j + 1;
      }
    } else {
      rx += escRe(c);
      i += 1;
    }
  }
  if (!/[*?[]/.test(p)) rx += "(?:/[^\\n]*)?";
  const full = new RegExp((anchored ? "^" : "^(?:[^\\n]*/)?") + rx + "$");
  globCache.set(pattern, full);
  return full;
}

function matchAny(p, patterns) {
  p = slash(p);
  return patterns.some((pat) => pat.trim() && globRe(pat).test(p));
}

function rolePatterns(table, role, qa) {
  return (Object.prototype.hasOwnProperty.call(table, role) ? table[role] : []).map((p) => p.split("{qa}").join(qa));
}

// ---------------------------------------------------------------- checklist

function splitDots(s) { return s.split(/\s+·\s+/); }

function parseArea(p, ctx) {
  const text = rd(p);
  const stem = stemOf(p);
  const area = { file: slash(relpath(p, ctx.root)), name: stem, title: "", header: {}, checks: [], problems: [] };
  let cur = null, lastKey = null, inHeader = true;
  const lines = text.split("\n");
  for (let idx = 1; idx <= lines.length; idx++) {
    const ln = lines[idx - 1];
    if (ln.startsWith("# ") && !area.title && inHeader) {
      area.title = ln.slice(2).trim();
      continue;
    }
    const m = HEAD_RE.exec(ln);
    if (m) {
      inHeader = false;
      cur = { id: m[1], title: m[2], fields: {}, line: idx, file: area.file, area: stem };
      area.checks.push(cur);
      lastKey = null;
      continue;
    }
    if (ln.startsWith("### ")) {
      area.problems.push(["error", idx, "Check heading isn't in the form '### AREA-001 · Title': " + cut(ln.trim(), 70)]);
      inHeader = false; cur = null; lastKey = null;
      continue;
    }
    if (ln.startsWith("#")) {
      if (!inHeader) cur = null;
      lastKey = null;
      continue;
    }
    const target = inHeader ? area.header : (cur ? cur.fields : null);
    const keys = inHeader ? HEADER_KEYS : CHECK_KEYS;
    const lm = /^ {0,3}[-*]\s+([^\n]*)$/.exec(ln);
    if (lm && target !== null) {
      for (const part of splitDots(lm[1])) {
        const km = /^([A-Za-z][A-Za-z ]{0,20}?)\s*:\s*([^\n]*)$/.exec(part.trim());
        const key = km ? capitalize(km[1].trim()) : null;
        if (km && keys.includes(key)) {
          target[key] = km[2].trim();
          lastKey = key;
        } else if (lastKey) {
          target[lastKey] = (target[lastKey] + " · " + part.trim()).trim();
        }
      }
      continue;
    }
    if (ln.startsWith("  ") && ln.trim() && lastKey && target !== null) {
      target[lastKey] = (target[lastKey] + " " + ln.trim()).trim();
      continue;
    }
    if (!ln.trim()) lastKey = null;
  }
  return area;
}

function loadAreas(ctx) {
  const d = ctx.p("checklist");
  if (!isdir(d)) return [];
  const files = sortedStrs(listdir(d).filter((f) => f.endsWith(".md") && !f.startsWith("_")));
  return files.map((f) => parseArea(pyjoin(d, f), ctx));
}

function allChecks(areas, includeRetired = false) {
  const res = [];
  for (const a of areas) {
    for (const c of a.checks) {
      if (includeRetired || !c.fields.Retired) res.push(c);
    }
  }
  return res;
}

function tagsOf(c) {
  return (c.fields.Tags || "").split(",").map((t) => t.trim().toLowerCase()).filter((t) => t);
}

function areaPaths(area) {
  return (area.header.Paths || "").split(",").map((p) => p.trim()).filter((p) => p);
}

// ---------------------------------------------------------------- bugs, runs, plan

function loadBugs(ctx) {
  const d = ctx.p("bugs");
  if (!isdir(d)) return [];
  const res = [];
  for (const f of sortedStrs(listdir(d))) {
    if (!/^BUG-\d{3,}\.md$/.test(f)) continue;
    const p = pyjoin(d, f);
    const text = rd(p);
    const [lines, body] = splitFm(text);
    res.push({
      file: slash(relpath(p, ctx.root)), name: f.slice(0, -3), fm: parseFm(lines), has_fm: lines !== null,
      sections: Array.from(body.matchAll(/^##\s+([^\n]+?)\s*$/gm), (m) => m[1]), body,
    });
  }
  return res;
}

function splitRow(ln) {
  let s = ln.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells = [];
  let cur = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === "\\" && i + 1 < s.length && s[i + 1] === "|") {
      cur.push("|");
      i += 2;
      continue;
    }
    if (s[i] === "|") {
      cells.push(cur.join("").trim());
      cur = [];
    } else {
      cur.push(s[i]);
    }
    i += 1;
  }
  cells.push(cur.join("").trim());
  return cells;
}

function sectionBounds(lines, title) {
  let start = null;
  const titleRe = new RegExp("^##\\s+" + escRe(title) + "\\s*$");
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (titleRe.test(ln)) {
      start = i + 1;
      continue;
    }
    if (start !== null && /^#{1,2}\s/.test(ln)) return [start, i];
  }
  return start !== null ? [start, lines.length] : null;
}

function parseResults(body) {
  const lines = body.split("\n");
  const b = sectionBounds(lines, "Results");
  if (!b) return [];
  const rows = [];
  let header = null;
  for (const ln of lines.slice(b[0], b[1])) {
    if (!ln.trim().startsWith("|")) continue;
    const cells = splitRow(ln);
    if (header === null) {
      header = cells.map((c) => c.trim().toLowerCase());
      continue;
    }
    if (cells.filter((c) => c).every((c) => /^:?-{2,}:?$/.test(c))) continue;
    const padded = cells.concat(Array(Math.max(0, header.length - cells.length)).fill(""));
    const row = {};
    const n = Math.min(header.length, padded.length);
    for (let i = 0; i < n; i++) row[header[i]] = padded[i];
    const res = ((row.result) || "").trim();
    rows.push({
      check: ((row.check) || "").trim(), result: res ? res.split(" ")[0].toLowerCase() : "",
      result_raw: res, note: ((row.note) || "").trim(),
      evidence: ((row.evidence) || "").trim(), bug: ((row.bug) || "").trim(),
    });
  }
  return rows;
}

function loadRuns(ctx) {
  const d = ctx.p("runs");
  if (!isdir(d)) return [];
  const res = [];
  for (const f of listdir(d)) {
    const m = RUN_FILE_RE.exec(f);
    if (!m || f.startsWith("_")) continue;
    const p = pyjoin(d, f);
    const text = rd(p);
    const [lines, body] = splitFm(text);
    const fm = parseFm(lines);
    res.push({
      n: parseInt(m[1], 10), mode: truthy(fm.mode) ? fm.mode : m[2], file: slash(relpath(p, ctx.root)),
      path: p, fm, body, text, results: parseResults(body),
    });
  }
  res.sort((a, b) => a.n - b.n);
  return res;
}

function loadPlan(ctx) {
  const p = ctx.p("plan.md");
  if (!exists(p)) return {};
  const [lines] = splitFm(rd(p));
  return parseFm(lines);
}

function setting(plan, key, def) {
  const v = plan[key];
  if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) return def;
  return v;
}

function defaultPriority(stage, severity) {
  const table = {
    prototype: { S1: "fix-now", S2: "later", S3: "later", S4: "later" },
    building: { S1: "fix-now", S2: "fix-now", S3: "before-release", S4: "later" },
    "near-release": { S1: "fix-now", S2: "fix-now", S3: "before-release", S4: "later" },
    rc: { S1: "fix-now", S2: "before-release", S3: "later", S4: "later" },
    live: { S1: "fix-now", S2: "before-release", S3: "later", S4: "later" },
    hotfix: { S1: "fix-now", S2: "before-release", S3: "later", S4: "later" },
  };
  const t = Object.prototype.hasOwnProperty.call(table, stage) ? table[stage] : table.building;
  return Object.prototype.hasOwnProperty.call(t, severity) ? t[severity] : "later";
}

// ---------------------------------------------------------------- validate

function hasQuote(s) {
  return /["“”'`][^\n]{2,}["“”'`]|\bexit\s*\d+|\b[1-5]\d\d\b/.test(s || "");
}

function validate(ctx) {
  const probs = [];
  const add = (level, file, line, message) => probs.push({ level, file, line, message });
  if (!ctx.exists()) {
    add("error", ctx.qa, 0, "No " + ctx.qa + "/ folder. Run `qa init` first.");
    return probs;
  }
  const plan = loadPlan(ctx);
  const pf = ctx.qa + "/plan.md";
  if (!exists(ctx.p("plan.md"))) add("warning", pf, 0, "No plan.md yet.");
  for (const [key, allowed] of [["stage", STAGES], ["autonomy", AUTONOMY], ["budget", BUDGETS]]) {
    const v = plan[key];
    if (truthy(v) && !allowed.includes(v)) add("error", pf, 0, key + " '" + S(v) + "' isn't one of " + allowed.join(", "));
  }
  for (const key of ["parallel_testers", "checks_per_tester", "agent_turns", "fixes_per_batch", "max_loop_rounds", "rotation"]) {
    const v = plan[key];
    if (!emptyish(v) && toInt(v, null) === null) add("warning", pf, 0, key + " should be a whole number (is '" + S(v) + "')");
  }
  for (const key of ["confirm_over_usd", "max_usd_per_run"]) {
    const v = plan[key];
    if (!emptyish(v) && v !== "never" && toFloat(v, null) === null) add("warning", pf, 0, key + " should be a number (is '" + S(v) + "')");
  }
  const areas = loadAreas(ctx);
  const seenPrefix = new Map();
  const seenIds = new Map();
  for (const a of areas) {
    for (const [level, line, msg] of a.problems) add(level, a.file, line, msg);
    const pre = a.header.Area || "";
    if (!pre) {
      add("error", a.file, 1, "Missing '- Area: PREFIX' in the header");
    } else if (!/^[A-Z][A-Z0-9]{1,11}$/.test(pre)) {
      add("error", a.file, 1, "Area prefix '" + pre + "' must be 2–12 capital letters or digits");
    } else if (seenPrefix.has(pre)) {
      add("error", a.file, 1, "Area prefix '" + pre + "' is also used by " + seenPrefix.get(pre));
    } else {
      seenPrefix.set(pre, a.file);
    }
    if (!a.header.Paths) add("error", a.file, 1, "Missing '- Paths:' in the header (use * for app-wide areas)");
    for (const c of a.checks) {
      const f = c.fields, cid = c.id;
      if (seenIds.has(cid)) {
        add("error", c.file, c.line, cid + " is a duplicate ID (also in " + seenIds.get(cid) + ")");
      } else {
        seenIds.set(cid, c.file + ":" + c.line);
      }
      if (pre && !cid.startsWith(pre + "-")) add("warning", c.file, c.line, cid + " doesn't use this area's prefix " + pre);
      if (f.Retired) continue;
      if (!RISKS.includes((f.Risk || "").toLowerCase())) {
        add("error", c.file, c.line, cid + ": Risk '" + (f.Risk || "") + "' isn't one of " + RISKS.join(", "));
      }
      const t = (f.Type || "").toLowerCase();
      if (!TYPES.includes(t)) add("error", c.file, c.line, cid + ": Type '" + (f.Type || "") + "' isn't one of " + TYPES.join(", "));
      if (t === "auto") {
        if (!f.Command && !f.Steps) add("error", c.file, c.line, cid + ": an auto check needs Command (or Steps)");
      } else if (!f.Steps) {
        add("error", c.file, c.line, cid + ": missing Steps");
      }
      if (!f.Expect) add("error", c.file, c.line, cid + ": missing Expect");
      if (!f.Source) add("warning", c.file, c.line, cid + ": missing Source (the oracle)");
      if (!c.title) add("warning", c.file, c.line, cid + ": missing title after the ID");
    }
  }
  const bugIds = new Map();
  const areaNames = new Set(areas.map((a) => a.name));
  for (const b of loadBugs(ctx)) {
    const fm = b.fm, fname = b.file;
    if (!b.has_fm) {
      add("error", fname, 1, "Missing front matter (--- … ---)");
      continue;
    }
    for (const k of ["id", "title", "status", "severity", "priority", "found", "repro", "area"]) {
      if (!truthy(fm[k])) add("error", fname, 1, "Missing '" + k + "'");
    }
    const bid = truthy(fm.id) ? fm.id : "";
    if (truthy(bid) && bid !== b.name) add("error", fname, 1, "id '" + S(bid) + "' doesn't match the file name " + b.name);
    if (bugIds.has(bid)) add("error", fname, 1, S(bid) + " is also used by " + bugIds.get(bid));
    bugIds.set(bid, fname);
    if (truthy(fm.status) && !BUG_STATUSES.includes(fm.status)) add("error", fname, 1, "status '" + S(fm.status) + "' isn't one of " + BUG_STATUSES.join(", "));
    if (truthy(fm.severity) && !SEVERITIES.includes(fm.severity)) add("error", fname, 1, "severity '" + S(fm.severity) + "' isn't one of S1, S2, S3, S4");
    if (truthy(fm.priority) && !PRIORITIES.includes(fm.priority)) add("error", fname, 1, "priority '" + S(fm.priority) + "' isn't one of " + PRIORITIES.join(", "));
    if (truthy(fm.area) && areaNames.size && !areaNames.has(fm.area)) add("warning", fname, 1, "area '" + S(fm.area) + "' has no checklist file");
    if (fm.status === "duplicate" && !truthy(fm.duplicate_of)) add("warning", fname, 1, "a duplicate should name duplicate_of");
    for (const sec of ["What a user sees", "Steps", "Expected", "Actual", "Evidence"]) {
      if (!b.sections.includes(sec)) add("warning", fname, 1, "missing section '## " + sec + "'");
    }
    if (!(fm.status === undefined || fm.status === null || fm.status === "" || fm.status === "new") && b.body.includes("(fill in:")) {
      add("warning", fname, 1, "still has '(fill in: …)' placeholders");
    }
  }
  const known = new Set(seenIds.keys());
  for (const r of loadRuns(ctx)) {
    for (const k of ["run", "mode", "build"]) {
      const v = r.fm[k];
      if (v === undefined || v === null || v === "") add("warning", r.file, 1, "front matter is missing '" + k + "'");
    }
    for (const row of r.results) {
      if (row.result && !RESULTS.includes(row.result)) {
        add("error", r.file, 0, row.check + ": result '" + row.result_raw + "' isn't one of " + RESULTS.join(", "));
      }
      if (known.size && row.check && CHECK_ID_RE.test(row.check) && !known.has(row.check)) {
        add("warning", r.file, 0, row.check + " isn't in the checklist");
      }
      if (["pass", "fail", "flaky"].includes(row.result) && !row.evidence && !hasQuote(row.note)) {
        add("warning", r.file, 0, row.check + ": " + row.result + " without evidence counts as not-run");
      }
    }
  }
  return probs;
}

function cmdValidate(ctx, pos, opts) {
  const probs = validate(ctx);
  const errs = probs.filter((p) => p.level === "error");
  if (opts.json) {
    out({ ok: errs.length === 0, errors: errs.length, warnings: probs.length - errs.length, problems: probs }, true);
  } else {
    const lines = probs.map((p) => p.level.padEnd(7) + " " + p.file + (p.line ? ":" + p.line : "") + "  " + p.message);
    lines.push(errs.length + " error(s), " + (probs.length - errs.length) + " warning(s)");
    out(null, false, lines.join("\n"));
  }
  return errs.length ? 1 : 0;
}

// ---------------------------------------------------------------- ids

function nextCheckId(ctx, prefix) {
  prefix = prefix.toUpperCase();
  let n = 0;
  const d = ctx.p("checklist");
  if (isdir(d)) {
    const rx = new RegExp("\\b" + escRe(prefix) + "-(\\d{3,})\\b", "g");
    for (const f of listdir(d)) {
      if (f.endsWith(".md")) {
        for (const m of rd(pyjoin(d, f)).matchAll(rx)) n = Math.max(n, parseInt(m[1], 10));
      }
    }
  }
  return prefix + "-" + pad3(n + 1);
}

function nextBugId(ctx) {
  let n = 0;
  const d = ctx.p("bugs");
  if (isdir(d)) {
    for (const f of listdir(d)) {
      const m = /^BUG-(\d{3,})\.md$/.exec(f);
      if (m) n = Math.max(n, parseInt(m[1], 10));
    }
  }
  return "BUG-" + pad3(n + 1);
}

function nextRunN(ctx) {
  let n = 0;
  const d = ctx.p("runs");
  if (isdir(d)) {
    for (const f of listdir(d)) {
      const m = /^(\d{3,})(?:-|$)/.exec(f);
      if (m) n = Math.max(n, parseInt(m[1], 10));
    }
  }
  return n + 1;
}

function cmdNextId(ctx, pos, opts) {
  if (!pos.length) throw new QAError("usage: qa next-id check <PREFIX> | bug | run");
  const kind = pos[0];
  let v;
  if (kind === "check") {
    if (pos.length < 2) throw new QAError("usage: qa next-id check <PREFIX>");
    v = nextCheckId(ctx, pos[1]);
  } else if (kind === "bug") {
    v = nextBugId(ctx);
  } else if (kind === "run") {
    v = pad3(nextRunN(ctx));
  } else {
    throw new QAError("usage: qa next-id check <PREFIX> | bug | run");
  }
  out({ id: v }, opts.json, v);
  return 0;
}

// ---------------------------------------------------------------- builds and snapshots

function builds(ctx) {
  const j = ctx.loadJson("builds.json", { builds: [] });
  return j.builds !== undefined ? j.builds : [];
}

function manifest(ctx, exclude) {
  const files = {};
  const excluded = (rel) => exclude.some((ex) => rel === ex || rel.startsWith(ex + "/"));
  function walk(absDir, relDir) {
    let ents;
    try { ents = fs.readdirSync(absDir, { withFileTypes: true }); } catch (e) { return; }
    const subdirs = [];
    for (const ent of ents) {
      let isD = ent.isDirectory();
      let followedDir = false;
      if (!isD && ent.isSymbolicLink()) {
        try { followedDir = fs.statSync(path.join(absDir, ent.name)).isDirectory(); } catch (e) { followedDir = false; }
      }
      if (isD || followedDir) {
        if (!SKIP_WALK.has(ent.name) && !excluded(relDir + ent.name) && isD) subdirs.push(ent.name);
        continue;
      }
      const rel = relDir + ent.name;
      if (excluded(rel)) continue;
      let st;
      try { st = fs.statSync(path.join(absDir, ent.name)); } catch (e) { continue; }
      files[rel] = [st.size, Math.floor(st.mtimeMs / 1000)];
    }
    for (const d of subdirs) walk(path.join(absDir, d), relDir + d + "/");
  }
  walk(ctx.root, "");
  return files;
}

const AGENT_DIRS = [".claude", ".agents", ".codex"];

function currentTree(ctx, includeQa = false) {
  // Build identity leaves out qa/ and agent tooling folders (not product code); phase trees keep them so
  // edits there during a phase are still caught.
  const exclude = includeQa ? [ctx.qa + "/.state", ctx.qa + "/evidence"] : [ctx.qa].concat(AGENT_DIRS);
  if (ctx.git.ok) return [ctx.git.tree(exclude), null];
  const m = manifest(ctx, exclude);
  return ["m" + sha(pyDumps(m, { sortKeys: true }), 40), m];
}

function changedBetween(ctx, a, b) {
  if ((a.tree || "").startsWith("m") || (b.tree || "").startsWith("m")) {
    const ma = truthy(a.manifest) ? a.manifest : {}, mb = truthy(b.manifest) ? b.manifest : {};
    const keys = new Set([...Object.keys(ma), ...Object.keys(mb)]);
    const res = [];
    for (const k of keys) {
      if (pyDumps(ma[k] === undefined ? null : ma[k]) !== pyDumps(mb[k] === undefined ? null : mb[k])) res.push(k);
    }
    return res.sort();
  }
  if (a.tree === b.tree) return [];
  return ctx.git.diffTrees(a.tree, b.tree);
}

function inQa(ctx, f) { return f === ctx.qa || f.startsWith(ctx.qa + "/"); }

function dirtyFiles(ctx) {
  if (!ctx.git.ok) return [];
  const [, o] = ctx.git.run(["status", "--porcelain=v1", "--untracked-files=all"]);
  const res = [];
  for (const ln of splitlines(o)) {
    if (Array.from(ln).length < 4) continue;
    let p = Array.from(ln).slice(3).join("");
    if (p.includes(" -> ")) p = p.slice(p.indexOf(" -> ") + 4);
    const c = ctx.git.toCwd(unquoteGit(p));
    if (c !== null && !inQa(ctx, c) && !AGENT_DIRS.some((d) => c === d || c.startsWith(d + "/"))) res.push(c);
  }
  return res.sort();
}

function snapshot(ctx) {
  const [tree, man] = currentTree(ctx, false);
  const reg = builds(ctx);
  const last = reg.length ? reg[reg.length - 1] : null;
  if (last && last.tree === tree) {
    const e = Object.assign({}, last);
    e.same = true;
    return e;
  }
  const n = last ? last.build + 1 : 1;
  let head = "", commit = "";
  if (ctx.git.ok) {
    head = ctx.git.head();
    const env = Object.assign({}, process.env, {
      GIT_AUTHOR_NAME: "enhance-qa", GIT_AUTHOR_EMAIL: "enhance-qa@localhost",
      GIT_COMMITTER_NAME: "enhance-qa", GIT_COMMITTER_EMAIL: "enhance-qa@localhost",
    });
    const args = ["commit-tree", tree, "-m", "enhance-qa build " + n].concat(head ? ["-p", head] : []);
    commit = ctx.git.out(args, env).trim();
    ctx.git.out(["update-ref", "refs/enhance-qa/builds/" + n, commit]);
  }
  const entry = { build: n, commit, head, tree, created: nowStr(), included: dirtyFiles(ctx) };
  if (man !== null) wr(ctx.state(path.join("manifests", n + ".json")), pyDumps(man, { sortKeys: true }));
  reg.push(entry);
  ctx.saveJson("builds.json", { builds: reg });
  const e = Object.assign({}, entry);
  e.same = false;
  return e;
}

function buildEntry(ctx, n) {
  if (!/^\d+$/.test(String(n).trim())) throw new QAError("Build numbers are whole numbers, like 3.", 2);
  const num = pyInt(n);
  for (const b of builds(ctx)) {
    if (b.build === num) {
      const e = Object.assign({}, b);
      if (e.tree.startsWith("m")) {
        const p = ctx.state(path.join("manifests", b.build + ".json"));
        e.manifest = exists(p) ? JSON.parse(rd(p)) : {};
      }
      return e;
    }
  }
  return null;
}

function testedBuilds(ctx, runs) {
  runs = runs === undefined ? loadRuns(ctx) : runs;
  const set = new Set();
  for (const r of runs) {
    const b = toInt(r.fm.build, 0);
    if (b > 0) set.add(b);
  }
  return Array.from(set).sort((a, b) => a - b);
}

function cmdSnapshot(ctx, pos, opts) {
  if (!ctx.exists()) throw new QAError("No " + ctx.qa + "/ folder. Run `qa init` first.");
  const e = snapshot(ctx);
  const short = (e.commit || e.tree).slice(0, 9);
  const text = "Build " + e.build + (e.same ? " (unchanged)" : "") + " · " + short +
    (e.included.length ? " · includes uncommitted: " + e.included.slice(0, 8).join(", ") + (e.included.length > 8 ? " …" : "") : "");
  out(e, opts.json, text);
  return 0;
}

function cmdDiff(ctx, pos, opts) {
  const reg = builds(ctx);
  if (!reg.length) throw new QAError("No builds yet. Run `qa snapshot`.", 1);
  const tested = testedBuilds(ctx).filter((b) => b !== reg[reg.length - 1].build);
  const aN = toInt(opts.from, tested.length ? tested[tested.length - 1] : null);
  const bN = toInt(opts.to, reg[reg.length - 1].build);
  if (aN === null) {
    out({ from: null, to: bN, changed: [] }, opts.json, "No earlier tested build to compare with.");
    return 0;
  }
  const a = buildEntry(ctx, aN), b = buildEntry(ctx, bN);
  if (!a || !b) throw new QAError("Unknown build number.", 2);
  const ch = changedBetween(ctx, a, b).filter((f) => !inQa(ctx, f) && !AGENT_DIRS.some((d) => f === d || f.startsWith(d + "/")));
  out({ from: aN, to: bN, changed: ch }, opts.json,
    "Build " + aN + " → " + bN + ": " + ch.length + " file(s) changed\n" + ch.join("\n"));
  return 0;
}

// ---------------------------------------------------------------- lock

function cmdLock(ctx, pos, opts) {
  const sub = pos.length ? pos[0] : "status";
  const p = ctx.state("lock.json");
  const cur = ctx.loadJson("lock.json", null);
  let stale = false;
  if (truthy(cur)) {
    const t = parseTime(cur.started);
    stale = t !== null && (nowDt() - t) / 1000 > STALE_LOCK_HOURS * 3600;
  }
  if (sub === "acquire") {
    if (truthy(cur) && !stale && !opts.force) {
      out({ acquired: false, lock: cur }, opts.json,
        "Another QA run holds the lock (run " + S(cur.run !== undefined ? cur.run : "?") + ", started " + S(cur.started) + " on " + S(cur.host) + ").");
      return 2;
    }
    const lock = { run: opts.run !== undefined ? opts.run : "", started: nowStr(), host: os.hostname(), pid: process.pid };
    ctx.saveJson("lock.json", lock);
    out({ acquired: true, took_over_stale: truthy(cur) && stale, lock }, opts.json,
      "Lock acquired" + (truthy(cur) && stale ? " (took over a stale lock)" : "") + ".");
    return 0;
  }
  if (sub === "release") {
    if (exists(p)) fs.rmSync(p);
    out({ released: true }, opts.json, "Lock released.");
    return 0;
  }
  out({ held: truthy(cur) && !stale, stale, lock: cur }, opts.json,
    truthy(cur) ? "Held by run " + S(cur.run !== undefined ? cur.run : "?") + " since " + S(cur.started) + (stale ? " (stale)" : "") + "." : "Not locked.");
  return 0;
}

// ---------------------------------------------------------------- hash

function fingerprints(ctx) {
  const res = {};
  for (const c of allChecks(loadAreas(ctx))) {
    const f = c.fields;
    const basis = [(f.Type || "").toLowerCase(), (f.Risk || "").toLowerCase(), normWs(f.Steps), normWs(f.Command), normWs(f.Expect)].join("\x1f");
    res[c.id] = sha(basis);
  }
  return res;
}

function hashCompare(ctx) {
  const rec = ctx.loadJson("hash.json", null);
  if (!truthy(rec)) return null;
  const cur = fingerprints(ctx), old = rec.checks !== undefined ? rec.checks : {};
  return {
    recorded: rec.recorded,
    changed: Object.keys(cur).filter((k) => k in old && cur[k] !== old[k]).sort(),
    added: Object.keys(cur).filter((k) => !(k in old)).sort(),
    removed: Object.keys(old).filter((k) => !(k in cur)).sort(),
  };
}

function cmdHash(ctx, pos, opts) {
  if (opts.record) {
    const fp = fingerprints(ctx);
    ctx.saveJson("hash.json", { recorded: nowStr(), checks: fp });
    out({ recorded: true, checks: Object.keys(fp).length, hash: sha(pyDumps(fp, { sortKeys: true })) }, opts.json,
      "Recorded the checklist fingerprint (" + Object.keys(fp).length + " checks).");
    return 0;
  }
  if (opts.verify) {
    const cmp = hashCompare(ctx);
    if (cmp === null) {
      out({ ok: false, error: "no recorded hash" }, opts.json, "No recorded hash. Run `qa hash --record` first.");
      return 1;
    }
    const ok = !(cmp.changed.length || cmp.added.length || cmp.removed.length);
    cmp.ok = ok;
    out(cmp, opts.json, ok ? "Checklist unchanged since " + S(cmp.recorded) + "." :
      "Checklist changed since " + S(cmp.recorded) + ": changed " + (cmp.changed.join(", ") || "none") + "; added " +
      (cmp.added.join(", ") || "none") + "; removed " + (cmp.removed.join(", ") || "none"));
    return ok ? 0 : 1;
  }
  const fp = fingerprints(ctx);
  out({ checks: Object.keys(fp).length, hash: sha(pyDumps(fp, { sortKeys: true })) }, opts.json,
    Object.keys(fp).length + " checks · fingerprint " + sha(pyDumps(fp, { sortKeys: true })));
  return 0;
}

// ---------------------------------------------------------------- phases and gate

function withoutManifest(ph) {
  const r = {};
  for (const k of Object.keys(ph || {})) if (k !== "manifest") r[k] = ph[k];
  return r;
}

function cmdPhase(ctx, pos, opts) {
  const sub = pos.length ? pos[0] : "status";
  if (sub === "start") {
    const role = opts.role;
    if (!ROLES.includes(role)) throw new QAError("usage: qa phase start --role " + ROLES.join("|") + " [--run N]");
    const [tree, man] = currentTree(ctx, true);
    const ph = {
      role, run: opts.run !== undefined ? opts.run : "", started: nowStr(), tree,
      allowed: rolePatterns(ALLOWED, role, ctx.qa), denied: rolePatterns(DENIED, role, ctx.qa),
    };
    if (man !== null) ph.manifest = man;
    ctx.saveJson("phase.json", ph);
    out({ started: true, role, run: ph.run }, opts.json, "Phase started: " + role + ".");
    return 0;
  }
  if (sub === "end") {
    const p = ctx.state("phase.json");
    if (exists(p)) fs.rmSync(p);
    out({ ended: true }, opts.json, "Phase ended.");
    return 0;
  }
  const ph = ctx.loadJson("phase.json", null);
  out({ active: truthy(ph), phase: withoutManifest(ph) }, opts.json,
    truthy(ph) ? "Active phase: " + S(ph.role) + " (run " + S(ph.run) + ", since " + S(ph.started) + ")." : "No active phase.");
  return 0;
}

function classify(ctx, role, files) {
  const allowed = rolePatterns(ALLOWED, role, ctx.qa), denied = rolePatterns(DENIED, role, ctx.qa);
  const needs = rolePatterns(NEEDS_OK, role, ctx.qa);
  const violations = [], flagged = [];
  for (const f of files) {
    if (f.startsWith(ctx.qa + "/.state/") || f.startsWith(ctx.qa + "/evidence/")) continue;
    if (matchAny(f, denied) || !matchAny(f, allowed)) violations.push(f);
    else if (matchAny(f, needs)) flagged.push(f);
  }
  return [violations, flagged];
}

function tamper(ctx, role, sinceTree) {
  const ph = ctx.loadJson("phase.json", null);
  let start;
  if (sinceTree === undefined || sinceTree === null) {
    if (!truthy(ph)) throw new QAError("No active phase. Run `qa phase start --role <role>` first, or pass --since <tree>.", 1);
    start = { tree: ph.tree, manifest: ph.manifest };
  } else {
    start = { tree: sinceTree };
  }
  const [tree, man] = currentTree(ctx, true);
  const now = { tree, manifest: man };
  const changed = changedBetween(ctx, start, now);
  const [v, f] = classify(ctx, role, changed);
  return { role, changed, violations: v, needs_ok: f, start_tree: start.tree };
}

function cmdTamper(ctx, pos, opts) {
  const ph = ctx.loadJson("phase.json", null);
  const role = truthy(opts.role) ? opts.role : (ph || {}).role;
  if (!ROLES.includes(role)) throw new QAError("usage: qa tamper --role <role> [--since <tree>]");
  const t = tamper(ctx, role, opts.since);
  out(t, opts.json, "Changed: " + t.changed.length + " · outside " + role + "'s files: " + (t.violations.join(", ") || "none") +
    (t.needs_ok.length ? "\nNeeds the user's OK (dependencies): " + t.needs_ok.join(", ") : ""));
  return t.violations.length ? 1 : 0;
}

function evidenceGaps(ctx, role, run) {
  if (!["tester", "verifier"].includes(role) || !truthy(run)) return [];
  const d = /^\d+$/.test(S(run)) ? ctx.p("runs", pad3(run)) : ctx.p("runs", S(run));
  const gaps = [];
  if (isdir(d)) {
    for (const f of sortedStrs(listdir(d))) {
      if (f.startsWith(role) && f.endsWith(".md")) {
        for (const row of parseResults(splitFm(rd(pyjoin(d, f)))[1])) {
          if (["pass", "fail", "flaky"].includes(row.result) && !row.evidence && !hasQuote(row.note)) gaps.push(row.check + " (" + f + ")");
        }
      }
    }
  }
  return gaps;
}

function revertPaths(ctx, startTree, paths, startManifest) {
  const stamp = nowStr().replace(/:/g, "").replace(/-/g, "");
  const done = [];
  for (const f of paths) {
    if (!inQa(ctx, f)) continue;
    const absf = pyjoin(ctx.root, f);
    if (exists(absf)) {
      const bk = ctx.state(path.join("reverted", stamp, f));
      fs.mkdirSync(path.dirname(bk), { recursive: true });
      fs.copyFileSync(absf, bk);
    }
    if (ctx.git.ok && ctx.git.existsIn(startTree, f)) {
      const data = ctx.git.showBytes(startTree, f);
      if (data !== null) {
        fs.mkdirSync(path.dirname(absf) || ".", { recursive: true });
        fs.writeFileSync(absf, data);
        done.push(f);
      }
    } else if (ctx.git.ok && exists(absf)) {
      fs.rmSync(absf);
      done.push(f);
    }
  }
  return done;
}

function cmdGate(ctx, pos, opts) {
  const ph = ctx.loadJson("phase.json", null);
  const role = truthy(opts.role) ? opts.role : (ph || {}).role;
  if (!ROLES.includes(role)) throw new QAError("usage: qa gate [--role <role>] [--revert] [--keep]");
  const report = { role, ok: true };
  if (truthy(ph)) {
    const t = tamper(ctx, role);
    Object.assign(report, { changed: t.changed, violations: t.violations, needs_ok: t.needs_ok });
    const product = t.violations.filter((f) => !inQa(ctx, f));
    report.product_changes = product;
    if (opts.revert && t.violations.length) {
      report.reverted = revertPaths(ctx, ph.tree, t.violations, ph.manifest);
    }
    if (t.violations.length) report.ok = false;
  } else {
    report.note = "No active phase: skipped the tamper check.";
  }
  if (!["scout", "lead"].includes(role)) {
    const cmp = hashCompare(ctx);
    if (cmp !== null && (cmp.changed.length || cmp.added.length || cmp.removed.length)) {
      report.checklist_changed = cmp;
      report.ok = false;
    }
  }
  const probs = validate(ctx).filter((p) => p.level === "error");
  if (probs.length) {
    report.validation_errors = probs.slice(0, 20);
    report.ok = false;
  }
  const gaps = evidenceGaps(ctx, role, truthy((ph || {}).run) ? ph.run : opts.run);
  if (gaps.length) report.evidence_gaps = gaps;
  if (truthy(ph) && !opts.keep) {
    fs.rmSync(ctx.state("phase.json"));
    report.phase_ended = true;
  }
  const lines = ["Gate (" + role + "): " + (report.ok ? "OK" : "PROBLEMS")];
  if (truthy(report.violations)) {
    lines.push("Outside " + role + "'s files: " + report.violations.join(", "));
    if (truthy(report.product_changes)) {
      lines.push("Product files changed during the phase (not reverted; could be the user's own edits): " + report.product_changes.join(", "));
    }
  }
  if (truthy(report.reverted)) lines.push("Reverted (backups in " + ctx.qa + "/.state/reverted/): " + report.reverted.join(", "));
  if (truthy(report.needs_ok)) lines.push("Needs the user's OK (dependency files): " + report.needs_ok.join(", "));
  if (truthy(report.checklist_changed)) {
    const c = report.checklist_changed;
    lines.push("Checklist changed during the phase: " + c.changed.concat(c.added, c.removed).join(", "));
  }
  if (truthy(report.validation_errors)) lines.push("Validation errors: " + report.validation_errors.length + " (run `qa validate`)");
  if (gaps.length) lines.push("Results without evidence (count as not-run): " + gaps.join(", "));
  if (truthy(report.note)) lines.push(report.note);
  out(report, opts.json, lines.join("\n"));
  return report.ok ? 0 : 1;
}

// ---------------------------------------------------------------- tamper-tests

const SKIP_PAT = /\.(skip|only)\s*\(|\b(xit|xdescribe|fit|fdescribe|xtest)\s*\(|@pytest\.mark\.(skip|xfail)|@unittest\.skip|#\[ignore\]|\bt\.Skip\(|@Disabled\b|@Ignore\b|\bpending\s*\(|test\.todo|it\.todo/;
const DISABLE_PAT = /eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck|#\s*type:\s*ignore|#\s*noqa|#\s*pylint:\s*disable|\/\/\s*nolint|#\s*pragma:\s*no\s*cover|@SuppressWarnings/;
const ASSERT_PAT = /\b(assert\w*|expect|should|assertEqual|assertTrue|assertFalse|toBe\w*|toEqual|toMatch\w*|toHave\w*|toThrow\w*|verify|ensure)\b/;
const TIMEOUT_PAT = /(timeout\w*\s*[:=(]\s*\d{4,}|setTimeout\s*\(\s*\d{4,}|retries\s*[:=]\s*[1-9]|\.retry\s*\(|flaky)/i;

function cmdTamperTests(ctx, pos, opts) {
  if (!ctx.git.ok) throw new QAError("tamper-tests needs git.", 1);
  const since = opts.since;
  if (!truthy(since)) throw new QAError("usage: qa tamper-tests --since <build number|git ref>");
  let ref = since;
  if (/^\d+$/.test(S(since))) {
    const b = buildEntry(ctx, since);
    if (!b) throw new QAError("Unknown build " + S(since) + ".", 2);
    ref = b.commit || b.tree;
  }
  const [rc, o, e] = ctx.git.run(["diff", "--name-status", S(ref), "--"]);
  if (rc !== 0) throw new QAError("git diff failed: " + cut(e.trim(), 200), 1);
  const entries = [];
  for (const ln of splitlines(o)) {
    const parts = ln.split("\t");
    if (parts.length >= 2) entries.push([parts[0][0], unquoteGit(parts[parts.length - 1])]);
  }
  const [, o2] = ctx.git.run(["ls-files", "--others", "--exclude-standard"]);
  for (const ln of splitlines(o2)) {
    if (ln.trim()) entries.push(["A", unquoteGit(ln.trim())]);
  }
  const flags = [];
  for (const [st, p] of entries) {
    const c = ctx.git.toCwd(p);
    if (c === null || c.startsWith(ctx.qa + "/")) continue;
    const isTest = matchAny(c, TEST_GLOBS), isCfg = matchAny(c, TEST_CONFIG_GLOBS);
    if (!(isTest || isCfg)) continue;
    if (isCfg && !isTest) {
      flags.push({ file: c, kind: "test or lint config changed", text: "" });
      continue;
    }
    if (c.endsWith(".snap") || ("/" + c).includes("/__snapshots__/")) {
      flags.push({ file: c, kind: "snapshot changed: check it matches a product reason", text: "" });
      continue;
    }
    if (st === "D") {
      flags.push({ file: c, kind: "test file deleted", text: "" });
      continue;
    }
    if (st === "A" && !ctx.git.existsIn(S(ref), c)) {
      const absf = pyjoin(ctx.root, c);
      let content;
      try {
        content = rd(absf);
      } catch (err) {
        continue;
      }
      const cl = content.split("\n");
      for (let i = 1; i <= cl.length; i++) {
        const ln = cl[i - 1];
        if (SKIP_PAT.test(ln)) flags.push({ file: c, line: i, kind: "skip or only in a new test", text: cut(ln.trim(), 120) });
      }
      continue;
    }
    const [, d] = ctx.git.run(["diff", "-U0", S(ref), "--", ctx.git.fromCwd(c)]);
    let lineNo = 0;
    for (const ln of splitlines(d)) {
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(ln);
      if (m) {
        lineNo = parseInt(m[1], 10);
        continue;
      }
      if (ln.startsWith("+++") || ln.startsWith("---")) continue;
      if (ln.startsWith("-") && ASSERT_PAT.test(ln)) {
        flags.push({ file: c, line: lineNo, kind: "assertion removed or changed", text: cut(ln.slice(1).trim(), 120) });
      } else if (ln.startsWith("+")) {
        const body = ln.slice(1);
        if (SKIP_PAT.test(body)) flags.push({ file: c, line: lineNo, kind: "test skipped or focused", text: cut(body.trim(), 120) });
        if (DISABLE_PAT.test(body)) flags.push({ file: c, line: lineNo, kind: "lint or type check disabled", text: cut(body.trim(), 120) });
        if (TIMEOUT_PAT.test(body)) flags.push({ file: c, line: lineNo, kind: "timeout raised or retries added", text: cut(body.trim(), 120) });
        lineNo += 1;
      }
    }
  }
  out({ since, flags }, opts.json,
    flags.length ?
      flags.length + " possible test-tampering flag(s) since " + S(since) + ":\n" +
      flags.map((f) => f.file + (f.line ? ":" + f.line : "") + ": " + f.kind + " " + (f.text ? "— " + f.text : "")).join("\n") :
      "No test-tampering flags since " + S(since) + ".");
  return 0;
}

// ---------------------------------------------------------------- coverage

function latestResults(runs) {
  const last = {};
  for (const r of runs) {
    for (const row of r.results) {
      if (row.check && row.result) {
        last[row.check] = {
          result: row.result, build: toInt(r.fm.build, 0), run: r.n,
          date: cut(pystr(truthy(r.fm.started) ? r.fm.started : ""), 10),
        };
      }
    }
  }
  return last;
}

function cmdCoverage(ctx, pos, opts) {
  const areas = loadAreas(ctx);
  const runs = loadRuns(ctx);
  const last = latestResults(runs);
  const rows = [];
  for (const c of allChecks(areas)) {
    const l = last[c.id] || {};
    rows.push({
      check: c.id, area: c.area, risk: (c.fields.Risk || "").toLowerCase(),
      type: (c.fields.Type || "").toLowerCase(), result: l.result !== undefined ? l.result : "",
      build: l.build !== undefined ? l.build : "", run: l.run !== undefined ? l.run : "", date: l.date !== undefined ? l.date : "",
    });
  }
  const total = rows.length;
  const passed = rows.filter((r) => r.result === "pass" || r.result === "pass-human").length;
  const failed = rows.filter((r) => r.result === "fail" || r.result === "flaky").length;
  const never = rows.filter((r) => !r.result).length;
  const summary = { checks: total, passed, failed, never_run: never };
  const lines = ["# Coverage", "",
    "Generated by `qa coverage` on " + nowStr().slice(0, 10) + ". " + total + " checks · " + passed + " passed · " + failed + " failed · " + never + " never run.",
    "", "| Check | Area | Risk | Type | Last result | Build | Run | Date |", "|---|---|---|---|---|---|---|---|"];
  for (const r of rows) {
    lines.push("| " + r.check + " | " + r.area + " | " + r.risk + " | " + r.type + " | " + (r.result || "never run") + " | " + S(r.build) + " | " +
      (r.run !== "" ? pad3(r.run) : "") + " | " + r.date + " |");
  }
  if (ctx.exists()) wr(ctx.p("coverage.md"), lines.join("\n") + "\n");
  out(opts.json ? { summary, rows } : null, opts.json,
    "Coverage written: " + total + " checks, " + passed + " passed, " + failed + " failed, " + never + " never run.");
  return 0;
}

// ---------------------------------------------------------------- select

function costTotal(ln) {
  const m = Array.from(ln.matchAll(/\$\s*([0-9]+(?:\.[0-9]+)?)/g), (x) => x[1]);
  return m;
}

function calibratedCost(runs) {
  const vals = [];
  for (const r of runs.slice(-5)) {
    const lines = r.body.split("\n");
    const b = sectionBounds(lines, "Cost");
    if (!b) continue;
    let total = null;
    for (const ln of lines.slice(b[0], b[1])) {
      if (ln.trim().startsWith("|") && ln.toLowerCase().includes("total")) {
        const m = costTotal(ln);
        if (m.length) total = parseFloat(m[m.length - 1]);
      }
    }
    const agentChecks = r.results.filter((row) => ["pass", "fail", "flaky", "blocked"].includes(row.result)).length;
    if (total !== null && agentChecks) vals.push(total / agentChecks);
  }
  if (vals.length >= 2) {
    let s = 0;
    for (const v of vals) s += v;
    return s / vals.length;
  }
  return null;
}

function major(v) {
  const m = /(\d+)/.exec(pystr(truthy(v) ? v : ""));
  return m ? parseInt(m[1], 10) : null;
}

function packageMajorBumps(ctx, baseEntry) {
  const bumps = [];
  if (!ctx.git.ok || !baseEntry || (baseEntry.tree || "").startsWith("m")) return bumps;
  for (const pkg of ["package.json"]) {
    const old = ctx.git.showBytes(baseEntry.tree, pkg);
    if (old === null || !exists(pyjoin(ctx.root, pkg))) continue;
    let a, b;
    try {
      a = JSON.parse(STRICT.decode(old));
      b = JSON.parse(rd(pyjoin(ctx.root, pkg)));
    } catch (e) {
      if (e instanceof SyntaxError || e instanceof TypeError || (e && e.isValueError)) continue;
      throw e;
    }
    for (const sec of ["dependencies", "devDependencies"]) {
      const bs = truthy(b[sec]) ? b[sec] : {};
      for (const name of Object.keys(bs)) {
        const ver = bs[name];
        const ov = (truthy(a[sec]) ? a[sec] : {})[name];
        if (truthy(ov) && major(ov) !== null && major(ver) !== null && major(ver) > major(ov)) {
          bumps.push(name + " " + S(ov) + " → " + S(ver));
        }
      }
    }
  }
  return bumps;
}

function trackedCount(ctx) {
  if (ctx.git.ok) {
    const [, o] = ctx.git.run(["ls-files"]);
    let n = 0;
    for (const ln of splitlines(o)) {
      const c = ctx.git.toCwd(unquoteGit(ln));
      if (c !== null && !inQa(ctx, c)) n += 1;
    }
    return n;
  }
  return Object.keys(manifest(ctx, [ctx.qa])).length;
}

function cmpTuple(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function select(ctx, opts) {
  const plan = loadPlan(ctx);
  const areas = loadAreas(ctx);
  const checks = allChecks(areas);
  const byId = {};
  for (const c of checks) byId[c.id] = c;
  const runs = loadRuns(ctx);
  const reg = builds(ctx);
  const budget = truthy(opts.budget) ? opts.budget : setting(plan, "budget", "standard");
  const stage = setting(plan, "stage", "building");
  const quick = !!opts.quick;
  const head = reg.length ? reg[reg.length - 1] : null;
  const tested = testedBuilds(ctx, runs).filter((b) => !head || b !== head.build);
  const baseN = toInt(opts.base, tested.length ? tested[tested.length - 1] : null);
  const base = baseN ? buildEntry(ctx, baseN) : null;
  const headE = head ? buildEntry(ctx, head.build) : null;
  let changed = base && headE ? changedBetween(ctx, base, headE) : [];
  changed = changed.filter((f) => !inQa(ctx, f) && !AGENT_DIRS.some((d) => f === d || f.startsWith(d + "/")));
  const affected = {};
  const mapped = new Set();
  for (const a of areas) {
    const pats = areaPaths(a).filter((p) => p !== "*");
    if (!pats.length) continue;
    const hits = changed.filter((f) => matchAny(f, pats));
    if (hits.length) {
      affected[a.name] = hits;
      for (const h of hits) mapped.add(h);
    }
  }
  const docs = changed.filter((f) => !mapped.has(f) && /\.(md|mdx|txt|rst)$/i.test(f));
  const unmapped = changed.filter((f) => !mapped.has(f) && !docs.includes(f));
  const selected = {};
  const selOrder = [];

  const pick = (c, reason) => {
    if (!["agent", "auto"].includes((c.fields.Type || "").toLowerCase())) return;
    if (!Object.prototype.hasOwnProperty.call(selected, c.id)) { selected[c.id] = []; selOrder.push(c.id); }
    if (!selected[c.id].includes(reason)) selected[c.id].push(reason);
  };

  for (const c of checks) {
    if (tagsOf(c).includes("smoke")) pick(c, "smoke");
  }
  const bugs = loadBugs(ctx);
  const toVerify = bugs.filter((b) => b.fm.status === "fixed").map((b) => (b.fm.id !== undefined ? b.fm.id : null));
  for (const b of bugs) {
    if (b.fm.status !== "fixed") continue;
    const bid = b.fm.id !== undefined ? b.fm.id : "";
    const refs = new Set(Array.from((pystr(b.fm.found !== undefined ? b.fm.found : "") + " " + pystr(b.fm.check !== undefined ? b.fm.check : "")).matchAll(new RegExp(ANY_ID_SRC, "g")), (m) => m[1]));
    for (const c of checks) {
      if (refs.has(c.id) || (truthy(bid) && (c.fields.Source || "").includes(bid))) pick(c, "verify " + S(bid));
    }
  }
  const risks = quick ? ["high"] : (budget === "thorough" ? ["high", "medium", "low"] : ["high", "medium"]);
  for (const c of checks) {
    const inAff = Object.prototype.hasOwnProperty.call(affected, c.area);
    if (inAff && risks.includes((c.fields.Risk || "").toLowerCase())) pick(c, "changed area");
    else if (inAff && tagsOf(c).includes("regression")) pick(c, "regression in changed area");
  }
  const human = checks.filter((c) => Object.prototype.hasOwnProperty.call(affected, c.area) &&
    ["human", "device", "gate"].includes((c.fields.Type || "").toLowerCase())).map((c) => c.id);
  let rotationPct = toInt(setting(plan, "rotation", Object.prototype.hasOwnProperty.call(DEFAULT_ROTATION, stage) ? DEFAULT_ROTATION[stage] : 10), 10);
  if (budget === "thorough") rotationPct = Math.max(rotationPct, 25);
  if (budget === "lean" || quick || !base) rotationPct = 0;
  const pool = checks.filter((c) => ["agent", "auto"].includes((c.fields.Type || "").toLowerCase()));
  const last = latestResults(runs);
  const rotN = rotationPct ? Math.ceil(pool.length * rotationPct / 100.0) : 0;
  const candidates = pool.filter((c) => !Object.prototype.hasOwnProperty.call(selected, c.id))
    .sort((x, y) => cmpTuple([(last[x.id] || {}).run || 0, x.id], [(last[y.id] || {}).run || 0, y.id]));
  for (const c of candidates.slice(0, rotN)) pick(c, "rotation");
  const order = { high: 0, medium: 1, low: 2 };
  const key = (i) => [selected[i].includes("smoke") ? 0 : 1,
    Object.prototype.hasOwnProperty.call(order, (byId[i].fields.Risk || "").toLowerCase()) ? order[(byId[i].fields.Risk || "").toLowerCase()] : 3, i];
  let ids = selOrder.slice().sort((x, y) => cmpTuple(key(x), key(y)));
  if (quick) ids = ids.slice(0, 10);
  const wideReasons = [];
  const totalFiles = trackedCount(ctx);
  if (base && totalFiles && changed.length >= 10 && changed.length / totalFiles > 0.3) {
    wideReasons.push(changed.length + " of " + totalFiles + " files changed");
  }
  const buildFiles = changed.filter((f) => matchAny(f, WIDE_FILES));
  const bumps = packageMajorBumps(ctx, base);
  if (bumps.length) wideReasons.push("major upgrade: " + bumps.slice(0, 5).join(", "));
  else if (buildFiles.length) wideReasons.push("build or dependency files changed: " + buildFiles.slice(0, 5).join(", "));
  const agentN = ids.filter((i) => (byId[i].fields.Type || "").toLowerCase() === "agent").length;
  const per = calibratedCost(runs) || COST_PER_AGENT_CHECK;
  const testers = Math.max(1, toInt(setting(plan, "parallel_testers", 3), 3));
  const estUsd = round2(agentN * per * OVERHEAD);
  const estMin = agentN ? Math.ceil(agentN * 1.5 / testers) + 2 : 1;
  return {
    base: baseN, head: head ? head.build : null, no_baseline: base === null,
    changed, areas: affected, docs_changed: docs, unmapped,
    to_verify: toVerify, selected: ids.map((i) => ({
      id: i, area: byId[i].area, risk: (byId[i].fields.Risk || "").toLowerCase(),
      type: (byId[i].fields.Type || "").toLowerCase(), reasons: selected[i],
    })),
    human, wide: wideReasons.length > 0, wide_reasons: wideReasons,
    estimate: { agent_checks: agentN, auto_checks: ids.length - agentN, usd: new PyFloat(estUsd), minutes: estMin, calibrated: per !== COST_PER_AGENT_CHECK },
  };
}

function cmdSelect(ctx, pos, opts) {
  const r = select(ctx, opts);
  if (opts.json) {
    out(r, true);
    return 0;
  }
  const lines = [];
  if (r.no_baseline) {
    lines.push("No earlier tested build: this needs a baseline (setup or full). Smoke checks listed below.");
  } else {
    lines.push("Build " + S(r.base) + " → " + S(r.head) + ": " + r.changed.length + " file(s) changed in " + Object.keys(r.areas).length + " area(s)" +
      (r.unmapped.length ? " · unmapped: " + r.unmapped.slice(0, 6).join(", ") : ""));
  }
  lines.push("Selected " + r.selected.length + " checks (" + r.estimate.agent_checks + " agent, " + r.estimate.auto_checks + " auto) · ~$" +
    fmt2(r.estimate.usd.v) + " · ~" + r.estimate.minutes + " min");
  for (const s of r.selected) lines.push("  " + s.id + "  " + s.risk + " · " + s.type + " · " + s.reasons.join(", "));
  if (r.to_verify.length) lines.push("Fixes to verify: " + r.to_verify.map((x) => S(x)).join(", "));
  if (r.human.length) lines.push("Human checks in changed areas: " + r.human.join(", "));
  if (r.wide) lines.push("Wide change, consider a full pass: " + r.wide_reasons.join("; "));
  out(null, false, lines.join("\n"));
  return 0;
}

// ---------------------------------------------------------------- results

const RESULTS_HEADER = ["| Check | Result | Note | Evidence | Bug |", "|---|---|---|---|---|"];

function escCell(s) { return (s || "").replace(/\|/g, "\\|").replace(/\n/g, " "); }

function findRun(ctx, run) {
  if (!/^\d+$/.test(String(run).trim())) throw new QAError("Run numbers are whole numbers, like 7.", 2);
  const n = pyInt(run);
  for (const r of loadRuns(ctx)) {
    if (r.n === n) return r;
  }
  throw new QAError("No run file for run " + S(run) + " in " + ctx.qa + "/runs/.", 1);
}

function writeResults(r, rows) {
  const text = r.text;
  const [lines, body] = splitFm(text);
  let blines = body.split("\n");
  const table = RESULTS_HEADER.concat(rows.map((x) => "| " + escCell(x.check) + " | " + escCell(x.result_raw || x.result) + " | " +
    escCell(x.note) + " | " + escCell(x.evidence) + " | " + escCell(x.bug) + " |"));
  const b = sectionBounds(blines, "Results");
  if (b) {
    const [start, end] = b;
    const content = blines.slice(start, end);
    const first = content.findIndex((ln) => ln.trim().startsWith("|"));
    let newContent;
    if (first === -1) {
      newContent = [""].concat(table, [""]);
    } else {
      let last = first;
      while (last < content.length && content[last].trim().startsWith("|")) last++;
      newContent = content.slice(0, first).concat(table, content.slice(last));
    }
    blines = blines.slice(0, start).concat(newContent, blines.slice(end));
  } else {
    blines = blines.concat(["", "## Results"], table);
  }
  const newBody = blines.join("\n");
  if (lines !== null) return "---\n" + lines.join("\n") + "\n---\n" + newBody;
  return newBody;
}

function rank(result) {
  const i = WORST_FIRST.indexOf(result);
  return i !== -1 ? i : WORST_FIRST.length;
}

function cmdResults(ctx, pos, opts) {
  if (pos.length < 2 || pos[0] !== "merge") throw new QAError("usage: qa results merge <run>");
  const r = findRun(ctx, pos[1]);
  const folder = ctx.p("runs", pad3(r.n));
  const existing = new Map();
  for (const row of r.results) if (row.check) existing.set(row.check, row);
  const order = r.results.filter((row) => row.check).map((row) => row.check);
  const incoming = new Map();
  if (isdir(folder)) {
    for (const f of sortedStrs(listdir(folder))) {
      if (!f.endsWith(".md")) continue;
      for (const row0 of parseResults(splitFm(rd(pyjoin(folder, f)))[1])) {
        if (row0.check) {
          const row = Object.assign({}, row0);
          row.source = f.slice(0, -3);
          if (!incoming.has(row.check)) incoming.set(row.check, []);
          incoming.get(row.check).push(row);
        }
      }
    }
  }
  const merged = new Map(existing);
  for (const [cid, rows0] of incoming) {
    const rows = rows0.slice().sort((x, y) => rank(x.result) - rank(y.result));
    const best = Object.assign({}, rows[0]);
    const kinds = sortedStrs(Array.from(new Set(rows.map((x) => x.result))));
    if (kinds.length > 1 && kinds.includes("pass") && kinds.some((k) => k === "fail" || k === "flaky")) {
      best.note = (best.note ? best.note + " · " : "") + "disagreement: " + rows.map((x) => x.source + " " + x.result).join(", ");
    }
    delete best.source;
    if (merged.has(cid) && rank(merged.get(cid).result) < rank(best.result)) continue;
    merged.set(cid, best);
    if (!order.includes(cid)) order.push(cid);
  }
  const rows = sortedStrs(order).map((c) => merged.get(c));
  wr(r.path, writeResults(r, rows));
  const counts = {};
  for (const row of rows) counts[row.result] = (counts[row.result] || 0) + 1;
  out({ run: r.n, rows: rows.length, counts }, opts.json,
    "Merged " + rows.length + " result(s) into " + r.file + ": " +
    Object.keys(counts).sort().map((k) => k + " " + counts[k]).join(", "));
  return 0;
}

function cmdResult(ctx, pos, opts) {
  if (pos.length < 4 || pos[0] !== "add") throw new QAError("usage: qa result add <run> <check> <result> [--note …] [--evidence …] [--bug …]");
  const run = pos[1], check = pos[2], result = pos[3];
  const resWord = result.split(" ")[0].toLowerCase();
  if (!RESULTS.includes(resWord)) throw new QAError("result must be one of " + RESULTS.join(", "));
  const r = findRun(ctx, run);
  const rows = r.results.filter((row) => row.check !== check);
  const opt = (k) => (opts[k] !== true ? (opts[k] !== undefined ? opts[k] : "") : "");
  rows.push({ check, result: resWord, result_raw: result, note: opt("note"), evidence: opt("evidence"), bug: opt("bug") });
  rows.sort((x, y) => (x.check < y.check ? -1 : x.check > y.check ? 1 : 0));
  wr(r.path, writeResults(r, rows));
  out({ run: r.n, check, result }, opts.json, "Recorded " + check + " = " + result + " in " + r.file + ".");
  return 0;
}

// ---------------------------------------------------------------- run files

function fill(template, values) {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m0, g1) => {
    const k = g1.trim();
    if (Object.prototype.hasOwnProperty.call(values, k)) return pystr(values[k]);
    return "(fill in: " + k + ")";
  });
}

function cmdRun(ctx, pos, opts) {
  if (!pos.length || pos[0] !== "new") throw new QAError("usage: qa run new --mode <mode> [--budget <preset>]");
  const mode = truthy(opts.mode) ? opts.mode : "check";
  const plan = loadPlan(ctx);
  const n = nextRunN(ctx);
  const reg = builds(ctx);
  const b = reg.length ? reg[reg.length - 1] : { build: "", commit: "", head: "", tree: "" };
  const slug = pystr(mode).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "run";
  const p = ctx.p("runs", pad3(n) + "-" + slug + ".md");
  const tpl = rd(path.join(TEMPLATES, "qa", "runs", "_template.md"));
  const text = fill(tpl, {
    run: n, run3: pad3(n), mode, build: b.build, commit: cut(b.commit || "", 12),
    head: cut(b.head || "", 12), tree: cut(b.tree || "", 12), started: nowStr(),
    budget: truthy(opts.budget) ? opts.budget : setting(plan, "budget", "standard"),
  });
  wr(p, text);
  fs.mkdirSync(ctx.p("runs", pad3(n)), { recursive: true });
  const rel = slash(relpath(p, ctx.root));
  out({ run: n, path: rel, folder: slash(relpath(ctx.p("runs", pad3(n)), ctx.root)) }, opts.json, rel);
  return 0;
}

// ---------------------------------------------------------------- bugs

function bugPath(ctx, bid) {
  if (!BUG_ID_RE.test(bid || "")) throw new QAError("Bug IDs look like BUG-001.");
  const p = ctx.p("bugs", bid + ".md");
  if (!exists(p)) throw new QAError("No such bug: " + bid, 1);
  return p;
}

function cmdBug(ctx, pos, opts) {
  const sub = pos.length ? pos[0] : "";
  if (sub === "new") {
    const title = opts.title;
    if (!truthy(title) || title === true) {
      throw new QAError('usage: qa bug new --title "…" --area <area> [--severity S1-S4] [--priority …] [--found "…"] [--repro 3/3] [--check ID] [--tags a,b] [--status new]');
    }
    const plan = loadPlan(ctx);
    const sev = pystr(truthy(opts.severity) ? opts.severity : "S3").toUpperCase();
    if (!SEVERITIES.includes(sev)) throw new QAError("severity must be S1, S2, S3 or S4");
    const status = truthy(opts.status) ? opts.status : "new";
    if (!BUG_STATUSES.includes(status)) throw new QAError("status must be one of " + BUG_STATUSES.join(", "));
    const pri = truthy(opts.priority) ? opts.priority : defaultPriority(setting(plan, "stage", "building"), sev);
    if (!PRIORITIES.includes(pri)) throw new QAError("priority must be one of " + PRIORITIES.join(", "));
    const bid = nextBugId(ctx);
    const tpl = rd(path.join(TEMPLATES, "qa", "bugs", "_template.md"));
    let text = fill(tpl, {
      id: bid, title, severity: sev, priority: pri,
      found: truthy(opts.found) ? opts.found : "", repro: truthy(opts.repro) ? opts.repro : "1/1", area: truthy(opts.area) ? opts.area : "",
    });
    const upd = { title, status };
    if (truthy(opts.tags) && opts.tags !== true) upd.tags = opts.tags.split(",").map((t) => t.trim()).filter((t) => t);
    if (truthy(opts.check) && opts.check !== true) upd.check = opts.check;
    if (truthy(opts.source) && opts.source !== true) upd.source = opts.source;
    text = fmSet(text, upd);
    const p = ctx.p("bugs", bid + ".md");
    wr(p, text);
    const rel = slash(relpath(p, ctx.root));
    out({ id: bid, path: rel, priority: pri }, opts.json, bid + " " + rel);
    return 0;
  }
  if (sub === "set") {
    if (pos.length < 3) throw new QAError("usage: qa bug set BUG-001 key=value [key=value …]");
    const p = bugPath(ctx, pos[1]);
    const upd = {};
    for (const kv of pos.slice(2)) {
      const eq = kv.indexOf("=");
      if (eq === -1) throw new QAError("expected key=value, got '" + kv + "'");
      let k = kv.slice(0, eq);
      let v = kv.slice(eq + 1);
      k = k.trim();
      if (k === "status" && !BUG_STATUSES.includes(v)) throw new QAError("status must be one of " + BUG_STATUSES.join(", "));
      if (k === "severity" && !SEVERITIES.includes(v.toUpperCase())) throw new QAError("severity must be S1, S2, S3 or S4");
      if (k === "priority" && !PRIORITIES.includes(v)) throw new QAError("priority must be one of " + PRIORITIES.join(", "));
      if (k === "tags") v = v.replace(/^[\[\]]+|[\[\]]+$/g, "").split(",").map((t) => t.trim()).filter((t) => t);
      if (k === "severity") v = v.toUpperCase();
      upd[k] = v;
    }
    const before = parseFm(splitFm(rd(p))[0]);
    wr(p, fmSet(rd(p), upd));
    const changes = {};
    for (const k of Object.keys(upd)) changes[k] = [before[k] !== undefined ? before[k] : "", upd[k]];
    out({ id: pos[1], changes }, opts.json,
      pos[1] + ": " + Object.keys(changes).map((k) => k + " " + (fmtValue(changes[k][0]) || "(empty)") + " → " + fmtValue(changes[k][1])).join("; "));
    return 0;
  }
  if (sub === "log") {
    if (pos.length < 2) throw new QAError('usage: qa bug log BUG-001 --from <verifier notes> | --text "…"');
    const bid = pos[1];
    const p = bugPath(ctx, bid);
    let entry = !(opts.text === undefined || opts.text === null || opts.text === true) ? opts.text : null;
    if (entry === null) {
      const src = opts.from;
      if (!truthy(src) || src === true || !exists(src)) throw new QAError("--from must name the verifier's notes file");
      const lines = rd(src).split("\n");
      let inSec = false;
      const headRe = new RegExp("^###\\s+" + escRe(bid) + "\\b");
      for (const ln of lines) {
        if (headRe.test(ln)) {
          inSec = true;
          continue;
        }
        if (inSec && /^#{1,3}\s/.test(ln)) break;
        const m = inSec ? /^\s*-\s*Log:\s*([^\n]+)$/.exec(ln) : null;
        if (m) {
          entry = m[1].trim();
          break;
        }
      }
      if (entry === null) throw new QAError("No '- Log:' line under '### " + bid + "' in " + src, 1);
    }
    let text = rd(p);
    let lines = text.split("\n");
    const b = sectionBounds(lines, "Verification log");
    const newLine = "- " + entry;
    if (!b) {
      lines = lines.concat(["", "## Verification log", newLine]);
    } else {
      const [start, end] = b;
      const content = lines.slice(start, end).filter((ln) => !/^\(written (from|by) the verifier/.test(ln.trim()));
      while (content.length && !content[content.length - 1].trim()) content.pop();
      content.push(newLine);
      lines = lines.slice(0, start).concat(content, end < lines.length ? [""] : [], lines.slice(end));
    }
    text = lines.join("\n");
    wr(p, text.endsWith("\n") ? text : text + "\n");
    out({ id: bid, logged: entry }, opts.json, "Logged on " + bid + ": " + entry);
    return 0;
  }
  throw new QAError("usage: qa bug new|set|log …");
}

// ---------------------------------------------------------------- status

function runCounts(r) {
  const c = {};
  for (const row of r.results) c[row.result] = (c[row.result] || 0) + 1;
  return c;
}

function sectionItems(body, title) {
  const lines = body.split("\n");
  const b = sectionBounds(lines, title);
  if (!b) return [];
  return lines.slice(b[0], b[1]).filter((ln) => /^\s*-\s*\[[ xX]\]/.test(ln)).map((ln) => ln.trimEnd());
}

function statusData(ctx) {
  if (!ctx.exists()) {
    return {
      qa: false, qa_dir: ctx.qa, git: ctx.git.ok,
      message: "No " + ctx.qa + "/ folder yet: run setup (`/enhance-qa` or `$enhance-qa`).",
    };
  }
  const plan = loadPlan(ctx);
  const areas = loadAreas(ctx);
  const checks = allChecks(areas);
  const bugs = loadBugs(ctx);
  const runs = loadRuns(ctx);
  const reg = builds(ctx);
  const last = runs.length ? runs[runs.length - 1] : null;
  const openBugs = bugs.filter((b) => OPEN_STATUSES.includes(b.fm.status));
  const sev = {};
  for (const s of SEVERITIES) sev[s] = openBugs.filter((b) => b.fm.severity === s).map((b) => b.fm.id);
  const tested = testedBuilds(ctx, runs);
  const lastTested = tested.length ? buildEntry(ctx, tested[tested.length - 1]) : null;
  let codeChanged = null;
  if (lastTested) {
    const [tree, man] = currentTree(ctx, false);
    if (man !== null) codeChanged = changedBetween(ctx, lastTested, { tree, manifest: man }).length > 0;
    else codeChanged = tree !== lastTested.tree;
  }
  const lock = ctx.loadJson("lock.json", null);
  const phase = ctx.loadJson("phase.json", null);
  const human = (last ? last.results : []).filter((row) => row.result === "human-pending").map((row) => row.check);
  const byType = {};
  for (const t of TYPES) byType[t] = checks.filter((c) => (c.fields.Type || "").toLowerCase() === t).length;
  const interrupted = last ? (truthy(last.fm.interrupted) ? last.fm.interrupted : "no") : null;
  return {
    qa: true, qa_dir: ctx.qa, git: ctx.git.ok, app: plan.app !== undefined ? plan.app : "", stage: plan.stage !== undefined ? plan.stage : "",
    autonomy: plan.autonomy !== undefined ? plan.autonomy : "", budget: plan.budget !== undefined ? plan.budget : "",
    checks: { total: checks.length, by_type: byType, areas: areas.length, questions: checks.filter((c) => c.fields.Question).map((c) => c.id) },
    bugs: {
      open: openBugs.length, by_severity: sev,
      awaiting_verification: bugs.filter((b) => b.fm.status === "fixed").map((b) => b.fm.id),
      needs_decision: bugs.filter((b) => b.fm.status === "needs-decision").map((b) => b.fm.id),
      fix_now: openBugs.filter((b) => b.fm.priority === "fix-now" && ["open", "reopened"].includes(b.fm.status)).map((b) => b.fm.id),
    },
    last_run: last ? {
      run: last.n, mode: last.mode, build: last.fm.build, verdict: last.fm.verdict !== undefined ? last.fm.verdict : "",
      started: last.fm.started !== undefined ? last.fm.started : "", finished: last.fm.finished !== undefined ? last.fm.finished : "",
      interrupted, progress: last.fm.progress !== undefined ? last.fm.progress : "",
      file: last.file, counts: runCounts(last),
    } : null,
    builds: { latest: reg.length ? reg[reg.length - 1].build : null, last_tested: tested.length ? tested[tested.length - 1] : null },
    code_changed_since_last_tested: codeChanged,
    human_pending: human,
    lock, phase: truthy(phase) ? withoutManifest(phase) : null,
  };
}

function bugTitle(bugs, bid) {
  for (const b of bugs) {
    if (b.fm.id === bid) return b.fm.title !== undefined ? b.fm.title : "";
  }
  return "";
}

function renderStatus(ctx) {
  const d = statusData(ctx);
  const bugs = loadBugs(ctx);
  const areas = loadAreas(ctx);
  const checks = {};
  for (const c of allChecks(areas)) checks[c.id] = c;
  const runs = loadRuns(ctx);
  const last = runs.length ? runs[runs.length - 1] : null;
  const app = truthy(d.app) ? d.app : path.basename(ctx.root);
  const L = ["<!-- enhance-qa: generated by `qa status --write`. Tick a box, or write \"→ your answer\" after an item. -->"];
  if (!last) {
    L.push("# QA status · " + S(app), "No passes yet. Run `/enhance-qa` (Claude Code) or `$enhance-qa` (Codex) to start.");
    return L.join("\n") + "\n";
  }
  const when = pystr(truthy(last.fm.finished) ? last.fm.finished : (truthy(last.fm.started) ? last.fm.started : ""));
  L.push("# QA status · Build " + S(last.fm.build !== undefined ? last.fm.build : "?") + " · " + when.replace(/T/g, " "));
  const verdict = pystr(truthy(last.fm.verdict) ? last.fm.verdict : "Not assessed yet");
  const ob = d.bugs.by_severity;
  const bits = [];
  for (const s of ["S1", "S2", "S3"]) {
    if (ob[s].length) bits.push(ob[s].length + " " + SEV_NAMES[s].split(" ")[1] + " open");
  }
  let cost = "";
  const lines = last.body.split("\n");
  const b = sectionBounds(lines, "Cost");
  if (b) {
    for (const ln of lines.slice(b[0], b[1])) {
      if (ln.toLowerCase().includes("total")) {
        const m = costTotal(ln);
        if (m.length) cost = ", ~$" + m[m.length - 1];
      }
    }
  }
  L.push("**Verdict: " + verdict.replace(/\.+$/, "") + ".** " + (bits.join(" · ") || "No open bugs above cosmetic") + " · last pass: " + S(last.mode) + cost);
  const intr = truthy(last.fm.interrupted) ? last.fm.interrupted : "no";
  if (pystr(intr) !== "no") {
    L.push("");
    L.push("> The last run was interrupted (" + S(last.fm.interrupted) + "). Run `/enhance-qa` again to resume it.");
  }
  L.push("", "## Needs you");
  const items = sectionItems(last.body, "Needs you");
  const mentioned = new Set(Array.from(items.join(" ").matchAll(new RegExp(ANY_ID_SRC, "g")), (m) => m[1]));
  for (const bid of d.bugs.needs_decision) {
    if (!mentioned.has(bid)) items.push("- [ ] " + S(bid) + " " + S(bugTitle(bugs, bid)) + ": decide (bug, by design, defer or won't fix)");
  }
  for (const cid of d.checks.questions) {
    if (!mentioned.has(cid)) items.push("- [ ] " + cid + " " + S(checks[cid].fields.Question !== undefined ? checks[cid].fields.Question : ""));
  }
  if (items.length) L.push(...items); else L.push("Nothing right now.");
  L.push("", "## Open bugs");
  const openRows = bugs.filter((x) => OPEN_STATUSES.includes(x.fm.status) && ["S1", "S2", "S3"].includes(x.fm.severity))
    .sort((x, y) => cmpTuple([S(x.fm.severity), S(x.fm.id)], [S(y.fm.severity), S(y.fm.id)]));
  if (openRows.length) {
    L.push("| Severity | Bug | Area | Status |", "|---|---|---|---|");
    for (const x of openRows) {
      const st = x.fm.status;
      L.push("| " + (Object.prototype.hasOwnProperty.call(SEV_NAMES, x.fm.severity) ? SEV_NAMES[x.fm.severity] : S(x.fm.severity)) + " | [" + S(x.fm.id) + "](bugs/" + S(x.fm.id) + ".md) " +
        escCell(pystr(x.fm.title !== undefined ? x.fm.title : "")) + " | " + S(x.fm.area !== undefined ? x.fm.area : "") + " | " + (st === "fixed" ? "fixed, awaiting verification" : S(st)) + " |");
    }
  } else {
    L.push("None above cosmetic.");
  }
  const s4 = bugs.filter((x) => OPEN_STATUSES.includes(x.fm.status) && x.fm.severity === "S4").map((x) => x.fm.id);
  if (s4.length) L.push("", "Cosmetic (S4): " + s4.length + " open: " + s4.map((x) => S(x)).join(", "));
  L.push("", "## Human checks for this build");
  const hp = last.results.filter((row) => row.result === "human-pending").map((row) => row.check);
  if (hp.length) L.push(...hp.map((cid) => "- [ ] " + cid + " " + (cid in checks ? checks[cid].title : ""))); else L.push("None pending.");
  L.push("", "## Coverage by area", "| Area | Checks | Passed | Failed | Not run yet | Last run |", "|---|---|---|---|---|---|");
  const latest = latestResults(runs);
  for (const a of areas) {
    const ids = a.checks.filter((c) => !c.fields.Retired).map((c) => c.id);
    const res = ids.map((i) => latest[i] || {});
    const buildsSeen = res.filter((r_) => r_.build).map((r_) => r_.build);
    L.push("| " + a.name + " | " + ids.length + " | " + res.filter((r_) => r_.result === "pass" || r_.result === "pass-human").length + " | " +
      res.filter((r_) => r_.result === "fail" || r_.result === "flaky").length + " | " + res.filter((r_) => !r_.result).length + " | " +
      (buildsSeen.length ? "build " + Math.max(...buildsSeen) : "—") + " |");
  }
  L.push("", "## Recent runs", "| Run | Build | Pass | Result |", "|---|---|---|---|");
  for (const r of runs.slice().reverse().slice(0, 5)) {
    const c = runCounts(r);
    let newBugs = 0;
    for (const ln of r.body.split("\n")) {
      if (/^\s*-\s*New:/.test(ln)) newBugs += (ln.match(/BUG-\d{3,}/g) || []).length;
    }
    let summary = ((c.pass || 0) + (c["pass-human"] || 0)) + " passed, " + ((c.fail || 0) + (c.flaky || 0)) + " failed";
    if (newBugs) summary += ", " + newBugs + " new bug" + (newBugs === 1 ? "" : "s");
    L.push("| [" + pad3(r.n) + "](runs/" + path.basename(r.path) + ") | " + S(r.fm.build !== undefined ? r.fm.build : "") + " | " + S(r.mode) + " | " + summary + " |");
  }
  return L.join("\n") + "\n";
}

function ingestItems(ctx) {
  const p = ctx.p("STATUS.md");
  if (!exists(p)) return [[], ""];
  const text = rd(p);
  const items = [];
  const lines = text.split("\n");
  for (let i = 1; i <= lines.length; i++) {
    const m = /^\s*-\s*\[( |x|X)\]\s*([^\n]*)$/.exec(lines[i - 1]);
    if (!m) continue;
    let rest = m[2];
    const ticked = m[1].toLowerCase() === "x";
    let answer = null;
    for (const arrow of ["→", "->"]) {
      const at = rest.indexOf(arrow);
      if (at !== -1) {
        answer = rest.slice(at + arrow.length).trim();
        rest = rest.slice(0, at);
        break;
      }
    }
    const idm = new RegExp(ANY_ID_SRC).exec(rest);
    if (ticked || truthy(answer)) {
      const iid = idm ? idm[1] : "";
      items.push({
        line: i, id: iid, kind: iid.startsWith("BUG-") ? "bug" : (iid ? "check" : "other"),
        ticked, answer, text: rest.trim(),
      });
    }
  }
  return [items, text];
}

function cmdIngest(ctx, pos, opts) {
  const [items, text] = ingestItems(ctx);
  if (opts.done) {
    ctx.saveJson("ingested.json", { hash: sha(text, 32), at: nowStr() });
    out({ done: true, items: items.length }, opts.json, "Marked " + items.length + " answer(s) as applied.");
    return 0;
  }
  out({ items }, opts.json,
    items.map((it) => (it.ticked ? "[x] " : "[ ] ") + cut(it.text, 70) + (it.answer ? " → " + it.answer : "")).join("\n") || "No ticks or answers in STATUS.md.");
  return 0;
}

function cmdStatus(ctx, pos, opts) {
  if (opts.write) {
    if (!ctx.exists()) throw new QAError("No " + ctx.qa + "/ folder. Run `qa init` first.", 1);
    const [items, text] = ingestItems(ctx);
    let saved = null;
    if (items.length && ctx.loadJson("ingested.json", {}).hash !== sha(text, 32)) {
      saved = ctx.state("answers-" + nowStr().replace(/:/g, "").replace(/-/g, "") + ".json");
      wr(saved, pyDumps(items, { indent: 2, ensureAscii: false }));
    }
    wr(ctx.p("STATUS.md"), renderStatus(ctx));
    let msg = "Wrote " + ctx.qa + "/STATUS.md.";
    if (saved) msg += " Unapplied answers were saved to " + slash(relpath(saved, ctx.root)) + ": run `qa ingest` and apply them.";
    out({ written: true, unapplied_answers_saved: saved ? slash(relpath(saved, ctx.root)) : null }, opts.json, msg);
    return 0;
  }
  const d = statusData(ctx);
  if (opts.json) {
    out(d, true);
    return 0;
  }
  if (!d.qa) {
    out(null, false, d.message);
    return 0;
  }
  const lr = d.last_run;
  const lines = [(truthy(d.app) ? S(d.app) : "this project") + " · stage " + (truthy(d.stage) ? S(d.stage) : "?") + " · autonomy " + (truthy(d.autonomy) ? S(d.autonomy) : "?")];
  if (lr) {
    lines.push("Last run " + pad3(lr.run) + " (" + S(lr.mode) + ", build " + S(lr.build) + "): " + (truthy(lr.verdict) ? S(lr.verdict) : "no verdict"));
    if (lr.interrupted !== "no") lines.push("Interrupted: " + S(lr.interrupted) + " → run again to resume");
  } else {
    lines.push("No runs yet.");
  }
  const sv = d.bugs.by_severity;
  lines.push("Open bugs: " + d.bugs.open + " (S1 " + sv.S1.length + " · S2 " + sv.S2.length + " · S3 " + sv.S3.length + " · S4 " + sv.S4.length +
    ") · awaiting verification: " + (d.bugs.awaiting_verification.map((x) => S(x)).join(", ") || "none") + " · needs decision: " + (d.bugs.needs_decision.map((x) => S(x)).join(", ") || "none"));
  lines.push("Checks: " + d.checks.total + " in " + d.checks.areas + " areas · questions waiting: " + d.checks.questions.length);
  if (d.code_changed_since_last_tested !== null) {
    lines.push("Code changed since the last tested build: " + (d.code_changed_since_last_tested ? "yes" : "no"));
  }
  if (truthy(d.lock)) lines.push("Locked by run " + S(d.lock.run !== undefined ? d.lock.run : "?") + " since " + S(d.lock.started));
  out(null, false, lines.join("\n"));
  return 0;
}

// ---------------------------------------------------------------- init

function cmdInit(ctx, pos, opts) {
  const created = [];
  let app = !(opts.app === undefined || opts.app === null || opts.app === true) ? opts.app : null;
  if (!truthy(app)) {
    const pkg = pyjoin(ctx.root, "package.json");
    if (exists(pkg)) {
      try {
        app = JSON.parse(rd(pkg)).name;
        if (app === undefined) app = null;
      } catch (e) {
        if (e instanceof SyntaxError || (e && e.isValueError)) app = null;
        else throw e;
      }
    }
    app = truthy(app) ? app : path.basename(ctx.root);
  }
  for (const d of ["", "checklist", "bugs", "runs", "evidence", ".state"]) {
    const p = d ? ctx.p(d) : ctx.qa_abs;
    if (!isdir(p)) {
      fs.mkdirSync(p, { recursive: true });
      created.push(slash(relpath(p, ctx.root)) + "/");
    }
  }
  for (const name of ["README.md", "STATUS.md", "plan.md", "notes.md", "coverage.md"]) {
    const dst = ctx.p(name);
    if (!exists(dst)) {
      wr(dst, fill(rd(path.join(TEMPLATES, "qa", name)), { app }));
      created.push(slash(relpath(dst, ctx.root)));
    }
  }
  const gi = pyjoin(ctx.root, ".gitignore");
  const want = [ctx.qa + "/evidence/", ctx.qa + "/.state/"];
  let raw = Buffer.alloc(0);
  if (exists(gi)) raw = fs.readFileSync(gi);
  const have = new Set(splitlines(raw.toString("utf8")).map((ln) => ln.trim()));
  const missing = want.filter((w) => !have.has(w) && !have.has(w.replace(/\/+$/, "")));
  if (missing.length) {
    const nl = raw.includes(Buffer.from("\r\n")) ? "\r\n" : "\n";
    const endsNl = raw.length > 0 && raw[raw.length - 1] === 10;
    const add = (raw.length === 0 || endsNl ? "" : nl) + ["# enhance-qa: evidence and local state"].concat(missing).join(nl) + nl;
    fs.appendFileSync(gi, Buffer.from(add, "utf8"));
    created.push(".gitignore (+" + missing.join(", ") + ")");
  }
  out({ created, app }, opts.json, created.length ? "Created: " + created.join(", ") : ctx.qa + "/ already set up; nothing to do.");
  return 0;
}

// ---------------------------------------------------------------- redact

const REDACT_PATTERNS = [
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g],
  ["aws-key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
  ["slack-token", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g],
  ["stripe-key", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}\b|\bwhsec_[A-Za-z0-9]{10,}\b/g],
  ["anthropic-key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g],
  ["openai-key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ["google-key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ["jwt", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
  ["url-credentials", /(?<=:\/\/)[^/\s:@]+:[^/\s@]+(?=@)/g],
];
const REDACT_KV = /((?:"|')?(?:password|passwd|pwd|secret|client_secret|api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|session[_-]?id|token)(?:"|')?\s*[:=]\s*)("[^"\n]*"|'[^'\n]*'|[^\s,&;"']+)/gi;
const REDACT_HEADER = /^(\s*(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key)\s*:\s*)([^\n]+)$/gim;
const EMAIL = /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,}|localhost)\b/g;
const CARD = /\b(?:\d[ -]?){12,18}\d\b/g;

function luhn(digits) {
  let total = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    total += d;
    alt = !alt;
  }
  return total % 10 === 0;
}

function redactText(s) {
  const counts = {};
  const bump = (k, n = 1) => { counts[k] = (counts[k] || 0) + n; };
  for (const [kind, rx] of REDACT_PATTERNS) {
    let n = 0;
    s = s.replace(rx, () => { n++; return "[REDACTED:" + kind + "]"; });
    if (n) bump(kind, n);
  }
  s = s.replace(REDACT_KV, (m0, g1, g2) => {
    if (g2.startsWith("[REDACTED")) return m0;
    bump("secret-field");
    const q = g2[0] === '"' || g2[0] === "'" ? g2[0] : "";
    return g1 + q + "[REDACTED]" + q;
  });
  s = s.replace(REDACT_HEADER, (m0, g1) => {
    bump("header");
    return g1 + "[REDACTED]";
  });
  s = s.replace(EMAIL, (m0, g1, g2) => {
    const dom = g2.toLowerCase();
    if (SAFE_EMAIL_DOMAINS.includes(dom) || SAFE_EMAIL_SUFFIXES.some((x) => dom.endsWith(x)) || g1.toLowerCase().startsWith("qa-")) return m0;
    bump("email");
    return "[REDACTED:email]";
  });
  s = s.replace(CARD, (m0) => {
    const digits = m0.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits) && !TEST_CARDS.has(digits)) {
      bump("card");
      return "[REDACTED:card]";
    }
    return m0;
  });
  return [s, counts];
}

function walkFiles(top, acc) {
  let ents;
  try { ents = fs.readdirSync(top, { withFileTypes: true }); } catch (e) { return; }
  for (const ent of ents) {
    const full = pyjoin(top, ent.name);
    let isD = ent.isDirectory();
    if (!isD && ent.isSymbolicLink()) {
      try { if (fs.statSync(full).isDirectory()) continue; } catch (e) { /* broken link: a file */ }
    }
    if (isD) walkFiles(full, acc); else acc.push(full);
  }
}

function cmdRedact(ctx, pos, opts) {
  if (!pos.length) throw new QAError("usage: qa redact <file or folder> … [--check]");
  const files = [];
  for (const p of pos) {
    if (isdir(p)) walkFiles(p, files);
    else if (exists(p)) files.push(p);
  }
  const report = [];
  let total = 0;
  for (const f of files.sort()) {
    let raw;
    try {
      raw = fs.readFileSync(f);
    } catch (e) {
      continue;
    }
    if (raw.subarray(0, 8000).includes(0)) continue;
    let text;
    try {
      text = STRICT.decode(raw);
    } catch (e) {
      report.push({ file: slash(f), skipped: "not UTF-8 text" });
      continue;
    }
    const [nw, counts] = redactText(text);
    if (Object.keys(counts).length) {
      const n = Object.values(counts).reduce((a, b) => a + b, 0);
      total += n;
      report.push({ file: slash(f), found: counts });
      if (!opts.check) fs.writeFileSync(f, Buffer.from(nw, "utf8"));
    }
  }
  out({ files: report, total, changed: !opts.check }, opts.json,
    report.map((r) => r.file + ": " + (r.skipped || Object.keys(r.found).sort().map((k) => k + " " + r.found[k]).join(", "))).join("\n") +
    (report.length ? "\n" : "") + total + " item(s) " + (opts.check ? "found" : "redacted") + ".");
  return opts.check && total ? 1 : 0;
}

// ---------------------------------------------------------------- export

function exportRows(ctx) {
  const areas = loadAreas(ctx);
  const last = latestResults(loadRuns(ctx));
  const checks = [];
  for (const c of allChecks(areas, true)) {
    const f = c.fields;
    const l = last[c.id] || {};
    checks.push([c.id, c.area, c.title, f.Risk || "", f.Type || "", f.Tags || "",
      f.Steps || f.Command || "", f.Expect || "", f.Source || "",
      f.Retired ? "retired" : "", l.result !== undefined ? l.result : "", l.build !== undefined ? l.build : ""]);
  }
  const bugs = [];
  const g = (fm, k) => (fm[k] !== undefined ? fm[k] : "");
  for (const b of loadBugs(ctx)) {
    const fm = b.fm;
    bugs.push([g(fm, "id"), g(fm, "title"), g(fm, "status"), g(fm, "severity"), g(fm, "priority"), g(fm, "area"), g(fm, "found"), g(fm, "repro")]);
  }
  return [checks, bugs];
}

const CHECK_COLS = ["ID", "Area", "Title", "Risk", "Type", "Tags", "Steps", "Expect", "Source", "Retired", "Last result", "Last build"];
const BUG_COLS = ["ID", "Title", "Status", "Severity", "Priority", "Area", "Found", "Repro"];

function htmlEscape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

function csvRow(cells) {
  return cells.map((x) => {
    const s = pystr(x);
    return /[,"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(",") + "\r\n";
}

function cmdExport(ctx, pos, opts) {
  const kind = pos.length ? pos[0] : "";
  const outdir = !(opts.out === undefined || opts.out === null || opts.out === true) ? opts.out : ctx.p("exports");
  fs.mkdirSync(outdir, { recursive: true });
  const [checks, bugs] = exportRows(ctx);
  const written = [];
  if (kind === "csv") {
    for (const [name, cols, rows] of [["checklist.csv", CHECK_COLS, checks], ["bugs.csv", BUG_COLS, bugs]]) {
      const p = pyjoin(outdir, name);
      let text = "﻿" + csvRow(cols);
      for (const r of rows) text += csvRow(r.map((x) => pystr(x)));
      fs.writeFileSync(p, Buffer.from(text, "utf8"));
      written.push(p);
    }
  } else if (kind === "html") {
    const p = pyjoin(outdir, "qa-report.html");
    const d = statusData(ctx);
    const table = (cols, rows) => "<table><thead><tr>" + cols.map((c) => "<th>" + htmlEscape(c) + "</th>").join("") + "</tr></thead><tbody>" +
      rows.map((r) => "<tr>" + r.map((x) => "<td>" + htmlEscape(pystr(x)) + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
    const lr = truthy(d.last_run) ? d.last_run : {};
    const g = (k) => (lr[k] !== undefined ? lr[k] : "");
    const doc = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
      "<title>QA report</title><style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;color:#1b1b1f;background:#fff}" +
      "h1{font-size:22px}h2{font-size:17px;margin-top:28px}table{border-collapse:collapse;width:100%;font-size:13px}" +
      "th,td{border:1px solid #d9d9e0;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f4f4f7}" +
      "@media (prefers-color-scheme:dark){body{background:#16161a;color:#e8e8ee}th{background:#24242b}th,td{border-color:#3a3a44}}</style></head><body>" +
      "<h1>QA report · " + htmlEscape(pystr(truthy(d.app) ? d.app : path.basename(ctx.root))) + "</h1><p>Generated " + htmlEscape(nowStr()) + " · last run " +
      htmlEscape(truthy(lr) ? pad3(lr.run) : "—") + " (" + htmlEscape(pystr(g("mode"))) + ", build " + htmlEscape(pystr(g("build"))) + "): <strong>" +
      htmlEscape(pystr(truthy(g("verdict")) ? g("verdict") : "no verdict")) + "</strong></p>" +
      "<h2>Bugs</h2>" + table(BUG_COLS, bugs) + "<h2>Checklist</h2>" + table(CHECK_COLS, checks) + "</body></html>";
    wr(p, doc);
    written.push(p);
  } else if (kind === "xlsx") {
    throw new QAError("xlsx export needs Python with openpyxl: run `python <skill>/scripts/qa.py export xlsx`, or use `qa export csv` (opens in Excel too).", 1);
  } else {
    throw new QAError("usage: qa export csv|html|xlsx [--out DIR]");
  }
  const rel = written.map((p) => slash(relpath(p, ctx.root)));
  out({ written: rel }, opts.json, "Wrote " + rel.join(", "));
  return 0;
}

// ---------------------------------------------------------------- hooks

const GIT_WRITE = /\bgit\s+(?:-C\s+\S+\s+)?(commit|add|push|reset|checkout|restore|rebase|merge|stash|cherry-pick|revert|rm|mv|tag|clean|apply|am|switch|update-ref|filter-branch|branch\s+-[dDmM])\b/;
const GIT_FIXER_DENY = /\bgit\s+(?:-C\s+\S+\s+)?(push|rebase|filter-branch|update-ref|switch|clean\s+-[a-z]*f|reset\s+--hard|commit\s+[^|;&]*--amend|checkout\s+(?!--)\S+\s*$|branch\s+-[dDmM])/;

function roleFromAgent(agentType) {
  const m = /enhance[-_]qa[-_](scout|tester|verifier|fixer)$/.exec(agentType || "");
  return m ? m[1] : null;
}

function hookPaths(data, cwd) {
  const tiRaw = data.tool_input;
  const ti = truthy(tiRaw) ? tiRaw : {};
  if (!isDict(ti)) throw new Error("tool_input is not an object");
  const paths = [];
  for (const k of ["file_path", "notebook_path", "path"]) {
    if (typeof ti[k] === "string") paths.push(ti[k]);
  }
  for (const v of Object.values(ti)) {
    if (typeof v === "string" && v.includes("*** ")) {
      for (const m of v.matchAll(/^\*\*\* (?:Add|Update|Delete) File: ([^\n]+)$/gm)) paths.push(m[1]);
      for (const m of v.matchAll(/^\*\*\* Move to: ([^\n]+)$/gm)) paths.push(m[1]);
    }
  }
  const res = [];
  for (let p of paths) {
    p = p.trim();
    const ap = path.isAbsolute(p) ? p : pyjoin(cwd, p);
    const rel = relpath(path.normalize(ap), path.normalize(cwd));
    res.push(slash(rel));
  }
  return res;
}

function deny(reason) {
  stdout(pyDumps({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }) + "\n");
  return 0;
}

function readStdin() {
  try {
    if (process.stdin.isTTY) return "";
    return new TextDecoder("utf-8").decode(fs.readFileSync(0));
  } catch (e) {
    return null;
  }
}

function cmdHook(ctx, pos, opts) {
  const kind = pos.length ? pos[0] : "";
  let data;
  const raw = readStdin();
  if (raw === null) return 0;
  try {
    data = raw.trim() ? JSON.parse(raw) : {};
  } catch (e) {
    return 0;
  }
  if (!isDict(data)) throw new Error("hook input is not an object");
  const cwdv = truthy(data.cwd) ? data.cwd : (process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const cwd = pystr(cwdv);
  const qa = slash(truthy(process.env.QA_DIR) ? process.env.QA_DIR : "qa").replace(/\/+$/, "");
  const phaseFile = pyjoin(cwd, qa, ".state", "phase.json");
  if (!exists(phaseFile)) return 0;
  let ph;
  try {
    ph = JSON.parse(rd(phaseFile));
  } catch (e) {
    return 0;
  }
  if (!isDict(ph)) throw new Error("phase is not an object");
  const t = parseTime(ph.started);
  if (t === null || (nowDt() - t) / 1000 > STALE_PHASE_HOURS * 3600) return 0;
  const role = roleFromAgent(truthy(data.agent_type) ? data.agent_type : "");
  if (kind === "pre-tool-use") {
    const tool = truthy(data.tool_name) ? data.tool_name : "";
    const tiv = truthy(data.tool_input) ? data.tool_input : {};
    if (!isDict(tiv)) throw new Error("tool_input is not an object");
    if (["Bash", "PowerShell", "shell", "exec_command"].includes(tool) ||
      (typeof tiv.command === "string" && !["Edit", "Write", "MultiEdit", "NotebookEdit", "apply_patch"].includes(tool))) {
      const cmd = pystr(truthy(tiv.command) ? tiv.command : "");
      if (["tester", "verifier", "scout"].includes(role) && GIT_WRITE.test(cmd)) {
        return deny("enhance-qa: the " + role + " role doesn't change git state. Report what you found instead.");
      }
      if (role === "fixer" && GIT_FIXER_DENY.test(cmd)) {
        return deny("enhance-qa: the fixer never pushes, rewrites history, switches branches or forces anything.");
      }
      if (!cmd.includes("*** ")) return 0;
    }
    const paths = hookPaths(data, cwd);
    if (!paths.length) return 0;
    const protectedPats = [qa + "/checklist/**", qa + "/plan.md"];
    for (const p of paths) {
      if (p.startsWith("..")) {
        if (role) return deny("enhance-qa: " + role + " may only edit files inside the project.");
        continue;
      }
      if (role === null) {
        if (!["scout", "lead"].includes(ph.role) && matchAny(p, protectedPats)) {
          return deny("enhance-qa: a QA " + S(ph.role) + " phase is running, so the checklist and plan are locked until it ends (`qa phase end`). Edit them after the phase.");
        }
        continue;
      }
      const allowed = rolePatterns(ALLOWED, role, qa), denied = rolePatterns(DENIED, role, qa);
      if (matchAny(p, denied) || !matchAny(p, allowed)) {
        return deny("enhance-qa: the " + role + " role may not edit " + p + ". Allowed: " + allowed.join(", ") + ".");
      }
    }
    return 0;
  }
  if (kind === "subagent-stop") {
    if (truthy(data.stop_hook_active) || !["tester", "verifier"].includes(role)) return 0;
    const lam = truthy(data.last_assistant_message) ? data.last_assistant_message : "";
    if (typeof lam !== "string") throw new Error("message is not a string");
    const msg = slash(lam);
    const m = new RegExp("(" + escRe(qa) + "/runs/\\d{3,}/(?:tester|verifier)-\\d+\\.md)").exec(msg);
    const notes = m ? pyjoin(cwd, m[1]) : null;
    if (!notes || !exists(notes)) {
      stdout(pyDumps({ decision: "block", reason: "enhance-qa: write your notes file (qa/runs/<run>/" + role + "-<k>.md) with your results and evidence, then finish with its path." }) + "\n");
      return 0;
    }
    const gaps = [];
    for (const row of parseResults(splitFm(rd(notes))[1])) {
      if (["pass", "fail", "flaky"].includes(row.result) && !row.evidence && !hasQuote(row.note)) gaps.push(row.check);
    }
    if (gaps.length) {
      stdout(pyDumps({ decision: "block", reason: "enhance-qa: these results have no evidence: " + gaps.join(", ") + ". Add evidence (a file under qa/evidence/ or a quoted observation) or mark them not-run, then finish." }) + "\n");
    }
    return 0;
  }
  return 0;
}

// ---------------------------------------------------------------- main

const HELP = `enhance-qa helper ${VERSION}. Run from the project root.

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
`;

const COMMANDS = {
  init: cmdInit, status: cmdStatus, ingest: cmdIngest, validate: cmdValidate, "next-id": cmdNextId,
  snapshot: cmdSnapshot, diff: cmdDiff, lock: cmdLock, hash: cmdHash, phase: cmdPhase, gate: cmdGate,
  tamper: cmdTamper, "tamper-tests": cmdTamperTests, select: cmdSelect, coverage: cmdCoverage,
  run: cmdRun, results: cmdResults, result: cmdResult, bug: cmdBug, redact: cmdRedact,
  export: cmdExport, hook: cmdHook,
};

function main(argv) {
  if (!argv.length || ["help", "-h", "--help"].includes(argv[0])) {
    stdout(HELP);
    return 0;
  }
  if (argv[0] === "version" || argv[0] === "--version") {
    stdout(VERSION + "\n");
    return 0;
  }
  const cmd = argv[0];
  if (!Object.prototype.hasOwnProperty.call(COMMANDS, cmd)) {
    stderr("Unknown command '" + cmd + "'. Run `qa help`.\n");
    return 2;
  }
  if (cmd === "hook") {
    try {
      const [pos, opts] = parseArgs(argv.slice(1));
      return COMMANDS.hook(new Ctx(opts), pos, opts);
    } catch (e) {
      return 0;
    }
  }
  const [pos, opts] = parseArgs(argv.slice(1));
  const ctx = new Ctx(opts);
  try {
    return COMMANDS[cmd](ctx, pos, opts);
  } catch (e) {
    if (e instanceof QAError) {
      if (opts.json) stdout(pyDumps({ error: e.message }) + "\n");
      else stderr(e.message + "\n");
      return e.code;
    }
    throw e;
  }
}

let code = 0;
try {
  code = main(process.argv.slice(2));
} catch (e) {
  if (process.argv[2] === "hook") {
    OUT.length = 0;
    code = 0;
  } else {
    stderr((e && e.stack ? e.stack : String(e)) + "\n");
    code = 1;
  }
}
flush();
process.exitCode = code;
