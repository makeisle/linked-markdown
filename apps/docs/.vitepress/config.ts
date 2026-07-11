import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Linked Mark Down",
  description:
    "Markdown you read as plain prose — and that AI and tools read as a typed knowledge graph.",
  // Served at its own subdomain https://linked-markdown.sandevaux.com/, so the
  // base is root. The interactive playground is deployed alongside at /play/.
  base: "/",
  // The spec/syntax pages @include the canonical files from `spec/`, which carry
  // some cross-references; don't fail the build on any that don't resolve here.
  ignoreDeadLinks: true,
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }]],

  // Shared across locales: the mark + wordmark, matching the app header.
  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "Linked Mark Down",
    socialLinks: [{ icon: "github", link: "https://github.com/makeisle/linked-markdown" }],
  },

  locales: {
    root: {
      label: "English",
      lang: "en",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/guide/getting-started" },
          { text: "Syntax", link: "/guide/syntax" },
          { text: "Spec", link: "/guide/spec" },
          { text: "Try it live", link: "/play/", target: "_self" },
        ],
        sidebar: [
          {
            text: "Guide",
            items: [
              { text: "Getting started", link: "/guide/getting-started" },
              { text: "The live demo", link: "/guide/demo" },
              { text: "Syntax guide", link: "/guide/syntax" },
            ],
          },
          { text: "Reference", items: [{ text: "Specification v1", link: "/guide/spec" }] },
        ],
      },
    },

    ko: {
      label: "한국어",
      lang: "ko",
      link: "/ko/",
      themeConfig: {
        nav: [
          { text: "가이드", link: "/ko/guide/getting-started" },
          { text: "문법", link: "/guide/syntax" },
          { text: "명세", link: "/guide/spec" },
          { text: "지금 써보기", link: "/play/", target: "_self" },
        ],
        sidebar: [
          {
            text: "가이드",
            items: [
              { text: "시작하기", link: "/ko/guide/getting-started" },
              { text: "라이브 데모", link: "/ko/guide/demo" },
              { text: "문법 가이드 (영문)", link: "/guide/syntax" },
            ],
          },
          { text: "레퍼런스", items: [{ text: "명세 v1 (영문)", link: "/guide/spec" }] },
        ],
        outlineTitle: "이 페이지",
        docFooter: { prev: "이전", next: "다음" },
        darkModeSwitchLabel: "다크 모드",
        returnToTopLabel: "맨 위로",
        langMenuLabel: "언어 변경",
      },
    },
  },
});
