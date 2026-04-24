"""
title: Context Trim Filter
author: Danilo
author_url: https://github.com/danilowanner
version: 0.2
"""

from dataclasses import dataclass
from pydantic import BaseModel, Field
from typing import Any, Optional


ROLE_KEYS = ("system", "user", "assistant", "tool")
ROLE_ABBREVIATIONS: dict[str, str] = {
    "system": "sys",
    "user": "user",
    "assistant": "asst",
    "tool": "tool",
}


@dataclass(frozen=True)
class ContextStats:
    char_counts: dict[str, int]
    total_bytes: int
    n_images: int
    n_files: int


class Filter:
    class Valves(BaseModel):
        priority: int = Field(
            default=5,
            description="Filter execution order. Lower values run first. Default 5 so this runs after memory filter.",
        )
        context_alert_threshold_tokens: int = Field(
            default=50_000,
            description="Emit a warning notification when estimated token count exceeds this value. 0 = disabled.",
        )
        bytes_per_token: float = Field(
            default=3.0,
            description="Divisor to estimate tokens from UTF-8 byte count. Lower = higher estimate.",
        )
        tokens_per_image: int = Field(
            default=800,
            description="Fixed token estimate per image part.",
        )
        tokens_per_file: int = Field(
            default=800,
            description="Fixed token estimate per file part.",
        )

    def __init__(self):
        self.valves = self.Valves()

    async def inlet(
        self,
        body: dict,
        __task__=None,
        __event_emitter__=None,
    ) -> dict:
        if __task__:
            return body

        messages = body.get("messages", [])
        result = _trim_tool_context(messages)
        stats = _compute_stats(result)
        est_tokens = _estimate_tokens(stats, self.valves)

        if est_tokens > 0:
            await _emit_status(
                __event_emitter__,
                _format_status_line(stats, est_tokens),
            )

        threshold = self.valves.context_alert_threshold_tokens
        if threshold > 0 and est_tokens >= threshold:
            await _emit_notification(
                __event_emitter__,
                f"Context size (~{_format_count(est_tokens)} tokens) exceeds ~{_format_count(threshold)}. Consider starting a new chat.",
            )

        body["messages"] = result
        return body


def _trim_tool_context(messages: list[dict]) -> list[dict]:
    last_user_idx = _find_last_user_index(messages)
    if last_user_idx is None:
        return [dict(msg) for msg in messages]

    result: list[dict] = []
    for i, msg in enumerate(messages):
        copy = dict(msg)
        if i < last_user_idx:
            if msg.get("role") == "tool":
                continue
            if msg.get("role") == "assistant" and copy.get("tool_calls"):
                copy["tool_calls"] = []
        result.append(copy)
    return result


def _find_last_user_index(messages: list[dict]) -> Optional[int]:
    for i in range(len(messages) - 1, -1, -1):
        if messages[i].get("role") == "user":
            return i
    return None


def _content_stats(content: Any) -> tuple[int, int, int, int]:
    """Returns (chars, utf8_bytes, images, files) for a message content value."""
    if isinstance(content, str):
        return len(content), len(content.encode("utf-8")), 0, 0
    if not isinstance(content, list):
        return 0, 0, 0, 0
    chars = 0
    utf8_bytes = 0
    images = 0
    files = 0
    for part in content:
        if not isinstance(part, dict):
            continue
        ptype = part.get("type", "")
        if ptype == "text" or (not ptype and "text" in part):
            text = part.get("text", "")
            chars += len(text)
            utf8_bytes += len(text.encode("utf-8"))
        elif ptype in ("image_url", "image"):
            images += 1
        elif ptype == "file":
            files += 1
    return chars, utf8_bytes, images, files


def _compute_stats(messages: list[dict]) -> ContextStats:
    char_counts: dict[str, int] = {k: 0 for k in ROLE_KEYS}
    total_bytes = 0
    n_images = 0
    n_files = 0
    for msg in messages:
        role = msg.get("role", "")
        key = role if role in char_counts else "assistant"
        chars, utf8_bytes, images, files = _content_stats(msg.get("content"))
        char_counts[key] += chars
        total_bytes += utf8_bytes
        n_images += images
        n_files += files
    return ContextStats(
        char_counts=char_counts,
        total_bytes=total_bytes,
        n_images=n_images,
        n_files=n_files,
    )


def _estimate_tokens(stats: ContextStats, valves: "Filter.Valves") -> int:
    text_tokens = int(stats.total_bytes / valves.bytes_per_token)
    return (
        text_tokens
        + stats.n_images * valves.tokens_per_image
        + stats.n_files * valves.tokens_per_file
    )


def _format_count(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}K"
    return str(n)


def _pluralize(n: int, singular: str, plural: str) -> str:
    return f"{n} {singular}" if n == 1 else f"{n} {plural}"


def _format_status_line(stats: ContextStats, est_tokens: int) -> str:
    total_chars = sum(stats.char_counts.values())

    segments: list[str] = []
    if est_tokens > 0:
        segments.append(f"~{_format_count(est_tokens)} tokens")
    if stats.n_images > 0:
        segments.append(_pluralize(stats.n_images, "image", "images"))
    if stats.n_files > 0:
        segments.append(_pluralize(stats.n_files, "file", "files"))
    if total_chars > 0:
        breakdown = " · ".join(
            f"{ROLE_ABBREVIATIONS[role]} {_format_count(count)}"
            for role, count in stats.char_counts.items()
            if count > 0
        )
        char_part = f"{_format_count(total_chars)} characters"
        segments.append(f"{char_part} ({breakdown})" if breakdown else char_part)

    return " · ".join(segments)


async def _emit_status(emitter: Any, description: str) -> None:
    if not emitter:
        return
    await emitter(
        {
            "type": "status",
            "data": {
                "description": description,
                "done": True,
                "hidden": False,
            },
        }
    )


async def _emit_notification(emitter: Any, content: str) -> None:
    if not emitter:
        return
    await emitter(
        {
            "type": "notification",
            "data": {
                "type": "warning",
                "content": content,
            },
        }
    )
