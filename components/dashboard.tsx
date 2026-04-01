"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardSnapshot, GpuHistoryPoint, GpuSample } from "@/lib/gpustat";
import { LineChart } from "@/components/line-chart";

type ThemeMode = "dark" | "light";

const EMPTY_STATE: DashboardSnapshot = {
  host: null,
  timestamp: null,
  header: null,
  gpus: [],
  history: {},
  status: "idle",
  error: null,
  sourceCommand: "gpustat --json -c -p -F -P draw,limit",
  updatedAt: new Date(0).toISOString(),
  rawBlock: [],
};

function formatPercent(value: number | null) {
  return value === null ? "n/a" : `${value}%`;
}

function formatMemory(used: number | null, total: number | null) {
  if (used === null || total === null) {
    return "n/a";
  }

  return `${used.toLocaleString()} / ${total.toLocaleString()} MB`;
}

function memoryMetricColor(used: number | null, total: number | null) {
  if (used === null || total === null || total <= 0) {
    return "text-[var(--md-on-surface-variant)]";
  }

  const ratio = (used / total) * 100;
  if (ratio >= 90) {
    return "text-[var(--md-error)]";
  }
  if (ratio >= 70) {
    return "text-[var(--md-warning)]";
  }
  return "text-[var(--md-success)]";
}

function formatWatts(draw: number | null, limit?: number | null) {
  if (draw === null) {
    return "n/a";
  }

  if (limit === null || limit === undefined) {
    return `${draw} W`;
  }

  return `${draw} / ${limit} W`;
}

function formatFan(value: number | null) {
  return value === null ? "n/a" : `${value}%`;
}

function formatRatioPercent(used: number | null, total: number | null) {
  if (used === null || total === null || total <= 0) {
    return "n/a";
  }

  return `${Math.round((used / total) * 100)}%`;
}

function metricColor(value: number | null, warn: number, critical: number) {
  if (value === null) {
    return "text-[var(--md-on-surface-variant)]";
  }
  if (value >= critical) {
    return "text-[var(--md-error)]";
  }
  if (value >= warn) {
    return "text-[var(--md-warning)]";
  }
  return "text-[var(--md-success)]";
}

function getPreferredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem("gpustat-theme");
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function Dashboard() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_STATE);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [selectedGpuIndex, setSelectedGpuIndex] = useState<number>(0);

  useEffect(() => {
    const resolvedTheme = getPreferredTheme();
    setTheme(resolvedTheme);
    document.documentElement.dataset.theme = resolvedTheme;
  }, []);

  useEffect(() => {
    let closed = false;

    fetch("/api/gpustat", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: DashboardSnapshot) => {
        if (!closed) {
          setSnapshot(data);
        }
      })
      .catch(() => undefined);

    const source = new EventSource("/api/gpustat/stream");
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as DashboardSnapshot;
      setSnapshot(payload);
    };

    return () => {
      closed = true;
      source.close();
    };
  }, []);

  useEffect(() => {
    if (snapshot.gpus.length === 0) {
      return;
    }

    if (!snapshot.gpus.some((gpu) => gpu.index === selectedGpuIndex)) {
      setSelectedGpuIndex(snapshot.gpus[0].index);
    }
  }, [selectedGpuIndex, snapshot.gpus]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("gpustat-theme", theme);
  }, [theme]);

  const updatedAt = snapshot.updatedAt ? new Date(snapshot.updatedAt) : null;
  const totalProcesses = useMemo(
    () => snapshot.gpus.reduce((sum, gpu) => sum + gpu.processes.length, 0),
    [snapshot.gpus],
  );
  const selectedGpu = snapshot.gpus.find((gpu) => gpu.index === selectedGpuIndex) ?? snapshot.gpus[0] ?? null;
  const selectedHistory = selectedGpu ? snapshot.history[selectedGpu.index] ?? [] : [];

  return (
    <main className="min-h-screen bg-[var(--md-background)] px-4 py-5 text-[var(--md-on-background)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-[32px] border border-[var(--md-outline-variant)] bg-[var(--md-surface-container)] px-5 py-4 shadow-[var(--md-shadow)] sm:px-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-medium tracking-tight text-[var(--md-on-surface)]">
                GPU Monitoring
              </h1>
              <ThemeToggle theme={theme} onChange={setTheme} />
            </div>
            <MobileHeaderInfo
              peakUtil={`${Math.max(0, ...snapshot.gpus.map((gpu) => gpu.utilizationGpu ?? 0))}%`}
              peakTemp={`${Math.max(0, ...snapshot.gpus.map((gpu) => gpu.temperatureC ?? 0))}°C`}
              peakPower={`${Math.max(0, ...snapshot.gpus.map((gpu) => gpu.powerDrawW ?? 0))} W`}
              processes={String(totalProcesses)}
              driver={snapshot.header ?? "live"}
              peakUtilClass={metricColor(
                Math.max(0, ...snapshot.gpus.map((gpu) => gpu.utilizationGpu ?? 0)),
                60,
                90,
              )}
              peakTempClass={metricColor(
                Math.max(0, ...snapshot.gpus.map((gpu) => gpu.temperatureC ?? 0)),
                72,
                82,
              )}
            />
          </div>
        </header>

        {snapshot.error ? (
          <section className="rounded-[24px] border border-[var(--md-error-container)] bg-[var(--md-error-container)] px-5 py-4 text-sm text-[var(--md-on-error-container)] shadow-[0_8px_24px_rgba(127,29,29,0.15)]">
            <div className="font-medium">gpustat error</div>
            <p className="mt-1 opacity-90">{snapshot.error}</p>
          </section>
        ) : null}

        <SurfaceCard
          title="GPU Overview"
          subtitle=""
          contentClassName="grid gap-3"
        >
          {snapshot.gpus.length === 0 ? (
            <EmptyState text="GPU 샘플이 아직 없습니다. 드라이버나 gpustat 상태를 먼저 확인하세요." />
          ) : (
            snapshot.gpus.map((gpu) => (
              <GpuCard
                key={gpu.index}
                gpu={gpu}
                selected={selectedGpu?.index === gpu.index}
                onSelect={() => setSelectedGpuIndex(gpu.index)}
              />
            ))
          )}
        </SurfaceCard>

        <section>
          <SurfaceCard
            title={selectedGpu ? `Selected GPU - GPU ${selectedGpu.index}` : "Selected GPU"}
            subtitle=""
          >
            {selectedGpu ? (
              <GpuDetailPanel gpu={selectedGpu} history={selectedHistory} />
            ) : (
              <EmptyState text="선택 가능한 GPU가 아직 없습니다." />
            )}
          </SurfaceCard>
        </section>
      </div>
    </main>
  );
}

function ThemeToggle({
  theme,
  onChange,
}: {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-[var(--md-outline-variant)] bg-[var(--md-surface-container-high)] p-1">
      <button
        type="button"
        onClick={() => onChange("dark")}
        className={`rounded-full px-4 py-2 text-sm transition ${
          theme === "dark"
            ? "bg-[var(--md-primary)] text-[var(--md-on-primary)]"
            : "text-[var(--md-on-surface-variant)]"
        }`}
      >
        Dark
      </button>
      <button
        type="button"
        onClick={() => onChange("light")}
        className={`rounded-full px-4 py-2 text-sm transition ${
          theme === "light"
            ? "bg-[var(--md-primary)] text-[var(--md-on-primary)]"
            : "text-[var(--md-on-surface-variant)]"
        }`}
      >
        Light
      </button>
    </div>
  );
}

