---
module: windows-code-signing
kind: gate
title: Windows code signing and SmartScreen
checked: 2026-11-16
---
# Windows code signing and SmartScreen

Pre-checks for signing Windows executables, DLLs, installers and drivers distributed outside the Microsoft Store (Store apps are re-signed by Microsoft; see `microsoft-store.md`). Covers Authenticode with `signtool`, timestamping, certificate types, SmartScreen reputation and verifying the result. Use with `../platforms/windows-desktop.md` and `../features/installers-updaters.md`. Signing keys and signing-service logins are human-held: agents verify, never hold or type secrets.

## Signals

- A Windows installer or executable shipped directly (MSI, EXE, MSIX, Inno Setup, NSIS, WiX, Squirrel, electron-builder `win` target).
- Config with `signtool`, `AzureSignTool`, `trusted-signing`/`artifact-signing`, a `.pfx` mention, or a `CERTIFICATE`/`WINDOWS_SIGN` secret in CI.
- The plan names "code signing", "SmartScreen" or "Authenticode".

## Kickoff questions

1. Where is the signing key held: a hardware token or HSM, a cloud signing service, or no certificate yet? (best guess: read the CI config)
2. What is shipped: EXE, DLL, MSI, MSIX, drivers? (best guess: list the release assets)

## Drivers

1. **`signtool verify`.** `signtool verify /pa /v file.exe` checks the signature chain and timestamp. Exact and cheap. Part of the Windows SDK.
2. **PowerShell `Get-AuthenticodeSignature`.** Status, signer and timestamp for many files at once. No SDK needed.
3. **Clean Windows VM with a browser download.** Download the artifact from the real link so it carries the Mark of the Web, then run it. Shows what a user sees.
4. **Certificate viewer / `certutil -dump`.** For expiry and issuer.

**Can't be driven here:** real SmartScreen reputation on first download (it builds over time and download volume, so it can't be proven before release), Smart App Control on a user's real machine, signing itself (needs the key or service identity), and certificate purchase or identity validation. These are human or device checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used |
| check | `signtool verify` on every shipped binary |
| full | verify, plus download test on a clean VM |
| release | full, plus the human SmartScreen and certificate checks |

Dimensions: EXE, DLL, MSI or MSIX, installer wrapper; x64 and ARM64; Windows 10 and latest 11; online and offline.

## Check catalogue

### Signature presence and validity
- [high · auto] List every PE file in the release (EXE, DLL, SYS, installer, uninstaller, helper) and run `signtool verify /pa /v` → each shipped file is signed, "Successfully verified" {smoke}
- [high · auto] The installer, the uninstaller and the main binaries inside it are all signed → none is unsigned (unsigned files start with no reputation on every new version)
- [high · auto] `Get-AuthenticodeSignature` for each file → Status is Valid, and the signer name is the expected company name
- [high · auto] Every signature has an RFC 3161 timestamp (`signtool verify /pa /v` shows a timestamp) → timestamp present, so the signature stays valid after the certificate expires
- [medium · auto] Digest algorithm is SHA-256 or stronger for both file digest and timestamp → no SHA-1 signature
- [high · auto] Files are signed after the last change in the build; check none are modified afterwards (repacked, UPX-compressed, version-stamped) → signature still verifies after packaging
- [medium · auto] Signer subject is identical on all files and across releases → one consistent publisher identity (changing it affects reputation)
- [medium · auto] Certificate chain builds to a trusted root and the leaf has the Code Signing usage → `certutil -verify` or signtool shows no chain error
- [medium · auto] Certificate expiry date is later than the planned release date plus support period, or the renewal is scheduled → date noted in the release report
- [high · auto] Search the repo, build logs and artifacts for `.pfx`, `.p12`, private keys and signing passwords → none present; keys never ship (WACK also checks this for packages) {security}

