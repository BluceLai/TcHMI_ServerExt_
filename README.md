# TwinCAT HMI C# Server Extension Bridge

This sample shows the intended data path:

PLC `GVL HMI` <-> TwinCAT HMI DataGrid <-> C# TwinCAT HMI Server Extension

## What is included

- PLC DUT `ST_HmiRow` and global array `HMI.aRows`.
- `Desktop.view` with a TwinCAT HMI `TcHmiDatagrid`.
- `TcHMI/Scripts/Bridge.js` for reading/writing PLC ADS symbols and the C# extension symbol.
- `TcHmiCSharpBridge` C# Server Extension project exposing `TcHmiCSharpBridge.Variables`.
- `TcHmiCSharpBridge.Ui` WinForms tool for viewing and editing the same C# bridge rows.

## Expected symbols

The HMI script uses these default server symbols:

- PLC mapped symbols: `ADS.PLC1.HMI.nActiveRowCount` plus row fields like `ADS.PLC1.HMI.aRows.0.sName`
- C#: `TcHmiCSharpBridge.Variables`

If your ADS runtime name is not `PLC1`, change `PLC_DOMAIN` in `TcHMI/Scripts/Bridge.js`.
The HMI reads and writes TwinCAT HMI mapped symbols, not raw PLC symbol names. The mapping is zero-based in the HMI server (`aRows.0` maps to PLC `aRows[1]`). Individual mapped fields are used instead of the complete `ARRAY OF STRUCT`; this is easier to diagnose and works better with TwinCAT HMI ADS symbol access.

## Build notes

1. Restore NuGet packages in Visual Studio if `Packages/` is not present.
2. Build `TcHmiCSharpBridge`.
3. Add/deploy the generated C# extension DLL through TwinCAT HMI Server Extension configuration if it is not picked up automatically by your engineering environment.
4. Build and run the TwinCAT HMI project.

The DataGrid uses indirect editing. Press `Write PLC` after editing rows to write editable values back to PLC. PLC write-back intentionally updates `lrValue` and `bEnabled` only; `sName`, `sUnit`, index, and source are treated as PLC metadata.

## C# UI

For debugging, open `TcHmiCSharpBridge.Ui.sln` instead of the full TwinCAT solution, select `Debug | Any CPU`, and press F5. This solution only contains the executable WinForms project; `TcHmiCSharpBridge.Shared` remains referenced by the UI project but is no longer a launchable solution project.

Run `TcHmiCSharpBridge.Ui` from Visual Studio to open a DataGridView for the C# side.

- `Save` writes rows to the shared bridge store.
- TwinCAT HMI `Pull C#` reads the same rows through `TcHmiCSharpBridge.Variables`.
- TwinCAT HMI `Push C#` writes rows back to the same store, and the C# UI can auto refresh them.
- TwinCAT HMI `Read PLC` also syncs the PLC snapshot into `TcHmiCSharpBridge.Variables`, so the C# UI can see PLC-side changes after auto refresh or reload.

By default the shared JSON file is under `%PROGRAMDATA%\TcHmiCSharpBridge\variables.json`, so the HMI server process and the standalone C# UI can access the same file.
Set `TCHMI_BRIDGE_DATA_PATH` for both the HMI server process and the UI if you want a different shared location.

## HMI Live / Publish

`Desktop.view` uses TwinCAT HMI native controls (`TcHmiTextblock`, `TcHmiButton`, `TcHmiDatagrid`) instead of raw HTML buttons and containers. The DataGrid has sample rows, so a published page should show a visible table even before the PLC or C# extension is connected.

If the HMI page is still blank after publishing, clear the browser cache or reload with Ctrl+F5, then confirm that `TcHMI/bin/Scripts/Bridge.js` exists after building.
