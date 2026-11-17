---
module: embedded-iot
kind: platform
title: Embedded devices, IoT and companion apps
checked: 2026-11-16
---
# Embedded and IoT

Covers firmware and connected devices (microcontrollers, Linux-based gadgets, sensors, wearables, smart-home hardware), their over-the-air (OTA) updates, and the companion app and cloud that go with them. Most checks need the real device or a rig; an agent can run simulators, log analysis and the app and cloud side. It goes with `ios.md` or `android.md` for the companion app, `apis-backend.md` for the cloud, `../features/installers-updaters.md`, `../features/security.md`, `../features/privacy-consent.md` and `../features/offline-sync.md`. Regulatory marking (radio, EMC, electrical safety) is outside software QA; the user brings those checklists (`byo.md`).

## Signals

- Build files: `platformio.ini`, `CMakeLists.txt` with Zephyr, ESP-IDF, Pico SDK or STM32Cube, `Cargo.toml` with `embassy` or `no_std`, `Makefile` with a cross-compiler, Yocto or Buildroot configs, `sdkconfig`, device-tree files, `*.ino`.
- Bootloader, partition tables (`partitions.csv`), MCUboot, signing keys folders, OTA server code, MQTT, CoAP, BLE GATT definitions, Matter or Thread config.
- A companion mobile app that pairs by Bluetooth LE, Wi-Fi provisioning or QR code.
- README words: "firmware", "OTA", "flash", "pairing", "sensor", "ESP32", "STM32", "Raspberry Pi".

## Kickoff questions

