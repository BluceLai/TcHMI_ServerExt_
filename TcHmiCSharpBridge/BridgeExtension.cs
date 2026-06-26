using TcHmiSrv.Core;
using TcHmiSrv.Core.Tools.Management;
using TcHmiCSharpBridge.Shared;

namespace TcHmiCSharpBridge;

public sealed class BridgeExtension : IServerExtension
{
    public ErrorValue Init()
    {
        _ = BridgeStore.Load();
        return ErrorValue.HMI_SUCCESS;
    }

    public BridgeVariable[] Variables
    {
        get
        {
            return BridgeStore.Load();
        }

        set
        {
            BridgeStore.Save(value ?? [], "TwinCAT HMI");
        }
    }
}
