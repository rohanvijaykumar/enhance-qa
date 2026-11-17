---
module: maps-location
kind: feature
title: Maps and location
checked: 2026-11-16
---
# Maps and location

Anything that uses where the user is or shows places on a map: store locators, delivery, ride and fitness apps, "near me" search, address entry, geofencing, maps embedded in sites. Camera, microphone and motion sensors are in `camera-mic-sensors.md`; consent rules in `privacy-consent.md`; address form formats in `forms-validation.md`. Usually goes with a mobile module or `web-app.md`, and `i18n-rtl.md`.

## Signals

- Dependencies: `leaflet`, `mapbox-gl`, `maplibre-gl`, `@googlemaps/js-api-loader`, `react-native-maps`, `MapKit`, `CoreLocation`, `FusedLocationProvider`, `geolocator`, `expo-location`, `turf`, `OpenLayers`, `PostGIS`.
- Code: `navigator.geolocation`, `watchPosition`, Places or geocoding API keys, `CLLocationManager`, location permission strings (`NSLocationWhenInUseUsageDescription`, `ACCESS_FINE_LOCATION`).
- UI: "use my location", "near me", pins, routes, address autocomplete.

## Kickoff questions

1. Is location used in the foreground only, or in the background too? (best guess: foreground only)
2. Which map and geocoding provider, and are the API keys restricted? (best guess: Mapbox or Google, test key)
3. Must it work offline, or in other countries? (best guess: online, home country plus two others)

## Drivers

1. **Playwright with geolocation, permissions, locale and time zone emulation.** Best default for web. Use `context.setGeolocation`, `grantPermissions(['geolocation'])` (or leave it denied), `timezoneId` and `locale`. Read the map's state from the page's JavaScript API and the DOM markers; take a screenshot only to judge map rendering, at 1280x800 or less.
2. **Chrome DevTools Sensors panel** (through the browser tool) for location override, "location unavailable" and time zone override.
3. **Emulator and simulator location tools.** Android emulator: extended controls location, routes and GPX playback, or `adb emu geo fix <longitude> <latitude>`. iOS simulator: `xcrun simctl location <device> set <lat>,<lon>` and `run` for scenarios; Xcode GPX files. Use these to simulate travel, speed and spoofed places.
4. **Direct API calls** to the geocoding and routing services (with test keys, within free rate limits and a handful of calls) and to the product's own endpoints, with edge coordinates and addresses.
5. **Geospatial checks in code.** Unit tests on distance (Haversine, `turf`), bounding boxes, polygon contains; PostGIS queries on seeded points.
6. **Permission state control.** `adb shell pm grant/revoke`, `xcrun simctl privacy <device> reset location`, browser site settings, to test every permission state from clean.

**Can't be driven here:** real GPS accuracy and fix time, indoor or urban-canyon drift, battery cost of continuous location, real movement (driving, walking), real-world geofence timing, and precise-vs-approximate behavior on real iOS and Android 12+ devices. Simulators give you a clean fix; real hardware is a device check. Judging whether the map is correct for a real neighborhood is a human check.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | allow location, the map shows the right position and nearby results |
| check | smoke, plus deny, and the changed screen in a second country |
| full | permission state x accuracy x country x network x time zone |
| release | all of full, background and geofence checks, offline maps, human and device checks, privacy review |

Dimensions: permission state (not asked, allowed while using, allowed once, precise or approximate, denied, denied permanently, location services off), country and script, network (online, offline, slow), device (phone, tablet, desktop), time zone, app state (foreground, background, killed).

## Check catalogue

### Permission prompts
- [high · agent] Open a feature needing location for the first time → asks in context, after a user action and with a clear reason; no prompt at app launch; the OS text (purpose string) says why {smoke}
- [high · agent] Deny → the app stays usable with a manual alternative (type an address, pick on the map); a short message says how to enable later; it doesn't re-prompt endlessly
- [high · agent] Allow once, allow while using, precise vs approximate (iOS and Android 12+) → each works; the app behaves sensibly with an approximate location (a rough area, wider radius) and can ask again for precise only when needed
- [medium · agent] Deny permanently, then go to settings and enable → app notices when returning and updates without a restart
- [medium · agent] Revoke permission while the app is open, or turn device location services off → graceful message; no crash; stale location isn't shown as current
- [medium · agent] Background location (where used) → separate, justified prompt; works only after the right permission step; stops when revoked; shows the OS indicator
- [medium · agent] Web: HTTPS only, permissions policy of iframes, prompt blocked inside embedded frames → works on the real origin; clear message otherwise

