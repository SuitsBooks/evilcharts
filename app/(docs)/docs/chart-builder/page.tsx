"use client";

import React, { useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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
  DocsContainer,
  DocsDescription,
  DocsTitle,
} from "@/components/docs/components/docs-typography";
import { GenerateBreadcrumb } from "@/components/ui/generate-breadcrumb";
import { PlusIcon, Trash2Icon } from "lucide-react";

type ChartType = "bar" | "line" | "area" | "pie" | "radar";

interface DataPoint {
  id: string;
  label: string;
  value: number;
}

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

function ChartPreview({
  chartType,
  data,
  title,
}: {
  chartType: ChartType;
  data: DataPoint[];
  title: string;
}) {
  const chartData = data.map((d) => ({ name: d.label, value: d.value }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {title || "Chart Preview"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {chartType === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v.length > 4 ? v.slice(0, 3) : v)}
              />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="var(--chart-1)" radius={4} />
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v.length > 4 ? v.slice(0, 3) : v)}
              />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--chart-1)" }}
              />
            </LineChart>
          ) : chartType === "area" ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="builder-area-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v.length > 4 ? v.slice(0, 3) : v)}
              />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#builder-area-fill)"
              />
            </AreaChart>
          ) : chartType === "pie" ? (
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={110}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          ) : (
            // radar
            <RadarChart data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Radar
                dataKey="value"
                stroke="var(--chart-1)"
                fill="var(--chart-1)"
                fillOpacity={0.3}
              />
            </RadarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default function ChartBuilderPage() {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [chartTitle, setChartTitle] = useState("My Chart");
  const [data, setData] = useState<DataPoint[]>(DEFAULT_DATA);

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
            return { ...d, value: isNaN(num) ? 0 : num };
          }
          return { ...d, label: raw };
        })
      );
    },
    []
  );

  return (
    <div className="page">
      <GenerateBreadcrumb />
      <DocsContainer>
        <DocsTitle title="Chart Builder" />
        <DocsDescription>
          Build a custom chart by selecting a chart type, entering your data,
          and seeing a live preview.
        </DocsDescription>
      </DocsContainer>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="flex flex-col gap-4">
          {/* Chart type + title */}
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
            </CardContent>
          </Card>

          {/* Data points */}
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
              {data.map((point) => (
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
                  />
                  <Input
                    type="number"
                    value={point.value}
                    onChange={(e) =>
                      updateDataPoint(point.id, "value", e.target.value)
                    }
                    className="h-7 text-xs"
                    placeholder="0"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeDataPoint(point.id)}
                    disabled={data.length <= 1}
                  >
                    <Trash2Icon className="size-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Live preview */}
        <ChartPreview chartType={chartType} data={data} title={chartTitle} />
      </div>
    </div>
  );
}
