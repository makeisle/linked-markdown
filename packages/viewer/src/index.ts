/**
 * `@lmd/viewer` — renders a `.lmd` document as clean Markdown and overlays the
 * manifest's link graph (anchors, refs, backlinks).
 *
 * - {@link renderToHtml} is pure and returns HTML + the computed overlay.
 * - {@link mount} renders into a DOM element and adds interactivity.
 */

export { renderToHtml, type RenderResult, type Backlink } from "./render.js";
export { mount, type MountHandle } from "./mount.js";
