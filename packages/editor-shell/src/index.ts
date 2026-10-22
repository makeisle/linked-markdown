export { EditorShell, aliasFrom, type EditorShellProps } from "./EditorShell.js";
export { ModalViewer } from "./ModalViewer.js";
export type { AnchorOption, CrossAnchor } from "./SectionEditor.js";
export type { Resolution, Workspace, WsAnchor, WsDoc } from "./workspace.js";
export {
  DEFAULT_HISTORY_LIMITS,
  canRedo,
  canUndo,
  createHistory,
  parseHistory,
  recordEdit,
  redo,
  undo,
  type EditHistory,
  type HistoryLimits,
  type HistorySnapshot,
  type RecordOptions,
} from "./history.js";
