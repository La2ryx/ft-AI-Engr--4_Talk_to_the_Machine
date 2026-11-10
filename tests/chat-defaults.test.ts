import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import Chat from "@/components/Chat";

it("enables web search when the chat first opens", () => {
  const html = renderToStaticMarkup(createElement(Chat));
  expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*checked=""/);
  expect(html).toContain("Exa web search enabled");
});
