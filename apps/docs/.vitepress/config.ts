import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Linked Markdown",
  description:
    "Markdown you read as plain prose — and that AI and tools read as a typed knowledge graph.",
  // The spec/syntax pages @include the canonical files from `spec/`, which carry
  // repo-relative links (to GOVERNANCE.md, conformance/, …) that don't resolve
  // inside the docs site. Don't fail the build on those.
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Syntax", link: "/guide/syntax" },
      { text: "Spec", link: "/guide/spec" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Syntax guide", link: "/guide/syntax" },
        ],
      },
      {
        text: "Reference",
        items: [{ text: "Specification v1", link: "/guide/spec" }],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/makeisle/linked-markdown" }],
  },
});
