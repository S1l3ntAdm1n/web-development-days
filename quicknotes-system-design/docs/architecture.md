# QuickNotes System Architecture & Scaling Plan

A comprehensive system architecture and scaling specification for **QuickNotes**, designed to support high availability, horizontal scalability, sub-100ms response times, and resilient multi-tier fault tolerance.

---

## 1. System Requirements

### 1.1. Functional Requirements
1. **User Authentication**: Secure registration, login, and JWT session authorization.
2. **Note CRUD Operations**: Create notes (title max 100 characters, optional body), retrieve notes, update notes, and delete notes.
3. **Feed & List Browsing**: Retrieve a paginated list of notes sorted by pinned status and update time.
4. **Categorization & Tagging**: Create tags and associate multiple tags with individual notes.
5. **Search & Filtering**: Search notes by keyword and filter by tag.
6. **Asynchronous Background Processing**: Asynchronous full-text search indexing and user activity auditing via worker queues.

### 1.2. Non-Functional Requirements
1. **High Availability**: $99.9\%$ uptime (~8.76 hours maximum allowable downtime per year).
2. **Low Latency**: P95 read response times $< 50\text{ ms}$; P95 write response times $< 100\text{ ms}$.
3. **Horizontal Scalability**: Stateless application tier and distributed caching capable of scaling dynamically with traffic surges.
4. **Data Durability & Consistency**: ACID guarantees on writes; zero loss of saved notes through automated database snapshots and write-ahead logging (WAL).
5. **Security**: TLS 1.3 encryption in transit, cryptographic password hashing (Argon2id), parameterized SQL queries to eliminate SQL injection, and strict input sanitization.

---

## 2. Capacity Estimations & Load Profile (1 Million Users)

### Baseline Assumptions
- **Total Registered Users**: 1,000,000 (1 million).
- **Daily Active Rate**: 20% active daily $\rightarrow$ **200,000 Daily Active Users (DAU)**.
- **Write Activity**: Each active user creates or updates an average of 2 notes per day.
- **Read Activity**: Each active user performs an average of 20 read operations (listing notes, viewing notes, filtering) per day.
- **Average Note Payload Size**: ~1 KB (including title, body, and metadata).
- **Peak Traffic Multiplier**: 5× average throughput.
- **Time Conversions**: 1 day = 86,400 seconds; 1 year = 365 days.

---

### Quantitative Calculations

#### 1. Writes Per Second (Create, Update, Delete)
- **Daily Total Writes**:
  $$200{,}000 \text{ DAU} \times 2 \text{ writes/day} = 400{,}000 \text{ writes/day}$$
- **Average Writes Per Second**:
  $$\text{Average Writes/sec} = \frac{400{,}000}{86{,}400} \approx 4.63 \text{ writes/sec} \quad (\approx 5 \text{ writes/sec})$$
- **Peak Writes Per Second ($5\times$)**:
  $$\text{Peak Writes/sec} = 4.63 \times 5 \approx 23.15 \text{ writes/sec} \quad (\approx 24 \text{ writes/sec})$$

---

#### 2. Reads Per Second (Feed Browsing, Detail Views, Searches)
- **Daily Total Reads**:
  $$200{,}000 \text{ DAU} \times 20 \text{ reads/day} = 4{,}000{,}000 \text{ reads/day}$$
- **Average Reads Per Second**:
  $$\text{Average Reads/sec} = \frac{4{,}000{,}000}{86{,}400} \approx 46.30 \text{ reads/sec} \quad (\approx 47 \text{ reads/sec})$$
- **Peak Reads Per Second ($5\times$)**:
  $$\text{Peak Reads/sec} = 46.30 \times 5 \approx 231.50 \text{ reads/sec} \quad (\approx 232 \text{ reads/sec})$$

---

#### 3. Storage Requirements Per Year
- **Daily Text Storage**:
  $$400{,}000 \text{ notes/day} \times 1 \text{ KB} = 400{,}000 \text{ KB/day} = 400 \text{ MB/day} = 0.4 \text{ GB/day}$$
- **Annual Raw Text Storage**:
  $$0.4 \text{ GB/day} \times 365 = 146 \text{ GB/year}$$
- **Total Storage (with B-Tree Indexes & Database Overhead $\approx 2\times$)**:
  $$146 \text{ GB} \times 2 \approx \mathbf{292 \text{ GB/year}} \quad (\approx 0.29 \text{ TB/year})$$

