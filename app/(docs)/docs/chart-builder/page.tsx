import {
  DocsContainer,
  DocsDescription,
  DocsTitle,
} from "@/components/docs/components/docs-typography";
import { ChartBuilder } from "@/components/docs/chart-builder";
import { GenerateBreadcrumb } from "@/components/ui/generate-breadcrumb";

export default function ChartBuilderPage() {
  return (
    <div className="page">
      <GenerateBreadcrumb />
      <DocsContainer>
        <DocsTitle title="Chart Builder" />
        <DocsDescription>
          Build a custom chart by selecting a chart type, entering your data, or
          loading rows from an Athena gateway (URL + API key or injected{" "}
          <code className="text-sm">athenaClient</code>), then see a live
          preview.
        </DocsDescription>
      </DocsContainer>

      <ChartBuilder />
    </div>
  );
}
