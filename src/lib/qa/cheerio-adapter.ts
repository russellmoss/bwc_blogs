import * as cheerio from "cheerio";
import type { Element as CheerioElement } from "domhandler";
import type { DomAdapter, DomElement } from "./engine";

export class CheerioDomAdapter implements DomAdapter {
  private $: cheerio.CheerioAPI;

  constructor(html: string) {
    this.$ = cheerio.load(html);
  }

  querySelectorAll(selector: string): DomElement[] {
    const elements: DomElement[] = [];
    try {
      this.$(selector).each((_, el) => {
        const $el = this.$(el);
        elements.push({
          tagName: (el as CheerioElement).tagName?.toUpperCase() || "",
          getAttribute: (name: string) => $el.attr(name) ?? null,
          textContent: $el.text(),
        });
      });
    } catch {
      // Invalid selector — return empty
    }
    return elements;
  }

  querySelector(selector: string): DomElement | null {
    try {
      const $el = this.$(selector).first();
      if ($el.length === 0) return null;
      const el = $el.get(0) as CheerioElement;
      return {
        tagName: el.tagName?.toUpperCase() || "",
        getAttribute: (name: string) => $el.attr(name) ?? null,
        textContent: $el.text(),
      };
    } catch {
      return null;
    }
  }
}