---

### Traffic & Capacity Summary Table

| Metric | Daily Volume | Average Throughput | Peak Throughput ($5\times$) |
| :--- | :--- | :--- | :--- |
| **Active Users (DAU)** | 200,000 | — | — |
| **Writes (Note Mutations)** | 400,000 | ~4.6 writes/sec | ~23.2 writes/sec |
| **Reads (Feed & Notes)** | 4,000,000 | ~46.3 reads/sec | ~231.5 reads/sec |
| **Read-to-Write Ratio** | **10 : 1** (Read-Heavy) | — | — |
| **Raw Note Data Storage** | 400 MB / day | — | 146 GB / year |
| **Total DB Storage (with indexes)** | ~800 MB / day | — | **~292 GB / year** |

---

## 3. System Architecture Diagram

```
                              +-------------------------+
                              |   Client Applications   |
                              |  (Browser / Mobile App) |
                              +-------------------------+
                                           |
                                           | 1. DNS Resolution (api.quicknotes.io)
                                           v
                              +-------------------------+
                              |       DNS Service       |
                              |  (Route 53 / Anycast)   |
                              +-------------------------+
                                           |
                                           | 2. Static Assets & Cached GETs
                                           v
                              +-------------------------+
                              | Content Delivery Network|
                              |      (CDN / Edge)       |
                              +-------------------------+
                                           |
                                           | 3. Dynamic API Requests
                                           v
                              +-------------------------+
                              |      Load Balancer      |
                              |   (ALB / Reverse Proxy) |
                              +-------------------------+
                                           |
                        +------------------+------------------+
                        |                                     |
                        v                                     v
           +-------------------------+           +-------------------------+
           |   App Server Instance 1 |           |   App Server Instance 2 |
           |     (Node.js / Go)      |           |     (Node.js / Go)      |
           +-------------------------+           +-------------------------+
                   |            |                         |            |
         Read /    |            | Cache Reads/            | Read /     | Cache Reads/
         Invalidate|            | Writes                  | Invalidate | Writes
                   v            v                         v            v
           +---------------------------------------------------------------+
           |                    In-Memory Cache (Redis)                    |
           |             (User Sessions & Pre-computed Feeds)              |
           +---------------------------------------------------------------+
                   |                                       |
          Writes   |                                       | Read Queries
          (Master) |                                       | (Slaves)
                   v                                       v
     +--------------------------+             +--------------------------+
     |  Primary Database (SQL)  |             | Database Read Replica(s) |
     |      (Master / Writes)   |             |      (Slaves / Reads)    |
     +--------------------------+             +--------------------------+
                   |  Streaming Replication                ^
                   +---------------------------------------+
                   |
                   | 4. Publish Event
                   v
     +--------------------------+
     |      Message Queue       |
     |   (RabbitMQ / AWS SQS)   |
     +--------------------------+
                   |
                   | 5. Consume Job
                   v
     +--------------------------+
     |     Worker Process       |
     | (Search Index & Auditing)|
     +--------------------------+
```

---

## 4. Component Explanations (Problem Solved by Each Component)

1. **DNS (Domain Name System)**: Solves the routing problem by resolving the domain `api.quicknotes.io` into healthy, geographically optimal edge IP addresses via latency-based Anycast routing.
2. **Content Delivery Network (CDN)**: Solves high latency and server bandwidth consumption by caching static frontend assets (HTML, CSS, JS) and public resources at global edge servers closest to end users.
3. **Load Balancer**: Solves traffic congestion and server single-points-of-failure by terminating TLS and evenly distributing incoming API requests across healthy backend application instances.
4. **App Servers (Two or More Instances)**: Solves business logic execution and request validation by running stateless service instances that authenticate users, execute CRUD operations, and scale horizontally on demand.
5. **In-Memory Cache (Redis)**: Solves high database read latency and repetitive disk I/O by storing serialized user notes, active feeds, and session tokens in fast RAM for sub-millisecond retrieval.
6. **Primary Database (Master / Writes)**: Solves data integrity, persistence, and ACID consistency challenges by acting as the authoritative single source of truth for all transactional insert, update, and delete statements.
7. **Database Read Replica**: Solves primary database read contention by offloading heavy `SELECT` and `JOIN` queries to a read-only instance synchronized via streaming replication.
8. **Message Queue (RabbitMQ / SQS)**: Solves synchronous request latency and thread blocking by buffering background tasks (such as search indexing and audit logging) for asynchronous processing.
9. **Worker Process**: Solves background computation overhead by pulling tasks off the message queue and executing heavy processing out-of-band without degrading user-facing API response times.

