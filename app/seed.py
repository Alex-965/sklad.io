"""Explicit development data only. Password is provided by environment."""
import os
from sqlalchemy import select
from .main import create_app
from .models import User, Category, Supplier
from .security import hasher
from .schemas import password_policy

def seed(app, password):
    """Idempotent bootstrap; never reset existing accounts or stock."""
    if not password_policy(password): raise ValueError('Weak ADMIN_PASSWORD')
    with app.state.sessions() as db:
        if not db.scalar(select(User).where(User.email=='admin@sklad.io')):
            db.add(User(email='admin@sklad.io',password_hash=hasher.hash(password),role='Admin',first_name='Олександр',last_name='Кобзей'))
        if not db.scalar(select(Category.id)):
            db.add_all([Category(name='Електроніка'),Category(name='Офісна техніка'),Category(name='Меблі')])
        if not db.scalar(select(Supplier.id)): db.add(Supplier(name='Навчальний постачальник'))
        db.commit()

if __name__ == '__main__':
    seed(create_app(), os.environ['ADMIN_PASSWORD'])
    print('Administrator and catalogues are ready')
