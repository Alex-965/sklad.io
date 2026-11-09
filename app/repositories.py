"""Repository encapsulates SQL without committing the service transaction."""
from typing import Protocol
from sqlalchemy import select, update
from .models import Product, Transaction, Audit

class InventoryRepository(Protocol):
    def exists(self, product_id: int) -> bool: ...
    def adjust(self, product_id: int, delta: int) -> bool: ...
    def add_movement(self, data, user_id: int): ...
    def items(self, low_only: bool = False): ...

class SqlInventoryRepository:
    def __init__(self, db):
        self.db = db

    def exists(self, product_id):
        return self.db.get(Product, product_id) is not None

    def adjust(self, product_id, delta):
        result = self.db.execute(update(Product).where(Product.id == product_id,
            Product.stock_quantity + delta >= 0, Product.stock_quantity + delta <= 2147483647)
            .values(stock_quantity=Product.stock_quantity + delta))
        return result.rowcount == 1

    def add_movement(self, data, user_id):
        movement = Transaction(**data.model_dump(), user_id=user_id)
        self.db.add(movement)
        self.db.add(Audit(user_id=user_id, action='stock.' + data.type))
        return movement

    def items(self, low_only=False):
        query = select(Product).order_by(Product.id)
        if low_only:
            query = query.where(Product.stock_quantity <= Product.min_stock_level)
        return list(self.db.scalars(query))
