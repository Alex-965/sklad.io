import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from app.hosted import create_hosted_app
from app.models import User

@pytest.fixture
def hosted(tmp_path, monkeypatch):
    dist=tmp_path/'dist'; (dist/'assets').mkdir(parents=True)
    (dist/'index.html').write_text('<html>Sklad.io</html>')
    (dist/'assets/app.js').write_text('console.log("Sklad.io")')
    monkeypatch.setenv('FRONTEND_DIST',str(dist))
    monkeypatch.setenv('DATABASE_URL','sqlite:///'+str(tmp_path/'hosted.db'))
    monkeypatch.setenv('JWT_SECRET','test-hosted-secret-'*4)
    monkeypatch.setenv('ADMIN_PASSWORD','HostedTest123!')
    monkeypatch.delenv('REQUIRE_PERSISTENT_DATABASE',raising=False)
    return create_hosted_app()

def test_hosted_frontend_api_and_assets(hosted):
    with TestClient(hosted) as c:
        assert 'Sklad.io' in c.get('/').text
        assert c.get('/assets/app.js').status_code==200
        assert c.get('/health').json()['database']=='connected'
        assert c.get('/api/products').status_code==401
        token=c.post('/api/auth/login',json={'email':'admin@sklad.io','password':'HostedTest123!'}).json()['access_token']
        assert c.get('/api/categories',headers={'Authorization':'Bearer '+token}).status_code==200
        assert c.get('/api/docs').status_code==200
        assert c.get('/api/missing').status_code==404

def test_hosted_bootstrap_does_not_duplicate(hosted):
    from app.seed import seed
    seed(hosted.state.api,'AnotherStrong123!')
    with hosted.state.api.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(User))==1
    with TestClient(hosted) as c:
        assert c.post('/api/auth/login',json={'email':'admin@sklad.io','password':'HostedTest123!'}).status_code==200

def test_hosted_rejects_ephemeral_database(monkeypatch):
    monkeypatch.setenv('REQUIRE_PERSISTENT_DATABASE','1')
    monkeypatch.setenv('DATABASE_URL','sqlite:///temporary.db')
    with pytest.raises(ValueError,match='external PostgreSQL'):
        create_hosted_app()
