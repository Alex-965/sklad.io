"""GoF Factory Method: subclasses override creation of a report product."""
from abc import ABC, abstractmethod
from .repositories import InventoryRepository

class InventoryReport(ABC):
    kind: str
    @abstractmethod
    def select_items(self, repository: InventoryRepository): ...

    def generate(self, repository):
        items = self.select_items(repository)
        return {'type': self.kind, 'items': [
            {'sku': p.sku, 'name': p.name, 'stock': p.stock_quantity,
             'value': str(p.price * p.stock_quantity)} for p in items],
            'total_value': str(sum((p.price * p.stock_quantity for p in items), start=0))}

class StockReport(InventoryReport):
    kind = 'stock'
    def select_items(self, repository):
        return repository.items()

class LowStockReport(InventoryReport):
    kind = 'low-stock'
    def select_items(self, repository):
        return repository.items(low_only=True)

class ReportCreator(ABC):
    @abstractmethod
    def create_report(self) -> InventoryReport: ...
    def generate_report(self, repository):
        return self.create_report().generate(repository)

class StockReportCreator(ReportCreator):
    def create_report(self):
        return StockReport()

class LowStockReportCreator(ReportCreator):
    def create_report(self):
        return LowStockReport()

CREATORS = {'stock': StockReportCreator, 'low-stock': LowStockReportCreator}
