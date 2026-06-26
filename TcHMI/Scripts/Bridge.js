const PLC_SYMBOL = "PLC1.HMI.aRows";
const EXTENSION_SYMBOL = "TcHmiCSharpBridge.Variables";
const STATUS_ID = "BridgeStatus";
const GRID_ID = "VariableGrid";

function getControls() {
    if (typeof TcHmi === "undefined") {
        return null;
    }

    return TcHmi.Controls;
}

function setStatus(message, attempts = 0) {
    const statusControl = getControls()?.get?.(STATUS_ID);
    if (statusControl?.setText !== undefined) {
        statusControl.setText(message);
        return;
    }

    const element = document.getElementById(STATUS_ID);
    if (element !== null) {
        element.textContent = message;
        return;
    }

    if (attempts < 50) {
        window.setTimeout(() => setStatus(message, attempts + 1), 100);
    }
}

function getGrid() {
    const controls = getControls();
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
        nIndex: Number(row?.nIndex ?? row?.index ?? row?.Index ?? index + 1),
        sName: String(row?.sName ?? row?.name ?? row?.Name ?? ""),
        lrValue: Number(row?.lrValue ?? row?.value ?? row?.Value ?? 0),
        bEnabled: Boolean(row?.bEnabled ?? row?.enabled ?? row?.Enabled ?? false),
        sUnit: String(row?.sUnit ?? row?.unit ?? row?.Unit ?? ""),
        sSource: String(row?.sSource ?? row?.source ?? row?.Source ?? "PLC")
    }));
}

function denormalizeRows(rows) {
    return rows.map((row) => ({
        nIndex: row.nIndex,
        sName: row.sName,
        lrValue: Number(row.lrValue),
        bEnabled: Boolean(row.bEnabled),
        sUnit: row.sUnit,
        sSource: row.sSource
    }));
}

function toExtensionRows(rows) {
    return rows.map((row) => ({
        Index: row.nIndex,
        Name: row.sName,
        Value: Number(row.lrValue),
        Enabled: Boolean(row.bEnabled),
        Unit: row.sUnit,
        Source: row.sSource
    }));
}

function readSymbol(symbolName) {
    return new Promise((resolve, reject) => {
        TcHmi.Server.readSymbol(symbolName, (data) => {
            const result = data?.results?.[0];
            if (data?.error === TcHmi.Errors.NONE && result?.error === TcHmi.Errors.NONE) {
                resolve(result.value);
                return;
            }

            reject(new Error(`Read failed: ${symbolName} (${formatError(data, result)})`));
        });
    });
}

function writeSymbol(symbolName, value) {
    return new Promise((resolve, reject) => {
        TcHmi.Server.writeSymbol(symbolName, value, (data) => {
            const result = data?.results?.[0];
            if (data?.error === TcHmi.Errors.NONE && (result === undefined || result.error === TcHmi.Errors.NONE)) {
                resolve();
                return;
            }

            reject(new Error(`Write failed: ${symbolName} (${formatError(data, result)})`));
        });
    });
}

function formatError(data, result) {
    const detail = result?.details ?? data?.details ?? data?.response?.error ?? result?.error ?? data?.error;
    if (typeof detail === "string") {
        return detail;
    }

    if (detail?.reason) {
        return detail.reason;
    }

    if (detail?.message) {
        return detail.message;
    }

    if (detail?.code !== undefined) {
        return `code ${detail.code}`;
    }

    return "unknown error";
}

function setGridRows(rows) {
    const grid = getGrid();
    if (grid?.setSrcData !== undefined) {
        grid.setSrcData(rows);
    }
}

function getGridRows() {
    const grid = getGrid();
    if (grid?.writePreparedValues !== undefined) {
        grid.writePreparedValues();
    }

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
        sSource: "HMI"
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
    if (typeof TcHmi === "undefined" || TcHmi.EventProvider === undefined) {
        window.setTimeout(() => bindButton(id, handler), 100);
        return;
    }

    let running = false;
    const run = () => {
        if (running) {
            return;
        }

        running = true;
        const button = TcHmi.Controls.get(id);
        if (button?.setIsEnabled !== undefined) {
            button.setIsEnabled(false);
        }

        handler()
            .catch((error) => setStatus(error.message))
            .finally(() => {
                if (button?.setIsEnabled !== undefined) {
                    button.setIsEnabled(true);
                }
                window.setTimeout(() => {
                    running = false;
                }, 100);
            });
    };

    TcHmi.EventProvider.register(`${id}.onStatePressed`, run);

    bindDomButton(id, run);
}

function bindDomButton(id, run, attempts = 0) {
    const element = document.getElementById(id);
    if (element !== null) {
        element.addEventListener("click", run);
        return;
    }

    if (attempts < 50) {
        window.setTimeout(() => bindDomButton(id, run, attempts + 1), 100);
    }
}

function init() {
    bindButton("ReadPlcButton", loadFromPlc);
    bindButton("WritePlcButton", writeToPlc);
    bindButton("PushExtensionButton", pushToExtension);
    bindButton("PullExtensionButton", pullFromExtension);
    setStatus("Bridge ready. Press Read PLC to load PLC1.HMI.aRows.");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
