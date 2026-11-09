import pytest, jwt
from pydantic import ValidationError
from app.schemas import ProductIn, MovementIn, UserIn, password_policy
from app.security import hasher, make_token, read_token

def test_UT01_strong_password():
    assert password_policy('Student123!')
def test_UT02_weak_password():
    assert not password_policy('admin123')
def test_UT03_password_hash():
    encoded=hasher.hash('Student123!')
    assert encoded!='Student123!' and hasher.verify('Student123!',encoded)
def test_UT04_wrong_password():
    assert not hasher.verify('wrong',hasher.hash('Student123!'))
def test_UT05_valid_movement():
    assert MovementIn(product_id=1,type='IN',quantity=1).quantity==1
def test_UT06_zero_quantity():
    with pytest.raises(ValidationError): MovementIn(product_id=1,type='IN',quantity=0)
def test_UT07_fractional_quantity():
    with pytest.raises(ValidationError): MovementIn(product_id=1,type='IN',quantity=1.5)
def test_UT08_negative_price():
    with pytest.raises(ValidationError): ProductIn(sku='A',name='A',category_id=1,price=-1)
def test_UT09_token_roundtrip():
    key='unit-test-secret-'*4
    assert read_token(make_token(7,key),key)['sub']=='7'
def test_UT10_wrong_signature():
    with pytest.raises(jwt.InvalidSignatureError): read_token(make_token(7,'a'*64),'b'*64)
