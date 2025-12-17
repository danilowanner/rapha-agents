import markdownIt, { Token } from "markdown-it-ts";

const md = markdownIt();

type RenderContext = {
  inBlockquote: boolean;
  inListItem: boolean;
  orderedListCounter?: number;
};

/**
 * Converts Markdown to Telegram-compatible HTML.
 * Uses markdown-it tokens for clean conversion without regex HTML parsing.
 * Supports: b, i, u, s, code, pre, a, blockquote.
 */
export const markdownToTelegramHtml = (markdown: string): string => {
  const tokens = md.parse(markdown, {});
  return renderTokens(tokens, { inBlockquote: false, inListItem: false })
    .trim()
    .replace(/\n{3,}/g, "\n\n");
};

const renderTokens = (tokens: Token[], ctx: RenderContext): string => {
  let result = "";
  let currentCtx = { ...ctx };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Update context BEFORE processing token
    if (token.type === "blockquote_open") currentCtx = { ...currentCtx, inBlockquote: true };
    if (token.type === "list_item_open") currentCtx = { ...currentCtx, inListItem: true };

    switch (token.type) {
      case "paragraph_open":
        break;
      case "paragraph_close":
        if (!currentCtx.inBlockquote && !currentCtx.inListItem) result += "\n\n";
        break;

      case "heading_open":
        result += "<b>";
        break;
      case "heading_close":
        result += "</b>\n\n";
        break;

      case "strong_open":
        result += "<b>";
        break;
      case "strong_close":
        result += "</b>";
        break;

      case "em_open":
        result += "<i>";
        break;
      case "em_close":
        result += "</i>";
        break;

      case "s_open":
        result += "<s>";
        break;
      case "s_close":
        result += "</s>";
        break;

      case "code_inline":
        result += `<code>${escapeHtml(token.content)}</code>`;
        break;

      case "fence":
      case "code_block":
        result += `<pre>${escapeHtml(token.content.trimEnd())}</pre>\n\n`;
        break;

      case "link_open": {
        const href = token.attrGet("href") ?? "";
        result += `<a href="${escapeHtml(href)}">`;
        break;
      }
      case "link_close":
        result += "</a>";
        break;

      case "blockquote_open":
        result += "<blockquote>";
        break;
      case "blockquote_close":
        result = result.trimEnd();
        result += "</blockquote>\n\n";
        break;

      case "bullet_list_open":
        if (token.level > 0) result += "\n";
        break;
      case "bullet_list_close":
        if (token.level === 0) result += "\n";
        break;

      case "ordered_list_open":
        currentCtx = { ...currentCtx, orderedListCounter: 0 };
        break;
      case "ordered_list_close":
        result += "\n";
        currentCtx = { ...currentCtx, orderedListCounter: undefined };
        break;

      case "list_item_open": {
        const isOrdered = currentCtx.orderedListCounter !== undefined;
        if (isOrdered) {
          currentCtx = { ...currentCtx, orderedListCounter: (currentCtx.orderedListCounter ?? 0) + 1 };
          result += `${currentCtx.orderedListCounter}. `;
        } else {
          const depth = Math.floor(token.level / 2);
          const bullets = ["•", "∙•", "∙∙•"];
          const bullet = bullets[depth] ?? "";
          result += `${bullet} `;
        }
        break;
      }
      case "list_item_close":
        result += "\n";
        break;

      case "softbreak":
      case "hardbreak":
        result += "\n";
        break;

      case "hr":
        result += "\n";
        break;

      case "text":
        result += escapeHtml(token.content);
        break;

      case "inline":
        if (token.children) {
          result += renderTokens(token.children, currentCtx);
        }
        break;

      case "html_block":
      case "html_inline":
        break;

      default:
        if (token.children) {
          result += renderTokens(token.children, currentCtx);
        }
    }

    // Update context AFTER processing closing tags
    if (token.type === "blockquote_close") currentCtx = { ...currentCtx, inBlockquote: false };
    if (token.type === "list_item_close") currentCtx = { ...currentCtx, inListItem: false };
  }

  return result;
};

const escapeHtml = (str: string): string =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
