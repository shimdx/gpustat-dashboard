import { spawn, type ChildProcess } from "node:child_process";

const HISTORY_LIMIT = 120;
const MAX_UPDATES_WITHOUT_CLIENTS = 300;

export type GpuProcess = {
  label: string;
  memoryMb: number | null;
};

export type GpuSample = {
  index: number;
  name: string;
  temperatureC: number | null;
  fanSpeedPercent: number | null;
  utilizationGpu: number | null;
  powerDrawW: number | null;
  powerLimitW: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  processes: GpuProcess[];
  raw: string;
};

export type GpuHistoryPoint = {
  at: string;
  utilizationGpu: number | null;
  memoryUsedMb: number | null;
  temperatureC: number | null;
  powerDrawW: number | null;
  fanSpeedPercent: number | null;
};

export type GpuHistory = {
  [gpuIndex: number]: GpuHistoryPoint[];
};

export type DashboardSnapshot = {
  host: string | null;
  timestamp: string | null;
  header: string | null;
  gpus: GpuSample[];
  history: GpuHistory;
  status: "idle" | "streaming" | "error";
  error: string | null;
  sourceCommand: string;
  updatedAt: string;
  rawBlock: string[];
};

type Listener = (snapshot: DashboardSnapshot) => void;

type GpuStatJsonProcess = {
  command?: string | null;
  pid?: number | null;
  gpu_memory_usage?: number | null;
};

type GpuStatJsonGpu = {
  index?: number | null;
  name?: string | null;
  "temperature.gpu"?: number | null;
  "fan.speed"?: number | null;
  "utilization.gpu"?: number | null;
  "power.draw"?: number | null;
  "enforced.power.limit"?: number | null;
  "memory.used"?: number | null;
  "memory.total"?: number | null;
  processes?: GpuStatJsonProcess[] | null;
};

type GpuStatJsonPayload = {
  hostname?: string | null;
  query_time?: string | null;
  driver_version?: string | null;
  gpus?: GpuStatJsonGpu[];
};

const SOURCE_COMMAND = "gpustat --json -c -p -F -P draw,limit";
const SPAWN_COMMAND = "while true; do gpustat --json -c -p -F -P draw,limit; sleep 1; done";

function makeInitialSnapshot(): DashboardSnapshot {
  return {
    host: null,
    timestamp: null,
    header: null,
    gpus: [],
    history: {},
    status: "idle",
    error: null,
    sourceCommand: SOURCE_COMMAND,
    updatedAt: new Date().toISOString(),
    rawBlock: [],
  };
}

function cloneSnapshot(snapshot: DashboardSnapshot): DashboardSnapshot {
  return {
    ...snapshot,
    gpus: snapshot.gpus.map((gpu) => ({
      ...gpu,
      processes: gpu.processes.map((process) => ({ ...process })),
    })),
    history: Object.fromEntries(
      Object.entries(snapshot.history).map(([index, points]) => [
        Number(index),
        points.map((point) => ({ ...point })),
      ]),
    ),
    rawBlock: [...snapshot.rawBlock],
  };
}

function parseProcess(process: GpuStatJsonProcess): GpuProcess {
  const label = process.command
    ? `${process.command}${process.pid ? `/${process.pid}` : ""}`
    : process.pid
      ? `pid/${process.pid}`
      : "unknown";

  return {
    label,
    memoryMb: typeof process.gpu_memory_usage === "number" ? process.gpu_memory_usage : null,
  };
}

function parseGpu(gpu: GpuStatJsonGpu): GpuSample | null {
  if (typeof gpu.index !== "number") {
    return null;
  }

  return {
    index: gpu.index,
    name: gpu.name ?? `GPU ${gpu.index}`,
    temperatureC: typeof gpu["temperature.gpu"] === "number" ? gpu["temperature.gpu"] : null,
    fanSpeedPercent: typeof gpu["fan.speed"] === "number" ? gpu["fan.speed"] : null,
    utilizationGpu: typeof gpu["utilization.gpu"] === "number" ? gpu["utilization.gpu"] : null,
    powerDrawW: typeof gpu["power.draw"] === "number" ? gpu["power.draw"] : null,
    powerLimitW:
      typeof gpu["enforced.power.limit"] === "number" ? gpu["enforced.power.limit"] : null,
    memoryUsedMb: typeof gpu["memory.used"] === "number" ? gpu["memory.used"] : null,
    memoryTotalMb: typeof gpu["memory.total"] === "number" ? gpu["memory.total"] : null,
    processes: Array.isArray(gpu.processes) ? gpu.processes.map(parseProcess) : [],
    raw: JSON.stringify(gpu),
  };
}

