const PLC_SYMBOL = "PLC1.HMI.aRows";
const EXTENSION_SYMBOL = "TcHmiCSharpBridge.Variables";
const STATUS_ID = "BridgeStatus";
const GRID_ID = "VariableGrid";
function setStatus(message) {
    const element = document.getElementById(STATUS_ID);
    if (element !== null) {
        element.textContent = message;
    }
}
function getGrid() {
    const controls = TcHmi?.Controls;
    if (controls?.get !== undefined) {
        return controls.get(GRID_ID);
    }
    return null;
}
function normalizeRows(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map((row, index) => ({
        index: Number(row?.nIndex ?? row?.index ?? row?.Index ?? index + 1),
        name: String(row?.sName ?? row?.name ?? row?.Name ?? ""),
        value: Number(row?.lrValue ?? row?.value ?? row?.Value ?? 0),
        enabled: Boolean(row?.bEnabled ?? row?.enabled ?? row?.Enabled ?? false),
        unit: String(row?.sUnit ?? row?.unit ?? row?.Unit ?? ""),
        source: String(row?.sSource ?? row?.source ?? row?.Source ?? "PLC")
    }));
}
function denormalizeRows(rows) {
    return rows.map((row) => ({
        nIndex: row.index,
        sName: row.name,
        lrValue: Number(row.value),
        bEnabled: Boolean(row.enabled),
        sUnit: row.unit,
        sSource: row.source
    }));
}
function toExtensionRows(rows) {
    return rows.map((row) => ({
        Index: row.index,
        Name: row.name,
        Value: Number(row.value),
        Enabled: Boolean(row.enabled),
        Unit: row.unit,
        Source: row.source
    }));
}
function readSymbol(symbolName) {
    return new Promise((resolve, reject) => {
        TcHmi.Server.readSymbol(symbolName, (data) => {
            if (data?.error === TcHmi.Errors.NONE) {
                resolve(data.value);
                return;
            }
            reject(new Error(`Read failed: ${symbolName}`));
        });
    });
}
function writeSymbol(symbolName, value) {
    return new Promise((resolve, reject) => {
        TcHmi.Server.writeSymbol(symbolName, value, (data) => {
            if (data?.error === TcHmi.Errors.NONE) {
                resolve();
                return;
            }
            reject(new Error(`Write failed: ${symbolName}`));
        });
    });
}
function setGridRows(rows) {
    const grid = getGrid();
    if (grid?.setSrcData !== undefined) {
        grid.setSrcData(rows);
    }
}
function getGridRows() {
    const grid = getGrid();
    if (grid?.getSrcData !== undefined) {
        return normalizeRows(grid.getSrcData());
    }
    return [];
}
async function loadFromPlc() {
    setStatus("Reading PLC rows...");
    const plcRows = await readSymbol(PLC_SYMBOL);
    setGridRows(normalizeRows(plcRows));
    setStatus(`Loaded from ${PLC_SYMBOL}`);
}
async function writeToPlc() {
    const rows = getGridRows();
    setStatus("Writing rows to PLC...");
    await writeSymbol(PLC_SYMBOL, denormalizeRows(rows));
    setStatus(`Wrote ${rows.length} rows to ${PLC_SYMBOL}`);
}
async function pushToExtension() {
    const rows = getGridRows().map((row) => ({
        ...row,
        source: "HMI"
    }));
    setStatus("Writing rows to C# extension...");
    await writeSymbol(EXTENSION_SYMBOL, toExtensionRows(rows));
    setStatus(`Wrote ${rows.length} rows to ${EXTENSION_SYMBOL}`);
}
async function pullFromExtension() {
    setStatus("Reading rows from C# extension...");
    const rows = await readSymbol(EXTENSION_SYMBOL);
    setGridRows(normalizeRows(rows));
    setStatus(`Loaded from ${EXTENSION_SYMBOL}`);
}
function bindButton(id, handler) {
    const button = document.getElementById(id);
    if (button === null) {
        return;
    }
    button.addEventListener("click", () => {
        button.disabled = true;
        handler()
            .catch((error) => setStatus(error.message))
            .finally(() => {
            button.disabled = false;
        });
    });
}
function init() {
    bindButton("ReadPlcButton", loadFromPlc);
    bindButton("WritePlcButton", writeToPlc);
    bindButton("PushExtensionButton", pushToExtension);
    bindButton("PullExtensionButton", pullFromExtension);
    void loadFromPlc().catch((error) => setStatus(error.message));
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
}
else {
    init();
}
//# sourceMappingURL=App.js.map