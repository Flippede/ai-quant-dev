import logging
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid4())
        request.state.request_id = request_id
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("Unhandled request error request_id=%s path=%s", request_id, request.url.path)
            raise
        response.headers["X-Request-ID"] = request_id
        return response
