using System.Text.Json;

namespace TcHmiCSharpBridge.Shared;

public static class BridgeStore
{
    private static readonly object SyncRoot = new();
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
    };

    public static string DataFilePath =>
        Environment.GetEnvironmentVariable("TCHMI_BRIDGE_DATA_PATH")
        ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "TcHmiCSharpBridge",
            "variables.json");

    public static BridgeVariable[] Load()
    {
        lock (SyncRoot)
        {
            EnsureCreated();
            var json = File.ReadAllText(DataFilePath);
            return JsonSerializer.Deserialize<BridgeVariable[]>(json, JsonOptions)
                   ?.Select(Clone)
                   .ToArray()
                   ?? [];
        }
    }

    public static void Save(IEnumerable<BridgeVariable> variables, string source)
    {
        lock (SyncRoot)
        {
            var normalized = variables.Select(variable => Normalize(variable, source)).ToArray();
            var directory = Path.GetDirectoryName(DataFilePath);
            if (!string.IsNullOrWhiteSpace(directory))
            {
                Directory.CreateDirectory(directory);
            }

            File.WriteAllText(DataFilePath, JsonSerializer.Serialize(normalized, JsonOptions));
        }
    }

    public static void Reset()
    {
        Save(CreateDefaults(), "CSharp");
    }

    public static BridgeVariable[] CreateDefaults()
    {
        return
        [
            new() { Index = 1, Name = "SpeedSetpoint", Value = 120.0, Enabled = true, Unit = "mm/s", Source = "CSharp" },
            new() { Index = 2, Name = "PressureLimit", Value = 5.5, Enabled = true, Unit = "bar", Source = "CSharp" },
            new() { Index = 3, Name = "BatchCount", Value = 12.0, Enabled = true, Unit = "pcs", Source = "CSharp" },
            new() { Index = 4, Name = "Temperature", Value = 36.5, Enabled = false, Unit = "degC", Source = "CSharp" }
        ];
    }

    private static void EnsureCreated()
    {
        if (File.Exists(DataFilePath))
        {
            return;
        }

        Save(CreateDefaults(), "CSharp");
    }

    private static BridgeVariable Normalize(BridgeVariable variable, string source)
    {
        var clone = Clone(variable);
        clone.Source = string.IsNullOrWhiteSpace(source) ? clone.Source : source;
        if (string.IsNullOrWhiteSpace(clone.Source))
        {
            clone.Source = "CSharp";
        }

        return clone;
    }

    public static BridgeVariable Clone(BridgeVariable variable)
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
