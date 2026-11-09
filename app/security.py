"""Password policy adapted from D:/Uni/safety/project/app.py; REST JWT sessions."""
import secrets, time
import jwt
from pwdlib import PasswordHash

hasher = PasswordHash.recommended()
DUMMY_HASH = hasher.hash('Dummy-Password-123!')

def make_token(user_id, key):
    now = int(time.time())
    claims = dict(sub=str(user_id), iat=now, exp=now+1800, jti=secrets.token_hex(16), iss='sklad-api', aud='sklad-ui')
    return jwt.encode(claims, key, algorithm='HS256')

def read_token(token, key):
    return jwt.decode(token, key, algorithms=['HS256'], issuer='sklad-api', audience='sklad-ui',
                      options={'require':['sub','exp','iat','jti','iss','aud']})