function parsePayload(payload: GpuStatJsonPayload, previous: DashboardSnapshot): DashboardSnapshot {
  const now = new Date().toISOString();
  const history = cloneSnapshot(previous).history;
  const gpus = (payload.gpus ?? []).map(parseGpu).filter((gpu): gpu is GpuSample => gpu !== null);

  for (const gpu of gpus) {
    const series = history[gpu.index] ?? [];
    series.push({
      at: now,
      utilizationGpu: gpu.utilizationGpu,
      memoryUsedMb: gpu.memoryUsedMb,
      temperatureC: gpu.temperatureC,
      powerDrawW: gpu.powerDrawW,
      fanSpeedPercent: gpu.fanSpeedPercent,
    });
    history[gpu.index] = series.slice(-HISTORY_LIMIT);
  }

  return {
    host: payload.hostname ?? null,
    timestamp: payload.query_time ?? null,
    header: payload.driver_version ? `driver ${payload.driver_version}` : payload.query_time ?? null,
    gpus,
    history,
    status: "streaming",
    error: null,
    sourceCommand: SOURCE_COMMAND,
    updatedAt: now,
    rawBlock: JSON.stringify(payload, null, 2).split("\n"),
  };
}

class GpuStatMonitor {
  private process: ChildProcess | null = null;
  private listeners = new Set<Listener>();
  private snapshot = makeInitialSnapshot();
  private stdoutBuffer = "";
  private idleUpdates = 0;

  getSnapshot() {
    return cloneSnapshot(this.snapshot);
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    this.ensureRunning();

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.idleUpdates = 0;
      }
    };
  }

  ensureRunning() {
    if (this.process) {
      return;
    }

    const child = spawn("bash", ["-lc", SPAWN_COMMAND], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.process = child;

    this.snapshot = {
      ...this.snapshot,
      status: "streaming",
      error: null,
      updatedAt: new Date().toISOString(),
    };
    this.broadcast();

    child.stdout?.on("data", (chunk: Buffer) => {
      this.consumeStdout(chunk.toString("utf8"));
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const message = chunk.toString("utf8").trim();
      if (!message) {
        return;
      }

      this.snapshot = {
        ...this.snapshot,
        status: "error",
        error: message,
        updatedAt: new Date().toISOString(),
      };
      this.broadcast();
    });

    child.on("exit", (code, signal) => {
      this.process = null;

      if (this.listeners.size === 0) {
        return;
      }

      this.snapshot = {
        ...this.snapshot,
        status: "error",
        error: `gpustat exited${code !== null ? ` with code ${code}` : ""}${signal ? ` (${signal})` : ""}`,
        updatedAt: new Date().toISOString(),
      };
      this.broadcast();

      setTimeout(() => this.ensureRunning(), 1000);
    });
  }

  private consumeStdout(data: string) {
    this.stdoutBuffer += data;

    for (;;) {
      const end = this.findJsonBoundary(this.stdoutBuffer);
      if (end === -1) {
        break;
      }

      const raw = this.stdoutBuffer.slice(0, end).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(end).trimStart();
      if (!raw) {
        continue;
      }

      try {
        const payload = JSON.parse(raw) as GpuStatJsonPayload;
        this.snapshot = parsePayload(payload, this.snapshot);
        this.broadcast();

        if (this.listeners.size === 0) {
          this.idleUpdates += 1;
          if (this.idleUpdates >= MAX_UPDATES_WITHOUT_CLIENTS) {
            this.stop();
          }
        } else {
          this.idleUpdates = 0;
        }
      } catch {
        continue;
      }
    }
  }

  private findJsonBoundary(buffer: string) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < buffer.length; index += 1) {
      const char = buffer[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return index + 1;
        }
      }
    }

    return -1;
  }

  private stop() {
    if (!this.process) {
      return;
    }

    this.process.kill();
    this.process = null;
    this.stdoutBuffer = "";
  }

  private broadcast() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __gpuStatMonitor__: GpuStatMonitor | undefined;
}

export const gpuStatMonitor = globalThis.__gpuStatMonitor__ ?? new GpuStatMonitor();

if (!globalThis.__gpuStatMonitor__) {
  globalThis.__gpuStatMonitor__ = gpuStatMonitor;
}
