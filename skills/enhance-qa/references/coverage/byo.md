# Bring your own checklist

For a client's QA spec, a console certification list under NDA, a regulated-industry checklist, a studio's house rules, or an old spreadsheet of test cases. Use it alongside the modules, or instead of them where the import is authoritative.

## How the user provides it

- Paste it into the chat, or
- point to a file: a spreadsheet (`.xlsx`, `.csv`), a PDF, a Word document, or Markdown or text.

Files under NDA stay where the user keeps them. Store only the derived checks in `qa/checklist/`, and keep NDA wording out of them where the user asks: paraphrase the requirement and keep the item number.

## How the scout imports it

1. **Read the whole document first,** and find its structure: sections, numbering, required versus recommended, platform or region variants.
2. **One check per testable requirement.**
   - Title: the requirement in plain words, with the original number (`### CERT-014 · R-3.2.1 Suspend and resume within 5 seconds`).
   - `Source: imported (<file name>, item <number>)`.
   - Type: `gate` for formal certification or submission steps, `device` for real hardware, `human` for judgement, `auto` for validators, `agent` for the rest.
   - Risk: high for "must" or "shall" requirements, medium for "should", low for "may".
3. **Requirements that aren't testable** (process, paperwork, legal declarations) become `human` checks with the steps to confirm them, for example "Confirm the age rating certificate is attached to the submission".
4. **Keep the import's own area names** if it has them. Otherwise map items to the product's existing areas, or create an `imported` area with `Paths: *`.
5. **Conflicts:** if an imported requirement contradicts a module's default, the import wins for this product. Note it in the plan under "Risks".
6. **Coverage report:** list every source item and its check ID in the plan, plus any item not turned into a check and why. Nothing is dropped silently.

## Updating an import

When the client sends a new version:
- import it again into the same area;
- match items by their original numbers;
- retire checks for removed items (`Retired: <date> removed in v<new>`);
- add new ones;
- list the changes for the user.
