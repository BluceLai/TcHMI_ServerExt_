type HmiRow = {
  index: number;
  name: string;
  value: number;
  enabled: boolean;
  unit: string;
  source: string;
};

const PLC_SYMBOL = "PLC1.HMI.aRows";
const EXTENSION_SYMBOL = "TcHmiCSharpBridge.Variables";
const STATUS_ID = "BridgeStatus";
const GRID_ID = "VariableGrid";

function getControls(): any {
  if (typeof TcHmi === "undefined") {
    return null;
  }

  return TcHmi.Controls;
}

function setStatus(message: string): void {
  const statusControl = getControls()?.get?.(STATUS_ID) as any;
  if (statusControl?.setText !== undefined) {
    statusControl.setText(message);
    return;
  }

  const element = document.getElementById(STATUS_ID);
  if (element !== null) {
    element.textContent = message;
  }
}

function getGrid(): any {
  const controls = getControls();
  if (controls?.get !== undefined) {
    return controls.get(GRID_ID);
  }

  return null;
}

function normalizeRows(value: any): HmiRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((row: any, index: number): HmiRow => ({
    index: Number(row?.nIndex ?? row?.index ?? row?.Index ?? index + 1),
    name: String(row?.sName ?? row?.name ?? row?.Name ?? ""),
    value: Number(row?.lrValue ?? row?.value ?? row?.Value ?? 0),
    enabled: Boolean(row?.bEnabled ?? row?.enabled ?? row?.Enabled ?? false),
    unit: String(row?.sUnit ?? row?.unit ?? row?.Unit ?? ""),
    source: String(row?.sSource ?? row?.source ?? row?.Source ?? "PLC")
  }));
}

function denormalizeRows(rows: HmiRow[]): any[] {
  return rows.map((row) => ({
    nIndex: row.index,
    sName: row.name,
    lrValue: Number(row.value),
    bEnabled: Boolean(row.enabled),
    sUnit: row.unit,
    sSource: row.source
  }));
}

function toExtensionRows(rows: HmiRow[]): any[] {
  return rows.map((row) => ({
    Index: row.index,
    Name: row.name,
    Value: Number(row.value),
    Enabled: Boolean(row.enabled),
    Unit: row.unit,
    Source: row.source
  }));
}

function readSymbol<T>(symbolName: string): Promise<T> {
  return new Promise((resolve, reject): void => {
    TcHmi.Server.readSymbol(symbolName, (data: any): void => {
      if (data?.error === TcHmi.Errors.NONE) {
        resolve(data.value as T);
        return;
      }

      reject(new Error(`Read failed: ${symbolName}`));
    });
  });
}

function writeSymbol<T>(symbolName: string, value: T): Promise<void> {
  return new Promise((resolve, reject): void => {
    TcHmi.Server.writeSymbol(symbolName, value, (data: any): void => {
      if (data?.error === TcHmi.Errors.NONE) {
        resolve();
        return;
      }

      reject(new Error(`Write failed: ${symbolName}`));
    });
  });
}

function setGridRows(rows: HmiRow[]): void {
  const grid = getGrid();
  if (grid?.setSrcData !== undefined) {
    grid.setSrcData(rows);
  }
}

function getGridRows(): HmiRow[] {
  const grid = getGrid();
  if (grid?.writePreparedValues !== undefined) {
    grid.writePreparedValues();
  }

  if (grid?.getSrcData !== undefined) {
    return normalizeRows(grid.getSrcData());
  }

  return [];
}

async function loadFromPlc(): Promise<void> {
  setStatus("Reading PLC rows...");
  const plcRows = await readSymbol<any[]>(PLC_SYMBOL);
  setGridRows(normalizeRows(plcRows));
  setStatus(`Loaded from ${PLC_SYMBOL}`);
}

async function writeToPlc(): Promise<void> {
  const rows = getGridRows();
  setStatus("Writing rows to PLC...");
  await writeSymbol(PLC_SYMBOL, denormalizeRows(rows));
  setStatus(`Wrote ${rows.length} rows to ${PLC_SYMBOL}`);
}

async function pushToExtension(): Promise<void> {
  const rows = getGridRows().map((row) => ({
    ...row,
    source: "HMI"
  }));
  setStatus("Writing rows to C# extension...");
  await writeSymbol(EXTENSION_SYMBOL, toExtensionRows(rows));
  setStatus(`Wrote ${rows.length} rows to ${EXTENSION_SYMBOL}`);
}

async function pullFromExtension(): Promise<void> {
  setStatus("Reading rows from C# extension...");
  const rows = await readSymbol<HmiRow[]>(EXTENSION_SYMBOL);
  setGridRows(normalizeRows(rows));
  setStatus(`Loaded from ${EXTENSION_SYMBOL}`);
}

function bindButton(id: string, handler: () => Promise<void>): void {
  if (typeof TcHmi === "undefined" || TcHmi.EventProvider === undefined) {
    window.setTimeout((): void => bindButton(id, handler), 100);
    return;
  }

  TcHmi.EventProvider.register(`${id}.onStatePressed`, (): void => {
    const button = TcHmi.Controls.get(id) as any;
    if (button?.setIsEnabled !== undefined) {
      button.setIsEnabled(false);
    }

    handler()
      .catch((error: Error): void => setStatus(error.message))
      .finally((): void => {
        if (button?.setIsEnabled !== undefined) {
          button.setIsEnabled(true);
        }
      });
  });
}

function init(): void {
  bindButton("ReadPlcButton", loadFromPlc);
  bindButton("WritePlcButton", writeToPlc);
  bindButton("PushExtensionButton", pushToExtension);
  bindButton("PullExtensionButton", pullFromExtension);
  setStatus("Ready. Press Read PLC / Pull C# to load live values.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
