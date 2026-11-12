# Mars Probes

## Code quality

- **KISS.** Choose the simplest solution that meets the requirements. Keep control flow explicit and add abstractions or dependencies only when they solve a concrete problem.
- **Clean Code.** Use names that describe intent. Keep functions and components focused. Explain decisions and constraints in comments when the code cannot make them clear.
- **DRY.** Keep one source of truth for each business rule within its layer. Reuse existing code when it expresses the same rule. Extract shared code when its callers should change together.
- **SOLID.** Give modules one responsibility. Extend behavior at existing boundaries. Keep interfaces small and honor their contracts. Pass dependencies explicitly when callers need to vary them.
- Keep changes focused on the request. Preserve existing behavior and API contracts unless the task calls for a change.
- Prefer native framework configuration and supported library features for validation, serialization, routing, error handling, and test setup before writing custom infrastructure.
- Design responsibility boundaries for the planned endpoints. Evaluate abstractions by clarity and reuse across those use cases, rather than by the current number of endpoints.
- Configure shared route metadata on FastAPI routers. When adding endpoints, check which error responses actually apply and group routers accordingly.

## Project layout

- [Project requirements](projeto-sondas-em-marte.md) describes expected behavior. [README.md](README.md) covers local setup.
- `backend/domain.py` owns probe and grid rules. Keep it independent of FastAPI and SQLite.
- `backend/main.py` configures the FastAPI application and registers routers and error handlers.
- `backend/api/error_handlers.py` defines the shared error response and maps exceptions to HTTP responses.
- `backend/api/probes_rest.py` defines the probe endpoints and maps service results to HTTP responses.
- `backend/api/schemas.py` defines the HTTP request and response models and validates probe requests.
- `backend/services/probe_service.py` executes probe use cases and controls transaction boundaries. All reads and writes of an atomic use case share the same session.
- `backend/persistence/database.py` configures SQLite and owns transaction contexts. `backend/persistence/repository.py` executes persistence operations using the session supplied by the service. `backend/persistence/models.py` maps SQLite tables and constraints. Keep ORM models separate from domain models.
- `frontend/src/main.tsx` mounts React. `frontend/src/App.tsx` composes the application UI.
- `frontend/src/components/LaunchForm.tsx` handles form input and UI state. Send requests through the relative API path configured in `frontend/vite.config.ts`. The backend enforces domain rules.
- Keep code identifiers, error messages, and all frontend copy in English.

## Run and verify

Run these commands from the repository root. See [README.md](README.md) for prerequisites and dependency installation.

| Task | Command |
| --- | --- |
| Start both services | `docker compose up --build` |
| Lint the backend | `uv --directory backend run --locked ruff check .` |
| Test the backend | `uv --directory backend run --locked pytest` |
| Lint the frontend | `npm --prefix frontend run lint` |
| Test the frontend | `npm --prefix frontend test` |
| Build the frontend | `npm --prefix frontend run build` |

- Run the checks for the affected layer. Run both test suites when changing the HTTP contract used by the frontend.
- Use pytest with a temporary SQLite database for API and persistence tests. Use Vitest and Testing Library for user-visible behavior in React.
- Add or update focused tests when a behavior change or regression lacks coverage. Report relevant checks that could not run.

## Commit messages

Use Conventional Commits in English for all commit messages. Write the subject
in the imperative mood and use the format `type(scope): summary`. The scope is
optional.
