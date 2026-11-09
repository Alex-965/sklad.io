"""Black-box functional scenarios through the actual HTTP API boundary."""
from app.security import read_token
from app.models import User

def test_TC01_login(system):
    c,h,a=system
    assert c.get('/auth/me',headers=h['admin']).json()['role']=='Admin'
def test_TC02_register_employee(system):
    c,h,a=system
    r=c.post('/users',headers=h['admin'],json={'email':'new@sklad.io','password':'Strong123!','first_name':'Ірина','last_name':'Коваль','role':'Storekeeper'})
    assert r.status_code==201 and 'password_hash' not in r.json()
def test_TC03_create_product(system,product):
    assert product['sku']=='TEST-1' and product['stock_quantity']==0
def test_TC04_receive_stock(system,product):
    c,h,a=system
    r=c.post('/transactions',headers=h['worker'],json={'product_id':product['id'],'type':'IN','quantity':10})
    assert r.status_code==201
    assert c.get('/products/1',headers=h['worker']).json()['stock_quantity']==10
def test_TC05_search(system,product):
    c,h,a=system
    r=c.get('/products?q=ноутбук&category_id=1',headers=h['manager'])
    assert r.status_code==200 and len(r.json())==1
def test_TC06_report(system,product):
    c,h,a=system
    r=c.get('/reports/low-stock',headers=h['manager'])
    assert r.status_code==200 and r.json()['items'][0]['sku']=='TEST-1'
def test_TC07_update_delete(system,product):
    c,h,a=system
    r=c.put('/products/1',headers=h['worker'],json={'sku':'TEST-1','name':'Оновлений','category_id':1,'price':'100.00'})
    assert r.status_code==200 and r.json()['name']=='Оновлений'
    assert c.delete('/products/1',headers=h['admin']).status_code==204
    assert c.get('/products/1',headers=h['admin']).status_code==404
def test_TC08_wrong_password(system):
    c,h,a=system
    assert c.post('/auth/login',json={'email':'admin@sklad.io','password':'wrong'}).status_code==401
def test_TC09_no_token(system):
    c,h,a=system
    assert c.get('/products').status_code==401
def test_TC10_manager_write_forbidden(system):
    c,h,a=system
    assert c.post('/categories',headers=h['manager'],json={'name':'Forbidden'}).status_code==403
def test_TC11_negative_price(system):
    c,h,a=system
    assert c.post('/products',headers=h['worker'],json={'sku':'N','name':'N','category_id':1,'price':-1}).status_code==422
def test_TC12_duplicate_sku(system,product):
    c,h,a=system
    assert c.post('/products',headers=h['worker'],json={'sku':'TEST-1','name':'N','category_id':1,'price':1}).status_code==409
def test_TC13_overdraft(system,product):
    c,h,a=system
    assert c.post('/transactions',headers=h['worker'],json={'product_id':1,'type':'OUT','quantity':1}).status_code==409
    assert c.get('/products/1',headers=h['worker']).json()['stock_quantity']==0
    assert c.get('/transactions',headers=h['worker']).json()==[]
def test_TC14_logout_revokes_token(system):
    c,h,a=system
    assert c.post('/auth/logout',headers=h['worker']).status_code==204
    assert c.get('/products',headers=h['worker']).status_code==401
def test_TC15_lockout(system):
    c,h,a=system
    for i in range(5):
        assert c.post('/auth/login',json={'email':'worker@sklad.io','password':'wrong'}).status_code==401
    assert c.post('/auth/login',json={'email':'worker@sklad.io','password':'Student123!'}).status_code==429
def test_TC16_invalid_reference(system):
    c,h,a=system
    assert c.post('/products',headers=h['worker'],json={'sku':'N','name':'N','category_id':9999,'price':1}).status_code==400
