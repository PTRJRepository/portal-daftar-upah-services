# AI Agent Rules & Project Structure Guidelines

## 1. Project Organization Principle
This project follows a strict separation between **Main Application Code** and **Development Support Files**.

- **Main Application Code**: Located in the root directory (e.g., `backend/`, `frontend/`, `src/`). This code is critical for production deployment and user functionality.
- **Development Support Files**: Located in `_dev_utils/`. This folder contains scripts, tests, planning documents, prompts, and temporary tools that are useful for development but **must not** interfere with the main application or be included in production builds unless explicitly required.

## 2. File Placement Rules for AI Agents
When creating new files or modifying existing ones, adhere to the following rules:

### A. Test Files
- **Unit Tests/Integration Tests**: Place in `_dev_utils/tests/` (or strictly in `test/` inside component folders if the framework requires it, but prefer `_dev_utils` for general tests).
- **Temporary Test Scripts**: Any script created to verify a specific behavior or debug an issue MUST be placed in `_dev_utils/tests/` or `_dev_utils/scripts/`. **Do not** create loose test scripts in the root directory.

### B. Integration & Migration Scripts
- Scripts for data migration, one-off integration tasks, or seeding data should go into `_dev_utils/integration_scripts/`.

### C. Planning & Documentation
- Implementation plans, architectural decisions, and AI prompts should be stored in `_dev_utils/planning/` or `_dev_utils/prompts/`.
- Use the `plans/` folder (now moved to `_dev_utils/planning/`) for storing context for future agents.

### D. Simulations & Experiments
- Any experimental code or "sandbox" implementation should be placed in `_dev_utils/experiments/` or a relevant subfolder within `_dev_utils`.

## 3. Workflow for AI Agents
1.  **Check `_dev_utils` first**: Before creating a new helper script, check if a similar one exists in `_dev_utils`.
2.  **Clean up**: improvements to test scripts should be saved; one-off "print debug" scripts should be deleted after use or moved to `_dev_utils/scratchpad/` if seemingly valuable.
3.  **No Pollution**: NEVER create file like `temp_test.py`, `debug.log`, or `test_script.js` in the project root.

## 4. Maintenance
- Periodically review `_dev_utils` to organize or archive old scripts.
- Ensure `_dev_utils` is added to `.gitignore` or `.dockerignore` if these files should not leak into production containers/repos (unless they are shared dev tools).
