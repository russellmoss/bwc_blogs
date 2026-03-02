export { runQAChecks, CHECK_REGISTRY, BrowserDomAdapter } from "./engine";
export type { DomAdapter, DomElement } from "./engine";
export { fleschKincaidGrade, countSyllables, countSentences } from "./readability";
export { getFixTier, getFixEntry, getClaudePromptTemplate } from "./fix-registry";
export { CheerioDomAdapter } from "./cheerio-adapter";
export { buildPatchPrompt } from "./patch-prompt";
export { mergePartialDocument, parsePartialJson } from "./merge-partial";
