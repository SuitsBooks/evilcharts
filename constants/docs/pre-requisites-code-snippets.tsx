import { BundledLanguage } from "shiki";

interface SnippetProps {
  code: string;
  language: BundledLanguage;
}

interface CodeSnippetProps {
  INSTALL_SHADCN_UI: SnippetProps;
  ADD_COMPONENTS: SnippetProps;
  INSTALL_RECHARTS: SnippetProps;
}

export const CODE_DOCS_LINKS = {
  INSTALL_NEXT_JS:
    "https://nextjs.org/docs/app/api-reference/cli/create-next-app",
  CONFIGURE_NEXT_JS_CLI:
    "https://nextjs.org/docs/app/api-reference/cli/create-next-app#with-the-default-template",
  INSTALL_TAILWIND_CSS:
    "https://tailwindcss.com/docs/installation/framework-guides/nextjs",
  INSTALL_SHADCN_UI: "https://ui.shadcn.com/docs/installation/next",
  INSTALL_RECHARTS: "https://recharts.github.io/en-US/guide/installation",
};

export const CODE_SNIPPETS: CodeSnippetProps = {
  INSTALL_SHADCN_UI: {
    code: `npx shadcn@latest init`,
    language: "bash",
  },
  ADD_COMPONENTS: {
    code: `npx shadcn@latest add chart label card`,
    language: "bash",
  },
  INSTALL_RECHARTS: {
    code: `npm install recharts@2.15.4`,
    language: "bash",
  },
};
