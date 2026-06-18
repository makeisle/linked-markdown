---
layout: home

hero:
  name: Linked Markdown
  text: A document is a graph
  tagline: Markdown you read as plain prose — and that AI and tools read as a typed knowledge graph.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Syntax guide
      link: /guide/syntax
    - theme: alt
      text: Specification
      link: /guide/spec

features:
  - title: Looks like Markdown
    details: All link metadata lives in HTML comments and front matter, invisible in every CommonMark/GFM renderer. Read the raw file as ordinary prose.
  - title: Identity, not guesswork
    details: Every linkable block has a stable UUID. That UUID is the join key into any external vector store, so embeddings live outside the file while the file stays the source of truth for connectivity.
  - title: Versioned links
    details: Cross-document references resolve through an import lockfile (namespace:slug@version) and carry content hashes, so drift is detectable.
  - title: One reference implementation, two targets
    details: A Rust core compiles natively for the CLI and to WebAssembly for the browser editor and viewer — kept honest by a shared conformance suite.
---
