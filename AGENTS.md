# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Building & running

See [BUILD.md](BUILD.md) before any build/run/install work. Key rule: run `gradlew`/`adb`
from **PowerShell** (not Git Bash) — the toolchain lives on `D:` via persistent env vars
that only PowerShell reliably sees. Install updates with `adb install -r` (same signing key);
never uninstall-to-install (it wipes the on-device database).