---

## 5. Step-by-Step Request Workflows

### 5.1. Flow of `GET /notes` (Listing User Notes)

```
[Client] ---> (1. GET /api/v1/notes) ---> [Load Balancer]
                                                |
                                                v
                                        [App Server 1]
                                                |
                        (2. Query Cache)        |
                         Key: notes:user_{id}   v
                     +----------------------------------+
                     |         Redis Cache              |
                     +----------------------------------+
                        | (Hit: Return JSON)       | (Miss)
                        v                          v
              [Return to App Server]     (3. Query Read Replica)
                        |                SELECT notes JOIN tags...
                        |                          |
                        |                          v
                        |                +--------------------+
                        |                |  DB Read Replica   |
                        |                +--------------------+
                        |                          |
                        |                 (4. Return Rows)
                        |                          v
                        |                 (5. Write into Cache)
                        |                 TTL: 300 seconds
                        |                          |
                        +--------------------------+
                                    |
                                    v
                     (6. HTTP 200 OK Response)
                                    v
                                [Client]
```

1. **Client Request**: The client application issues an authenticated `GET /api/v1/notes?page=1&limit=10` request with a Bearer JWT header.
2. **Traffic Distribution**: The request arrives at the **Load Balancer**, which validates the TLS handshake and routes the request to an available **App Server** instance.
3. **Authentication & Cache Inspection**: The App Server verifies the JWT token and checks the **Redis Cache** for the cache key `notes:user_{user_id}:page_1`.
4. **Cache Hit Path**: If cached data is present (Cache Hit), the App Server deserializes the cached JSON payload and immediately returns an `HTTP 200 OK` response to the client ($< 15\text{ ms}$).
5. **Cache Miss Path**: If the key is not in Redis (Cache Miss), the App Server issues a parameterized SQL query to the **Database Read Replica** (`SELECT ... FROM notes LEFT JOIN note_tags ... WHERE user_id = ? ORDER BY ...`).
6. **Cache Population**: The App Server serializes the database query results and saves them back to **Redis** with a 5-minute Time-To-Live (TTL).
7. **Client Response**: The App Server responds to the client with an `HTTP 200 OK` status and the JSON notes array.

---

### 5.2. Flow of `POST /notes` (Creating a Note)

```
[Client] ---> (1. POST /api/v1/notes) ---> [Load Balancer]
                                                 |
                                                 v
                                         [App Server 2]
                                                 |
                       (2. Validate Title <= 100)
                                                 |
                       (3. INSERT Transaction)   v
                     +------------------------------------+
                     |      Primary Database (Master)     |
                     +------------------------------------+
                                                 |
                       (4. Invalidate Cache)     v
                     +------------------------------------+
                     |           Redis Cache              |
                     +------------------------------------+
                                                 |
                       (5. Enqueue Task)         v
                     +------------------------------------+
                     |          Message Queue             |
                     +------------------------------------+
                                                 |
                       (6. HTTP 201 Created)     | (7. Dequeue Job)
                                                 v         v
                                             [Client]  [Worker]
                                                           |
                                                (8. Update Search Index)
```

1. **Client Request**: The client submits a `POST /api/v1/notes` request containing `{ "title": "New Note", "body": "...", "tag_ids": [1] }`.
2. **Routing & Validation**: The **Load Balancer** forwards the request to **App Server 2**. The server authenticates the user and verifies that the `title` is non-empty and under 100 characters.
3. **Database Transaction**: The App Server opens an ACID transaction on the **Primary Database (Master)**, inserts the new row into `notes`, inserts tag associations into `note_tags`, and commits the transaction.
4. **Cache Invalidation**: The App Server evicts/invalidates the cached feed keys for that user in **Redis** (`notes:user_{user_id}:*`) to ensure subsequent reads fetch the fresh note.
5. **Publish Background Event**: The App Server publishes an asynchronous event payload `{"event": "note.created", "note_id": "...", "user_id": "..."}` onto the **Message Queue**.
6. **Fast Client Acknowledgment**: The App Server immediately returns an `HTTP 201 Created` response containing the new note object and a `Location: /api/v1/notes/:id` header ($< 60\text{ ms}$).
7. **Asynchronous Background Processing**: A **Worker Process** consumes the event from the message queue and updates the full-text search index (e.g., Elasticsearch or Postgres Full-Text Search) out-of-band without blocking the user.

