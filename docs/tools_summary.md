## Frontend
### React 18
The dominant UI library for building component-based interfaces. Its main draw is the massive ecosystem, declarative rendering, and new concurrent features (Suspense, transitions) in v18. The downside is it's a library, not a framework — you assemble the rest yourself — and the learning curve around hooks and re-render behavior trips people up.

### Vite
A build tool and dev server that replaces Webpack/CRA. It's dramatically faster in development because it serves ES modules natively instead of bundling first. Cold starts are near-instant. The tradeoff is that it's newer, so some older plugins or edge cases with CommonJS modules can cause friction.

### TypeScript
A typed superset of JavaScript that catches errors at compile time rather than runtime. It's almost universally considered worth it on any project larger than a script — better autocomplete, safer refactors, self-documenting APIs. The cost is initial configuration overhead and occasional fighting with the type system on complex generics or third-party libraries with poor type definitions.

### Clerk React SDK
A drop-in authentication and user management solution. You get sign-in/sign-up UI, session management, JWTs, and social OAuth without building any of it. Fast to integrate and handles a lot of security footguns for you. The disadvantages are vendor lock-in, cost at scale, and less control compared to rolling your own auth — if you need unusual auth flows, you may hit its limits.

### TailwindCSS
A utility-first CSS framework where you style by composing small class names directly in markup. It eliminates context-switching between files and produces consistent, purged CSS bundles. Critics point to verbose, cluttered JSX and a steeper initial learning curve if you're used to semantic CSS. Also harder to enforce design consistency without a component library on top of it.

The **@tailwindcss/typography** plugin adds the `prose` utilities so long-form HTML (headings, lists, emphasis, links) reads well without hand-writing rules for every element. Here it styles lecture summaries after they are parsed from Markdown.

### react-markdown and remark-gfm
**react-markdown** turns Markdown strings into React elements without `dangerouslySetInnerHTML`, so arbitrary HTML in model output is not executed by default. **remark-gfm** extends parsing with GitHub-flavored Markdown (tables, task lists, strikethrough, more predictable lists). Together they drive the formatted summary view on the lecture page.

## Backend
### Python 3.12
The latest stable Python release, with meaningful performance improvements (10–15% faster than 3.11 in benchmarks) and better error messages. The ecosystem for data, APIs, and ML is unmatched. Disadvantages are the GIL (mitigated in async contexts) and slower raw throughput compared to Go or Rust for CPU-bound work.

### FastAPI
A modern async Python web framework built on Starlette and Pydantic. Its killer feature is automatic OpenAPI/Swagger docs generated from your type hints, and it's one of the fastest Python frameworks. The main gotcha is that async Python requires discipline — mixing sync and async code incorrectly can block the event loop silently.

### SQLAlchemy 2.0 (async)
The gold-standard Python ORM (**Object-Relational Mapper**), now with a cleaner async-first API in v2.

An **ORM** is a library that maps rows in relational database tables to objects in your programming language, so you can work with `User`, `Class`, and `Lecture` as regular Python classes instead of writing raw SQL strings. You declare each table as a class with typed attributes, and the ORM handles translating `session.add(user)`, `session.query(User).filter(...)`, or `user.lectures` into the corresponding `INSERT`, `SELECT`, and `JOIN` statements. It also manages connection pooling, transactions, identity tracking (so the same row in memory stays one object), and schema metadata that tools like Alembic can diff against the live database.

SQLAlchemy is unusual in that it's really two layers stacked on top of each other:

- **Core** — an expression language that builds SQL programmatically (`select(User).where(User.id == 1)`). Think of it as a typed query builder; you get SQL's full power without string concatenation.
- **ORM** — the object layer on top of Core that gives you the `User` class, relationships (`user.lectures`), unit-of-work flushing, and identity maps.

You can drop down from the ORM to Core (or even raw SQL) whenever the ORM gets in the way, which is why it's preferred for non-trivial schemas where Django's ORM or simpler tools start to feel limiting.

The **async** variant (used here) runs on top of drivers like `asyncpg` and exposes `AsyncSession` / `async with engine.begin()` so database calls don't block the FastAPI event loop. Under the hood SQLAlchemy uses a greenlet shim to adapt its mostly-sync internals to `await`.

It's extremely powerful and flexible, supporting both ORM and raw SQL patterns. The downside is its complexity — the learning curve is steep, and async SQLAlchemy in particular has subtle gotchas:

- **Session lifecycle** — sessions must be scoped per-request (FastAPI dependency injection makes this easier) and explicitly committed/rolled back.
- **No implicit lazy loading** — in sync SQLAlchemy, accessing `user.lectures` quietly fires a second query; in async, that would require re-entering the event loop from attribute access, which isn't allowed, so you must **eager-load** relationships up front with `selectinload()` or `joinedload()`, or call `await session.refresh(user, ["lectures"])`.
- **Detached instances** — once a session closes, objects returned from it can't lazy-load anything, which surprises people coming from Django.
- **Autoflush and transactional boundaries** — queries can trigger an implicit flush; combined with async, ordering of `await` points matters.

### Alembic
The standard migration tool for SQLAlchemy. It generates versioned migration scripts and handles schema evolution cleanly. Works well but the autogenerate feature isn't magic — it misses things like renamed columns or certain constraint changes, so migrations need careful review before running in production.

### Uvicorn
A lightning-fast **ASGI** (**Asynchronous Server Gateway Interface**) server, and the standard way to run FastAPI in development and production.

**ASGI** is the async successor to Python's older **WSGI** standard (what gunicorn/Flask/Django historically used). WSGI is a synchronous, one-request-per-worker-thread contract, which can't natively handle long-lived connections like WebSockets, Server-Sent Events, or thousands of concurrent `await`-based requests. ASGI defines a unified async interface for HTTP, WebSockets, and lifespan events, so a single process can multiplex many in-flight requests on one event loop. FastAPI is an ASGI app; it needs an ASGI server to actually listen on a socket and dispatch requests, and Uvicorn is that server.

Under the hood Uvicorn is built on `uvloop` (a libuv-backed event loop, much faster than asyncio's default) and `httptools` (a C HTTP parser), which is why it's one of the fastest Python servers — often within an order of magnitude of Go or Node for pure I/O. It handles HTTP/1.1, WebSockets, graceful shutdown, and `--reload` for dev.

In production you typically don't run a single `uvicorn` process directly. The common pattern is **Gunicorn with Uvicorn workers** (`gunicorn -k uvicorn.workers.UvicornWorker`), which gives you Gunicorn's battle-tested process manager — worker count, preload, timeouts, graceful restarts — wrapped around Uvicorn's fast ASGI runtime. Alternatively, **Hypercorn** is another ASGI server with HTTP/2 and HTTP/3 support if you need those protocols.

Tradeoffs: Uvicorn itself is minimal, so features like automatic worker management, sophisticated process supervision, or HTTP/2 aren't built in — you layer them on via Gunicorn, a reverse proxy (nginx/Caddy), or a different ASGI server. Debugging async stack traces and event-loop stalls can also be trickier than in a sync WSGI world; a single blocking call (e.g. a `requests.get` instead of `httpx.AsyncClient`) can starve the entire process.