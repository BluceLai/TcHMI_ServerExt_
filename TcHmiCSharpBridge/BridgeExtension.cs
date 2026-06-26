using TcHmiSrv.Core;
using TcHmiSrv.Core.Tools.Management;

namespace TcHmiCSharpBridge;

public sealed class BridgeExtension : IServerExtension
{
    private readonly object syncRoot = new();

    private BridgeVariable[] variables =
    [
        new() { Index = 1, Name = "SpeedSetpoint", Value = 120.0, Enabled = true, Unit = "mm/s" },
        new() { Index = 2, Name = "PressureLimit", Value = 5.5, Enabled = true, Unit = "bar" },
        new() { Index = 3, Name = "BatchCount", Value = 12, Enabled = true, Unit = "pcs" },
        new() { Index = 4, Name = "Temperature", Value = 36.5, Enabled = false, Unit = "degC" }
    ];

    public ErrorValue Init()
    {
        return ErrorValue.HMI_SUCCESS;
    }

    public BridgeVariable[] Variables
    {
        get
        {
            lock (syncRoot)
            {
                return variables.Select(Clone).ToArray();
            }
        }

        set
        {
            lock (syncRoot)
            {
                variables = (value ?? []).Select(Normalize).ToArray();
            }
        }
    }

    private static BridgeVariable Normalize(BridgeVariable variable)
    {
        var clone = Clone(variable);
        clone.Source = string.IsNullOrWhiteSpace(clone.Source) ? "CSharp" : clone.Source;
        return clone;
    }

    private static BridgeVariable Clone(BridgeVariable variable)
    {
        return new BridgeVariable
        {
            Index = variable.Index,
            Name = variable.Name,
            Value = variable.Value,
            Enabled = variable.Enabled,
            Unit = variable.Unit,
            Source = variable.Source
        };
    }
}
