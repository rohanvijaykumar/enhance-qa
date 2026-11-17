# wordcount

Counts lines, words and characters in files or standard input, like a small `wc`. Python 3.8+, no dependencies.

```
python wordcount.py notes.txt
python wordcount.py -w notes.txt todo.txt
cat notes.txt | python wordcount.py -l
python wordcount.py --version
```

## Behaviour

- **Counts:** lines are newline characters (a last line without a newline isn't counted, as in `wc`). Words are runs of non-whitespace. Characters are Unicode characters, not bytes.
- **Encoding:** input is read as UTF-8. Invalid UTF-8 counts as replacement characters (U+FFFD), one for each invalid sequence. Output is UTF-8.
- **Columns:** the output is `lines words chars name`. `-l`, `-w` and `-c` choose columns, which always print in that order. With none of them, all three print.
- **Several files:** when more than one file is named, there's one line per file, then a `total` line summing the files that could be read. A single file has no total line.
- **Standard input:** read when no file is given (no name is printed) or when the file is `-` (printed as `-`).
- **Errors:** a file that can't be read prints `wordcount: <file>: <reason>` to stderr. The other files are still counted, and the exit code is 1.
- **Exit codes:** 0 success, 1 a file couldn't be read, 2 a usage error (unknown option).
- **Version:** `--version` prints `wordcount 1.0.0`.