---

## 6. Architectural Trade-offs

### Trade-off 1: Cache-Aside (Lazy Loading) vs. Write-Through Caching
- **Approach A (Cache-Aside / Lazy Loading - Chosen)**:
  Application servers check Redis on reads; if missing, they read from the database and populate the cache. On writes, the app simply invalidates/deletes the cached user feed key.
- **Approach B (Write-Through Caching)**:
  Every note creation or edit synchronously writes both to the primary database and updates the active Redis cache key before returning.
- **Evaluation**:
  - *Pros of Approach A*: Only actively read notes occupy valuable memory; simpler write path; cache never holds stale data after invalidation.
  - *Cons of Approach A*: The first request after a cache eviction experiences a cache miss penalty (querying the database).
  - *Pros of Approach B*: Every read is a guaranteed cache hit.
  - *Cons of Approach B*: Wastes Redis memory caching notes for inactive users who may not open their feed for days; requires complex distributed rollback logic if the cache write fails after the database commit.
- **Conclusion**: Cache-Aside is superior for QuickNotes because active users quickly populate the cache while inactive data naturally expires without consuming RAM.

---

### Trade-off 2: Eventual Consistency (Read Replicas) vs. Strong Consistency
- **Approach A (Eventual Consistency with Read Replicas - Chosen)**:
  All read traffic queries read replicas and Redis, accepting an asynchronous replication lag of 20–100ms.
- **Approach B (Strong Consistency on Single Primary)**:
  All reads and writes target the primary database instance to guarantee immediate read-your-writes consistency.
- **Evaluation**:
  - *Pros of Approach A*: Read throughput scales horizontally; peak load of 232 reads/sec is handled effortlessly without degrading primary write capacity.
  - *Cons of Approach A*: If a user creates a note and immediately queries a read replica before replication synchronizes, the new note might take 50ms to appear (mitigated by returning the newly created note in the `POST` response payload).
  - *Pros of Approach B*: Zero replication lag.
  - *Cons of Approach B*: Creates a critical bottleneck on the primary database, severely limiting scalability and causing connection timeouts during traffic spikes.
- **Conclusion**: Eventual consistency is the standard industry choice for consumer note-taking applications. The client UI renders the `POST` response immediately, masking the brief replication window.

---

## 7. Eliminating Single Points of Failure (SPOF Mitigation)

To guarantee high availability ($99.9\%$), every layer in the architecture is designed with redundancy, health monitoring, and automated failover:

1. **DNS & Edge Redundancy**:
   - The DNS layer uses multi-provider Anycast routing (AWS Route 53 with Cloudflare fallback). If an entire cloud region fails, DNS health checks automatically reroute traffic to the standby region within 30 seconds.
2. **Redundant Load Balancers**:
   - Deployed as dual active-active Application Load Balancers spanning multiple Availability Zones (Multi-AZ) with elastic IP failover.
3. **Stateless Application Server Cluster**:
   - A minimum of two application servers (`App Server 1` and `App Server 2`) run across distinct Availability Zones. If an instance crashes or fails health checks (`GET /health`), the load balancer automatically stops sending traffic to it, and the Auto-Scaling Group spins up a replacement instance within minutes.
4. **In-Memory Cache High Availability**:
   - Redis is deployed in a Redis Sentinel or Redis Cluster configuration with primary-replica replication across AZs and automatic failover. If a Redis node fails, read queries fall back gracefully to the database read replica (circuit breaker pattern).
5. **Database High Availability & Auto-Failover**:
   - The Primary SQL Database streams transaction logs to a hot standby replica in a second Availability Zone. If the primary node crashes, automated health checks trigger a failover promotion, elevating the standby replica to become the new primary in under 60 seconds with zero data loss.
6. **Message Queue & Worker Fleet Durability**:
   - The message broker (RabbitMQ/SQS) runs in a clustered multi-node configuration with persistent disk buffering and Dead-Letter Queues (DLQ). If a worker process crashes mid-job, the unacknowledged message is automatically redelivered to a healthy worker.