### Installer and package signing
- [high · auto] MSI: `signtool verify /pa file.msi` → signed
- [medium · auto] MSIX: package is signed with a certificate whose subject matches the manifest `Publisher` exactly → `Add-AppxPackage` installs without a publisher mismatch error
- [medium · auto] Auto-updater downloads and verifies signatures of updates before running them → the update feed rejects an unsigned or wrongly signed test update {security}
- [medium · auto] Driver or kernel files, if any, follow Microsoft's attestation or WHQL path, not plain Authenticode only → note it for the human; not testable here

### Download and run behaviour
- [high · device] Download the release from the real URL in Edge on a clean Windows VM, then run it → the dialog shows the verified publisher name (not "Unknown publisher"); note whether SmartScreen shows a warning (see Sources 1)
- [medium · device] Download the same file with a different browser and via `curl` plus copied Mark of the Web (`Zone.Identifier`) → behaviour is recorded; no claim made about reputation
- [medium · device] Run on Windows 11 with Smart App Control on → signed files run; unsigned files may be blocked (see Sources 1)
- [medium · device] Run with a common antivirus on (Defender at least) → no malware detection; a false positive is reported to the vendor, not hidden
- [medium · agent] Install, run, uninstall as a standard user and as admin → the UAC prompt names the publisher, and no extra prompts appear

### Certificate and service choices
- [medium · human] Decide the signing route: Microsoft Store (re-signed by Microsoft, no download warning), Artifact Signing (formerly Trusted Signing; cloud service with identity validation, no hardware token, works from CI), or an OV or EV certificate from a certificate authority → the choice is written in the release notes (see Sources 1)
- [medium · human] If an EV certificate is bought: confirm the reason is procurement or policy, not SmartScreen, since EV no longer bypasses SmartScreen (see Sources 1) → reason recorded
- [high · human] Signing key or service identity access is limited to the CI job or named people, with MFA → only intended identities can sign
- [medium · gate] Signed release is published, then downloaded by a test user on a fresh PC → the human records the first-download experience; reputation may take weeks and many downloads to build

## Gates

Every shipped binary and installer verifies as signed with a timestamp, no key material ships, and the human accepts the SmartScreen expectation. A SmartScreen warning on a brand-new signed release isn't a release blocker by itself; record it.

## Human-only checks

- [human] Hold the certificate or signing-service login. Agents never type or store the key, token PIN or service credentials.
- [human] Download the real release on a second PC with a normal browser. Judge: publisher name shown, warning or not, and whether the install feels trustworthy.
- [human] Tell early users in the release notes that a first-download prompt may show, and what the real publisher name is.

## Known pitfalls

- Signed doesn't mean no warning. OV and EV files both show a warning for new, unrecognised files until reputation builds; there's no manual submission for consumer reputation and no fixed threshold. Don't promise any behaviour.
- Reputation is tied to the file hash and the signing identity. A rebuilt file gets a new hash; a changed certificate resets the publisher signal.
- A signature without a timestamp fails when the certificate expires. Check the timestamp, not just "signed".
- `signtool verify` without `/pa` uses a driver policy and may fail on normal apps. Use `/pa`.
- Local builds don't carry the Mark of the Web, so they never show SmartScreen. Test a downloaded copy.
- Antivirus false positives on new binaries are common. Report them, but don't call them a signing bug.
- Don't sign anything that may count as unwanted software. It can give the certificate a negative reputation.

## Sources

1. [SmartScreen reputation for Windows app developers](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation) — OV and EV behaviour, Store, Artifact Signing (formerly Trusted Signing), Smart App Control, no manual submission for consumers (checked 2026-11-16)
2. [Artifact Signing (formerly Trusted Signing) documentation](https://learn.microsoft.com/en-us/azure/trusted-signing/) — service overview as linked from the SmartScreen page (checked 2026-11-16)
3. [SignTool](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool) — sign and verify commands (not re-fetched this pass)
4. [Windows App Certification Kit tests](https://learn.microsoft.com/en-us/windows/uwp/debug-test-perf/windows-app-certification-kit-tests) — leaked signing keys check (checked 2026-11-16 via research note 2)
