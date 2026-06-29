# Branch Log

This file records local branch intent, major changes, user-reported problems from prior versions, and items that still need verification.

Update this file whenever a branch is created, behavior changes, or the user reports a regression.

## Branch: codex/hmi-csharp-bridge-stabilize

Created: 2026-06-29

Purpose:

- Stabilize the PLC <-> TwinCAT HMI path before continuing C# Server Extension testing.
- Keep this work local until GitHub push is explicitly requested.

Major changes:

- Reverted `TcHMI/Scripts/Bridge.js` to the stable manual flow.
- Removed default automatic PLC polling from the HMI page.
- Removed default automatic C# UI to PLC writeback from the HMI page.
- Kept manual buttons:
  - `Read PLC`
  - `Write PLC`
  - `Push C#`
  - `Pull C#`
- Updated `OPENSPEC.md` to require local branches for revisions.
- Updated `OPENSPEC.md` to make manual PLC/HMI read-write the stable baseline.

User-reported problems from previous version:

- PLC <-> HMI read/write broke again after recent changes.
- C# <-> HMI could not be tested because PLC <-> HMI was no longer stable.
- Visual Studio showed a red-marked `TcHmiCSharpBridge.nuspec` item.

Current known / unconfirmed issues:

- PLC <-> HMI must be retested in TwinCAT HMI Live/Publish after this rollback.
- C# Server Extension symbol `TcHmiCSharpBridge.Variables` still needs live HMI Server verification.
- HMI `Push C#` / `Pull C#` still needs verification after the C# extension is confirmed deployed and loaded.
- Standalone C# UI can build, but live synchronization with HMI is still unconfirmed.
- `TcHmiCSharpBridge.nuspec` is not present in the current filesystem/project search, and no project/solution file references it. The Visual Studio red mark is likely stale UI/project cache; confirm after reloading the solution.

Verification already run:

- `node --check TcHMI\Scripts\Bridge.js` passed.
- `dotnet build TcHmiCSharpBridge\TcHmiCSharpBridge.csproj --configuration Debug --no-restore --verbosity minimal` passed.
- `dotnet build TcHmiCSharpBridge.Ui.sln --configuration Debug --no-restore --verbosity minimal` passed.
- `MSBuild TcHMI\TcHMI.hmiproj /p:Configuration=Debug /p:Platform="TwinCAT HMI" /v:minimal` passed.

## Branch: codex/official-sample-rebuild

Created: 2026-06-29

Purpose:

- Rebuild the PLC <-> TwinCAT HMI <-> C# bridge around the Beckhoff `TF2000_Server_Samples` `StaticSymbols` server extension pattern.
- Restore the original requested workflow: PLC GVL `HMI` variables, TwinCAT HMI DataGrid operation, and C# variables through a Server Extension plus standalone C# UI.
- Push the rebuilt branch to GitHub after validation.

Major changes:

- Kept PLC/HMI communication on TwinCAT HMI mapped ADS scalar symbols under `ADS.PLC1.HMI`.
- Kept DataGrid editing for `lrValue` and `bEnabled`; metadata fields stay read-only in HMI.
- HMI now automatically reads PLC once on page load and still supports manual `Read PLC`.
- HMI writes PLC only when `Write PLC` is pressed.
- C# Server Extension uses `ExportSymbol("Variables")` and `RequestListener.OnRequest`, matching the Beckhoff official sample pattern.
- Added `TcHmiCSharpBridge` to `TcHmiSrv.Config.default.json` `EXTENSIONS`.
- Added `TcHmiCSharpBridge` to the HMI publish profile `serverExtensions`.
- Added `TcHmiCSharpBridge/TcHmiCSharpBridge.nuspec` using the official sample package shape.
- Updated `OPENSPEC.md` for the rebuilt architecture and deployment checks.

User-reported problems from previous version:

- The previous implementation looked completely broken.
- PLC <-> HMI read/write was no longer reliable.
- C# <-> HMI could not be tested because the HMI/PLC base path was broken.
- User requested applying the Beckhoff official sample approach directly.

Current known / unconfirmed issues:

- HMI Live/Publish must still be tested on the local TwinCAT HMI Server.
- PLC online values must still be verified after Publish.
- `TcHmiCSharpBridge.Variables` must still be verified in TwinCAT HMI Configuration after Publish.
- Standalone C# UI builds, but live file-backed synchronization still needs retest after the extension is loaded by HMI Server.
- GitHub push is pending validation and commit.

Verification already run:

- `node --check TcHMI\Scripts\Bridge.js` passed.
- JSON parse validation passed for HMI publish config, HMI server config, and extension config files.
- `dotnet build TcHmiCSharpBridge\TcHmiCSharpBridge.csproj --configuration Debug --no-restore --verbosity minimal` passed.
- `dotnet build TcHmiCSharpBridge.Ui.sln --configuration Debug --no-restore --verbosity minimal` passed.
- `MSBuild TcHMI\TcHMI.hmiproj /p:Configuration=Debug /p:Platform="TwinCAT HMI" /v:minimal` passed.
- Confirmed `TcHmiCSharpBridge\bin\Debug` contains the extension DLL, shared DLL, and config JSON files.
- Confirmed `TcHMI\bin\Scripts\Bridge.js` contains the rebuilt script.
