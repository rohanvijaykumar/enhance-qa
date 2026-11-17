# csvstat

Quick statistics (count, min, max, mean) for a numeric column in a CSV file.

```
python csvstat.py sales.csv --column amount
python csvstat.py sales.csv --column amount --json
python csvstat.py data.tsv --column amount --delimiter ";"
```

- Empty cells are skipped; any other non-numeric value is an error.
- Works with files saved by Excel (UTF-8 with a byte-order mark).
- File names with spaces work when quoted.
- Errors go to stderr. Exit codes: 0 success, 1 bad input or file, 2 usage error.
- `--version` prints the version (currently 1.2.0).
