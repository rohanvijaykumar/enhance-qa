#!/usr/bin/env python3
"""wordcount: count lines, words and characters, like a small wc."""
import argparse
import sys

VERSION = "1.0.0"


def count(text):
    return text.count("\n"), len(text.split()), len(text)


def read_source(name):
    if name == "-":
        data = sys.stdin.buffer.read()
    else:
        with open(name, "rb") as fh:
            data = fh.read()
    return data.decode("utf-8", errors="replace")


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    parser = argparse.ArgumentParser(prog="wordcount", description="Count lines, words and characters.")
    parser.add_argument("-l", "--lines", action="store_true", help="print the line count")
    parser.add_argument("-w", "--words", action="store_true", help="print the word count")
    parser.add_argument("-c", "--chars", action="store_true", help="print the character count")
    parser.add_argument("--version", action="version", version="wordcount " + VERSION)
    parser.add_argument("files", nargs="*", metavar="FILE", help='files to read; "-" or none means standard input')
    args = parser.parse_args(argv)

    show = [args.lines, args.words, args.chars]
    if not any(show):
        show = [True, True, True]
    names = args.files or ["-"]

    status = 0
    totals = [0, 0, 0]
    for name in names:
        try:
            text = read_source(name)
        except OSError as exc:
            reason = exc.strerror or str(exc)
            print("wordcount: %s: %s" % (name, reason), file=sys.stderr)
            status = 1
            continue
        values = count(text)
        totals = [t + v for t, v in zip(totals, values)]
        cols = [str(v) for v, keep in zip(values, show) if keep]
        label = "" if name == "-" and not args.files else name
        print(" ".join(cols + ([label] if label else [])))
    if len(names) > 1:
        print(" ".join([str(v) for v, keep in zip(totals, show) if keep] + ["total"]))
    return status


if __name__ == "__main__":
    sys.exit(main())