### Location accuracy and spoofing
- [high · agent] Set the simulated position to several places (home country, another continent, 0,0, poles, date line at ±180 longitude) → map centers there; results near it; no out-of-range errors {smoke}
- [medium · agent] Location jumps (teleport from London to Tokyo) → the app updates once and doesn't show impossible speed or crash; routes recalculated
- [medium · agent] Moving location (GPX playback at walking, cycling and driving speeds) → marker moves smoothly; speed, distance and heading are plausible; paused when stationary; no battery-heavy polling when idle
- [medium · agent] Low accuracy, stale or null fix, timeout and "position unavailable" errors (DevTools sensor override or emulator) → timeouts handled with a retry and a fallback to manual entry; accuracy radius is shown or considered
- [medium · agent] Mock-location apps and spoofed positions → if the product relies on real position (anti-fraud, geofenced content), it detects or tolerates mock locations as designed {security}
- [medium · agent] Location in tunnels, on planes, or with VPN (IP-based location differing from GPS) → conflicts handled; the app states which source it uses
- [low · agent] Coordinates sent to the server → rounded to the precision needed; swapped lat/lon order is a classic bug (check with a point where the swap is visibly wrong)

### Geocoding and address edge cases
- [high · auto] Geocode well-known addresses in the home country and in two others → coordinates land within the expected area (within a few hundred meters, against a known reference); the displayed address matches
- [medium · auto] Messy input: typos, abbreviations (St, Str., Rd), missing postcode, lowercase, extra spaces, unit numbers (Apt 4B), PO boxes, intersections, landmarks → returns a reasonable result or a clear "no match"; ambiguous results offer choices
- [medium · auto] Non-Latin and right-to-left addresses (Chinese, Japanese, Arabic, Cyrillic), accents, local order of address parts (postcode first in some countries) → work and display correctly (see `i18n-rtl.md`)
- [medium · auto] Same name in multiple places ("Springfield", "Paris, Texas") → disambiguated by country, region or user location
- [medium · auto] Reverse geocoding for places with no address (ocean, desert, border) → friendly fallback text, not "undefined" or null
- [medium · agent] Autocomplete suggestions → debounced; session tokens used where the provider needs them (cost); selection fills every address field
- [medium · agent] Provider error, quota exceeded, invalid key, timeout → readable message and manual fallback; keys are restricted by referrer or app (not usable from other sites) {security}
- [medium · auto] Rate limits and cost → repeated typing doesn't produce hundreds of billable requests; results cached where the terms allow

### Map rendering and interaction
- [high · agent] Load the map → tiles, labels, markers and controls render; no gray tiles, broken attribution or "for development purposes only" watermark (a key problem) {smoke}
- [medium · agent] Zoom, pan, rotate, tilt and double-tap, with mouse, touch, trackpad, keyboard → smooth; zoom limits sensible; markers stay attached to positions; no map stealing page scroll unexpectedly (scroll hijacking)
- [medium · agent] Many markers (1,000 and 10,000) → clustering or viewport loading; the UI stays responsive; counts right at each zoom
- [medium · agent] Marker tap and popups → show the right item; popups don't overflow the screen; text and images load; close works; selected state syncs with the list
- [medium · agent] Map and list in sync: pan the map, results update ("search this area"); filter the list, markers update; the same counts
- [medium · agent] Routes and directions → start and end are right; the line follows roads; ETA and distance plausible; reroute works; travel modes (drive, walk, transit) differ; no route found handled
- [medium · agent] Map styles, dark mode, satellite, labels in the user's language → switch cleanly; contrast of labels and markers is OK
- [medium · agent] Window resize, orientation change, hidden-then-shown map container (tabs) → map re-renders at the right size (the classic gray map after resize)
- [medium · agent] Attribution and licensing text → present and visible as the provider's terms need
- [medium · agent] Keyboard and screen reader access to map content → essential info is also in a text list; markers are focusable with names; controls labeled {a11y}
- [low · agent] Deep links to a place or coordinates (`geo:`, maps URLs, "open in Maps") → open the right app and location

### Offline maps and poor network
- [medium · agent] Download an offline region (if offered) → size shown before; progress and cancel; works in airplane mode; shows an "offline" state outside the region (see `offline-sync.md`)
- [medium · agent] Cached tiles and expired caches → stale maps are labeled; cache size capped; "delete offline maps" frees space
- [medium · agent] Slow network → tiles load progressively; low-resolution placeholders; search and routes show errors, not endless spinners
- [low · device] Offline use on a device with real GPS and no network → location still works; the position on cached map is right

### Distance, units and geometry
- [high · auto] Distance between known city pairs → matches a reference (great-circle or route) within tolerance; labels are right; same-point distance is 0
- [medium · agent] Units: km vs miles by locale and setting; meters under 1 km and feet under 0.1 mile as designed; rounding sensible ("1.0 km" vs "1 km") → consistent in list, map and notifications
- [medium · auto] Radius and "within X km" filters → boundaries inclusive or exclusive as stated; very small and very large radius; the date line and the poles; uses spherical, not flat, distance
- [medium · auto] Bounding boxes and polygons crossing the antimeridian (±180) → correct results; no "everything" or "nothing" results
- [medium · auto] Coordinate formats and order: decimal degrees, DMS, lat/lon vs lon/lat, precision of 5 to 6 decimals, projection (Web Mercator vs WGS84) → consistent in storage, API and display
- [low · auto] Sort by distance → nearest first, ties stable, distance shown matches sort

