"""React at /, unchanged FastAPI contract under /api, one HTTPS origin."""
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from .main import create_app
from .seed import seed

def create_hosted_app():
    if os.getenv('REQUIRE_PERSISTENT_DATABASE') == '1':
        url = os.getenv('DATABASE_URL', '')
        if not url.startswith(('postgresql://','postgresql+psycopg://','postgres://')):
            raise ValueError('Hosting requires an external PostgreSQL DATABASE_URL')
        if len(os.getenv('JWT_SECRET', '')) < 32:
            raise ValueError('Hosting requires a persistent JWT_SECRET of at least 32 characters')
    dist = Path(os.getenv('FRONTEND_DIST', str(Path(__file__).resolve().parents[1] / 'frontend' / 'dist')))
    if not (dist / 'index.html').is_file():
        raise RuntimeError('Frontend is missing. Run pnpm install and pnpm run build in frontend/')
    api = create_app()
    if os.getenv('ADMIN_PASSWORD'):
        seed(api, os.environ['ADMIN_PASSWORD'])
    web = FastAPI(title='Sklad.io', docs_url=None, redoc_url=None, openapi_url=None)
    web.state.api = api

    @web.get('/health')
    def health():
        with api.state.sessions() as db:
            db.execute(text('SELECT 1'))
        return {'status':'ok', 'database':'connected'}

    @web.get('/', include_in_schema=False)
    def index():
        return FileResponse(dist / 'index.html', headers={'Cache-Control':'no-cache'})

    if (dist / 'favicon.svg').is_file():
        @web.get('/favicon.svg', include_in_schema=False)
        def favicon():
            return FileResponse(dist / 'favicon.svg', media_type='image/svg+xml')

    web.mount('/api', api)
    web.mount('/assets', StaticFiles(directory=dist / 'assets'), name='assets')
    return web
