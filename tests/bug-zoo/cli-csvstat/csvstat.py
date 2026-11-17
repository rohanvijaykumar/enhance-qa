#!/usr/bin/env python3
"""csvstat: quick statistics for a numeric column in a CSV file."""
import csv
import sys

VERSION = "1.2.0"

USAGE = """usage: csvstat FILE --column NAME [--delimiter CHAR] [--json]

Prints the count, minimum, maximum and mean of a numeric column.
  --column NAME      the column to summarise (required)
  --delimiter CHAR   field delimiter (default ,)
  --json             print JSON instead of text
  --version          print the version
Exit codes: 0 success, 1 bad input or file, 2 usage error."""


def parse(argv):
    opts = {"delimiter": ",", "json": False, "column": None, "file": None}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ("-h", "--help"):
            print(USAGE)
            sys.exit(0)
        if a == "--version":
            print("csvstat 1.1.0")  # BUG(version-mismatch)
            sys.exit(0)
        if a == "--json":
            opts["json"] = True
        elif a == "--column":
            i += 1
            opts["column"] = argv[i] if i < len(argv) else None
        elif a == "--delim":  # BUG(delimiter-flag): help says --delimiter
            i += 1
            opts["delimiter"] = argv[i]
        elif a.startswith("-"):
            print("unknown option: " + a)  # BUG(errors-on-stdout)
            sys.exit(2)
        else:
            opts["file"] = a
        i += 1
    return opts


def main(argv):
    opts = parse(argv)
    if not opts["file"] or not opts["column"]:
        print(USAGE)
        return 2
    try:
        f = open(opts["file"], newline="", encoding="utf-8")  # BUG(bom-header): no utf-8-sig
    except OSError as e:
        print("error: can't open %s: %s" % (opts["file"], e.strerror))
        return 0  # BUG(exit-code-on-error)
    with f:
        rows = list(csv.DictReader(f, delimiter=opts["delimiter"]))
    names = list(rows[0].keys())  # BUG(empty-file-crash)
    if opts["column"] not in names:
        print("error: no column %r (columns: %s)" % (opts["column"], ", ".join(names)))
        return 1
    values = []
    for n, r in enumerate(rows, 2):
        v = (r.get(opts["column"]) or "").strip()
        if v == "":
            continue
        try:
            values.append(float(v))
        except ValueError:
            print("error: %r isn't a number (row %d)" % (v, n))
            return 1
    count = len(values)
    mean = sum(values) / (count + 1) if count else 0  # BUG(mean-off-by-one)
    result = {"column": opts["column"], "count": count, "min": min(values) if values else None,
              "max": max(values) if values else None, "mean": round(mean, 4)}
    if opts["json"]:
        import json
        print(json.dumps(result))
    else:
        print("column %(column)s: count %(count)d, min %(min)s, max %(max)s, mean %(mean)s" % result)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
