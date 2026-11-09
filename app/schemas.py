from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

def password_policy(value):
    return (8 <= len(value) <= 128 and any(c.isupper() for c in value)
            and any(c.islower() for c in value) and any(c.isdigit() for c in value)
            and any(not c.isalnum() and not c.isspace() for c in value))

class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class Login(Input):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class UserIn(Input):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: Literal['Admin','Storekeeper','Manager'] = 'Manager'
    @field_validator('password')
    @classmethod
    def strong(cls, v):
        if not password_policy(v):
            raise ValueError('Пароль має містити великі й малі літери, цифру та спеціальний символ')
        return v

class ProductIn(Input):
    sku: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    category_id: int = Field(gt=0, strict=True)
    supplier_id: int | None = Field(default=None, gt=0, strict=True)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2, allow_inf_nan=False)
    min_stock_level: int = Field(default=5, ge=0, strict=True)

class MovementIn(Input):
    product_id: int = Field(gt=0, strict=True)
    type: Literal['IN','OUT']
    quantity: int = Field(gt=0, le=1000000000, strict=True)
    notes: str = Field(default='', max_length=1000)

class NamedIn(Input):
    name: str = Field(min_length=1, max_length=150)

class ProfileIn(Input):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)

class UserUpdate(ProfileIn):
    email: EmailStr
    role: Literal['Admin','Storekeeper','Manager']
    active: bool = Field(strict=True)

class PasswordIn(Input):
    old_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    @field_validator('new_password')
    @classmethod
    def strong(cls, value):
        if not password_policy(value):
            raise ValueError('Пароль має містити великі й малі літери, цифру та спеціальний символ')
        return value
