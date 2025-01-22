from pydantic import BaseModel, EmailStr

class User(BaseModel):
    uid: str
    email: EmailStr | None = None
    # Add other relevant fields based on your user data