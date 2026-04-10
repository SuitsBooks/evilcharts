"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { TooltipProps } from "recharts";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient, type AthenaSdkClient } from "@xylex-group/athena";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DownloadIcon, PlusIcon, Trash2Icon } from "lucide-react";

export type ChartBuilderProps = {
  /** Pre-built client; when set, URL/key fields are hidden (keys stay off the wire if you inject from a proxy). */
  athenaClient?: AthenaSdkClient;
  athenaUrl?: string;
  athenaKey?: string;
  athenaGatewayClientName?: string;
  defaultAthenaTable?: string;
  defaultAthenaSelect?: string;
  defaultLabelField?: string;
  defaultValueField?: string;
};

const ATHENA_FORM_STORAGE_KEY = "evilcharts:chart-builder:athena";
const CHART_PRESETS_STORAGE_KEY = "evilcharts:chart-builder:presets";

const DEFAULT_CHART_WIDTH_PX = 640;
const DEFAULT_CHART_HEIGHT_PX = 420;
const MIN_CHART_WIDTH = 280;
const MAX_CHART_WIDTH = 1600;
const MIN_CHART_HEIGHT = 200;
const MAX_CHART_HEIGHT = 1000;

type DataSource = "manual" | "athena";

type ChartType = "bar" | "line" | "area" | "pie" | "radar";

export interface DataPoint {
  id: string;
  label: string;
  value: number;
}

type PersistedAthenaFormV1 = {
  v: 1;
  dataSource?: DataSource;
  url?: string;
  key?: string;
  gatewayName?: string;
  table?: string;
  select?: string;
  labelField?: string;
  valueField?: string;
  rowLimit?: number;
  filterColumn?: string;
  filterValue?: string;
  chartWidthPx?: number;
  chartHeightPx?: number;
  chartTitle?: string;
  chartType?: ChartType;
  chartData?: DataPoint[];
  showLegend?: boolean;
  legendLabel?: string;
  seriesColor?: string;
  liveRefreshEnabled?: boolean;
  referenceLines?: ReferenceLineConfig[];
  referenceBands?: ReferenceBandConfig[];
};

export type ReferenceLineConfig = {
  id: string;
  y: number;
  label?: string;
  color?: string;
  dashed?: boolean;
};

export type ReferenceBandConfig = {
  id: string;
  y1: number;
  y2: number;
  fill: string;
  fillOpacity?: number;
  label?: string;
};

type ChartPresetV1 = {
  id: string;
  name: string;
  savedAt: string;
  chartType: ChartType;
  chartTitle: string;
  dataSource: DataSource;
  data: DataPoint[];
  chartWidthPx: number;
  chartHeightPx: number;
  athenaTable: string;
  athenaSelect: string;
  athenaLabelField: string;
  athenaValueField: string;
  athenaFilterColumn: string;
  athenaFilterValue: string;
  athenaRowLimit: number;
  athenaGatewayName: string;
  athenaUrl: string;
  showLegend?: boolean;
  legendLabel?: string;
  seriesColor?: string;
  liveRefreshEnabled?: boolean;
  referenceLines?: ReferenceLineConfig[];
  referenceBands?: ReferenceBandConfig[];
};

type ChartPresetsFileV1 = {
  v: 1;
  presets: ChartPresetV1[];
};

const tooltipCursor = {
  stroke: "hsl(var(--border))",
  strokeWidth: 1,
  strokeDasharray: "4 4",
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function formatTooltipNumber(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function BuilderTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const raw = item.value;
  const val =
    typeof raw === "number"
      ? formatTooltipNumber(raw)
      : String(raw ?? "—");
  const category =
    label != null && String(label) !== ""
      ? String(label)
      : String(
          (item.payload as { name?: string } | undefined)?.name ??
            item.name ??
            "—"
        );
  const pct = (item.payload as { percent?: number } | undefined)?.percent;
  const showPct =
    typeof pct === "number" &&
    Number.isFinite(pct) &&
    pct >= 0 &&
    pct <= 1;
  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2.5 text-sm shadow-lg ring-1 ring-border/40 backdrop-blur-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Category
      </div>
      <div className="mt-0.5 max-w-[240px] break-words font-medium leading-snug text-foreground">
        {category}
      </div>
      <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Value
      </div>
      <div className="mt-0.5 tabular-nums text-base font-semibold tracking-tight text-foreground">
        {val}
      </div>
      {showPct ? (
        <div className="mt-1.5 text-xs text-muted-foreground">
          {(pct * 100).toFixed(1)}% of total
        </div>
      ) : null}
    </div>
  );
}

