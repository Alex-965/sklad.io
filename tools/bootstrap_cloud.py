"""Initialize a new cloud schema. Credentials arrive on stdin and are never logged."""
import json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import inspect, text
from app.database import connect

def main():
    config=json.load(sys.stdin)
    engine,sessions=connect(config['database_url'])
    with sessions() as db:
        assert db.execute(text('SELECT 1')).scalar()==1
    print(json.dumps({'status':'ok','tables':sorted(inspect(engine).get_table_names())}))
    engine.dispose()

if __name__=='__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'status':'failed','error_type':type(exc).__name__}))
        sys.exit(1)
