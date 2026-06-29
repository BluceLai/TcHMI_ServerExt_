# OPENSPEC: TwinCAT HMI C# Server Extension Bridge

## Purpose

This document is the working specification for this repository. Follow it before changing PLC variables, TwinCAT HMI mappings, HMI JavaScript, the C# Server Extension, or the standalone C# UI.

The goal is to prevent repeated mistakes around:

- Raw PLC symbols vs TwinCAT HMI mapped symbols.
- PLC array index vs HMI mapped index.
- Whole `ARRAY OF STRUCT` access vs scalar field access.
- C# Server Extension vs standalone C# UI responsibilities.
- Publish/deploy configuration that is local-machine specific.

This is a living specification. When a bug is fixed or behavior changes, update this file in the same task so future work does not repeat the same mistake.

## Target Architecture

```text
PLC GVL HMI
  HMI.aRows[1..8] : ARRAY OF ST_HmiRow
  HMI.nActiveRowCount
  HMI.bCommitRequested
        |
        | TwinCAT HMI mapped symbols
        v
TwinCAT HMI Server
  ADS.PLC1.HMI.aRows.0.lrValue
  ADS.PLC1.HMI.aRows.0.bEnabled
  TcHmiCSharpBridge.Variables
        |
        v
TwinCAT HMI page
  TcHmiDatagrid
  TcHmi.Server.readSymbol/writeSymbol
        |
        v
C# Server Extension
  TcHmiCSharpBridge : IServerExtension
  ExportSymbol("Variables")
        |
        v
Shared store
  %PROGRAMDATA%\TcHmiCSharpBridge\variables.json
        |
        v
Standalone C# UI
  TcHmiCSharpBridge.Ui
```

The standalone C# UI is not loaded by TwinCAT HMI Server. It is an external tool. It sees HMI data only through the shared store used by the C# Server Extension, or through another explicit communication layer added in the future.

## Hard Rules

1. Do not use raw PLC symbol names in HMI JavaScript for mapped PLC variables.

   Correct:

   ```js
   ADS.PLC1.HMI.aRows.0.lrValue
   ```

   Avoid:

   ```js
   PLC1.HMI.aRows[1].lrValue
   ```

2. Treat TwinCAT HMI mapped array indexes as zero-based.

   ```text
   HMI mapped symbol aRows.0 -> PLC online/watch aRows[1]
   HMI mapped symbol aRows.7 -> PLC online/watch aRows[8]
   ```

3. Do not read or write the complete `ARRAY OF STRUCT` from HMI JavaScript.

   Use scalar fields:

   ```js
   ADS.PLC1.HMI.aRows.0.lrValue
   ADS.PLC1.HMI.aRows.0.bEnabled
   ```

   Avoid:

   ```js
   ADS.PLC1.HMI.aRows
   PLC1.HMI.aRows
   ```

4. Only write PLC fields that are intended to be operator inputs.

   Current writable PLC fields:

   - `lrValue`
   - `bEnabled`

   Current metadata/read-only fields:

   - `nIndex`
   - `sName`
   - `sUnit`
   - `sSource`
   - `nActiveRowCount`

5. Do not assume the C# UI and HMI Server use the same `%LOCALAPPDATA%`.

   The shared default path must be:

   ```text
   %PROGRAMDATA%\TcHmiCSharpBridge\variables.json
   ```

   If using `TCHMI_BRIDGE_DATA_PATH`, set it for both the HMI Server process and the standalone C# UI.

6. Do not commit machine-specific publish secrets.

   `TcHMI/Properties/tchmipublish.config.json` can contain local server host, user, and encrypted password. Review carefully before staging or pushing it.

7. Keep this file synchronized with implementation changes.

   Any change to PLC mapping, HMI symbol names, C# extension deployment, shared storage, button behavior, or troubleshooting rules must update `OPENSPEC.md` before the task is considered complete.

8. Use a local branch for every revision.

   Start new change work from a local branch such as:

   ```powershell
   git switch -c codex/<short-change-name>
   ```

   Push to GitHub only when explicitly needed or requested.

   Also update `BRANCH_LOG.md` on every branch with:

   - Branch name and purpose.
   - Major changes.
   - User-reported problems from the previous version.
   - Current known or unconfirmed issues.
   - Verification already run.

