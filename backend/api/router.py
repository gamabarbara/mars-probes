from fastapi import APIRouter

from api.probes_rest import read_router, write_router

api_router = APIRouter()
api_router.include_router(read_router)
api_router.include_router(write_router)
