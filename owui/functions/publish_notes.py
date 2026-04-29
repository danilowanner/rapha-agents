"""
title: Publish Notes
author: Danilo
author_url: https://github.com/danilowanner
version: 0.2
"""

import json
import urllib.request
from typing import Any, Optional

from pydantic import BaseModel, Field


class Pipe:
    class Valves(BaseModel):
        api_key: str = Field(
            default="",
            description="Bearer token for the docs API (Authorization: Bearer <token>).",
        )
        api_url: str = Field(
            default="http://rapha-ai-api-zvlvy0:3000/docs/publish",
            description="Docs publish API endpoint URL. Use Dokploy service name (see Containers list). OWUI must be on dokploy-network.",
        )

    def __init__(self) -> None:
        self.valves = self.Valves()

    async def pipe(
        self,
        body: dict[str, object],
        __user__: Optional[dict[str, object]] = None,
        __metadata__: Optional[dict[str, object]] = None,
        __event_emitter__=None,
    ) -> str:
        api_key = (self.valves.api_key or "").strip()
        api_url = (self.valves.api_url or "").strip()
        if not api_key:
            return "Docs publish configuration missing: API key not set."
        if not api_url:
            return "Docs publish configuration missing: API URL not set."

        meta = __metadata__ or {}
        user_message = _as_dict(meta.get("user_message") or body.get("user_message"))
        files = [f for f in _as_list(user_message.get("files")) if isinstance(f, dict)]
        if not files:
            return "No files found on the user message; nothing was published."

        sources = [s for s in _as_list(meta.get("sources")) if isinstance(s, dict)]
        chat_id = str(meta.get("chat_id") or body.get("chat_id") or "")
        message_id = str(meta.get("message_id") or body.get("user_message_id") or user_message.get("id") or "")
        user_email = str((__user__ or {}).get("email") or _as_dict(user_message.get("user")).get("email") or "")

        await _emit_status(__event_emitter__, f"Publishing {len(files)} note(s) to Docs...", done=False)

        results: list[dict[str, Any]] = []
        for file in files:
            file_id = str(file.get("id") or "")
            title = str(file.get("title") or file.get("name") or f"Untitled {file_id}")
            markdown = _find_source_markdown(file=file, sources=sources)

            if not markdown:
                results.append({"title": title, "success": False, "url": "", "error": "Missing markdown content"})
                await _emit_notification(__event_emitter__, f"Failed to publish note '{title}': Missing markdown content")
                continue

            success, url, error = _post_note(
                url=api_url,
                api_key=api_key,
                title=title,
                markdown=markdown,
                user_email=user_email,
                note_id=file_id,
                chat_id=chat_id,
                message_id=message_id,
            )
            results.append({"title": title, "success": success, "url": url, "error": error})
            if not success:
                await _emit_notification(__event_emitter__, f"Failed to publish note '{title}': {error}")

        await _emit_status(__event_emitter__, "Docs publish completed.", done=True)

        lines = ["## Published notes", ""]
        for r in results:
            title = r["title"] or "Untitled"
            if r["success"] and r["url"]:
                lines.append(f"- [{title}]({r['url']})")
            else:
                lines.append(f"- {title} — Failed: {r['error'] or 'Unknown error'}")
        return "\n".join(lines)


def _find_source_markdown(file: dict[str, Any], sources: list[dict[str, Any]]) -> str:
    file_id = str(file.get("id") or "")
    updated_at = file.get("updated_at")
    for source in sources:
        info = _as_dict(source.get("source"))
        if str(info.get("id") or "") != file_id:
            continue
        if info.get("updated_at") != updated_at:
            continue
        document = _as_list(source.get("document"))
        markdown = document[0] if document else ""
        return markdown if isinstance(markdown, str) else ""
    return ""


def _post_note(
    *,
    url: str,
    api_key: str,
    title: str,
    markdown: str,
    user_email: str,
    note_id: str,
    chat_id: str,
    message_id: str,
) -> tuple[bool, str, str]:
    payload = {
        "title": title,
        "markdown": markdown,
        "userEmail": user_email,
        "noteId": note_id,
        "chatId": chat_id,
        "messageId": message_id,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            public_url = json.loads(response.read().decode("utf-8")).get("url") or ""
            if not public_url:
                return False, "", "Docs API response did not contain a 'url' field."
            return True, public_url, ""
    except Exception as e:
        return False, "", str(e)


async def _emit_status(emitter: Any, description: str, done: bool = True) -> None:
    if not emitter:
        return
    await emitter({"type": "status", "data": {"description": description, "done": done, "hidden": False}})


async def _emit_notification(emitter: Any, content: str) -> None:
    if not emitter:
        return
    await emitter({"type": "notification", "data": {"type": "error", "content": content}})


def _as_dict(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: object) -> list[Any]:
    return value if isinstance(value, list) else []