9. Keep PLC/HMI stable before enabling continuous automation.

   The default HMI behavior is one automatic `Read PLC` when the page loads, plus manual `Read PLC` and manual `Write PLC` buttons. Do not enable continuous PLC polling or automatic C# to PLC writeback by default until the C# Server Extension is proven loaded and stable on the target HMI Server.

## PLC Contract

The PLC global variable list is `HMI`.

Required variables:

```iecst
{attribute 'qualified_only'}
VAR_GLOBAL
    aRows : ARRAY[1..8] OF ST_HmiRow;
    nActiveRowCount : UINT;
    nLastChangedIndex : UINT;
    bCommitRequested : BOOL;
END_VAR
```

Required structure:

```iecst
TYPE ST_HmiRow :
STRUCT
    nIndex : UINT;
    sName : STRING(40);
    lrValue : LREAL;
    bEnabled : BOOL;
    sUnit : STRING(16);
    sSource : STRING(16);
END_STRUCT
END_TYPE
```

PLC logic should not overwrite HMI-writeable values every cycle. Only housekeeping such as `nIndex` and `sSource` should be updated after `bCommitRequested`.

## HMI Mapping Contract

Every PLC field used by HMI JavaScript must exist under TwinCAT HMI mapped symbols and must be allowed for the user group that runs the page.

Required mapped symbols:

```text
ADS.PLC1.HMI.nActiveRowCount
ADS.PLC1.HMI.bCommitRequested
ADS.PLC1.HMI.aRows.0.nIndex
ADS.PLC1.HMI.aRows.0.sName
ADS.PLC1.HMI.aRows.0.lrValue
ADS.PLC1.HMI.aRows.0.bEnabled
ADS.PLC1.HMI.aRows.0.sUnit
ADS.PLC1.HMI.aRows.0.sSource
...
ADS.PLC1.HMI.aRows.7.*
```

Required C# extension symbol:

```text
TcHmiCSharpBridge.Variables
```

Required access:

- `__SystemUsers` needs read/write access for all symbols used by the page.
- `__SystemAdministrators` should have read/write access for extension symbols.

## HMI JavaScript Contract

Main file:

```text
TcHMI/Scripts/Bridge.js
```

Rules:

- Use `TcHmi.Server.readSymbol` and `TcHmi.Server.writeSymbol`.
- Check `data.error` and `data.results[0].error`.
- Display exact failed symbol in the status line.
- Read PLC row count first.
- Read row fields one scalar symbol at a time.
- Write only `lrValue` and `bEnabled` back to PLC.
- Set `bCommitRequested` after writing rows.
- After `Read PLC`, sync the snapshot into `TcHmiCSharpBridge.Variables`.

Expected read flow:

```text
HMI page load or Read PLC button
  -> read ADS.PLC1.HMI.nActiveRowCount
  -> read ADS.PLC1.HMI.aRows.N.* fields
  -> set DataGrid rows
  -> write TcHmiCSharpBridge.Variables with Source = PLC
  -> C# UI can reload/auto-refresh
```

Expected write flow:

```text
Write PLC button
  -> collect DataGrid prepared values
  -> write ADS.PLC1.HMI.aRows.N.lrValue
  -> write ADS.PLC1.HMI.aRows.N.bEnabled
  -> write ADS.PLC1.HMI.bCommitRequested = true
  -> write TcHmiCSharpBridge.Variables
  -> C# UI can reload/auto-refresh
```

Expected C# UI to PLC flow:

```text
C# UI Save
  -> write %PROGRAMDATA%\TcHmiCSharpBridge\variables.json with Source = CSharpUI
  -> HMI Pull C#
  -> HMI sets DataGrid rows from TcHmiCSharpBridge.Variables
  -> operator confirms with HMI Write PLC
  -> HMI writes lrValue and bEnabled to PLC
  -> HMI writes TcHmiCSharpBridge.Variables with Source = HMI
```

Automatic C# UI to PLC writeback is intentionally disabled in the stable baseline. If it is added later, it must be feature-flagged and must not replace the manual PLC/HMI path until verified.

Expected C# flow:

```text
Push C#
  -> write current HMI DataGrid rows to TcHmiCSharpBridge.Variables

Pull C#
  -> read TcHmiCSharpBridge.Variables
  -> display in HMI DataGrid
```

## C# Server Extension Contract

Main project:

```text
TcHmiCSharpBridge/TcHmiCSharpBridge.csproj
```

Required attributes:

```csharp
[assembly: ServerExtensionType(typeof(BridgeExtension))]
[assembly: ExportSymbol(
    "Variables",
    ReadValue = typeof(BridgeVariable[]),
    WriteValue = typeof(BridgeVariable[]),
    Access = Access.ReadWrite,
    AddSymbol = true)]
```

Required extension:

```csharp
public sealed class BridgeExtension : IServerExtension
{
    private readonly RequestListener requestListener = new();

    public ErrorValue Init()
    {
        requestListener.OnRequest += OnRequest;
        return ErrorValue.HMI_SUCCESS;
    }
}
```

The exported HMI symbol name is:

```text
TcHmiCSharpBridge.Variables
```

The implementation must follow the Beckhoff `TF2000_Server_Samples` `StaticSymbols` pattern:

- Register `RequestListener.OnRequest` in `Init`.
- Check `command.Mapping`.
- Use `command.WriteValue is null` to distinguish read from write.
- Set `command.ReadValue` on success.
- Set `command.SubsymbolHandled = true` for handled symbols.
- Convert between `Value` and .NET objects through `TcHmiJsonSerializer` / `ValueJsonConverter`.

Do not rely on a plain C# property getter/setter being called automatically for HMI symbol reads/writes.

The extension project must also carry HMI Server Extension metadata:

```xml
<TcHmiProjectFileVersion>1.0.0.0</TcHmiProjectFileVersion>
<TcHmiExtensionTypes>{5DF3DCF0-60A1-4102-985E-1810812D0E69}</TcHmiExtensionTypes>
```

The build output must include the extension config files next to the DLL:

```text
TcHmiCSharpBridge.dll
TcHmiCSharpBridge.Shared.dll
TcHmiCSharpBridge.Config.json
TcHmiCSharpBridge.Schema.json
TcHmiCSharpBridge.Language.en.json
```

Package spec:

```text
TcHmiCSharpBridge/TcHmiCSharpBridge.nuspec
```

The `.nuspec` file follows the Beckhoff `TF2000_Server_Samples` `StaticSymbols` package shape and must include:

- `TcHmiCSharpBridge.dll`
- `TcHmiCSharpBridge.Shared.dll`
- `TcHmiCSharpBridge.*.json`

If `Push C#` or `Pull C#` fails, verify:

- The extension DLL is built.
- The extension is installed/deployed into TwinCAT HMI Server.
- The extension appears in TwinCAT HMI Server configuration.
- `TcHmiCSharpBridge.Variables` exists under HMI Server symbols.
- The user group has read/write access.
- The publish profile includes the `TcHmiCSharpBridge` server extension for the local test machine.

## Standalone C# UI Contract

Main project:

```text
TcHmiCSharpBridge.Ui/TcHmiCSharpBridge.Ui.csproj
```

Rules:

- This project must be launched from `TcHmiCSharpBridge.Ui.sln` for normal debugging.
- It is a standalone WinForms tool, not a TwinCAT HMI Server Extension.
- It should not reference TwinCAT HMI runtime APIs unless a deliberate live client feature is added.
- It reads and writes the same shared store as the Server Extension.
- Auto refresh is file-based. If the HMI Server writes another file path, the UI will not update.

Default shared path:

```text
%PROGRAMDATA%\TcHmiCSharpBridge\variables.json
```

## Publish And Deployment Contract

Before testing HMI Live or Publish:

1. Build PLC and activate/download if PLC variables changed.
2. Build `TcHmiCSharpBridge`.
3. Build `TcHMI`.
4. Confirm `TcHMI/bin/Scripts/Bridge.js` contains the latest script.
5. Confirm `TcHMI/Server/TcHmiSrv/TcHmiSrv.Config.default.json` contains an `EXTENSIONS.TcHmiCSharpBridge` entry.
6. Confirm `TcHMI/Properties/tchmipublish.config.json` includes `TcHmiCSharpBridge` under `serverExtensions` for local publish.
7. Confirm the C# extension is published/installed in TwinCAT HMI Server.
8. Confirm mapped symbols exist in TwinCAT HMI Configuration.
9. Confirm `TcHmiCSharpBridge.Variables` exists in TwinCAT HMI Configuration.
10. Reload browser with cache refresh if UI behavior looks stale.

Do not rely on `tchmipublish.config.json` in Git for another machine. It may be local and secret-bearing.

## Build Commands

Run these from the repo root:

