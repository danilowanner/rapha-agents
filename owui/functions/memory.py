"""
title: Memory Filter
author: open-webui
author_url: https://github.com/open-webui
funding_url: https://github.com/open-webui
version: 0.1
"""

import json
import urllib.request
from pydantic import BaseModel, Field
from typing import Any, Optional


class Filter:
    class Valves(BaseModel):
        priority: int = Field(
            default=0,
            description="Filter execution order. Lower values run first.",
        )
        api_key: str = Field(
            default="",
            description="Bearer token for the memory API.",
        )

    def __init__(self):
        self.valves = self.Valves()

    async def inlet(
        self,
        body: dict,
        __event_emitter__=None,
    ) -> dict:
        if __event_emitter__:
            await __event_emitter__(
                {
                    "type": "status",
                    "data": {
                        "description": "Memory active",
                        "done": True,
                        "hidden": False,
                    },
                }
            )
        return body

    async def outlet(
        self,
        body: dict,
        __user__: Optional[dict] = None,
        __event_emitter__=None,
    ) -> dict:
        messages = body.get("messages", [])
        pairs = _collect_user_agent_pairs(messages)
        if not pairs:
            return body
        latest = pairs[-1]
        user_id = (__user__ or {}).get("email", "")
        if not user_id:
            return body
        url = "https://api.raphastudio.com/memory"
        headers = {"Content-Type": "application/json"}
        if self.valves.api_key:
            headers["Authorization"] = f"Bearer {self.valves.api_key}"
        ok, err = _post_memory(url, headers, user_id, "owui", latest)
        if __event_emitter__:
            desc = "Memory saved" if ok else f"Memory failed: {err}"
            await __event_emitter__(
                {
                    "type": "status",
                    "data": {
                        "description": desc,
                        "done": True,
                        "hidden": ok,
                    },
                }
            )
        return body


def _content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text" and "text" in item:
                    parts.append(item["text"])
            elif isinstance(item, str):
                parts.append(item)
        return " ".join(parts).strip()
    return ""


def _collect_user_agent_pairs(messages: list[dict]) -> list[dict[str, str]]:
    pairs: list[dict[str, str]] = []
    i = 0
    while i < len(messages):
        msg = messages[i]
        role = msg.get("role")
        if role != "user":
            i += 1
            continue
        user_text = _content_to_text(msg.get("content", ""))
        if i + 1 < len(messages) and messages[i + 1].get("role") == "assistant":
            agent_text = _content_to_text(messages[i + 1].get("content", ""))
            pairs.append({"userMessage": user_text, "agentMessage": agent_text})
            i += 2
        else:
            i += 1
    return pairs


def _url_join(base: str, path: str) -> str:
    return f"{base.rstrip('/')}/{path.lstrip('/')}"


def _post_memory(
    url: str,
    headers: dict[str, str],
    user_id: str,
    agent_id: str,
    pair: dict[str, str],
) -> tuple[bool, str]:
    payload = {
        "userId": user_id,
        "agentId": agent_id,
        "userMessage": pair["userMessage"],
        "agentMessage": pair["agentMessage"],
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        urllib.request.urlopen(req, timeout=10)
        return True, ""
    except Exception as e:
        return False, str(e)