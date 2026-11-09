import os, sys, json, time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

ROOT=Path(os.getenv('PROJECT_DIR',str(Path(__file__).resolve().parents[1])))
sys.path.insert(0,str(ROOT))
from app.main import create_app
from app.models import Base, User, Category
from app.security import hasher

RESULTS=[]
@pytest.fixture
def system(tmp_path):
    url=os.getenv('TEST_DATABASE_URL','sqlite:///'+str(tmp_path/'test.db'))
    app=create_app(url, 'test-secret-only-'*4)
    Base.metadata.drop_all(app.state.engine)
    Base.metadata.create_all(app.state.engine)
    with app.state.sessions() as db:
        for email,role in [('admin@sklad.io','Admin'),('worker@sklad.io','Storekeeper'),('manager@sklad.io','Manager')]:
            db.add(User(email=email,password_hash=hasher.hash('Student123!'),role=role,first_name=role,last_name='Test'))
        db.add(Category(name='Електроніка'));db.commit()
    with TestClient(app) as client:
        headers={}
        for role,email in [('admin','admin@sklad.io'),('worker','worker@sklad.io'),('manager','manager@sklad.io')]:
            r=client.post('/auth/login',json={'email':email,'password':'Student123!'})
            assert r.status_code==200,r.text
            headers[role]={'Authorization':'Bearer '+r.json()['access_token']}
        yield client,headers,app
    app.state.engine.dispose()

@pytest.fixture
def product(system):
    c,h,a=system
    r=c.post('/products',headers=h['worker'],json={'sku':'TEST-1','name':'Ноутбук Dell','category_id':1,'price':'45000.00','min_stock_level':5})
    assert r.status_code==201,r.text
    return r.json()

def pytest_runtest_logreport(report):
    if report.when=='call' or (report.when=='setup' and report.failed):
        RESULTS.append({'test':report.nodeid,'status':report.outcome,'duration':round(report.duration,3),
                        'details':str(report.longrepr) if report.failed else ''})

def pytest_sessionfinish(session,exitstatus):
    dest=Path(os.getenv('RESULTS_FILE','results.json'))
    dest.write_text(json.dumps({'exit_code':exitstatus,'database':os.getenv('TEST_DATABASE_LABEL','SQLite'),
        'results':RESULTS},ensure_ascii=False,indent=2),encoding='utf-8')
