import aiohttp
import logging
import uuid
import json
from aiohttp import web
from typing import Any, Callable, Awaitable
from . import utils


__sockets: dict[str, web.WebSocketResponse] = {}


async def create_websocket_handler(
    request, handler: Callable[[str, Any, str], Awaitable[Any]]
):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    sid = request.rel_url.query.get("clientId", "")
    if sid:
        # Reusing existing session, remove old
        __sockets.pop(sid, None)
    else:
        sid = uuid.uuid4().hex

    __sockets[sid] = ws

    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.ERROR:
                logging.warning(
                    "ws connection closed with exception %s" % ws.exception()
                )
            if msg.type == aiohttp.WSMsgType.TEXT:
                data = json.loads(msg.data)
                await handler(data.get("type"), data.get("detail"), sid)
    finally:
        __sockets.pop(sid, None)
    return ws


async def send_json(event: str, data: Any, sid: str = None):
    detail = utils.unpack_dataclass(data)
    message = {"type": event, "data": detail}

    if sid is None:
        socket_list = list(__sockets.values())
        for ws in socket_list:
            await __send_socket_catch_exception(ws.send_json, message)
    elif sid in __sockets:
        await __send_socket_catch_exception(__sockets[sid].send_json, message)


async def __send_socket_catch_exception(function, message):
    try:
        await function(message)
    except (
        aiohttp.ClientError,
        aiohttp.ClientPayloadError,
        ConnectionResetError,
        BrokenPipeError,
        ConnectionError,
    ) as err:
        logging.warning("send error: {}".format(err))
