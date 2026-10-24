from fastapi import APIRouter, Query, Response, status

from app.auth.dependencies import CurrentUser, DbSession
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.services import categories as service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut], summary="Default + custom categories")
def list_categories(user: CurrentUser, db: DbSession) -> list[CategoryOut]:
    return [
        CategoryOut.model_validate(category).model_copy(update={"expense_count": count})
        for category, count in service.list_categories(db, user)
    ]


@router.post(
    "", response_model=CategoryOut, status_code=status.HTTP_201_CREATED, summary="Create custom"
)
def create_category(data: CategoryCreate, user: CurrentUser, db: DbSession) -> CategoryOut:
    return CategoryOut.model_validate(service.create_category(db, user, data))


@router.patch("/{category_id}", response_model=CategoryOut, summary="Update a custom category")
def update_category(
    category_id: int, data: CategoryUpdate, user: CurrentUser, db: DbSession
) -> CategoryOut:
    category = service.update_category(db, user, category_id, data)
    count = service.count_expenses(db, user, category.id)
    return CategoryOut.model_validate(category).model_copy(update={"expense_count": count})


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a custom category",
    description="Returns 409 `category_in_use` if anything still uses it, unless `reassign_to` "
    "names the category to move those items to.",
)
def delete_category(
    category_id: int,
    user: CurrentUser,
    db: DbSession,
    reassign_to: int | None = Query(None, description="Category id to move items to"),
) -> Response:
    service.delete_category(db, user, category_id, reassign_to)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
