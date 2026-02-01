import React from "react";
import { GenerateBreadcrumb } from "@/components/ui/generate-breadcrumb";
import {
  DocsContainer,
  DocsDescription,
  DocsLink,
  DocsParagraph,
  DocsSubContainer,
  DocsSubtitle,
  DocsTitle,
} from "@/components/docs/components/docs-typography";
import { WhiteSpan } from "@/components/ui/typography";

const Page = () => {
  return (
    <div className="page">
      <GenerateBreadcrumb />
      <DocsContainer>
        <DocsTitle title="Introduction" />
        <DocsDescription>
          While searching for chart components with smooth animations and
          dynamic data visualizations, I realized there weren&apos;t many
          options available. So, I decided to build my own.
        </DocsDescription>
      </DocsContainer>
      <DocsParagraph>
        <WhiteSpan>Charts UI</WhiteSpan> is a library of chart components with
        smooth animations and dynamic data visualizations. It is built with
        React and TypeScript.
      </DocsParagraph>
      <DocsParagraph>
        It is a collection of chart components with smooth animations and
        dynamic data transitions.
      </DocsParagraph>
      <DocsSubContainer>
        <DocsSubtitle title="Why I named it EvilCharts?" />
        <DocsParagraph>
          I named this library <WhiteSpan>EvilCharts</WhiteSpan> because
          it&apos;s inspired by{" "}
          <DocsLink href="https://x.com/evilrabbit_" _blank>
            @Evil Rabbit
          </DocsLink>{" "}
          which is why I chose the name EvilCharts.
        </DocsParagraph>
        <DocsSubtitle className="!mt-6" title="Design Philosophy" />
        <DocsParagraph>
          As I wanted to create it as plug and play, not a separate library, I
          used the shadcn design system. This makes it easy to use and integrate
          with your project.
        </DocsParagraph>
      </DocsSubContainer>
      <DocsSubContainer>
        <DocsParagraph>
          Our Chart Components are built with{" "}
          <DocsLink href="http://recharts.github.io/" _blank>
            recharts
          </DocsLink>{" "}
          and{" "}
          <DocsLink href="https://ui.shadcn.com/" _blank>
            shadcn UI
          </DocsLink>{" "}
          design system.
        </DocsParagraph>
      </DocsSubContainer>
    </div>
  );
};
export default Page;
