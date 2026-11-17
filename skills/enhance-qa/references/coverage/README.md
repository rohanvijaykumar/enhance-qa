# Coverage library

Everything the scout can draw on when it writes the checklist. Only the parts a product needs are ever loaded.

## How it's used

1. **Always:** `base.md`. It applies to every product.
2. **Platform modules** (`platforms/`): one or more per product. Hybrids combine them (a Tauri app is `electron-tauri` + `web-app` + the desktop OS modules it ships to).
3. **Feature packs** (`features/`): switched on by features the scout finds, whatever the platform.
4. **Release-gate packs** (`gates/`): one per distribution channel, loaded for `release` passes and when the plan names a channel.
5. **Bring your own** (`byo.md`): imported client, console or regulated-industry checklists.

**Who reads what:**
- The **scout** reads `base.md`, the signals of every module (to choose), and then the full text of the chosen modules, packs and gates.
- **Testers** read only the "Drivers" section of the platform modules for their area, plus the checks they're given.
- The **lead** reads this index and the "Default matrix" of the chosen platform modules.

Record the chosen modules, packs and gates in `qa/plan.md` (`modules:` and `gates:`). The scout re-checks signals when new features appear.

Each file follows `_template.md`. Every platform rule carries a source and a "checked" date. During `release` passes, the lead re-checks the source links of the gates in use and notes any that changed.

## Platform modules (22)

| File | Covers |
|---|---|
| `platforms/web-app.md` | SPAs and server-rendered apps: responsive layout, zoom, forms, sessions, cross-browser |
| `platforms/website-content.md` | Marketing sites, blogs, docs, storefronts: links, SEO, social previews, legal pages, performance |
| `platforms/ios.md` | iPhone and iPad apps, with watchOS and CarPlay notes |
| `platforms/android.md` | Phones, tablets, Wear OS and Android Auto notes |
| `platforms/cross-platform-mobile.md` | React Native, Flutter, Expo: what differs between iOS and Android |
| `platforms/windows-desktop.md` | Win32, WPF, WinUI, .NET: installers, high DPI, UAC |
| `platforms/macos-desktop.md` | AppKit and SwiftUI: notarisation, sandboxing, permissions |
| `platforms/linux-desktop.md` | GTK and Qt: deb, rpm, Flatpak, Snap, AppImage; Wayland and X11 |
| `platforms/electron-tauri.md` | Web-in-desktop shells: Electron and Tauri |
| `platforms/cli-devtools.md` | CLIs and developer tools: commands, flags, exit codes, pipes, shells, install methods |
| `platforms/apis-backend.md` | REST, GraphQL, gRPC, webhooks, jobs and queues |
| `platforms/libraries-sdks.md` | npm, PyPI, crates, NuGet, Maven: clean installs, docs examples, semver, types |
| `platforms/browser-extensions.md` | Chrome, Firefox, Edge and Safari extensions |
| `platforms/host-app-plugins.md` | VS Code and JetBrains extensions, Office add-ins, Figma, WordPress and Shopify apps |
| `platforms/bots-chat.md` | Slack, Discord, Telegram and WhatsApp bots |
| `platforms/games.md` | PC, console, mobile and web games; Unity, Unreal, Godot, web engines |
| `platforms/audio-plugins.md` | VST3, AU, AAX and CLAP plugins; standalone audio apps |
| `platforms/ai-llm-features.md` | Chatbots, agents, RAG: evals, prompt injection, cost and latency |
| `platforms/embedded-iot.md` | Firmware, devices, companion apps, over-the-air updates |
| `platforms/data-pipelines.md` | ETL, dashboards, reports, data correctness |
| `platforms/xr.md` | AR, VR and XR: Quest, Vision Pro, WebXR; comfort, tracking, frame rate |
| `platforms/tv-media-deliverables.md` | Smart TV and set-top apps, plus video, audio and disc deliverables (DVD/Blu-ray menus, chapters, subtitles, loudness, region codes, naming, checksums) |

## Feature packs (24)

| File | Covers |
|---|---|
| `features/accounts-auth.md` | Sign-up, login, reset, sessions, OAuth, 2FA, roles |
| `features/payments-subscriptions.md` | Checkout, subscriptions, refunds, webhooks (test mode only) |
| `features/admin-backoffice.md` | Admin and back-office tools |
| `features/forms-validation.md` | Forms and validation |
| `features/search-filter-sort.md` | Search, filter and sort |
| `features/file-upload-download.md` | File upload and download |
| `features/data-import-export.md` | Data import, export and migrations |
| `features/notifications.md` | Email, SMS and push (sandboxes only) |
| `features/realtime-collaboration.md` | Real-time and collaboration |
| `features/offline-sync.md` | Offline and sync |
| `features/media-playback.md` | Media playback and captions |
| `features/maps-location.md` | Maps and location |
| `features/camera-mic-sensors.md` | Camera, microphone and sensors |
| `features/i18n-rtl.md` | Internationalisation and right-to-left languages |
| `features/accessibility.md` | Accessibility (WCAG 2.2 AA) |
| `features/performance.md` | Performance basics |
| `features/security.md` | Security basics (OWASP Top 10, ASVS level 1; not a pentest) |
| `features/privacy-consent.md` | Privacy and consent (GDPR, CCPA, COPPA) |
| `features/integrations-webhooks.md` | Integrations and webhooks |
| `features/analytics-events.md` | Analytics events |
| `features/onboarding.md` | Onboarding and first run |
| `features/settings-persistence.md` | Settings and persistence |
| `features/installers-updaters.md` | Installers and updaters |
| `features/ai-built-app-risks.md` | Defects typical of apps built mostly by AI agents, strongest evidence first |

## Release-gate packs (16)

| File | Covers |
|---|---|
| `gates/apple-app-store.md` | Apple App Store review |
| `gates/google-play.md` | Google Play policy and pre-launch checks |
| `gates/microsoft-store.md` | Microsoft Store and the Windows App Certification Kit |
| `gates/macos-notarization.md` | macOS notarisation and Gatekeeper |
| `gates/windows-code-signing.md` | Windows code signing and SmartScreen |
| `gates/steam.md` | Steam release and Steam Deck Verified |
| `gates/xbox.md` | Xbox requirements |
| `gates/playstation-nintendo.md` | PlayStation and Nintendo (bring your own: under NDA) |
| `gates/age-ratings.md` | IARC, ESRB and PEGI |
| `gates/browser-extension-stores.md` | Chrome Web Store, Firefox Add-ons, Edge and Safari |
| `gates/vscode-marketplace.md` | VS Code Marketplace and Open VSX |
| `gates/audio-plugin-validation.md` | auval, the VST3 validator, pluginval, AAX signing |
| `gates/package-publishing.md` | npm, PyPI, crates, Homebrew and winget |
| `gates/web-launch.md` | The 14-check web launch gate, run against the deployed URL |
| `gates/accessibility-law.md` | European Accessibility Act, ADA |
| `gates/privacy-law.md` | GDPR, UK GDPR, CCPA/CPRA, COPPA and similar |
