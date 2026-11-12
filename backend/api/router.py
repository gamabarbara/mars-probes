from fastapi import APIRouter

from api.probes import read_router, write_router

api_router = APIRouter()
api_router.include_router(read_router, prefix="/probes")
api_router.include_router(write_router, prefix="/probes")
