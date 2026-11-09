from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import select, func
from app.models import Product, Transaction, Audit

def test_IT01_api_persists_movement(system,product):
    c,h,a=system
    r=c.post('/transactions',headers=h['worker'],json={'product_id':1,'type':'IN','quantity':10})
    assert r.status_code==201
    with a.state.sessions() as db:
        assert db.get(Product,1).stock_quantity==10
        movement=db.get(Transaction,r.json()['id'])
        assert movement.quantity==10 and movement.user_id==2
        assert db.scalar(select(Audit).where(Audit.action=='stock.IN')) is not None

def test_IT02_failure_rolls_back(system,product):
    c,h,a=system
    assert c.post('/transactions',headers=h['worker'],json={'product_id':1,'type':'OUT','quantity':5}).status_code==409
    with a.state.sessions() as db:
        assert db.get(Product,1).stock_quantity==0
        assert db.scalar(select(func.count()).select_from(Transaction))==0
        assert db.scalar(select(func.count()).select_from(Audit).where(Audit.action=='stock.OUT'))==0

def test_IT03_concurrent_withdrawals(system,product):
    c,h,a=system
    assert c.post('/transactions',headers=h['worker'],json={'product_id':1,'type':'IN','quantity':10}).status_code==201
    def withdraw(_):
        return c.post('/transactions',headers=h['worker'],json={'product_id':1,'type':'OUT','quantity':7}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses=list(pool.map(withdraw,range(2)))
    assert sorted(statuses)==[201,409]
    with a.state.sessions() as db:
        assert db.get(Product,1).stock_quantity==3
        assert db.scalar(select(func.count()).select_from(Transaction))==2