function GpuCard({
  gpu,
  selected,
  onSelect,
}: {
  gpu: GpuSample;
  selected: boolean;
  onSelect: () => void;
}) {
  const memoryLabel = formatMemory(gpu.memoryUsedMb, gpu.memoryTotalMb);
  const powerLabel = formatWatts(gpu.powerDrawW, gpu.powerLimitW);
  const fanLabel = formatFan(gpu.fanSpeedPercent);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-[18px] border px-4 py-3 text-left transition ${
        selected
          ? "border-[var(--md-primary)] bg-[var(--md-secondary-container)] shadow-[0_8px_24px_rgba(59,130,246,0.12)]"
          : "border-[var(--md-outline-variant)] bg-[var(--md-surface-container-low)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3 xl:hidden">
        <div className="min-w-0">
          <div className="truncate font-mono text-sm font-medium text-[var(--md-on-surface)]">
            {`GPU ${gpu.index} - ${gpu.name}`}
          </div>
          <div className="mt-1 font-mono text-xs leading-5 text-[var(--md-on-surface-variant)]">
            <span className={memoryMetricColor(gpu.memoryUsedMb, gpu.memoryTotalMb)}>MEM {memoryLabel}</span>
            <span>{`  proc ${gpu.processes.length}`}</span>
            <span className={metricColor(gpu.temperatureC, 72, 82)}>
              {`  temp ${gpu.temperatureC === null ? "n/a" : `${gpu.temperatureC}°C`}`}
            </span>
          </div>
          <div className="mt-1 font-mono text-xs leading-5 text-[var(--md-on-surface-variant)]">
            <span>{formatRatioPercent(gpu.memoryUsedMb, gpu.memoryTotalMb)}</span>
            <span className={metricColor(gpu.fanSpeedPercent, 60, 85)}>{`  fan ${fanLabel}`}</span>
            <span>{`  pwr ${powerLabel}`}</span>
          </div>
        </div>
        <div className={`shrink-0 text-right text-2xl font-medium ${metricColor(gpu.utilizationGpu, 60, 90)}`}>
          {formatPercent(gpu.utilizationGpu)}
        </div>
      </div>

      <div className="hidden gap-2 xl:grid xl:grid-cols-[72px_minmax(220px,1.4fr)_92px_130px_80px_120px] xl:items-center">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--md-on-surface-variant)]">
          GPU {gpu.index}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[var(--md-on-surface)]">{`GPU ${gpu.index} - ${gpu.name}`}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-[var(--md-on-surface-variant)]">
            <span className={memoryMetricColor(gpu.memoryUsedMb, gpu.memoryTotalMb)}>MEM {memoryLabel}</span>
            <span>proc {gpu.processes.length}</span>
            <span className={metricColor(gpu.temperatureC, 72, 82)}>
              temp {gpu.temperatureC === null ? "n/a" : `${gpu.temperatureC}°C`}
            </span>
          </div>
        </div>
        <div className={`text-right text-xl font-medium ${metricColor(gpu.utilizationGpu, 60, 90)}`}>
          {formatPercent(gpu.utilizationGpu)}
        </div>
        <div className="font-mono text-sm text-[var(--md-on-surface-variant)]">
          {formatRatioPercent(gpu.memoryUsedMb, gpu.memoryTotalMb)}
        </div>
        <div className={`font-mono text-sm ${metricColor(gpu.fanSpeedPercent, 60, 85)}`}>
          {fanLabel}
        </div>
        <div className="font-mono text-sm text-[var(--md-on-surface-variant)]">
          {powerLabel}
        </div>
      </div>
    </button>
  );
}

