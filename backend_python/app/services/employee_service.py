from app.repositories.employee_repository import EmployeeRepository
from app.models.employee import EmployeeCreate, EmployeeUpdate

repo_singleton = EmployeeRepository()

def get_repo():
    return repo_singleton

class EmployeeService:
    def __init__(self, repo: EmployeeRepository = None):
        self.repo = repo or get_repo()

    def list(self, skip: int = 0, limit: int = 100, gang_code: str = None, loc_code: str = None):
        return self.repo.list(skip, limit, gang_code, loc_code)

    def create(self, payload: EmployeeCreate):
        return self.repo.create(payload.dict())

    def update(self, id: int, payload: EmployeeUpdate):
        return self.repo.update(id, payload.dict())

    def delete(self, id: int):
        return self.repo.delete(id)

    def get(self, id: int):
        return self.repo.get(id)
