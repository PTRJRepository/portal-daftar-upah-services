from pydantic import BaseModel

class Gang(BaseModel):
    code: str
    description: str
