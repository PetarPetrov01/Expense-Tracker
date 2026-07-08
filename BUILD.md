# Build & Run (Android)

Environment-specific notes for building, running, and installing this app on the
maintainer's Windows machine. Read this before running any Gradle/adb/build work —
you should not need to be told the setup each time.

## Toolchain (persistent `setx` env vars)

These are set persistently in Windows (via `setx`), not just per-session:

| Var | Value |
|-----|-------|
| `JAVA_HOME` | `C:\Program Files\Java\jdk-17.0.5` (JDK 17) |
| `ANDROID_HOME` / `ANDROID_SDK_ROOT` | `D:\tools\android-sdk` |
| `GRADLE_USER_HOME` | `D:\gradle` |

`android/local.properties` has `sdk.dir=D:\\tools\\android-sdk`.

## IMPORTANT: run Gradle from PowerShell, not Git Bash

Use the **PowerShell** tool for `gradlew`, `adb`, and any build step that needs the
toolchain. The persistent env vars above are reliably visible to PowerShell; the
Git Bash shell may launch without them and the build will fail to find the JDK/SDK.
(Read-only git/inspection is fine in either shell.)

## Build a signed release APK

```powershell
Set-Location D:\code\android-app\android
.\gradlew.bat assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`
(A clean release build takes ~9–10 min; it bundles the JS, so the APK runs
standalone without Metro.)

### Signing

The release build is signed with the maintainer's key — this is the SAME key that
signed the currently-installed app, which is what makes in-place updates possible.

- Keystore: `android/keystores/expense-tracker.keystore` (git-ignored, must exist locally).
- Config: `signingConfigs.release` in `android/app/build.gradle`, reading
  `EXPENSE_UPLOAD_*` from `android/gradle.properties`.
- To confirm a new APK matches the installed app before installing:
  `apksigner verify --print-certs <apk>` and compare the `SHA-256 digest` to the
  installed APK's (pull it via `adb shell pm path com.expensetracker.app` → `adb pull`).

## Install onto the device (preserving data)

Package: `com.expensetracker.app`. Data lives in an on-device SQLite DB (expo-sqlite).

**Always use `-r` (reinstall in place). NEVER uninstall to force an install — that wipes the database (the maintainer's real data).**

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r `
  D:\code\android-app\android\app\build\outputs\apk\release\app-release.apk
```

`install -r` preserves data when the signature matches and `versionCode` is >= the
installed one. It fails safe: on a signature mismatch it errors out without touching
data. Before any install that could hit a mismatch, back up first:
**Settings → Data → Export to JSON** in the app.

If a change adds a DB **migration** (touches `src/db/schema.ts` / `drizzle/`), the
migration runs on first launch of the new build — still data-preserving, but verify
the migration on a copy first.

> Note: `versionCode` is currently hard-coded to `1` in `android/app/build.gradle`
> and is not auto-bumped. Two different builds are therefore indistinguishable to
> Android, and the Play Store would reject a second upload at the same code. Bump it
> per release if/when distributing.

## Dev loop (Metro + dev client)

```powershell
npx expo start --dev-client   # Metro on :8081
```

Reload on the device, then **kill Metro when done** (stop the process; it holds
:8081). For a wifi-attached device, `adb reverse tcp:8081 tcp:8081` lets it reach
Metro over the adb link.

## Seeding realistic test data (dev instance only)

`tools/generate-test-data.mjs` writes `test-data.json` (categories, tags, notes,
some foreign-currency rows; formatVersion 2). Both are dev-only and git-ignored /
uncommitted.

```powershell
node tools/generate-test-data.mjs
& "$env:ANDROID_HOME\platform-tools\adb.exe" push test-data.json /sdcard/Download/test-data.json
```

Then in the app: **Settings → Data → Replace from JSON** → pick `Download/test-data.json`.
Only do "Replace" in a throwaway/dev instance — it wipes existing data.

## Quality gates (run before committing code)

```
npm test              # Vitest (pure-logic unit tests)
npx tsc --noEmit      # type check
npm run lint          # expo lint
```
