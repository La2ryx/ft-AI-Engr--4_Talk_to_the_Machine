import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MarkdownMessage from "@/components/MarkdownMessage";

const render = (content: string) =>
  renderToStaticMarkup(createElement(MarkdownMessage, { content }));

describe("Markdown replies", () => {
  it("renders headings, lists, emphasis, and fenced code", () => {
    const html = render("# Answer\n\n**Important**\n\n- First\n- Second\n\n```js\nconst value = 1;\n```");
    expect(html).toContain("<h1>Answer</h1>");
    expect(html).toContain("<strong>Important</strong>");
    expect(html).toContain("<li>First</li>");
    expect(html).toContain('<code class="language-js">');
  });

  it("renders GFM tables inside an accessible scrolling region", () => {
    const html = render("| Model | Tokens |\n| --- | --- |\n| Example | 12 |");
    expect(html).toContain('aria-label="Response table"');
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Tokens</th>");
    expect(html).toContain("<td>12</td>");
  });

  it("does not render raw HTML or executable links", () => {
    const html = render('<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("opens source links with safe new-tab attributes", () => {
    const html = render("[Source](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