### Time zones by location
- [high · agent] Events, opening hours and "open now" for places in other time zones → times shown in the place's local time or clearly labeled; "open now" uses the place's zone, not the user's
- [medium · agent] User travels (change location and device time zone) → the app updates local times; reminders and schedules follow the documented rule (see `notifications.md`)
- [medium · agent] DST changes at a place and half-hour or 45-minute zones (India, Nepal) → right display and math
- [medium · agent] Places that cross zones or have no zone data (ocean) → fallback to UTC offset with a label

### Privacy and safety
- [high · agent] Location is requested, stored, sent and shown only for the stated purpose; check network logs and storage → no location to third parties beyond the map and geocoding providers; no precise location in URLs, logs or analytics without consent {security}
- [high · agent] Other users' locations (friends, drivers, sellers, photos with EXIF GPS) → shown only with consent and at the promised precision; "hide my location" works; strangers can't locate a home address {security}
- [medium · agent] Retention and deletion → history of location can be viewed and deleted; account deletion removes it; the privacy policy matches actual behavior (see `privacy-consent.md`)
- [medium · agent] Sharing a link or screenshot of a map or trip → doesn't expose the home or live location unintentionally; shared links are revocable and expire
- [medium · agent] Children, sensitive places (clinics, shelters), and safety features (SOS, live share) → follow the stated policy; the user can stop sharing at once
- [medium · agent] Background location indicator and battery use → visible to the user; stops when the feature ends

## Gates

- Permission asked in context; deny and approximate paths work.
- Map renders with no key errors; attribution present.
- Geocoding and distance checked against known references in at least two countries.
- Time zone handling right for other places.
- No unexpected location sharing; privacy policy and permission strings match behavior (see `../gates/apple-app-store.md`, `../gates/google-play.md` for background location rules).

## Human-only checks

- [human] Walk or drive a short route with the real app on a real phone → the blue dot is where you are; routes and turn prompts make sense; battery use is acceptable
- [human] Use the app in a real city center with tall buildings and indoors → accuracy messages and behavior are honest
- [human] Check the map's correctness in your own neighborhood and one you don't know → labels, names, border lines and place details are right and not offensive; disputed borders follow your policy
- [human] Read permission prompts and privacy wording on a real device in two languages → clear, honest, not pushy

## Known pitfalls

- **Simulators give perfect fixes.** Clean accuracy in a simulator says nothing about real GPS; keep real-device checks as device lines.
- **Cached location.** Browsers and OSes return a cached position; a "wrong" location may be a cached fix; clear it or use `maximumAge: 0` in the test.
- **Geolocation permission persists** in browser profiles; reset between runs.
- **Gray map or watermark** from a missing, wrong or restricted API key in the test environment is a config issue first; report it only if the production key would fail.
- **Geocoding results differ by provider** and change over time; compare with a tolerance, not exact coordinates.
- **Headless browsers** may have no tile rendering without WebGL; use `--use-gl=swiftshader` or a headed run for map screenshots.
- **VPNs and corporate networks** change IP-based location.
- **Paid APIs.** Don't loop geocoding or routing calls; keep to a few calls and use recorded fixtures.
- Don't spoof location in production, test with real people's locations, or track real users.

## Sources

1. [MDN: Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API) — permissions, errors, accuracy, secure context (checked 2026-11-16)
2. [Playwright: emulation (geolocation, locale, time zone, permissions)](https://playwright.dev/docs/emulation) (checked 2026-11-16)
3. [Chrome DevTools: Sensors panel](https://developer.chrome.com/docs/devtools/sensors) — location and time zone override (checked 2026-11-16)
4. [Android: Request location permissions](https://developer.android.com/develop/sensors-and-location/location/permissions) — approximate vs precise, background (checked 2026-11-16)
5. [Android Emulator: extended controls and routes](https://developer.android.com/studio/run/emulator-extended-controls) (checked 2026-11-16)
6. [Apple: Requesting authorization for location services](https://developer.apple.com/documentation/corelocation/requesting-authorization-to-use-location-services) — precise vs reduced accuracy, purpose strings (checked 2026-11-16)
7. [Apple: Simulating location in tests](https://developer.apple.com/documentation/xcode/simulating-location-in-tests) — GPX files and simulated location in test plans (checked 2026-11-16)
8. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) — non-text content and keyboard access for maps (checked 2026-11-16)
9. [Falsehoods programmers believe about addresses](https://www.mjt.me.uk/posts/falsehoods-programmers-believe-about-addresses/) — address edge cases (checked 2026-11-16)
