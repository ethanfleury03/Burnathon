## Frontend
### React 18
The dominant UI library for building component-based interfaces. Its main draw is the massive ecosystem, declarative rendering, and new concurrent features (Suspense, transitions) in v18. The downside is it's a library, not a framework — you assemble the rest yourself — and the learning curve around hooks and re-render behavior trips people up.

### Vite
A build tool and dev server that replaces Webpack/CRA. It's dramatically faster in development because it serves ES modules natively instead of bundling first. Cold starts are near-instant. The tradeoff is that it's newer, so some older plugins or edge cases with CommonJS modules can cause friction.

### TypeScript
A typed superset of JavaScript that catches errors at compile time rather than runtime. It's almost universally considered worth it on any project larger than a script — better autocomplete, safer refactors, self-documenting APIs. The cost is initial configuration overhead and occasional fighting with the type system on complex generics or third-party libraries with poor type definitions.

### Clerk React SDK
A drop-in authentication and user management solution. You get sign-in/sign-up UI, session management, JWTs, and social OAuth without building any of it. Fast to integrate and handles a lot of security footguns for you. The disadvantages are vendor lock-in, cost at scale, and less control compared to rolling your own auth — if you need unusual auth flows, you may hit its limits.

###TailwindCSS
A utility-first CSS framework where you style by composing small class names directly in markup. It eliminates context-switching between files and produces consistent, purged CSS bundles. Critics point to verbose, cluttered JSX and a steeper initial learning curve if you're used to semantic CSS. Also harder to enforce design consistency without a component library on top of it.

## Backend
### Python 3.12
The latest stable Python release, with meaningful performance improvements (10–15% faster than 3.11 in benchmarks) and better error messages. The ecosystem for data, APIs, and ML is unmatched. Disadvantages are the GIL (mitigated in async contexts) and slower raw throughput compared to Go or Rust for CPU-bound work.

### FastAPI
A modern async Python web framework built on Starlette and Pydantic. Its killer feature is automatic OpenAPI/Swagger docs generated from your type hints, and it's one of the fastest Python frameworks. The main gotcha is that async Python requires discipline — mixing sync and async code incorrectly can block the event loop silently.

### SQLAlchemy 2.0 (async)
The gold-standard Python ORM, now with a cleaner async-first API in v2. It's extremely powerful and flexible, supporting both ORM and raw SQL patterns. The downside is its complexity — the learning curve is steep, and async SQLAlchemy in particular has subtle gotchas around session lifecycle and lazy loading (which doesn't work in async contexts, so you must eager-load explicitly).

### Alembic
The standard migration tool for SQLAlchemy. It generates versioned migration scripts and handles schema evolution cleanly. Works well but the autogenerate feature isn't magic — it misses things like renamed columns or certain constraint changes, so migrations need careful review before running in production.

###uvicorn
ASGI server for FastAPI. Different process model, same idea for deployment.