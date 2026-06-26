namespace TcHmiCSharpBridge.Shared;

public sealed class BridgeVariable
{
    public ushort Index { get; set; }

    public string Name { get; set; } = string.Empty;

    public double Value { get; set; }

    public bool Enabled { get; set; }

    public string Unit { get; set; } = string.Empty;

    public string Source { get; set; } = "CSharp";
}