```powershell
dotnet build .\TcHmiCSharpBridge\TcHmiCSharpBridge.csproj --configuration Debug --no-restore --verbosity minimal
dotnet build .\TcHmiCSharpBridge.Ui.sln --configuration Debug --no-restore --verbosity minimal
& 'C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe' .\TcHMI\TcHMI.hmiproj /p:Configuration=Debug /p:Platform='TwinCAT HMI' /v:minimal
node --check .\TcHMI\Scripts\Bridge.js
```

Avoid running multiple `dotnet build` commands in parallel when both touch `TcHmiCSharpBridge.Shared`; it can lock the same `Shared.dll`.

## Change Checklist

When adding or changing a PLC row field:

- Update `ST_HmiRow`.
- Update `HMI.TcGVL` defaults.
- Update TwinCAT HMI mapped symbols.
- Update symbol permissions.
- Update `Bridge.js` read normalization.
- Decide if the field is writable or metadata.
- Update DataGrid column editability.
- Update `BridgeVariable` if the C# model needs it.
- Update C# UI columns if needed.
- Build C# extension, C# UI, and HMI.

When changing the ADS runtime name:

- Update `PLC_DOMAIN` in `Bridge.js`.
- Update HMI mapped symbol names.
- Update HMI Server symbol mappings.
- Confirm the runtime in `ADS.Config.default.json`.

When changing shared C# storage:

- Update `BridgeStore.DataFilePath`.
- Confirm HMI Server process can read/write the path.
- Confirm C# UI can read/write the same path.
- Document required environment variables.

## Troubleshooting

`Read failed: PLC1.HMI...`

- HMI JavaScript is using raw PLC symbols. Use `ADS.PLC1.HMI...` mapped symbols.

`Read failed: ADS.PLC1.HMI.nActiveRowCount`

- Mapping does not exist, ADS runtime is not connected, PLC is not active, or symbol permission is missing.

`Write failed: ADS.PLC1.HMI.aRows.0.sName`

- The UI attempted to write metadata/string fields. Write only `lrValue` and `bEnabled` unless PLC/HMI config explicitly supports more.

`Push C#` or `Pull C#` fails

- `TcHmiCSharpBridge.Variables` is missing or the C# Server Extension is not deployed/loaded.

C# UI does not show PLC changes

- Press HMI `Read PLC` or `Write PLC` first; both should sync `TcHmiCSharpBridge.Variables`.
- Confirm status says C# extension sync succeeded.
- Confirm both HMI Server Extension and C# UI use `%PROGRAMDATA%\TcHmiCSharpBridge\variables.json`.
- Confirm C# UI Auto refresh is enabled or press Reload.
- Confirm the local publish profile includes `TcHmiCSharpBridge`.
- If C# UI still shows default rows, delete or reset `%PROGRAMDATA%\TcHmiCSharpBridge\variables.json`, then retest after HMI sync succeeds.

C# UI changes do not write back to PLC

- Confirm the C# UI row `Source` becomes `CSharpUI` after Save.
- Press HMI `Pull C#`.
- Confirm the HMI DataGrid shows the C# UI rows.
- Press HMI `Write PLC`.
- Confirm `TcHmiCSharpBridge.Variables` is served by a loaded C# Server Extension, not just manually declared in `TcHmiSrv.Config.default.json`.
- Confirm the extension follows the Beckhoff `StaticSymbols` sample pattern: register `RequestListener.OnRequest`, inspect `command.Mapping`, use `command.WriteValue` for writes, and set `command.ReadValue` for reads.
- Confirm the extension package/config files are installed or publishable; symbol declaration alone is not enough.

HMI page is blank after Publish

- Confirm `Default.tpl` includes `Scripts/Bridge.js`.
- Confirm `TcHMI/bin/Scripts/Bridge.js` exists.
- Refresh browser cache.
- Check TwinCAT HMI Server logs.

## Review Rules For Future Code Changes

Before committing:

- Confirm the work is on a local feature branch, not directly on `main`.
- Confirm `BRANCH_LOG.md` reflects the branch changes, user-reported regressions, and remaining unconfirmed issues.
- Do not stage unrelated TwinCAT/Visual Studio auto changes unless they are part of the fix.
- Do not stage `tchmipublish.config.json` unless intentionally sharing local publish settings.
- Update `OPENSPEC.md` whenever the fix changes behavior, deployment, or troubleshooting knowledge.
- Run the build commands above.
- Verify failed HMI status messages include exact symbol names.
- Keep PLC metadata read-only in the HMI unless a real write requirement exists.
