"""
title: Debug Request
author: Danilo
author_url: https://github.com/danilowanner
version: 0.1
"""

import json
from typing import Optional

from fastapi import Request
from pydantic import BaseModel, Field

FENCE = "`" * 6


class Pipe:
    class Valves(BaseModel):
        pretty: bool = Field(default=True)

    def __init__(self) -> None:
        self.valves = self.Valves()

    async def pipe(
        self,
        body: dict[str, object],
        __user__: Optional[dict[str, object]] = None,
        __request__: Optional[Request] = None,
        __metadata__: Optional[dict[str, object]] = None,
    ) -> str:
        indent = 2 if self.valves.pretty else None

        body_json = json.dumps(
            body,
            indent=indent,
            ensure_ascii=False,
            default=str,
        )
        user_json = json.dumps(
            __user__,
            indent=indent,
            ensure_ascii=False,
            default=str,
        )
        metadata_json = json.dumps(
            __metadata__,
            indent=indent,
            ensure_ascii=False,
            default=str,
        )

        return "\n\n".join(
            [
                f"### Body\n{FENCE}json\n{body_json}\n{FENCE}",
                f"### User\n{FENCE}json\n{user_json}\n{FENCE}",
                f"### Metadata\n{FENCE}json\n{metadata_json}\n{FENCE}",
            ]
        )
