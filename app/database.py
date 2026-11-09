from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from .models import Base

def connect(url):
    if url.startswith('postgres://'):
        url = 'postgresql+psycopg://' + url[len('postgres://'):]
    elif url.startswith('postgresql://'):
        url = 'postgresql+psycopg://' + url[len('postgresql://'):]
    engine = create_engine(url, pool_pre_ping=True, connect_args={'check_same_thread': False} if url.startswith('sqlite') else {})
    if url.startswith('sqlite'):
        @event.listens_for(engine, 'connect')
        def foreign_keys(conn, _):
            conn.execute('PRAGMA foreign_keys=ON')
            # SQLite's built-in lower() covers ASCII only; match PostgreSQL Unicode search.
            conn.create_function('lower', 1, lambda value: value.casefold() if value is not None else None, deterministic=True)
    Base.metadata.create_all(engine)
    return engine, sessionmaker(engine, expire_on_commit=False)
