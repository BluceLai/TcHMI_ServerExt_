using System.ComponentModel;
using TcHmiCSharpBridge.Shared;

namespace TcHmiCSharpBridge.Ui;

public sealed class MainForm : Form
{
    private readonly BindingList<BridgeVariable> variables = [];
    private readonly DataGridView grid = new();
    private readonly Label statusLabel = new();
    private readonly CheckBox autoRefreshCheckBox = new();
    private readonly System.Windows.Forms.Timer refreshTimer = new();
    private bool loading;
    private bool dirty;
    private DateTime lastFileWriteTimeUtc;

    public MainForm()
    {
        Text = "TwinCAT HMI C# Bridge";
        Width = 980;
        Height = 620;
        MinimumSize = new Size(760, 420);
        StartPosition = FormStartPosition.CenterScreen;

        var toolbar = CreateToolbar();
        ConfigureGrid();

        statusLabel.AutoSize = false;
        statusLabel.Dock = DockStyle.Bottom;
        statusLabel.Height = 28;
        statusLabel.Padding = new Padding(10, 6, 10, 0);

        Controls.Add(grid);
        Controls.Add(statusLabel);
        Controls.Add(toolbar);

        refreshTimer.Interval = 1000;
        refreshTimer.Tick += (_, _) => AutoRefreshFromStore();

        Load += (_, _) =>
        {
            LoadFromStore();
            refreshTimer.Start();
        };
    }

    private Control CreateToolbar()
    {
        var panel = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 48,
            Padding = new Padding(10, 8, 10, 8),
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false
        };

        panel.Controls.Add(CreateButton("Reload", (_, _) => LoadFromStore()));
        panel.Controls.Add(CreateButton("Save", (_, _) => SaveToStore()));
        panel.Controls.Add(CreateButton("Add Row", (_, _) => AddRow()));
        panel.Controls.Add(CreateButton("Delete Row", (_, _) => DeleteSelectedRows()));
        panel.Controls.Add(CreateButton("Defaults", (_, _) => ResetDefaults()));

        autoRefreshCheckBox.Text = "Auto refresh";
        autoRefreshCheckBox.Checked = true;
        autoRefreshCheckBox.AutoSize = true;
        autoRefreshCheckBox.Margin = new Padding(18, 7, 0, 0);
        panel.Controls.Add(autoRefreshCheckBox);

        return panel;
    }

    private static Button CreateButton(string text, EventHandler click)
    {
        var button = new Button
        {
            Text = text,
            Width = 92,
            Height = 30,
            Margin = new Padding(0, 0, 8, 0)
        };
        button.Click += click;
        return button;
    }

    private void ConfigureGrid()
    {
        grid.Dock = DockStyle.Fill;
        grid.AutoGenerateColumns = false;
        grid.AllowUserToAddRows = false;
        grid.AllowUserToDeleteRows = true;
        grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        grid.MultiSelect = true;
        grid.DataSource = variables;

        grid.Columns.Add(CreateTextColumn(nameof(BridgeVariable.Index), "Index", 70));
        grid.Columns.Add(CreateTextColumn(nameof(BridgeVariable.Name), "Name", 240));
        grid.Columns.Add(CreateTextColumn(nameof(BridgeVariable.Value), "Value", 120));
        grid.Columns.Add(new DataGridViewCheckBoxColumn
        {
            DataPropertyName = nameof(BridgeVariable.Enabled),
            HeaderText = "Enabled",
            Width = 90
        });
        grid.Columns.Add(CreateTextColumn(nameof(BridgeVariable.Unit), "Unit", 120));
        grid.Columns.Add(CreateTextColumn(nameof(BridgeVariable.Source), "Source", 140, true));

        grid.CellValueChanged += (_, _) => MarkDirty();
        grid.CurrentCellDirtyStateChanged += (_, _) =>
        {
            if (grid.IsCurrentCellDirty)
            {
                grid.CommitEdit(DataGridViewDataErrorContexts.Commit);
            }
        };
        grid.UserDeletedRow += (_, _) => MarkDirty();
    }

    private static DataGridViewTextBoxColumn CreateTextColumn(
        string propertyName,
        string headerText,
        int width,
        bool readOnly = false)
    {
        return new DataGridViewTextBoxColumn
        {
            DataPropertyName = propertyName,
            HeaderText = headerText,
            Width = width,
            ReadOnly = readOnly
        };
    }

    private void LoadFromStore()
    {
        loading = true;
        try
        {
            variables.Clear();
            foreach (var variable in BridgeStore.Load())
            {
                variables.Add(variable);
            }

            dirty = false;
            UpdateLastFileWriteTime();
            SetStatus("Loaded");
        }
        catch (Exception ex)
        {
            SetStatus(ex.Message);
        }
        finally
        {
            loading = false;
        }
    }

    private void SaveToStore()
    {
        try
        {
            BridgeStore.Save(variables, "CSharpUI");
            dirty = false;
            UpdateLastFileWriteTime();
            SetStatus("Saved for TwinCAT HMI");
        }
        catch (Exception ex)
        {
            SetStatus(ex.Message);
        }
    }

    private void AddRow()
    {
        var nextIndex = variables.Count == 0 ? 1 : variables.Max(variable => variable.Index) + 1;
        variables.Add(new BridgeVariable
        {
            Index = (ushort)nextIndex,
            Name = $"Variable{nextIndex}",
            Value = 0,
            Enabled = true,
            Unit = "",
            Source = "CSharpUI"
        });
        MarkDirty();
    }

    private void DeleteSelectedRows()
    {
        foreach (DataGridViewRow row in grid.SelectedRows)
        {
            if (row.DataBoundItem is BridgeVariable variable)
            {
                variables.Remove(variable);
            }
        }

        MarkDirty();
    }

    private void ResetDefaults()
    {
        var result = MessageBox.Show(
            "Replace current bridge rows with default values?",
            Text,
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);

        if (result != DialogResult.Yes)
        {
            return;
        }

        BridgeStore.Reset();
        LoadFromStore();
    }

    private void AutoRefreshFromStore()
    {
        if (!autoRefreshCheckBox.Checked || dirty || !File.Exists(BridgeStore.DataFilePath))
        {
            return;
        }

        var writeTime = File.GetLastWriteTimeUtc(BridgeStore.DataFilePath);
        if (writeTime > lastFileWriteTimeUtc)
        {
            LoadFromStore();
        }
    }

    private void MarkDirty()
    {
        if (loading)
        {
            return;
        }

        dirty = true;
        SetStatus("Edited. Press Save to send to TwinCAT HMI.");
    }

    private void UpdateLastFileWriteTime()
    {
        lastFileWriteTimeUtc = File.Exists(BridgeStore.DataFilePath)
            ? File.GetLastWriteTimeUtc(BridgeStore.DataFilePath)
            : DateTime.MinValue;
    }

    private void SetStatus(string message)
    {
        statusLabel.Text = $"{message} | {BridgeStore.DataFilePath}";
    }
}
