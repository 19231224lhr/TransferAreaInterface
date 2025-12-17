/**
 * View Rendering Utilities
 *
 * Centralized wrapper around `lit-html` so the codebase can progressively
 * replace string-based DOM injection (e.g. `innerHTML`) with safe, efficient
 * template rendering.
 */

import { html, svg, render, nothing, type TemplateResult } from 'lit-html';

export { html, svg, render, nothing, TemplateResult };

export type ViewContent = TemplateResult | typeof nothing;

export function renderInto(target: Element | null, content: ViewContent): void {
  if (!target) return;
  // lit-html accepts Element/DocumentFragment containers; its TS types differ across versions.
  render(content as any, target as any);
}
