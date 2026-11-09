from decimal import Decimal
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from app.services import StockService
from app.schemas import MovementIn
from app.reports import StockReportCreator, LowStockReportCreator, StockReport, LowStockReport

class FakeRepository:
    def __init__(self, stock=10):
        self.stock = stock
        self.movements = []
    def exists(self, product_id): return product_id == 1
    def adjust(self, product_id, delta):
        if self.stock + delta < 0: return False
        self.stock += delta
        return True
    def add_movement(self, data, user_id):
        self.movements.append((data.type, data.quantity, user_id))
        return self.movements[-1]
    def items(self, low_only=False):
        p = SimpleNamespace(sku='X', name='Item', stock_quantity=self.stock, price=Decimal('10.00'))
        return [p] if not low_only or self.stock <= 5 else []

def test_PT01_service_uses_repository():
    r=FakeRepository()
    StockService(r).record(MovementIn(product_id=1,type='OUT',quantity=7),2)
    assert r.stock==3 and r.movements==[('OUT',7,2)]
def test_PT02_repository_rejects_overdraft():
    r=FakeRepository(0)
    with pytest.raises(HTTPException): StockService(r).record(MovementIn(product_id=1,type='OUT',quantity=1),2)
    assert r.stock==0 and not r.movements
def test_PT03_factory_method_products():
    assert isinstance(StockReportCreator().create_report(),StockReport)
    assert isinstance(LowStockReportCreator().create_report(),LowStockReport)
def test_PT04_factory_method_results():
    r=FakeRepository(10)
    assert StockReportCreator().generate_report(r)['total_value']=='100.00'
    assert LowStockReportCreator().generate_report(r)['items']==[]
    r.stock=5
    assert len(LowStockReportCreator().generate_report(r)['items'])==1
