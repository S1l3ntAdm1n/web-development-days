# QuickNotes: System Design & REST API Client

A production-ready note-taking application architecture and asynchronous REST API client designed for **QuickNotes**. This repository provides an end-to-end full-stack systems engineering blueprint featuring an accessible, secure frontend API client, a comprehensive RESTful API specification, an ACID-compliant relational data model, and an enterprise multi-tier cloud architecture engineered to serve over 1 million registered users.

---

## Table of Contents

- [Project Overview](#project-overview)
- [How to Run the API Client](#how-to-run-the-api-client)
- [Interactive Features](#interactive-features)
- [Architecture & Design Documents](#architecture--design-documents)
- [What I Learned](#what-i-learned)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)

---

## Project Overview

QuickNotes enables users to quickly capture, organize, and manage thoughts with tags and real-time synchronization. This repository delivers both the functional client implementation and the underlying architectural specifications required to scale the platform from a local tool to a cloud-scale web service.

The project encompasses:
1. **Frontend API Client**: A lightweight, responsive web client using modern asynchronous JavaScript (`fetch`, `async`/`await`, `try`/`catch`/`finally`) that communicates with an external REST API, enforces strict two-tiered input validation, prevents Cross-Site Scripting (XSS) via safe DOM manipulation (`textContent`), and surfaces clear visual indicators for loading, success, error, and empty states.
2. **RESTful API Specification**: Formal design of resource endpoints, idempotent verbs, request/response JSON contracts, and RFC 7807-compliant error payloads.
3. **Relational Data Model**: A PostgreSQL schema defining normalized entities, cascading foreign keys, junction tables, high-performance composite indexes, and complex analytical queries.
4. **Cloud System Architecture**: A distributed system design incorporating Anycast DNS, CDN edge caching, Application Load Balancers, stateless application clusters, Redis in-memory caching, SQL primary-replica database replication, asynchronous message queues, and worker fleets.

---

## How to Run the API Client

The QuickNotes frontend client is built with zero external dependencies, compilation steps, or build tools. You can run it locally in any modern web browser.

### Option 1: Direct File Execution
1. Clone the repository:
   ```bash
   git clone https://github.com/S1l3ntAdm1n/quicknotes-system-design.git
   cd quicknotes-system-design
   ```
2. Double-click [index.html](index.html) in your operating system file manager to open it in your default web browser.

### Option 2: Using VS Code Live Server
1. Open the project folder in VS Code.
2. Right-click on [index.html](index.html) and select **Open with Live Server**.
3. The client will launch at `http://127.0.0.1:5500/index.html`.

### Option 3: Local HTTP Server (Python or Node.js)
Start a lightweight local HTTP server from the project directory:

```bash
# Using Python 3
python -m http.server 3000

# Or using Node.js / npx
npx serve .
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## Interactive Features

- **Asynchronous Data Retrieval (`GET`)**: Click **Load Notes** to fetch the latest 10 notes from `https://jsonplaceholder.typicode.com/posts?_limit=10`.
- **Note Creation (`POST`)**: Fill in the title and optional body to create a new note. Note titles are strictly validated (required, maximum 100 characters).
- **Note Deletion (`DELETE`)**: Click **Delete Note** on any card to issue a `DELETE` request and remove the note from the active feed.
- **Defensive State Handling**:
  - **Loading State**: Visual loading spinner and message in `#status` with buttons disabled during active network requests.
  - **Success State**: Clear feedback confirming creation, deletion, or loading.
  - **Error State**: Distinct red error messaging showing network diagnostics or validation failures.
  - **Empty State**: Clear placeholder message shown when no notes are loaded.
- **XSS Prevention**: All user input and API data are rendered exclusively using `document.createElement()` and `.textContent`.

---

## Architecture & Design Documents

Explore the in-depth system design specifications located in the [docs/](docs/) directory:

1. [docs/api-design.md](docs/api-design.md) — **RESTful API Specification**:
   - Detailed specification of 8 REST endpoints for notes and tags.
   - Request and response JSON payloads for creating and listing notes.
   - Comprehensive error handling covering status codes `400`, `401`, `403`, `404`, `422`, and `500`.

2. [docs/data-model.md](docs/data-model.md) — **Relational Data Model & Database Schema**:
   - Schema definitions for `users`, `notes`, `tags`, and `note_tags`.
   - Explanations of $1:N$ and $M:N$ relationships and cascading constraints.
   - Production-ready `CREATE TABLE` DDL statements.
   - Three practical SQL queries (including multi-table `JOIN` with tag aggregation).
   - Composite indexing strategy and justification of SQL over NoSQL.

3. [docs/architecture.md](docs/architecture.md) — **System Architecture & Scaling Plan**:
   - Functional and non-functional requirements.
   - Quantitative capacity estimations for 1 million registered users (200,000 DAU; 23.2 peak writes/sec; 231.5 peak reads/sec; ~292 GB/year storage).
   - End-to-end ASCII system architecture diagram.
   - Single-sentence problem-solution justifications for all 9 architectural components.
   - Detailed step-by-step request lifecycles for `GET /notes` and `POST /notes`.
   - Architectural trade-off evaluations and Single Point of Failure (SPOF) mitigation strategies.

---

## What I Learned

1. **Defensive Asynchronous API Programming & UX State Machines**:
   - Learned how to encapsulate `fetch()` inside a robust, reusable async wrapper that validates `response.ok`, extracts error messages, and cleanly manages loading, success, error, and empty states.
   - Gained practical experience disabling UI interactive elements while requests are in flight to prevent accidental duplicate submissions and race conditions.
2. **Secure DOM Rendering & Client-Side Validation**:
   - Reinforced the critical security principle of rendering untrusted API and user data exclusively with `.textContent` rather than `.innerHTML`, completely neutralizing Cross-Site Scripting (XSS) vectors.
   - Implemented two-tiered input validation (non-empty trimmed titles and strict 100-character limits) that fails fast before triggering unnecessary network bandwidth consumption.
3. **High-Scale System Architecture & Capacity Planning**:
   - Mastered the mathematical modeling of high-scale applications (converting Daily Active Users into average and peak QPS, read-to-write ratios, and annual storage projections).
   - Understood the architectural necessity of decoupling read paths (Edge CDN + Redis cache + DB Read Replicas) from write paths (Primary Master DB + Message Queue + Worker Process) to eliminate bottlenecks and guarantee 99.9% availability without single points of failure.
4. **Relational Database Design & Query Optimization**:
   - Deepened understanding of normalizing entities through junction tables (`note_tags`) for $M:N$ relationships, using composite B-Tree indexes to transform $O(N)$ full-table scans into $O(\log N)$ range lookups, and leveraging SQL aggregation (`json_agg`) to return structured data in a single network round-trip.

---

## Project Structure

```text
quicknotes-system-design/
├── index.html              # Accessible HTML5 application skeleton
├── style.css               # Clean, responsive CSS with distinct state styles
├── api.js                  # Asynchronous REST API client & DOM controller
├── docs/
│   ├── api-design.md       # Complete REST API specification & error schemas
│   ├── data-model.md       # Relational database schema, SQL queries & indexing
│   └── architecture.md     # System architecture, capacity math & SPOF mitigation
└── README.md               # Project documentation, execution guide & reflections
```

---

## Tech Stack

- **Frontend**: Semantic HTML5, Vanilla CSS3 (Custom Properties & Flexbox), Modern Vanilla JavaScript (ES6+ / Fetch API).
- **Mock REST API**: JSONPlaceholder (`https://jsonplaceholder.typicode.com/posts`).
- **Database Architecture Target**: PostgreSQL 15+ (ACID compliance, JSON aggregation, B-Tree indexes).
- **Infrastructure Architecture Target**: Anycast DNS, Edge CDN, Application Load Balancers, Redis In-Memory Cache, RabbitMQ / AWS SQS Message Queue.