1. What hardware is available to test on: one dev board, the real product, several revisions, or none? (best guess: a dev board or none; with none, checks run on a simulator and the rest go to the user)
2. How does the device connect and update: BLE, Wi-Fi, cellular, USB; OTA from your server or by cable? (best guess: read the firmware's drivers and update code)
3. Which firmware versions must upgrade to this one, and is there a signing key setup? (best guess: the last released version; the user holds the signing keys, and an agent never touches them)

## Drivers

1. **Host unit tests.** Compile the hardware-independent logic for the host (PlatformIO `native` environment, Unity/CMock/Ceedling, Zephyr `native_sim`, Rust `cargo test`) and run it. Cheap and deterministic: parsers, state machines, protocol framing, update logic, retry timers [6].
2. **Simulators and emulators.** QEMU for many ARM and RISC-V cores and some boards; Renode for multi-node embedded simulation with scripted peripherals, UART assertions and Robot Framework tests; Zephyr's `native_sim` and `qemu_x86`; the ESP32 QEMU fork (Espressif) for a limited set of peripherals. Boot the real firmware image, script UART input and assert on the log [1][2].
3. **Serial log and test harness.** Capture UART or RTT output (`pyserial`, `picocom`, `probe-rs`, `openocd`) with assertions on boot messages, version, reset reason and panic traces. A hardware-in-the-loop rig can automate flashing (`esptool.py`, `west flash`, `pio run -t upload`, `probe-rs`), power cycling (a relay or smart plug), button presses and sensor stimuli (a GPIO board or signal generator). Agents may drive a rig the user has built and approved; they never open a device that isn't theirs [3].
4. **Protocol tools.** `bluetoothctl`, `nRF Connect` (human on phone), Wireshark and Bluetooth sniffers, `mosquitto_sub`/`mosquitto_pub` against a test broker, `coap-client`, `mqttx`. Replay and fuzz the device protocol on a bench network or a local broker, never a production broker.
5. **Static and binary analysis.** Compiler warnings as errors, `cppcheck`, `clang-tidy`, `cargo clippy`, `cargo audit`, stack-usage and map-file size reports (`size`, `bloaty`), `binwalk` and `strings` to look for secrets in the image, `espsecure.py` or `imgtool` to verify signatures [4].
6. **Companion app and cloud drivers.** The app via the iOS or Android modules (simulators can't do real BLE; use a physical phone or a BLE mock layer); the cloud via HTTP and MQTT with a local or staging broker. A simulated device (a script that speaks the protocol) lets the app and cloud be tested without hardware.
7. **Computer use / camera** only to read a device display; otherwise a human.

**Can't be driven here:** anything that needs the real device or physical conditions: power loss and brownouts on real hardware, battery life, thermal and environmental ranges, RF range and interference, real sensors and actuators, mechanical wear, safety behaviour, and certification and labs. Simulators don't model timing, radios or flash wear faithfully. These are device or human checks, with exact steps.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | latest firmware image in the simulator or on one board: boots, prints the right version, main function works, companion app pairs |
| check | smoke cell, plus the changed subsystem, plus an OTA update from the previous release |
| full | pairwise over hardware revision × firmware upgrade path × connectivity × power source × app and cloud version |
| release | every hardware revision, every supported upgrade path, power-loss and rollback tests, soak, companion app on supported phones, plus device and human checks |

Dimensions: hardware revision and batch; firmware upgrade path (N-1, N-2, factory image); radio environment (strong, weak, congested, absent); power source (battery at several levels, USB, mains, brownout); temperature (if in scope); sensor input ranges; companion app version and OS; cloud API version; time and time zone; locale.

## Check catalogue

### Build, boot and basic function
- [high · auto] Build the firmware from a clean checkout with the project's own toolchain, warnings as errors → builds reproducibly; the image size fits the partition with headroom; the version string and build ID are embedded {smoke}
- [high · auto] Run host unit tests and static analysis (`cppcheck`, `clang-tidy`, `clippy`) → pass; new warnings listed {smoke}
- [high · auto] Boot the image in the simulator (Renode, QEMU, `native_sim`) or on a board and capture the serial log → the boot banner shows the right version; no panic, assertion or watchdog reset; boot time within the stated limit {smoke}
- [high · agent] Exercise the main function on the board or simulator (read a sensor, switch an output, send a message) → output matches input; the value reaches the app and cloud
- [medium · auto] Check the stack, heap and RAM use from the map file and runtime stats → headroom under the stated margin; no heap fragmentation growth over a soak
- [medium · auto] Check the reset reason and the panic and crash log on a forced fault (null pointer, stack overflow, watchdog) → the device recovers and records the cause; the next boot reports it
- [medium · auto] Search the image and the repo for secrets (Wi-Fi passwords, API keys, private keys, default admin passwords, debug backdoors) → none; debug interfaces (UART console, JTAG, SWD) disabled or protected in release builds {security}

### Provisioning, pairing and factory reset
- [high · agent] First-time setup from a factory-fresh state: power on, enter pairing mode, pair with the app, join Wi-Fi, register to the cloud → completes with the documented steps; every prompt makes sense; device identity is unique {smoke}
- [high · agent] Pairing failure cases: wrong code, wrong Wi-Fi password, out of range, a second phone trying to pair, pairing mode timeout, unpair and re-pair → each gives a clear message; a failed attempt doesn't leave the device half-provisioned; a stranger can't hijack pairing {security}
- [high · agent] No universal default password: check each device has a unique credential or requires one to be set on first use → no shared default; any default is printed on the device only [5] {security}
- [high · device] Factory reset by the documented method (button hold, app, hold on power) → wipes user data, Wi-Fi credentials, pairing and cloud account link; the device returns to setup mode; the old owner can't read the data
- [medium · agent] Transfer ownership (sell or give the device) and remove it from an account → the old account loses control; the new owner can set it up; no data from the old owner remains
- [medium · agent] Provision many devices in sequence with the same app and account → each one is distinct; limits (maximum devices) handled with a clear message
- [medium · device] Pair while the phone's Bluetooth or location permission is denied, on each supported OS version → the app explains what permission is needed and why

### Connectivity and the companion protocol
- [high · auto] Replay and fuzz the device protocol against the device or simulator on a bench network (malformed, truncated, oversized, out-of-order and replayed frames; wrong lengths; unknown commands) → the device rejects bad input without crashing, hanging or changing state; no buffer overflow {security}
- [high · agent] Lose connectivity during normal use (turn Wi-Fi off, walk out of range, kill the broker) and restore it → the device reconnects with backoff; queued data is sent or discarded as designed; the app shows offline and recovers {smoke}
- [high · agent] Connectivity loss during a command from the app (a lock, a heater, a valve) → the app shows the true state (pending, failed, unknown), not a false success; the device ends in a safe state
- [medium · agent] Check reconnect storms: 100 simulated devices reconnect at once to a test broker (small scale, local only) → backoff and jitter spread the load; no crash
- [medium · agent] Check the protocol version negotiation between old and new app, firmware and cloud (N-1, N-2) → mixed versions work or the app says an update is needed; no silent misreads
- [medium · device] Check BLE and Wi-Fi behaviour near range limits, with interference and with many other devices around → graceful degradation; reconnects; battery drain stays sensible
- [medium · agent] Check TLS and credentials on cloud links: certificate validation, pinning or trusted roots, certificate expiry and rotation, clock errors → connections refused when the certificate is wrong; the device doesn't connect with validation off {security}
- [medium · agent] Check local network exposure: open ports, mDNS names, unauthenticated local APIs, services left on from development → only the intended; local control requires authentication {security}
- [medium · agent] Check the data sent to the cloud against the privacy notice (identifiers, location, audio, usage) → no more than disclosed; opt-in where required {security}

### Over-the-air updates and rollback
- [high · auto] Update from the previous release and from the oldest supported release to this one in the simulator or on a board, then boot → the version string changes; settings and calibration data are kept or migrated; the device works {smoke}
- [high · device] Cut power at several points during an update (while downloading, writing flash, verifying, swapping, first boot) → the device boots into the old or the new good image every time; never a brick; the update retries on its own or can be retried by the user
- [high · auto] Run a bad image: corrupted file, truncated download, wrong hash, wrong signature, an image for another hardware revision, a downgrade, a valid signature on an old version → rejected before running; the old image keeps running; the failure is reported to the cloud and app {security}
- [high · auto] Verify the update's signature chain: unsigned and wrongly-signed images are rejected; keys are not in the repo or the image; secure boot or signature checking is on in release builds → pass; an agent never handles production signing keys {security}
- [high · auto] A/B or fallback rollback: make the new image crash or fail its self-test (boot counter, watchdog) → the bootloader rolls back to the last good image automatically; the cloud sees the rollback [4]
- [medium · agent] Update with low battery, with no storage space, on a slow or flaky link, and with the app closed → the update waits or fails safely; no partial state; resumes where it can
- [medium · agent] Staged rollout and update control: updates only for the intended device groups, pause and halt from the server, and a minimum-version rule → the right devices get it; a halted rollout stops
- [medium · agent] Update the device while it's busy (recording, heating, in a call) → the device waits for a safe moment or tells the user; no unsafe interruption
- [medium · agent] Companion app and cloud update order: app first, cloud first, firmware first → every order works, or the required order is enforced

### Time, power, battery and sensors
- [high · device] Soak: run the device for days under a typical and a worst-case load with logging → no memory leak, no stuck state, no unexpected reboot (count watchdog resets), no storage wear beyond plan
- [high · device] Power events: brownout, sudden removal during writes to settings, battery pulled and reinserted, low-battery thresholds → settings are not corrupted; the device shuts down cleanly or resumes
- [medium · device] Measure battery life and sleep current for the stated use profile → within the claim; the device really sleeps; radios aren't left on
- [medium · auto] Time: boot with no network time, with a wrong clock, an NTP outage, a time-zone change, daylight saving and a rollover (2038 for 32-bit time, uptime counters) → time-dependent features behave; certificates and schedules aren't broken by a bad clock
- [medium · device] Sensor ranges and faults: inputs at the minimum, maximum, over range, disconnected, noisy and stuck → values clamped or flagged; the app shows a sensible error, not a wild reading; calibration works and survives updates
- [medium · device] Actuator safety: command extremes, rapid toggling and conflicting commands → limits enforced in firmware, not only the app; the safe state on fault is correct
- [medium · agent] Flash wear and storage: write logs and settings for a long time in the simulator and check write frequency → write rates fit the flash endurance claim; the log rotates
- [low · device] Temperature and humidity range per the spec → behaves within limits (lab, human)

### Companion app and cloud
- [high · agent] Use the app's full flow with a simulated device (a script speaking the protocol): setup, control, status, history, notifications, update → every screen shows the right data; errors are clear {smoke}
- [high · agent] App with a real device on a real phone → same flow works; BLE permissions, background behaviour and reconnect after the phone sleeps or the app is killed behave (device check)
- [medium · agent] Account and sharing: invite another user, change roles, remove a user, delete the account → access changes at once on device and app; deleting the account removes the data and unlinks devices
- [medium · agent] Notifications and automations from the device (alerts, schedules, geofence) in the test environment → correct, once, and at the right time; quiet hours honoured
- [medium · agent] Cloud outage with the device local: stop the test cloud → the device keeps working locally as designed; data is buffered; no crash loop
- [medium · agent] Data export and history across firmware versions and time zones → continuous, correct units, no duplicates after reconnect
- [medium · agent] Check units, locales and time formats across the device display, app and cloud → consistent

## Gates

Hardware certification (radio, EMC, safety, carrier) is a lab and human matter; see `byo.md` for the user's checklist. Security baseline reference: the ETSI EN 303 645 consumer IoT provisions (no universal default passwords, a vulnerability disclosure policy, secure updates and others) [5]. Block release when:

- Any power-loss test during an update bricks a device, or rollback fails.
- Unsigned, corrupted or wrong-version images can be installed.
- Default or shared passwords, enabled debug interfaces, or secrets in the image.
- The device protocol crashes or changes state on malformed input.
- Factory reset leaves personal data or the old pairing.
- Any supported upgrade path fails or loses user data.

## Human-only checks

- [human] Run the unboxing and setup yourself, as a new user, on a phone you choose → can you finish in the stated time with only the printed instructions?
- [human] Pull the power plug and the battery at random moments during use and during an update, five times each → the device always comes back.
- [human] Carry the device around the home or site: walls, other rooms, distance, busy Wi-Fi → stays connected or recovers.
- [human] Test the physical controls and indicators (buttons, LEDs, screen, buzzer, labels) → they match the manual and behave consistently.
- [human] Run the sensor and actuator checks with real stimuli (heat, light, motion, load) and a safe setup → readings and actions are right.
- [human] Check certifications, safety labels and the legal markings with your lab or compliance contact. (Agents never mark these passed.)

## Known pitfalls

- **Simulators aren't hardware.** Renode and QEMU don't model radio, timing, flash wear or power faithfully. A pass in the simulator proves logic, not the product.
- **Serial logs lie when buffered.** A missing line may be lost from a UART buffer; check the log level and baud rate before filing.
- **Reset-reason noise.** A reset after a flash, a debugger attach or a brownout during bench power-up isn't a firmware crash. Reproduce on a stable supply.
- **Bench power supplies and USB hubs** cause brownouts and reboots that production power wouldn't. Check the supply first.
- **Wi-Fi and BLE test results depend on the room.** Record the environment; retry in another place before reporting a range bug.
- **Phone BLE stacks differ.** A pairing failure on one phone model and OS version is a compatibility finding, not necessarily a firmware bug; note the device and OS.
- **Time-based failures after a flat clock.** A device with no network time may have a 1970 clock; certificates fail by design. Check that the failure is handled, not that it exists.
- **Don't flash an image to a device that isn't a test unit.** And never test OTA against production update servers or production fleets.
- **Debug builds are slower and bigger** than release builds. Measure performance, size and power on the release build.
- **A clean mock hides integration gaps.** A simulated device skips real firmware timing; a test that only uses the mock can't prove pairing works.

## Sources

1. [Renode](https://renode.io/) — multi-node embedded simulation with scripted tests (checked 2026-11-16)
2. [QEMU](https://www.qemu.org/) — system emulation for ARM and RISC-V targets (checked 2026-11-16)
3. [Memfault: OTA update checklist for embedded devices](https://memfault.com/blog/ota-update-checklist-for-embedded-devices/) — power loss, rollback, boot counters, watchdogs, signed images; vendor blog (checked 2026-11-16)
4. [MCUboot](https://docs.mcuboot.com/) — secure bootloader: signed images, swap and rollback (checked 2026-11-16)
5. [Zephyr: ETSI EN 303 645 summary](https://docs.zephyrproject.org/latest/security/standards/etsi-303645.html) — the 13 provisions, including no universal default passwords, disclosure policy and secure updates (checked 2026-11-16)
6. [PlatformIO: unit testing](https://docs.platformio.org/en/latest/advanced/unit-testing/index.html) — host-based native tests for embedded code (checked 2026-11-16)
