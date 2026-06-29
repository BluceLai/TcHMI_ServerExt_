using Newtonsoft.Json;
using TcHmiSrv.Core;
using TcHmiSrv.Core.General;
using TcHmiSrv.Core.Listeners;
using TcHmiSrv.Core.Listeners.RequestListenerEventArgs;
using TcHmiSrv.Core.Tools.Json.Newtonsoft;
using TcHmiSrv.Core.Tools.Json.Newtonsoft.Converters;
using TcHmiSrv.Core.Tools.Management;
using TcHmiCSharpBridge.Shared;

namespace TcHmiCSharpBridge;

public sealed class BridgeExtension : IServerExtension
{
    private const string VariablesMapping = "Variables";
    private readonly RequestListener requestListener = new();

    public ErrorValue Init()
    {
        try
        {
            _ = BridgeStore.Load();
            requestListener.OnRequest += OnRequest;
            _ = TcHmiAsyncLogger.Send(Severity.Info, "TcHmiCSharpBridge initialized.");
            return ErrorValue.HMI_SUCCESS;
        }
        catch (Exception ex)
        {
            _ = TcHmiAsyncLogger.Send(Severity.Error, $"TcHmiCSharpBridge init failed: {ex}");
            return ErrorValue.HMI_E_EXTENSION_LOAD;
        }
    }

    private static Value ReadVariables()
    {
        var rows = BridgeStore.Load();
        var json = JsonConvert.SerializeObject(rows);
        return TcHmiJsonSerializer.Deserialize(ValueJsonConverter.DefaultConverter, json);
    }

    private static Value WriteVariables(Value writeValue)
    {
        var json = TcHmiJsonSerializer.Serialize(ValueJsonConverter.DefaultConverter, writeValue);
        var rows = JsonConvert.DeserializeObject<BridgeVariable[]>(json) ?? [];
        BridgeStore.Save(rows, "TwinCAT HMI");
        return ReadVariables();
    }

    private void OnRequest(object? sender, OnRequestEventArgs e)
    {
        foreach (var command in e.Commands)
        {
            try
            {
                if (!string.Equals(command.Mapping, VariablesMapping, StringComparison.Ordinal))
                {
                    command.ExtensionResult = (uint)ErrorValue.HMI_E_EXTENSION;
                    command.ResultString = $"Unknown mapping: {command.Mapping}";
                    continue;
                }

                if (command.Path.Count() > 0)
                {
                    command.ExtensionResult = (uint)ErrorValue.HMI_E_EXTENSION;
                    command.ResultString = "Subsymbols are not supported for TcHmiCSharpBridge.Variables.";
                    continue;
                }

                command.ReadValue = command.WriteValue is null
                    ? ReadVariables()
                    : WriteVariables(command.WriteValue);
                command.SubsymbolHandled = true;
            }
            catch (Exception ex)
            {
                command.ExtensionResult = (uint)ErrorValue.HMI_E_EXTENSION;
                command.ResultString = ex.ToString();
            }
        }
    }
}