function readPresetsFromStorage(): ChartPresetV1[] {
  try {
    const raw = localStorage.getItem(CHART_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const o = JSON.parse(raw) as ChartPresetsFileV1;
    if (o.v !== 1 || !Array.isArray(o.presets)) return [];
    return o.presets;
  } catch {
    return [];
  }
}

function writePresetsToStorage(presets: ChartPresetV1[]) {
  const payload: ChartPresetsFileV1 = { v: 1, presets };
  localStorage.setItem(CHART_PRESETS_STORAGE_KEY, JSON.stringify(payload));
}

const DEFAULT_SERIES_COLOR = "var(--chart-1)";
const DEFAULT_PICKER_HEX = "#6366f1";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const DEFAULT_DATA: DataPoint[] = [
  { id: "1", label: "January", value: 420 },
  { id: "2", label: "February", value: 680 },
  { id: "3", label: "March", value: 510 },
  { id: "4", label: "April", value: 790 },
  { id: "5", label: "May", value: 340 },
  { id: "6", label: "June", value: 610 },
];

function axisTickTruncate(v: string, maxLen: number) {
  const s = String(v);
  return s.length > maxLen ? `${s.slice(0, Math.max(0, maxLen - 1))}…` : s;
}

function CartesianAnnotations({
  bands,
  lines,
}: {
  bands: ReferenceBandConfig[];
  lines: ReferenceLineConfig[];
}) {
  return (
    <>
      {bands.map((b) => {
        const lo = Math.min(b.y1, b.y2);
        const hi = Math.max(b.y1, b.y2);
        return (
          <ReferenceArea
            key={b.id}
            y1={lo}
            y2={hi}
            fill={b.fill}
            fillOpacity={b.fillOpacity ?? 0.22}
            strokeOpacity={0}
          />
        );
      })}
      {lines.map((l) => (
        <ReferenceLine
          key={l.id}
          y={l.y}
          stroke={l.color ?? "hsl(var(--muted-foreground))"}
          strokeWidth={1.5}
          strokeDasharray={l.dashed ? "5 4" : undefined}
          label={
            l.label
              ? { value: l.label, position: "insideTopRight", fill: "hsl(var(--muted-foreground))", fontSize: 10 }
              : undefined
          }
        />
      ))}
    </>
  );
}

function ChartPreview({
  chartType,
  data,
  title,
  widthPx,
  heightPx,
  showLegend,
  legendLabel,
  seriesColor,
  referenceLines,
  referenceBands,
}: {
  chartType: ChartType;
  data: DataPoint[];
  title: string;
  widthPx: number;
  heightPx: number;
  showLegend: boolean;
  legendLabel: string;
  seriesColor: string;
  referenceLines: ReferenceLineConfig[];
  referenceBands: ReferenceBandConfig[];
}) {
  const chartData = data.map((d) => ({ name: d.label, value: d.value }));
  const tickMax = widthPx > 900 ? 14 : widthPx > 600 ? 10 : 6;
  const pieOuter = Math.max(
    48,
    Math.round(Math.min(widthPx, heightPx) * 0.34) - 24
  );
  const gradId = `builder-area-fill-${useId().replace(/:/g, "")}`;
  const legendMb = showLegend ? 28 : 8;
  const cartesianMargin = {
    top: 8,
    right: 12,
    left: 4,
    bottom: legendMb,
  };

  const tt = (
    <Tooltip
      content={BuilderTooltip}
      cursor={tooltipCursor}
      animationDuration={150}
    />
  );

  const legendEl = showLegend ? (
    <Legend
      wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
      formatter={(value) => (String(value) === "value" ? legendLabel || "Value" : value)}
    />
  ) : null;

  return (
    <Card className="h-full min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {title || "Chart Preview"}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div
          className="mx-auto min-h-0"
          style={{
            width: widthPx,
            maxWidth: "100%",
            height: heightPx,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={chartData} margin={cartesianMargin}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => axisTickTruncate(v, tickMax)}
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                {tt}
                <CartesianAnnotations bands={referenceBands} lines={referenceLines} />
                <Bar
                  dataKey="value"
                  name={legendLabel || "Value"}
                  fill={seriesColor}
                  radius={4}
                />
                {legendEl}
              </BarChart>
            ) : chartType === "line" ? (
              <LineChart data={chartData} margin={cartesianMargin}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => axisTickTruncate(v, tickMax)}
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                {tt}
                <CartesianAnnotations bands={referenceBands} lines={referenceLines} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={legendLabel || "Value"}
                  stroke={seriesColor}
                  strokeWidth={2}
                  dot={{ r: 4, fill: seriesColor }}
                  activeDot={{ r: 6 }}
                />
                {legendEl}
              </LineChart>
            ) : chartType === "area" ? (
              <AreaChart data={chartData} margin={cartesianMargin}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={seriesColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={seriesColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => axisTickTruncate(v, tickMax)}
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                {tt}
                <CartesianAnnotations bands={referenceBands} lines={referenceLines} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={legendLabel || "Value"}
                  stroke={seriesColor}
                  strokeWidth={2}
                  fill={`url(#${gradId})`}
                />
                {legendEl}
              </AreaChart>
            ) : chartType === "pie" ? (
              <PieChart margin={{ top: 8, right: 8, bottom: showLegend ? 32 : 8, left: 8 }}>
                <Tooltip content={BuilderTooltip} animationDuration={150} />
                {showLegend ? (
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value) => String(value)}
                  />
                ) : null}
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={pieOuter}
                  label={({ name, percent }) =>
                    `${axisTickTruncate(String(name), 12)} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${String(entry.name)}-${String(entry.value)}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            ) : (
              <RadarChart
                data={chartData}
                margin={{ top: 8, right: 28, bottom: showLegend ? 36 : 8, left: 28 }}
              >
                <PolarGrid />
                <PolarAngleAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => axisTickTruncate(v, tickMax)}
                />
                {tt}
                <Radar
                  dataKey="value"
                  name={legendLabel || "Value"}
                  stroke={seriesColor}
                  fill={seriesColor}
                  fillOpacity={0.35}
                />
                {legendEl}
              </RadarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTableCell(v: unknown) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function ChartDataTable({
  rawRows,
  manualRows,
}: {
  rawRows: Record<string, unknown>[] | null;
  manualRows: DataPoint[];
}) {
  const { columns, rows } = useMemo(() => {
    if (rawRows && rawRows.length > 0) {
      const keys = Object.keys(rawRows[0]);
      return { columns: keys, rows: rawRows };
    }
    return {
      columns: ["id", "label", "value"],
      rows: manualRows.map((d) => ({
        id: d.id,
        label: d.label,
        value: d.value,
      })) as Record<string, unknown>[],
    };
  }, [rawRows, manualRows]);

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Data</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-80 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c} className="sticky top-0 z-10 bg-muted/90">
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={columns
                    .map((c) => `${c}:${formatTableCell(row[c])}`)
                    .join("|")}
                >
                  {columns.map((c) => (
                    <TableCell key={c} className="max-w-[200px] truncate font-mono text-xs">
                      {formatTableCell(row[c])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </p>
      </CardContent>
    </Card>
  );
}

function parseFilterValue(raw: string): string | number | boolean {
  const t = raw.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+$/.test(t)) return Number.parseInt(t, 10);
  if (/^-?\d+\.\d+$/.test(t)) return Number.parseFloat(t);
  return t;
}

function mapRowsToDataPoints(
  rows: unknown[],
  labelField: string,
  valueField: string
): DataPoint[] {
  return rows.map((row, i) => {
    const r = row as Record<string, unknown>;
    const rawId = r.id;
    const id =
      rawId !== undefined && rawId !== null ? String(rawId) : String(i);
    const label = String(r[labelField] ?? "");
    const num = Number(r[valueField]);
    const value = Number.isFinite(num) ? num : 0;
    return { id, label, value };
  });
}

export function ChartBuilder({
  athenaClient: athenaClientProp,
  athenaUrl: athenaUrlProp,
  athenaKey: athenaKeyProp,
  athenaGatewayClientName = "evilcharts",
  defaultAthenaTable = "",
  defaultAthenaSelect = "",
  defaultLabelField = "name",
  defaultValueField = "id",
}: ChartBuilderProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [chartTitle, setChartTitle] = useState("My Chart");
  const [data, setData] = useState<DataPoint[]>(DEFAULT_DATA);
  const [dataSource, setDataSource] = useState<DataSource>("manual");
  const [athenaFormHydrated, setAthenaFormHydrated] = useState(false);

  const [urlInput, setUrlInput] = useState(athenaUrlProp ?? "");
  const [keyInput, setKeyInput] = useState(athenaKeyProp ?? "");
  const [gatewayNameInput, setGatewayNameInput] = useState(
    athenaGatewayClientName
  );
  const [tableInput, setTableInput] = useState(defaultAthenaTable);
  const [selectInput, setSelectInput] = useState(defaultAthenaSelect);
  const [labelFieldInput, setLabelFieldInput] = useState(defaultLabelField);
  const [valueFieldInput, setValueFieldInput] = useState(defaultValueField);
  const [filterColumnInput, setFilterColumnInput] = useState("");
  const [filterValueInput, setFilterValueInput] = useState("");
  const [rowLimit, setRowLimit] = useState(500);
  const [chartWidthPx, setChartWidthPx] = useState(DEFAULT_CHART_WIDTH_PX);
  const [chartHeightPx, setChartHeightPx] = useState(DEFAULT_CHART_HEIGHT_PX);
  const [presets, setPresets] = useState<ChartPresetV1[]>([]);
  const [presetsHydrated, setPresetsHydrated] = useState(false);
  const [presetNameDraft, setPresetNameDraft] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [fetchLoading, setFetchLoading] = useState(false);
  const [athenaError, setAthenaError] = useState<string | null>(null);
  const [athenaErrorDetails, setAthenaErrorDetails] = useState<string | null>(
    null
  );
  const [athenaRawRows, setAthenaRawRows] = useState<Record<
    string,
    unknown
  >[] | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [legendLabel, setLegendLabel] = useState("Value");
  const [seriesColor, setSeriesColor] = useState(DEFAULT_SERIES_COLOR);
  const [seriesColorPicker, setSeriesColorPicker] = useState(DEFAULT_PICKER_HEX);
  const [liveRefreshEnabled, setLiveRefreshEnabled] = useState(false);
  const [livePollError, setLivePollError] = useState<string | null>(null);
  const [referenceLines, setReferenceLines] = useState<ReferenceLineConfig[]>(
    []
  );
  const [referenceBands, setReferenceBands] = useState<ReferenceBandConfig[]>(
    []
  );

  const fetchGenRef = useRef(0);
  const pollInFlightRef = useRef(false);

  const resolvedClient = useMemo((): AthenaSdkClient | null => {
    if (athenaClientProp) return athenaClientProp;
    const url = (athenaUrlProp ?? urlInput).trim();
    const key = (athenaKeyProp ?? keyInput).trim();
    if (!url || !key) return null;
    const clientName = gatewayNameInput.trim() || athenaGatewayClientName;
    return createClient(url, key, {
      client: clientName,
      backend: { type: "athena" },
    });
  }, [
    athenaClientProp,
    athenaUrlProp,
    athenaKeyProp,
    urlInput,
    keyInput,
    gatewayNameInput,
    athenaGatewayClientName,
  ]);

  const showConnectionFields = !athenaClientProp;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ATHENA_FORM_STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as PersistedAthenaFormV1;
      if (p.v !== 1) return;
      if (athenaUrlProp === undefined && typeof p.url === "string")
        setUrlInput(p.url);
      if (athenaKeyProp === undefined && typeof p.key === "string")
        setKeyInput(p.key);
      if (typeof p.gatewayName === "string") setGatewayNameInput(p.gatewayName);
      if (typeof p.table === "string") setTableInput(p.table);
      if (typeof p.select === "string") setSelectInput(p.select);
      if (typeof p.labelField === "string") setLabelFieldInput(p.labelField);
      if (typeof p.valueField === "string") setValueFieldInput(p.valueField);
      if (typeof p.rowLimit === "number" && p.rowLimit >= 1 && p.rowLimit <= 10_000)
        setRowLimit(p.rowLimit);
      if (typeof p.filterColumn === "string") setFilterColumnInput(p.filterColumn);
      if (typeof p.filterValue === "string") setFilterValueInput(p.filterValue);
      if (p.dataSource === "athena" || p.dataSource === "manual")
        setDataSource(p.dataSource);
      if (
        typeof p.chartWidthPx === "number" &&
        p.chartWidthPx >= MIN_CHART_WIDTH &&
        p.chartWidthPx <= MAX_CHART_WIDTH
      )
        setChartWidthPx(p.chartWidthPx);
      if (
        typeof p.chartHeightPx === "number" &&
        p.chartHeightPx >= MIN_CHART_HEIGHT &&
        p.chartHeightPx <= MAX_CHART_HEIGHT
      )
        setChartHeightPx(p.chartHeightPx);
      if (typeof p.chartTitle === "string") setChartTitle(p.chartTitle);
      if (
        p.chartType === "bar" ||
        p.chartType === "line" ||
        p.chartType === "area" ||
        p.chartType === "pie" ||
        p.chartType === "radar"
      )
        setChartType(p.chartType);
      if (Array.isArray(p.chartData) && p.chartData.length > 0) {
        const valid = p.chartData.every(
          (d) =>
            d &&
            typeof d.id === "string" &&
            typeof d.label === "string" &&
            typeof d.value === "number"
        );
        if (valid) setData(p.chartData);
      }
      if (typeof p.showLegend === "boolean") setShowLegend(p.showLegend);
      if (typeof p.legendLabel === "string") setLegendLabel(p.legendLabel);
      if (typeof p.seriesColor === "string") {
        setSeriesColor(p.seriesColor);
        if (/^#[0-9A-Fa-f]{6}$/.test(p.seriesColor))
          setSeriesColorPicker(p.seriesColor);
      }
      if (typeof p.liveRefreshEnabled === "boolean")
        setLiveRefreshEnabled(p.liveRefreshEnabled);
      if (Array.isArray(p.referenceLines)) {
        const ok = p.referenceLines.every(
          (l) =>
            l &&
            typeof l.id === "string" &&
            typeof l.y === "number" &&
            Number.isFinite(l.y)
        );
        if (ok) setReferenceLines(p.referenceLines as ReferenceLineConfig[]);
      }
      if (Array.isArray(p.referenceBands)) {
        const ok = p.referenceBands.every(
          (b) =>
            b &&
            typeof b.id === "string" &&
            typeof b.y1 === "number" &&
            typeof b.y2 === "number" &&
            typeof b.fill === "string"
        );
        if (ok) setReferenceBands(p.referenceBands as ReferenceBandConfig[]);
      }
    } catch {
      /* ignore invalid storage */
    } finally {
      setAthenaFormHydrated(true);
    }
  }, [athenaUrlProp, athenaKeyProp]);

  useEffect(() => {
    setPresets(readPresetsFromStorage());
    setPresetsHydrated(true);
  }, []);

  useEffect(() => {
    if (!presetsHydrated) return;
    try {
      writePresetsToStorage(presets);
    } catch {
      /* quota */
    }
  }, [presetsHydrated, presets]);

  useEffect(() => {
    if (!athenaFormHydrated) return;
    try {
      const payload: PersistedAthenaFormV1 = {
        v: 1,
        dataSource,
        url: urlInput,
        key: keyInput,
        gatewayName: gatewayNameInput,
        table: tableInput,
        select: selectInput,
        labelField: labelFieldInput,
        valueField: valueFieldInput,
        rowLimit,
        filterColumn: filterColumnInput,
        filterValue: filterValueInput,
        chartWidthPx,
        chartHeightPx,
        chartTitle,
        chartType,
        chartData: data,
        showLegend,
        legendLabel,
        seriesColor,
        liveRefreshEnabled,
        referenceLines,
        referenceBands,
      };
      localStorage.setItem(ATHENA_FORM_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota / private mode */
    }
  }, [
    athenaFormHydrated,
    dataSource,
    urlInput,
    keyInput,
    gatewayNameInput,
    tableInput,
    selectInput,
    labelFieldInput,
    valueFieldInput,
    rowLimit,
    filterColumnInput,
    filterValueInput,
    chartWidthPx,
    chartHeightPx,
    chartTitle,
    chartType,
    data,
    showLegend,
    legendLabel,
    seriesColor,
    liveRefreshEnabled,
    referenceLines,
    referenceBands,
  ]);

  useEffect(() => {
    if (dataSource === "manual") {
      setAthenaRawRows(null);
      setLiveRefreshEnabled(false);
      setLivePollError(null);
    }
  }, [dataSource]);

  const addDataPoint = useCallback(() => {
    setData((prev) => [
      ...prev,
      { id: String(Date.now()), label: `Item ${prev.length + 1}`, value: 0 },
    ]);
  }, []);

  const removeDataPoint = useCallback((id: string) => {
    setData((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const updateDataPoint = useCallback(
    (id: string, field: "label" | "value", raw: string) => {
      setData((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d;
          if (field === "value") {
            const num = parseFloat(raw);
            return { ...d, value: Number.isNaN(num) ? 0 : num };
          }
          return { ...d, label: raw };
        })
      );
    },
    []
  );

  const runAthenaFetch = useCallback(
    async (opts: { limit: number; silent?: boolean }) => {
      const silent = opts.silent ?? false;
      if (!resolvedClient) {
        if (!silent) {
          setAthenaError("Set Athena URL and API key, or pass athenaClient.");
          setAthenaErrorDetails(null);
        }
        return;
      }
      const table = tableInput.trim();
      if (!table) {
        if (!silent) {
          setAthenaError("Table name is required.");
          setAthenaErrorDetails(null);
        }
        return;
      }
      const labelF = labelFieldInput.trim();
      const valueF = valueFieldInput.trim();
      if (!labelF || !valueF) {
        if (!silent) {
          setAthenaError("Category and measure column names are required.");
          setAthenaErrorDetails(null);
        }
        return;
      }

      if (silent) {
        if (pollInFlightRef.current) return;
        pollInFlightRef.current = true;
      }

      const selectStr = selectInput.trim() || `${labelF},${valueF}`;
      const limit = Math.min(Math.max(1, opts.limit), 10_000);
      const filterCol = filterColumnInput.trim();
      const filterValRaw = filterValueInput.trim();
      const gen = ++fetchGenRef.current;

      if (!silent) {
        setFetchLoading(true);
        setAthenaError(null);
        setAthenaErrorDetails(null);
        setLivePollError(null);
      }

      try {
        let chain = resolvedClient.from(table).select(selectStr);
        if (filterCol && filterValRaw !== "") {
          chain = chain.eq(filterCol, parseFilterValue(filterValueInput));
        }
        const { data: rows, error, errorDetails } = await chain.range(
          0,
          limit - 1
        );

        if (gen !== fetchGenRef.current) return;

        if (error) {
          if (!silent) {
            setAthenaError(error);
            setAthenaErrorDetails(
              errorDetails
                ? [
                    errorDetails.code && `code: ${errorDetails.code}`,
                    errorDetails.status != null &&
                      `status: ${errorDetails.status}`,
                    errorDetails.endpoint &&
                      `endpoint: ${errorDetails.endpoint}`,
                    errorDetails.requestId &&
                      `requestId: ${errorDetails.requestId}`,
                  ]
                    .filter(
                      (x): x is string =>
                        typeof x === "string" && x.length > 0
                    )
                    .join(" · ") || null
                : null
            );
          } else {
            setLivePollError(error);
          }
          return;
        }

        if (silent) setLivePollError(null);

        const list = Array.isArray(rows) ? rows : [];
        if (list.length === 0) {
          if (!silent) {
            setData([{ id: "0", label: "(no rows)", value: 0 }]);
            setAthenaRawRows([]);
          }
          return;
        }

        const rawCopy = list.map((row) => ({
          ...(row as Record<string, unknown>),
        }));
        setAthenaRawRows(rawCopy);
        setData(mapRowsToDataPoints(list, labelF, valueF));
      } finally {
        if (silent) pollInFlightRef.current = false;
        if (!silent) setFetchLoading(false);
      }
    },
    [
      resolvedClient,
      tableInput,
      selectInput,
      labelFieldInput,
      valueFieldInput,
      filterColumnInput,
      filterValueInput,
    ]
  );

  const fetchFromAthena = useCallback(() => {
    void runAthenaFetch({ limit: rowLimit, silent: false });
  }, [runAthenaFetch, rowLimit]);

  useEffect(() => {
    if (!liveRefreshEnabled || dataSource !== "athena" || !resolvedClient) {
      return;
    }
    const id = window.setInterval(() => {
      void runAthenaFetch({ limit: 500, silent: true });
    }, 2000);
    return () => window.clearInterval(id);
  }, [liveRefreshEnabled, dataSource, resolvedClient, runAthenaFetch]);

  const applyPreset = useCallback(
    (p: ChartPresetV1) => {
      setChartType(p.chartType);
      setChartTitle(p.chartTitle);
      setDataSource(p.dataSource);
      setData(p.data.length > 0 ? p.data : DEFAULT_DATA);
      setChartWidthPx(clamp(p.chartWidthPx, MIN_CHART_WIDTH, MAX_CHART_WIDTH));
      setChartHeightPx(clamp(p.chartHeightPx, MIN_CHART_HEIGHT, MAX_CHART_HEIGHT));
      setTableInput(p.athenaTable);
      setSelectInput(p.athenaSelect);
      setLabelFieldInput(p.athenaLabelField);
      setValueFieldInput(p.athenaValueField);
      setFilterColumnInput(p.athenaFilterColumn);
      setFilterValueInput(p.athenaFilterValue);
      setRowLimit(clamp(p.athenaRowLimit, 1, 10_000));
      setGatewayNameInput(p.athenaGatewayName);
      if (athenaUrlProp === undefined) setUrlInput(p.athenaUrl);
      setShowLegend(p.showLegend ?? true);
      setLegendLabel(p.legendLabel ?? "Value");
      const sc = p.seriesColor ?? DEFAULT_SERIES_COLOR;
      setSeriesColor(sc);
      if (/^#[0-9A-Fa-f]{6}$/.test(sc)) setSeriesColorPicker(sc);
      setLiveRefreshEnabled(p.liveRefreshEnabled ?? false);
      setReferenceLines(p.referenceLines ?? []);
      setReferenceBands(p.referenceBands ?? []);
      setAthenaRawRows(null);
      setLivePollError(null);
      setSelectedPresetId(p.id);
    },
    [athenaUrlProp]
  );

  const saveCurrentPreset = useCallback(() => {
    const name =
      presetNameDraft.trim() ||
      `Chart ${new Date().toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}`;
    const next: ChartPresetV1 = {
      id: crypto.randomUUID(),
      name,
      savedAt: new Date().toISOString(),
      chartType,
      chartTitle,
      dataSource,
      data,
      chartWidthPx,
      chartHeightPx,
      athenaTable: tableInput,
      athenaSelect: selectInput,
      athenaLabelField: labelFieldInput,
      athenaValueField: valueFieldInput,
      athenaFilterColumn: filterColumnInput,
      athenaFilterValue: filterValueInput,
      athenaRowLimit: rowLimit,
      athenaGatewayName: gatewayNameInput,
      athenaUrl: urlInput,
      showLegend,
      legendLabel,
      seriesColor,
      liveRefreshEnabled,
      referenceLines,
      referenceBands,
    };
    setPresets((prev) => [...prev, next]);
    setPresetNameDraft("");
    setSelectedPresetId(next.id);
  }, [
    presetNameDraft,
    chartType,
    chartTitle,
    dataSource,
    data,
    chartWidthPx,
    chartHeightPx,
    tableInput,
    selectInput,
    labelFieldInput,
    valueFieldInput,
    filterColumnInput,
    filterValueInput,
    rowLimit,
    gatewayNameInput,
    urlInput,
    showLegend,
    legendLabel,
    seriesColor,
    liveRefreshEnabled,
    referenceLines,
    referenceBands,
  ]);

  const loadSelectedPreset = useCallback(() => {
    const p = presets.find((x) => x.id === selectedPresetId);
    if (p) applyPreset(p);
  }, [presets, selectedPresetId, applyPreset]);

  const deleteSelectedPreset = useCallback(() => {
    setPresets((prev) => prev.filter((x) => x.id !== selectedPresetId));
    setSelectedPresetId("");
  }, [selectedPresetId]);

  const exportPresetsFile = useCallback(() => {
    const payload: ChartPresetsFileV1 = { v: 1, presets };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = "evilcharts-chart-presets.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [presets]);

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Chart Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="chart-title" className="text-xs">
                Title
              </Label>
              <Input
                id="chart-title"
                value={chartTitle}
                onChange={(e) => setChartTitle(e.target.value)}
                placeholder="Chart title"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="chart-type" className="text-xs">
                Chart Type
              </Label>
              <Select
                value={chartType}
                onValueChange={(v) => setChartType(v as ChartType)}
              >
                <SelectTrigger id="chart-type" className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="area">Area Chart</SelectItem>
                  <SelectItem value="pie">Pie Chart</SelectItem>
                  <SelectItem value="radar">Radar Chart</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data-source" className="text-xs">
                Data source
              </Label>
              <Select
                value={dataSource}
                onValueChange={(v) => setDataSource(v as DataSource)}
              >
                <SelectTrigger id="data-source" className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="athena">Athena</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="chart-width" className="text-xs">
                  Preview width (px)
                </Label>
                <Input
                  id="chart-width"
                  type="number"
                  min={MIN_CHART_WIDTH}
                  max={MAX_CHART_WIDTH}
                  value={chartWidthPx}
                  onChange={(e) =>
                    setChartWidthPx(
                      clamp(
                        Number.parseInt(e.target.value, 10) || DEFAULT_CHART_WIDTH_PX,
                        MIN_CHART_WIDTH,
                        MAX_CHART_WIDTH
                      )
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="chart-height" className="text-xs">
                  Preview height (px)
                </Label>
                <Input
                  id="chart-height"
                  type="number"
                  min={MIN_CHART_HEIGHT}
                  max={MAX_CHART_HEIGHT}
                  value={chartHeightPx}
                  onChange={(e) =>
                    setChartHeightPx(
                      clamp(
                        Number.parseInt(e.target.value, 10) || DEFAULT_CHART_HEIGHT_PX,
                        MIN_CHART_HEIGHT,
                        MAX_CHART_HEIGHT
                      )
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="show-legend"
                type="checkbox"
                checked={showLegend}
                onChange={(e) => setShowLegend(e.target.checked)}
                className="size-3.5 rounded border-input accent-primary"
              />
              <Label htmlFor="show-legend" className="text-xs font-normal">
                Show legend
              </Label>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="legend-label" className="text-xs">
                Legend label
              </Label>
              <Input
                id="legend-label"
                value={legendLabel}
                onChange={(e) => setLegendLabel(e.target.value)}
                placeholder="Value"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Series color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={seriesColorPicker}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSeriesColorPicker(v);
                    setSeriesColor(v);
                  }}
                  className="h-8 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                  aria-label="Pick series color"
                />
                <Input
                  value={seriesColor}
                  onChange={(e) => setSeriesColor(e.target.value)}
                  placeholder="var(--chart-1) or #hex"
                  className="h-8 flex-1 text-sm font-mono"
                />
              </div>
            </div>

            <div className="rounded-md border border-border/80 bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-medium">Y-axis annotations</p>
              {chartType === "bar" ||
              chartType === "line" ||
              chartType === "area" ? (
                <>
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      Threshold lines (horizontal)
                    </p>
                    {referenceLines.map((l) => (
                      <div
                        key={l.id}
                        className="grid grid-cols-[72px_1fr_56px_20px_28px] gap-1.5 items-center"
                      >
                        <Input
                          type="number"
                          value={l.y}
                          onChange={(e) =>
                            setReferenceLines((prev) =>
                              prev.map((x) =>
                                x.id === l.id
                                  ? {
                                      ...x,
                                      y: Number.parseFloat(e.target.value) || 0,
                                    }
                                  : x
                              )
                            )
                          }
                          className="h-7 text-xs"
                          title="Y value"
                        />
                        <Input
                          value={l.label ?? ""}
                          onChange={(e) =>
                            setReferenceLines((prev) =>
                              prev.map((x) =>
                                x.id === l.id
                                  ? { ...x, label: e.target.value || undefined }
                                  : x
                              )
                            )
                          }
                          placeholder="Label"
                          className="h-7 text-xs"
                        />
                        <input
                          type="color"
                          value={l.color ?? "#64748b"}
                          onChange={(e) =>
                            setReferenceLines((prev) =>
                              prev.map((x) =>
                                x.id === l.id
                                  ? { ...x, color: e.target.value }
                                  : x
                              )
                            )
                          }
                          className="h-7 w-full min-w-0 rounded border border-input"
                          aria-label="Line color"
                        />
                        <input
                          type="checkbox"
                          checked={!!l.dashed}
                          onChange={(e) =>
                            setReferenceLines((prev) =>
                              prev.map((x) =>
                                x.id === l.id
                                  ? { ...x, dashed: e.target.checked }
                                  : x
                              )
                            )
                          }
                          className="size-3.5 accent-primary"
                          title="Dashed"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setReferenceLines((prev) =>
                              prev.filter((x) => x.id !== l.id)
                            )
                          }
                          aria-label="Remove line"
                        >
                          <Trash2Icon className="size-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        setReferenceLines((prev) => [
                          ...prev,
                          {
                            id: crypto.randomUUID(),
                            y: 0,
                            dashed: true,
                            color: "#64748b",
                          },
                        ])
                      }
                    >
                      Add threshold line
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      Regions (Y band fill)
                    </p>
                    {referenceBands.map((b) => (
                      <div
                        key={b.id}
                        className="grid grid-cols-[64px_64px_56px_48px_28px] gap-1.5 items-center"
                      >
                        <Input
                          type="number"
                          value={b.y1}
                          onChange={(e) =>
                            setReferenceBands((prev) =>
                              prev.map((x) =>
                                x.id === b.id
                                  ? {
                                      ...x,
                                      y1: Number.parseFloat(e.target.value) || 0,
                                    }
                                  : x
                              )
                            )
                          }
                          className="h-7 text-xs"
                          title="Y1"
                        />
                        <Input
                          type="number"
                          value={b.y2}
                          onChange={(e) =>
                            setReferenceBands((prev) =>
                              prev.map((x) =>
                                x.id === b.id
                                  ? {
                                      ...x,
                                      y2: Number.parseFloat(e.target.value) || 0,
                                    }
                                  : x
                              )
                            )
                          }
                          className="h-7 text-xs"
                          title="Y2"
                        />
                        <input
                          type="color"
                          value={b.fill}
                          onChange={(e) =>
                            setReferenceBands((prev) =>
                              prev.map((x) =>
                                x.id === b.id
                                  ? { ...x, fill: e.target.value }
                                  : x
                              )
                            )
                          }
                          className="h-7 w-full min-w-0 rounded border border-input"
                          aria-label="Fill"
                        />
                        <Input
                          type="number"
                          step={0.05}
                          min={0}
                          max={1}
                          value={b.fillOpacity ?? 0.22}
                          onChange={(e) =>
                            setReferenceBands((prev) =>
                              prev.map((x) =>
                                x.id === b.id
                                  ? {
                                      ...x,
                                      fillOpacity: clamp(
                                        Number.parseFloat(e.target.value) || 0,
                                        0,
                                        1
                                      ),
                                    }
                                  : x
                              )
                            )
                          }
                          className="h-7 text-xs"
                          title="Opacity"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setReferenceBands((prev) =>
                              prev.filter((x) => x.id !== b.id)
                            )
                          }
                          aria-label="Remove band"
                        >
                          <Trash2Icon className="size-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        setReferenceBands((prev) => [
                          ...prev,
                          {
                            id: crypto.randomUUID(),
                            y1: 0,
                            y2: 100,
                            fill: "#94a3b8",
                            fillOpacity: 0.2,
                          },
                        ])
                      }
                    >
                      Add region
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Threshold lines and regions apply to bar, line, and area charts
                  only.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Saved configs
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal leading-snug">
              Named snapshots (chart type, size, data, Athena query fields). API
              keys are not stored in presets; the current session key is kept.
              Stored in <code className="text-[11px]">localStorage</code>.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preset-name" className="text-xs">
                New preset name
              </Label>
              <div className="flex gap-2">
                <Input
                  id="preset-name"
                  value={presetNameDraft}
                  onChange={(e) => setPresetNameDraft(e.target.value)}
                  placeholder="e.g. NL companies bar"
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={saveCurrentPreset}
                >
                  Save
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preset-pick" className="text-xs">
                Load or delete
              </Label>
              <Select
                value={selectedPresetId || "__none__"}
                onValueChange={(v) =>
                  setSelectedPresetId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger id="preset-pick" className="h-8 text-sm">
                  <SelectValue placeholder="Select a saved config…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                disabled={!selectedPresetId}
                onClick={loadSelectedPreset}
              >
                Load
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={!selectedPresetId}
                onClick={deleteSelectedPreset}
              >
                Delete
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={presets.length === 0}
                onClick={exportPresetsFile}
              >
                <DownloadIcon className="size-3.5" />
                Export JSON
              </Button>
            </div>
          </CardContent>
        </Card>

        {dataSource === "athena" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Athena
              </CardTitle>
              <p className="text-xs text-muted-foreground font-normal leading-snug">
                Form values (including API key) are saved in{" "}
                <code className="text-[11px]">localStorage</code> on this device
                so they survive navigation. Keys in the browser are still
                exposed; prefer passing{" "}
                <code className="text-[11px]">athenaClient</code> from a server
                proxy when possible.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {showConnectionFields && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="athena-url" className="text-xs">
                      Gateway URL
                    </Label>
                    <Input
                      id="athena-url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://…"
                      className="h-8 text-sm"
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="athena-key" className="text-xs">
                      API key
                    </Label>
                    <Input
                      id="athena-key"
                      type="password"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="…"
                      className="h-8 text-sm"
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="athena-client-name" className="text-xs">
                      Gateway client name
                    </Label>
                    <Input
                      id="athena-client-name"
                      value={gatewayNameInput}
                      onChange={(e) => setGatewayNameInput(e.target.value)}
                      placeholder="evilcharts"
                      className="h-8 text-sm"
                    />
                  </div>
                </>
              )}
              {!showConnectionFields && (
                <p className="text-xs text-muted-foreground">
                  Using injected <code className="text-[11px]">athenaClient</code>
                  .
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="athena-table" className="text-xs">
                  Table
                </Label>
                <Input
                  id="athena-table"
                  value={tableInput}
                  onChange={(e) => setTableInput(e.target.value)}
                  placeholder="my_table"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="athena-select" className="text-xs">
                  Select (optional)
                </Label>
                <Input
                  id="athena-select"
                  value={selectInput}
                  onChange={(e) => setSelectInput(e.target.value)}
                  placeholder="empty = category column + measure column only"
                  className="h-8 text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground leading-snug -mt-1">
                <strong className="font-medium text-foreground">Category</strong>{" "}
                and <strong className="font-medium text-foreground">measure</strong>{" "}
                must be real column names on the table (e.g.{" "}
                <code className="text-[11px]">name</code>,{" "}
                <code className="text-[11px]">id</code>). To restrict rows (e.g.{" "}
                country = NL), use the filter below — do not put{" "}
                <code className="text-[11px]">NL</code> in the measure field.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="athena-label-field" className="text-xs">
                    Category column (axis label)
                  </Label>
                  <Input
                    id="athena-label-field"
                    value={labelFieldInput}
                    onChange={(e) => setLabelFieldInput(e.target.value)}
                    placeholder="name"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="athena-value-field" className="text-xs">
                    Measure column (numeric)
                  </Label>
                  <Input
                    id="athena-value-field"
                    value={valueFieldInput}
                    onChange={(e) => setValueFieldInput(e.target.value)}
                    placeholder="id"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="athena-filter-column" className="text-xs">
                    Filter column (optional)
                  </Label>
                  <Input
                    id="athena-filter-column"
                    value={filterColumnInput}
                    onChange={(e) => setFilterColumnInput(e.target.value)}
                    placeholder="country_code"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="athena-filter-value" className="text-xs">
                    Filter equals
                  </Label>
                  <Input
                    id="athena-filter-value"
                    value={filterValueInput}
                    onChange={(e) => setFilterValueInput(e.target.value)}
                    placeholder="NL"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="athena-row-limit" className="text-xs">
                  Row limit
                </Label>
                <Input
                  id="athena-row-limit"
                  type="number"
                  min={1}
                  max={10000}
                  value={rowLimit}
                  onChange={(e) =>
                    setRowLimit(
                      Math.min(
                        10000,
                        Math.max(1, parseInt(e.target.value, 10) || 500)
                      )
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex items-start gap-2">
                <input
                  id="live-refresh"
                  type="checkbox"
                  checked={liveRefreshEnabled}
                  onChange={(e) => {
                    setLiveRefreshEnabled(e.target.checked);
                    if (!e.target.checked) setLivePollError(null);
                  }}
                  disabled={!resolvedClient}
                  className="mt-0.5 size-3.5 accent-primary"
                />
                <Label
                  htmlFor="live-refresh"
                  className="text-xs font-normal leading-snug text-muted-foreground"
                >
                  Live refresh every 2s (always fetches 500 rows; manual row
                  limit applies only to the button above)
                </Label>
              </div>
              {livePollError ? (
                <p
                  className="text-xs text-amber-600 dark:text-amber-500"
                  role="status"
                >
                  Last poll error: {livePollError}
                </p>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={fetchLoading || !resolvedClient}
                onClick={() => void fetchFromAthena()}
              >
                {fetchLoading ? "Loading…" : "Fetch from Athena"}
              </Button>
              {athenaError && (
                <div
                  role="alert"
                  className="text-xs text-destructive space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2"
                >
                  <p>{athenaError}</p>
                  {athenaErrorDetails && (
                    <p className="text-muted-foreground">{athenaErrorDetails}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {dataSource === "manual" && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Data Points
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={addDataPoint}
                >
                  <PlusIcon className="size-3" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_80px_32px] gap-2 mb-1">
                <span className="text-xs text-muted-foreground">Label</span>
                <span className="text-xs text-muted-foreground">Value</span>
                <span />
              </div>
              {data.map((point, index) => (
                <div
                  key={point.id}
                  className="grid grid-cols-[1fr_80px_32px] gap-2 items-center"
                >
                  <Input
                    value={point.label}
                    onChange={(e) =>
                      updateDataPoint(point.id, "label", e.target.value)
                    }
                    className="h-7 text-xs"
                    placeholder="Label"
                    aria-label={`Label for data point ${point.label || `row ${index + 1}`}`}
                  />
                  <Input
                    type="number"
                    value={point.value}
                    onChange={(e) =>
                      updateDataPoint(point.id, "value", e.target.value)
                    }
                    className="h-7 text-xs"
                    placeholder="0"
                    aria-label={`Value for data point ${point.label || `row ${index + 1}`}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeDataPoint(point.id)}
                    disabled={data.length <= 1}
                    aria-label="Remove data point"
                  >
                    <Trash2Icon className="size-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <ChartPreview
          chartType={chartType}
          data={data}
          title={chartTitle}
          widthPx={chartWidthPx}
          heightPx={chartHeightPx}
          showLegend={showLegend}
          legendLabel={legendLabel}
          seriesColor={seriesColor}
          referenceLines={referenceLines}
          referenceBands={referenceBands}
        />
        <ChartDataTable rawRows={athenaRawRows} manualRows={data} />
      </div>
    </div>
  );
}
