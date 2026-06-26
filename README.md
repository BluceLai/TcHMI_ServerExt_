# TwinCAT HMI C# Server Extension Bridge

This sample shows the intended data path:

PLC `GVL HMI` <-> TwinCAT HMI DataGrid <-> C# TwinCAT HMI Server Extension

## What is included

- PLC DUT `ST_HmiRow` and global array `HMI.aRows`.
- `Desktop.view` with a TwinCAT HMI `TcHmiDatagrid`.
- `TcHMI/App.ts` for reading/writing PLC ADS symbols and the C# extension symbol.
- `TcHmiCSharpBridge` C# Server Extension project exposing `TcHmiCSharpBridge.Variables`.

## Expected symbols

The HMI script uses these default server symbols:

- PLC: `PLC1.HMI.aRows`
- C#: `TcHmiCSharpBridge.Variables`

If your ADS runtime name is not `PLC1`, change `PLC_SYMBOL` in `TcHMI/App.ts`.

## Build notes

1. Restore NuGet packages in Visual Studio if `Packages/` is not present.
2. Build `TcHmiCSharpBridge`.
3. Add/deploy the generated C# extension DLL through TwinCAT HMI Server Extension configuration if it is not picked up automatically by your engineering environment.
4. Build and run the TwinCAT HMI project.

The DataGrid uses indirect editing. Press `Write PLC` after editing rows to write the values back to `HMI.aRows`.
