"""
title: Publish Notes
author: Danilo
author_url: https://github.com/danilowanner
version: 0.1
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
        parent = meta.get("parent_message") or {}
        files = parent.get("files") or []
        chat_id = str(meta.get("chat_id") or "")
        message_id = str(meta.get("message_id") or "")

        user_email = ((__user__ or {}).get("email") or "") or (
            ((parent.get("user") or {}).get("email")) or ""
        )

        if not files:
            return "No files found on the parent message; nothing was published."

        await _emit_status(__event_emitter__, f"Publishing {len(files)} note(s) to Docs...", done=False)

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

        results: list[dict[str, Any]] = []
        for file in files:
            file_id = str(file.get("id") or "")
            title = str(
                file.get("title") or file.get("name") or f"Untitled {file_id}".strip()
            )
            markdown = (
                ((file.get("data") or {}).get("content") or {}).get("md") or ""
            )

            if not markdown or not isinstance(markdown, str):
                results.append({"title": title, "success": False, "url": "", "error": "Missing markdown content"})
                await _emit_notification(__event_emitter__, f"Failed to publish note '{title}': Missing markdown content")
                continue

            success, url, error = _post_note(
                url=api_url,
                headers=headers,
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

        lines: list[str] = ["## Published notes", ""]
        for r in results:
            t = r["title"] or "Untitled"
            if r["success"] and r["url"]:
                lines.append(f"- [{t}]({r['url']})")
            else:
                err = r["error"] or "Unknown error"
                lines.append(f"- {t} — Failed: {err}")
        return "\n".join(lines)


def _post_note(
    url: str,
    headers: dict[str, str],
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
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            resp = json.loads(response.read().decode("utf-8"))
            public_url = resp.get("url") or ""
            if not public_url:
                return False, "", "Docs API response did not contain a 'url' field."
            return True, public_url, ""
    except Exception as e:
        return False, "", str(e)


async def _emit_status(emitter: Any, description: str, done: bool = True) -> None:
    if not emitter:
        return
    await emitter(
        {
            "type": "status",
            "data": {"description": description, "done": done, "hidden": False},
        }
    )


async def _emit_notification(emitter: Any, content: str) -> None:
    if not emitter:
        return
    await emitter(
        {
            "type": "notification",
            "data": {"type": "error", "content": content},
        }
    )