function GpuDetailPanel({
  gpu,
  history,
}: {
  gpu: GpuSample;
  history: GpuHistoryPoint[];
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-[20px] border border-[var(--md-outline-variant)] bg-[var(--md-surface-container-low)] p-4">
        <div className="flex flex-wrap gap-2">
          {gpu.processes.length > 0 ? (
            gpu.processes.map((process, index) => (
              <span
                key={`${process.label}-${index}`}
                className="rounded-full bg-[var(--md-tertiary-container)] px-3 py-2 text-xs font-medium text-[var(--md-on-tertiary-container)]"
              >
                {process.label} · {process.memoryMb ?? "n/a"} MB
              </span>
            ))
          ) : (
            <span className="text-sm text-[var(--md-on-surface-variant)]">No processes on this GPU.</span>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <LineChart
          title="Utilization History"
          suffix="%"
          points={history.map((point) => ({
            value: point.utilizationGpu,
            label: new Date(point.at).toLocaleTimeString(),
          }))}
          stroke="var(--chart-util-stroke)"
          fill="var(--chart-util-fill)"
          height={84}
        />
        <LineChart
          title="Memory History"
          suffix=" MB"
          points={history.map((point) => ({
            value: point.memoryUsedMb,
            label: new Date(point.at).toLocaleTimeString(),
          }))}
          stroke="var(--chart-memory-stroke)"
          fill="var(--chart-memory-fill)"
          height={84}
        />
        <LineChart
          title="Temperature History"
          suffix="°C"
          points={history.map((point) => ({
            value: point.temperatureC,
            label: new Date(point.at).toLocaleTimeString(),
          }))}
          stroke="var(--chart-temp-stroke)"
          fill="var(--chart-temp-fill)"
          height={84}
        />
        <LineChart
          title="Fan History"
          suffix="%"
          points={history.map((point) => ({
            value: point.fanSpeedPercent,
            label: new Date(point.at).toLocaleTimeString(),
          }))}
          stroke="var(--chart-fan-stroke)"
          fill="var(--chart-fan-fill)"
          height={84}
        />
        <LineChart
          title="Power History"
          suffix=" W"
          points={history.map((point) => ({
            value: point.powerDrawW,
            label: new Date(point.at).toLocaleTimeString(),
          }))}
          stroke="var(--chart-power-stroke)"
          fill="var(--chart-power-fill)"
          height={84}
        />
      </div>
    </div>
  );
}

function SurfaceCard({
  title,
  subtitle,
  children,
  contentClassName,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <section className="rounded-[28px] border border-[var(--md-outline-variant)] bg-[var(--md-surface-container)] px-5 py-5 shadow-[var(--md-shadow)]">
      {title || subtitle ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title ? <h2 className="text-xl font-medium text-[var(--md-on-surface)]">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-[var(--md-on-surface-variant)]">{subtitle}</p> : null}
          </div>
        </div>
      ) : null}
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

function MobileHeaderInfo({
  peakUtil,
  peakTemp,
  peakPower,
  processes,
  driver,
  peakUtilClass,
  peakTempClass,
}: {
  peakUtil: string;
  peakTemp: string;
  peakPower: string;
  processes: string;
  driver: string;
  peakUtilClass: string;
  peakTempClass: string;
}) {
  return (
    <>
      <div className="font-mono text-xs leading-6 text-[var(--md-on-surface-variant)] md:hidden">
        <span className={peakUtilClass}>{`util ${peakUtil}`}</span>
        <span>{`  `}</span>
        <span className={peakTempClass}>{`temp ${peakTemp}`}</span>
        <span>{`  pwr ${peakPower}`}</span>
        <span>{`  proc ${processes}`}</span>
      </div>
      <div className="hidden font-mono text-xs leading-6 text-[var(--md-on-surface-variant)] md:block">
        <span className={peakUtilClass}>{`Peak Util ${peakUtil}`}</span>
        <span>{`  |  `}</span>
        <span className={peakTempClass}>{`Peak Temp ${peakTemp}`}</span>
        <span>{`  |  Peak Power ${peakPower}`}</span>
        <span>{`  |  Processes ${processes}`}</span>
        <span>{`  |  Driver ${driver}`}</span>
      </div>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-[24px] border border-dashed border-[var(--md-outline)] bg-[var(--md-surface-container-low)] px-6 py-8 text-center text-sm text-[var(--md-on-surface-variant)]">
      {text}
    </div>
  );
}
