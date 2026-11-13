from typing import Annotated, Literal

from pydantic import AliasPath, BaseModel, ConfigDict, Field

from domain import MAX_GRID_COORDINATE, Direction, ProbeSortField

GridLimit = Annotated[int, Field(strict=True, ge=0, le=MAX_GRID_COORDINATE)]


class LaunchRequest(BaseModel):
    x: GridLimit
    y: GridLimit
    direction: Direction


class CommandsRequest(BaseModel):
    commands: str = Field(
        strict=True, min_length=1, max_length=1000, pattern=r"^[MLR]+$"
    )


class ProbeListQuery(BaseModel):
    limit: int | None = Field(
        default=None,
        ge=1,
        le=100,
        description=(
            "Maximum number of probes to return. Defaults to 20 when only offset "
            "is provided. Omit both pagination parameters to return all probes."
        ),
    )
    offset: int | None = Field(
        default=None,
        ge=0,
        le=2**63 - 1,
        description="Number of probes to skip. Starts at the first probe when omitted.",
    )
    sort_by: ProbeSortField = ProbeSortField.ID
    order: Literal["asc", "desc"] = "asc"


class ProbeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, validate_by_name=True)

    id: str
    x: int = Field(validation_alias=AliasPath("position", "x"))
    y: int = Field(validation_alias=AliasPath("position", "y"))
    direction: Direction


class ProbeDetailResponse(ProbeResponse):
    max_x: GridLimit = Field(validation_alias=AliasPath("grid", "max_x"))
    max_y: GridLimit = Field(validation_alias=AliasPath("grid", "max_y"))


class ProbeListResponse(BaseModel):
    probes: list[ProbeResponse]
