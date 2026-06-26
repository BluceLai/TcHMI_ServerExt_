using TcHmiSrv.Core;
using TcHmiSrv.Core.Tools.StaticSymbols;
using TcHmiSrv.Core.Tools.TypeAttribute;
using TcHmiCSharpBridge;

[assembly: ServerExtensionType(typeof(BridgeExtension))]
[assembly: ExportSymbol(
    "Variables",
    ReadValue = typeof(BridgeVariable[]),
    WriteValue = typeof(BridgeVariable[]),
    Access = Access.ReadWrite,
    AddSymbol = true,
    Description = "Rows mirrored between PLC, TwinCAT HMI Datagrid, and the C# server extension.")]
