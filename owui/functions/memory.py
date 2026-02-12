"""
title: Memory Filter
author: open-webui
author_url: https://github.com/open-webui
funding_url: https://github.com/open-webui
version: 0.1
"""

import json
import urllib.request
from urllib.parse import urlencode

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
        api_url: str = Field(
            default="http://rapha-ai-api-zvlvy0:3000/memory",
            description="Memory API endpoint URL. Use Dokploy service name (see Containers list). OWUI must be on dokploy-network.",
        )

    def __init__(self):
        self.valves = self.Valves()

    async def inlet(
        self,
        body: dict,
        __task__=None,
        __chat_id__=None,
        __user__: Optional[dict] = None,
        __event_emitter__=None,
    ) -> dict:
        if __task__:
            return body
        config = _get_config(self.valves, __user__)
        messages = body.get("messages", [])
        system_idx = _find_system_message_index(messages)
        if not config:
            await _emit_status(__event_emitter__, "Memory: valves for API key and URL not configured", hidden=False)
            return body
        await _emit_status(__event_emitter__, "Fetching memories...", hidden=False)
        memory_xml, fetch_err = _fetch_memory(config["url"], config["headers"], config["user_id"], exclude_chat_id=__chat_id__)
        if fetch_err:
            await _emit_status(__event_emitter__, f"Memory fetch failed: {fetch_err}", hidden=False)
            return body
        if  memory_xml:
            memory_part = {"type": "text", "text": memory_xml}
            if system_idx is not None:
                content = messages[system_idx].get("content", "")
                parts = content if isinstance(content, list) else [{"type": "text", "text": content}]
                parts.append(memory_part)
                messages[system_idx]["content"] = parts
            else:
                messages.insert(0, {"role": "system", "content": [memory_part]})
            await _emit_status(__event_emitter__, "Memories loaded", hidden=False)
        else:
            await _emit_status(__event_emitter__, "No memories found", hidden=False)
        return body

    async def outlet(
        self,
        body: dict,
        __chat_id__=None,
        __user__: Optional[dict] = None,
        __event_emitter__ = None,
    ) -> dict:
        messages = body.get("messages", [])
        pairs = _collect_user_agent_pairs(messages)
        if not pairs:
            return body
        latest = pairs[-1]
        config = _get_config(self.valves, __user__)
        if not config:
            await _emit_status(__event_emitter__, "Memory: valves for API key and URL not configured", hidden=False)
            return body
        chat_id = _thread_id(__chat_id__, body)
        _attach_outlet_body_debug(body)
        ok, err = _post_memory(config["url"], config["headers"], config["user_id"], latest, chat_id=chat_id)
        if ok:
            await _emit_status(__event_emitter__, "Memory saved", hidden=True)
        else:
            chat_repr = repr(chat_id)
            await _emit_status(__event_emitter__, f"Memory failed: {err} (chat_id={chat_repr})", hidden=False)
        return body


def _get_config(valves, __user__: Optional[dict]) -> Optional[dict[str, Any]]:
    user_id = (__user__ or {}).get("email", "")
    if not user_id:
        return None
    api_key = (valves.api_key or "").strip()
    url = (valves.api_url or "").strip()
    if not api_key or not url:
        return None
    return {
        "user_id": user_id,
        "url": url,
        "headers": {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    }


async def _emit_status(emitter: Any, description: str, hidden: bool = False) -> None:
    if not emitter:
        return
    await emitter(
        {
            "type": "status",
            "data": {
                "description": description,
                "done": True,
                "hidden": hidden,
            },
        }
    )


def _attach_outlet_body_debug(body: dict) -> None:
    """
    JSON-serializes the outlet body and appends it as an assistant message to body["messages"]
    so it shows up in the chat for inspection.
    """
    try:
        dump = json.dumps(body, default=str, indent=2)
    except Exception:
        return
    messages = body.get("messages", [])
    if not isinstance(messages, list):
        body["messages"] = messages = []
    messages.append({"role": "assistant", "content": f"[Memory filter debug] outlet body:\n{dump}"})


def _thread_id(reserved_chat_id: Any, body: dict) -> Optional[str]:
    """OWUI provides a unique thread id per chat (reserved arg __chat_id__ or body["chat_id"])."""
    if reserved_chat_id and isinstance(reserved_chat_id, str):
        return reserved_chat_id.strip() or None
    val = body.get("chat_id")
    return val.strip() if val and isinstance(val, str) else None


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
    pair: dict[str, str],
    chat_id: Optional[str] = None,
) -> tuple[bool, str]:
    payload: dict[str, Any] = {
        "userId": user_id,
        "userMessage": pair["userMessage"],
        "agentMessage": pair["agentMessage"],
    }
    if chat_id is not None:
        payload["chatId"] = chat_id
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        urllib.request.urlopen(req, timeout=10)
        return True, ""
    except Exception as e:
        return False, str(e)


def _fetch_memory(
    url: str,
    headers: dict[str, str],
    user_id: str,
    exclude_chat_id: Optional[str] = None,
) -> tuple[str, str]:
    memory_url = _url_join(url, user_id)
    if exclude_chat_id:
        memory_url = f"{memory_url}?{urlencode({'excludeChatId': exclude_chat_id})}"
    req = urllib.request.Request(memory_url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data.get("xml", ""), ""
    except Exception as e:
        return "", str(e)


def _find_system_message_index(messages: list[dict]) -> Optional[int]:
    for idx, msg in enumerate(messages):
        if msg.get("role") == "system":
            return idx
    return None