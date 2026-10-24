from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

CategoryName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$", to_lower=True)]
# lucide-react icon name in kebab case, e.g. "shopping-cart".
IconName = Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=50)]


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str
    icon: str
    is_default: bool
    # How many of the current user's expenses use this category.
    expense_count: int = 0


class CategoryCreate(BaseModel):
    name: CategoryName
    color: HexColor
    icon: IconName


class CategoryUpdate(BaseModel):
    name: CategoryName | None = None
    color: HexColor | None = None
    icon: IconName | None = None
