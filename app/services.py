from fastapi import HTTPException
from .models import Category, Supplier
from .repositories import InventoryRepository, SqlInventoryRepository
from .reports import CREATORS

def check_links(db, data):
    if not db.get(Category, data.category_id):
        raise HTTPException(400, 'Категорію не знайдено')
    if data.supplier_id is not None and not db.get(Supplier, data.supplier_id):
        raise HTTPException(400, 'Постачальника не знайдено')

class StockService:
    def __init__(self, repository: InventoryRepository):
        self.repository = repository

    def record(self, data, user_id):
        if not self.repository.exists(data.product_id):
            raise HTTPException(404, 'Товар не знайдено')
        delta = data.quantity if data.type == 'IN' else -data.quantity
        if not self.repository.adjust(data.product_id, delta):
            raise HTTPException(409, 'Недостатній залишок або переповнення')
        return self.repository.add_movement(data, user_id)

def move_stock(db, data, user):
    movement = StockService(SqlInventoryRepository(db)).record(data, user.id)
    db.commit()
    db.refresh(movement)
    return movement

def inventory_report(db, kind):
    creator = CREATORS.get(kind)
    if creator is None:
        raise HTTPException(400, 'Невідомий тип звіту')
    return creator().generate_report(SqlInventoryRepository(db))
