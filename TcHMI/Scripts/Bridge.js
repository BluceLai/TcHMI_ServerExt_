const PLC_DOMAIN = "PLC1";
const PLC_GVL = "HMI";
const PLC_ROW_COUNT = 8;
const PLC_ACTIVE_COUNT_SYMBOL = `${PLC_DOMAIN}.${PLC_GVL}.nActiveRowCount`;
const PLC_COMMIT_SYMBOL = `${PLC_DOMAIN}.${PLC_GVL}.bCommitRequested`;
const PLC_ROW_FIELDS = ["nIndex", "sName", "lrValue", "bEnabled", "sUnit", "sSource"];
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

function plcRowSymbol(rowNumber, fieldName) {
    return `${PLC_DOMAIN}.${PLC_GVL}.aRows[${rowNumber}].${fieldName}`;
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

function clampRowCount(value) {
    const count = Number(value);
    if (!Number.isFinite(count)) {
        return PLC_ROW_COUNT;
    }

    return Math.max(0, Math.min(PLC_ROW_COUNT, Math.trunc(count)));
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

async function readPlcRow(rowNumber) {
    const row = {};
    for (const fieldName of PLC_ROW_FIELDS) {
        row[fieldName] = await readSymbol(plcRowSymbol(rowNumber, fieldName));
    }

    return normalizeRows([row], rowNumber - 1)[0];
}

async function readPlcRows() {
    const activeRowCount = clampRowCount(await readSymbol(PLC_ACTIVE_COUNT_SYMBOL));
    const rows = [];
    for (let rowNumber = 1; rowNumber <= activeRowCount; rowNumber += 1) {
        rows.push(await readPlcRow(rowNumber));
    }

    return rows;
}

async function writePlcRow(rowNumber, row) {
    const value = denormalizeRows([row])[0];
    await writeSymbol(plcRowSymbol(rowNumber, "nIndex"), Number(value.nIndex || rowNumber));
    await writeSymbol(plcRowSymbol(rowNumber, "sName"), value.sName);
    await writeSymbol(plcRowSymbol(rowNumber, "lrValue"), Number(value.lrValue));
    await writeSymbol(plcRowSymbol(rowNumber, "bEnabled"), Boolean(value.bEnabled));
    await writeSymbol(plcRowSymbol(rowNumber, "sUnit"), value.sUnit);
    await writeSymbol(plcRowSymbol(rowNumber, "sSource"), value.sSource || "HMI");
}

async function writePlcRows(rows) {
    const clippedRows = rows.slice(0, PLC_ROW_COUNT);
    await writeSymbol(PLC_ACTIVE_COUNT_SYMBOL, clippedRows.length);

    for (let rowNumber = 1; rowNumber <= clippedRows.length; rowNumber += 1) {
        await writePlcRow(rowNumber, {
            ...clippedRows[rowNumber - 1],
            nIndex: rowNumber,
            sSource: "HMI"
        });
    }

    await writeSymbol(PLC_COMMIT_SYMBOL, true);
}

async function loadFromPlc() {
    setStatus("Reading PLC row fields...");
    const plcRows = await readPlcRows();
    setGridRows(plcRows);
    setStatus(`Loaded ${plcRows.length} rows from ${PLC_DOMAIN}.${PLC_GVL}.aRows fields`);
}

async function writeToPlc() {
    const rows = getGridRows();
    setStatus("Writing PLC row fields...");
    await writePlcRows(rows);
    setStatus(`Wrote ${Math.min(rows.length, PLC_ROW_COUNT)} rows to ${PLC_DOMAIN}.${PLC_GVL}.aRows fields`);
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
    setStatus(`Bridge ready. Press Read PLC to load ${PLC_DOMAIN}.${PLC_GVL}.aRows fields.`);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
