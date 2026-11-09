import logging, os, secrets, time
from datetime import datetime
from pathlib import Path
import jwt
from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from .database import connect
from .models import User, Category, Supplier, Product, Transaction, RevokedToken, Audit
from .schemas import Login, UserIn, ProductIn, MovementIn, NamedIn
from .security import hasher, DUMMY_HASH, make_token, read_token
from .services import check_links, move_stock, inventory_report

bearer = HTTPBearer(auto_error=False)
log = logging.getLogger('sklad')

def create_app(database_url=None, secret=None):
    app = FastAPI(title='Sklad.io Warehouse API', version='1.0.0')
    engine, sessions = connect(database_url or os.getenv('DATABASE_URL','sqlite:///./warehouse.db'))
    app.state.engine = engine
    app.state.sessions = sessions
    if secret is None:
        secret = os.getenv('JWT_SECRET')
        if not secret:
            path = Path('.jwt-secret')
            if not path.exists():
                path.write_text(secrets.token_urlsafe(48))
            secret = path.read_text().strip()
    if len(secret) < 32:
        raise ValueError('JWT_SECRET must be at least 32 characters')
    app.state.secret = secret
    app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173','http://127.0.0.1:5173'],
                       allow_methods=['GET','POST','PUT','DELETE'], allow_headers=['Authorization','Content-Type'])

    @app.exception_handler(HTTPException)
    async def http_error(req, exc):
        return JSONResponse({'status':exc.status_code,'message':exc.detail}, status_code=exc.status_code)
    @app.exception_handler(RequestValidationError)
    async def validation_error(req, exc):
        return JSONResponse({'status':422,'message':'Некоректні дані',
             'errors':[{'field':'.'.join(map(str,e['loc'])), 'message':e['msg']} for e in exc.errors()]},status_code=422)
    @app.exception_handler(IntegrityError)
    async def integrity_error(req, exc):
        return JSONResponse({'status':409,'message':'Конфлікт унікальності або зв’язків'},status_code=409)
    @app.exception_handler(Exception)
    async def server_error(req, exc):
        log.exception('Unhandled error')
        return JSONResponse({'status':500,'message':'Внутрішня помилка сервера'},status_code=500)

    def db_session():
        with sessions() as db:
            try:
                yield db
            except Exception:
                db.rollback()
                raise
    def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db=Depends(db_session)):
        try:
            if not credentials:
                raise ValueError()
            claims = read_token(credentials.credentials, secret)
            if db.get(RevokedToken, claims['jti']):
                raise ValueError()
            user = db.get(User, int(claims['sub']))
            if not user or not user.active:
                raise ValueError()
            return user
        except (jwt.PyJWTError, ValueError, TypeError):
            raise HTTPException(401,'Потрібна автентифікація')
    def roles(*allowed):
        def guard(user=Depends(current_user)):
            if user.role not in allowed:
                raise HTTPException(403,'Доступ заборонено')
            return user
        return guard
    write = roles('Admin','Storekeeper')
    admin = roles('Admin')

    @app.get('/health')
    def health():
        return {'status':'ok'}
    @app.post('/auth/login')
    def login(data: Login, db=Depends(db_session)):
        user = db.scalar(select(User).where(User.email == str(data.email).lower()).with_for_update())
        if user and user.locked_until > int(time.time()):
            raise HTTPException(429,'Вхід тимчасово заблоковано')
        valid = hasher.verify(data.password, user.password_hash if user else DUMMY_HASH)
        if not user or not valid or not user.active:
            if user:
                user.failures += 1
                user.locked_until = int(time.time())+300 if user.failures >= 5 else 0
            db.add(Audit(user_id=user.id if user else None,action='login.failed'))
            db.commit()
            raise HTTPException(401,'Невірні облікові дані')
        user.failures = user.locked_until = 0
        db.add(Audit(user_id=user.id,action='login.success'))
        db.commit()
        return {'access_token':make_token(user.id, secret),'token_type':'bearer','expires_in':1800}
    @app.post('/auth/logout', status_code=204)
    def logout(credentials=Depends(bearer), user=Depends(current_user), db=Depends(db_session)):
        claims = read_token(credentials.credentials, secret)
        db.merge(RevokedToken(jti=claims['jti'],expires=claims['exp']))
        db.commit()
        return Response(status_code=204)
    def user_view(u):
        return dict(id=u.id,email=u.email,role=u.role,first_name=u.first_name,last_name=u.last_name,active=u.active)
    @app.get('/auth/me')
    def me(user=Depends(current_user)):
        return user_view(user)
    @app.get('/users')
    def users(user=Depends(admin), db=Depends(db_session)):
        return [user_view(u) for u in db.scalars(select(User).order_by(User.id))]
    @app.post('/users',status_code=201)
    def add_user(data: UserIn, user=Depends(admin), db=Depends(db_session)):
        values=data.model_dump(exclude={'password'})
        values['email']=str(data.email).lower()
        record=User(**values,password_hash=hasher.hash(data.password))
        db.add(record); db.commit(); db.refresh(record)
        return user_view(record)
    @app.get('/categories')
    def categories(user=Depends(current_user), db=Depends(db_session)):
        return list(db.scalars(select(Category).order_by(Category.id)))
    @app.post('/categories',status_code=201)
    def add_category(data: NamedIn, user=Depends(write), db=Depends(db_session)):
        item=Category(**data.model_dump()); db.add(item); db.commit(); db.refresh(item); return item
    @app.get('/suppliers')
    def suppliers(user=Depends(current_user), db=Depends(db_session)):
        return list(db.scalars(select(Supplier).order_by(Supplier.id)))
    @app.post('/suppliers',status_code=201)
    def add_supplier(data: NamedIn, user=Depends(write), db=Depends(db_session)):
        item=Supplier(**data.model_dump()); db.add(item); db.commit(); db.refresh(item); return item
    @app.get('/products')
    def products(q: str = Query(default='',max_length=255), category_id: int | None = None,
                 offset: int = Query(0,ge=0), limit: int = Query(100,ge=1,le=1000),
                 user=Depends(current_user), db=Depends(db_session)):
        query=select(Product).where(Product.name.icontains(q,autoescape=True) | Product.sku.icontains(q,autoescape=True))
        if category_id is not None: query=query.where(Product.category_id==category_id)
        return list(db.scalars(query.order_by(Product.id).offset(offset).limit(limit)))
    @app.get('/products/{item_id}')
    def get_product(item_id:int, user=Depends(current_user), db=Depends(db_session)):
        item=db.get(Product,item_id)
        if not item: raise HTTPException(404,'Товар не знайдено')
        return item
    @app.post('/products',status_code=201)
    def add_product(data:ProductIn, user=Depends(write), db=Depends(db_session)):
        check_links(db,data)
        item=Product(**data.model_dump()); db.add(item); db.commit(); db.refresh(item); return item
    @app.put('/products/{item_id}')
    def edit_product(item_id:int, data:ProductIn, user=Depends(write), db=Depends(db_session)):
        item=db.get(Product,item_id)
        if not item: raise HTTPException(404,'Товар не знайдено')
        check_links(db,data)
        for key,value in data.model_dump().items(): setattr(item,key,value)
        db.commit(); db.refresh(item); return item
    @app.delete('/products/{item_id}',status_code=204)
    def delete_product(item_id:int, user=Depends(admin), db=Depends(db_session)):
        item=db.get(Product,item_id)
        if not item: raise HTTPException(404,'Товар не знайдено')
        if item.stock_quantity or db.scalar(select(Transaction.id).where(Transaction.product_id==item_id).limit(1)):
            raise HTTPException(409,'Товар має залишок або історію руху')
        db.delete(item); db.commit(); return Response(status_code=204)
    @app.post('/transactions',status_code=201)
    def add_movement(data:MovementIn,user=Depends(write),db=Depends(db_session)):
        return move_stock(db,data,user)
    @app.get('/transactions')
    def movements(start:datetime | None=None,end:datetime | None=None,user=Depends(current_user),db=Depends(db_session)):
        if start and end and start>end: raise HTTPException(400,'Некоректний період')
        query=select(Transaction)
        if start: query=query.where(Transaction.transaction_date>=start)
        if end: query=query.where(Transaction.transaction_date<=end)
        return list(db.scalars(query.order_by(Transaction.id.desc()).limit(1000)))
    @app.get('/reports/{kind}')
    def report(kind:str,user=Depends(current_user),db=Depends(db_session)):
        return inventory_report(db,kind)
    @app.get('/audit')
    def audit(user=Depends(admin),db=Depends(db_session)):
        return list(db.scalars(select(Audit).order_by(Audit.id.desc()).limit(100)))
    return app
