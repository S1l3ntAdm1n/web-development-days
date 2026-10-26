# SnapShare: System Architecture & Scaling Plan

A comprehensive scaling plan and system design for **SnapShare**, a photo-sharing platform where users upload photos and scroll a personalized feed of photos from people they follow.

---

## 1. Assumptions & Baseline Metrics

### Starting Facts
- **Total Registered Users**: 10,000,000 (10 million).
- **Daily Active Rate**: 10% of registered users are active on any given day.
- **Upload Activity**: Each active user uploads an average of 1 photo per day.
- **Feed Browsing Activity**: Each active user views an average of 50 feed pages per day.
- **Original Photo Size**: Average 2 MB per photo.
- **Thumbnail Photo Size**: Average 50 KB (0.05 MB) per photo.
- **Peak Traffic Multiplier**: 5× average load.
- **Time Conversions**: 1 day = 86,400 seconds; 1 year = 365 days.

---

### Daily Active Users (DAU)
$$\text{DAU} = 10{,}000{,}000 \times 10\% = 1{,}000{,}000 \text{ active users/day (1 Million DAU)}$$

---

### Capacity Estimations & Calculations

#### 1. Uploads Per Second (Write Throughput)
- **Daily Uploads**:
  $$1{,}000{,}000 \text{ active users} \times 1 \text{ photo/day} = 1{,}000{,}000 \text{ photos/day}$$

- **Average Uploads Per Second**:
  $$\text{Average Uploads/sec} = \frac{1{,}000{,}000 \text{ photos}}{86{,}400 \text{ seconds}} \approx 11.57 \text{ uploads/sec} \quad (\approx 12 \text{ uploads/sec})$$

- **Peak Uploads Per Second ($5\times$ multiplier)**:
  $$\text{Peak Uploads/sec} = 11.57 \times 5 \approx 57.87 \text{ uploads/sec} \quad (\approx 58 \text{ uploads/sec})$$

---

#### 2. Feed Views Per Second (Read Throughput)
- **Daily Feed Views**:
  $$1{,}000{,}000 \text{ active users} \times 50 \text{ page views/day} = 50{,}000{,}000 \text{ feed views/day}$$

- **Average Feed Views Per Second**:
  $$\text{Average Feed Views/sec} = \frac{50{,}000{,}000 \text{ views}}{86{,}400 \text{ seconds}} \approx 578.70 \text{ views/sec} \quad (\approx 579 \text{ views/sec})$$

- **Peak Feed Views Per Second ($5\times$ multiplier)**:
  $$\text{Peak Feed Views/sec} = 578.70 \times 5 \approx 2{,}893.52 \text{ views/sec} \quad (\approx 2{,}894 \text{ views/sec})$$

---

#### 3. Photo & Media Storage Per Year
Each upload creates two assets: the original photo (2 MB) and an optimized thumbnail (50 KB = 0.05 MB).

- **Daily Storage Additions**:
  - **Original Photos**: $1{,}000{,}000 \times 2 \text{ MB} = 2{,}000{,}000 \text{ MB/day} = 2{,}000 \text{ GB/day} = 2.00 \text{ TB/day}$
  - **Thumbnails**: $1{,}000{,}000 \times 0.05 \text{ MB} = 50{,}000 \text{ MB/day} = 50 \text{ GB/day} = 0.05 \text{ TB/day}$
  - **Combined Daily Storage**: $2.00 \text{ TB} + 0.05 \text{ TB} = 2.05 \text{ TB/day}$

- **Annual Storage Requirements (365 days)**:
  - **Original Photos**: $2.00 \text{ TB/day} \times 365 = 730.00 \text{ TB/year}$
  - **Thumbnails**: $0.05 \text{ TB/day} \times 365 = 18.25 \text{ TB/year}$
  - **Total Media Storage Per Year**:
    $$730.00 \text{ TB} + 18.25 \text{ TB} = 748.25 \text{ TB/year} \quad (\approx 0.75 \text{ Petabytes/year})$$
  *(In binary units: $\approx 680.5 \text{ TiB/year}$)*

---

### Quantitative Summary Table

| Metric | Daily Volume | Average Rate | Peak Rate ($5\times$) |
| :--- | :--- | :--- | :--- |
| **Active Users (DAU)** | 1,000,000 users | — | — |
| **Photo Uploads (Writes)** | 1,000,000 uploads | ~11.6 uploads/sec | ~58 uploads/sec |
| **Feed Views (Reads)** | 50,000,000 views | ~579 views/sec | ~2,894 views/sec |
| **Original Photos Storage** | 2 TB / day | — | 730 TB / year |
| **Thumbnails Storage** | 50 GB / day | — | 18.25 TB / year |
| **Total Media Storage** | **2.05 TB / day** | — | **748.25 TB / year** |

---

## 2. Traffic Profile: Read-Heavy vs. Write-Heavy

### Decision
The SnapShare system is **overwhelmingly read-heavy**.

### Ratio Comparison
- **Feed Views (Reads)**: 50,000,000 requests/day (~579 avg / ~2,894 peak req/sec).
- **Photo Uploads (Writes)**: 1,000,000 requests/day (~11.6 avg / ~58 peak req/sec).
- **Read-to-Write Ratio**: **50 : 1** (for every photo uploaded, users view 50 feed pages; each feed page in turn loads multiple photo/thumbnail assets).

### What This Means for System Design
1. **Aggressive Multi-Tier Caching**: Since reads dominate by a factor of 50, reading directly from disk or querying the relational database for every request would quickly overwhelm infrastructure. We must cache heavily at the network edge (CDN for image binaries) and in memory (Redis/Memcached for user feeds, follower relationships, and photo metadata).
2. **Database Read Replicas**: Write queries (inserting a photo record, following a user) run on a dedicated primary database instance, while read queries (loading feeds, user profiles) are distributed across multiple read-only database replicas.
3. **Decoupled Asynchronous Writes**: Because write volume is comparatively modest (11.6/sec avg), the write pipeline can afford to offload heavy operations (such as image resizing and fanout calculations) to background worker queues, ensuring fast acknowledgment back to the uploading user.
4. **CDN Offloading**: With 50 million feed views per day loading thumbnails, caching images at geographically distributed CDN edge points will shield application servers and object storage from over 95% of incoming static media traffic.

---

## 3. Storage Strategy: Why Photos Must NOT Be Stored in the Database

Photos must **never** be stored as binary large objects (`BLOB`s) directly inside relational or document database tables. Instead, photos must reside in **dedicated distributed object storage** (e.g., AWS S3, Google Cloud Storage, or MinIO), while the database stores only structured metadata and URI pointers.

### Four Critical Reasons Against Storing Photos in the Database:
1. **Buffer Pool & Memory Cache Pollution**: Relational database engines (such as PostgreSQL or MySQL InnoDB) load data pages into high-speed RAM (buffer pool). Large 2 MB image blobs consume massive chunks of RAM, evicting frequently accessed indexes and table rows, which drastically degrades general query performance.
2. **Database Bloat & Massive Backup Overhead**: Adding 748 TB of binary data per year directly to the database would inflate database dumps, snapshot creation, replication streams, and disaster recovery recovery-time objectives (RTO) from minutes to days.
3. **Connection & Thread Exhaustion**: Streaming large 2 MB binary files over HTTP through the database holds database connection pool slots and application threads open for the duration of the client download, leading to thread starvation under high concurrency.
4. **Cost & Infrastructure Inefficiency**: High-IOPS enterprise SSD storage attached to database clusters costs substantially more per gigabyte than commoditized cloud object storage, making database BLOB storage economically prohibitive.

### Where Photos Should Go Instead:
- **Binary Files**: Stored in **Distributed Object Storage** (such as AWS S3 or Google Cloud Storage). Object storage provides 99.999999999% (11 9's) durability, near-infinite horizontal scalability, built-in tiering (e.g., transitioning older photos to cold storage/Glacier), native CDN edge integration, and direct pre-signed URL uploads.
- **Metadata in Database**: The relational database stores only compact, indexed metadata records:
  ```sql
  photo_id         UUID PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES users(user_id),
  photo_url        VARCHAR(512) NOT NULL,
  thumbnail_url    VARCHAR(512),
  caption          VARCHAR(2200),
  file_size_bytes  INTEGER NOT NULL,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  ```

---

## 4. System Architecture Diagram

```
                              +-------------------------+
                              |   Client Applications   |
                              |  (iOS / Android / Web)  |
                              +-------------------------+
                                    |              ^
                 Upload Requests &  |              | Read Feeds &
                 Feed Queries (API) |              | Download Images
                                    v              |
                       +-------------------------------+
                       |   Content Delivery Network    |<----------+
                       |             (CDN)             |           |
                       +-------------------------------+           |
                                    |                              |
                                    | API Calls                    | Cache Misses
                                    v                              | (Thumbnails/Photos)
                       +-------------------------------+           |
                       |         Load Balancer         |           |
                       +-------------------------------+           |
                                    |                              |
                      +-------------+-------------+                |
                      |                           |                |
                      v                           v                |
         +-----------------------+   +-----------------------+     |
         |  App Server (Node/Go) |   |  App Server (Node/Go) |     |
         +-----------------------+   +-----------------------+     |
             |             |                     |                 |
     Writes  |             | Read / Invalidate   | Cache Reads     |
             |             v                     v                 |
             |     +----------------------------------+            |
             |     |      In-Memory Cache (Redis)     |            |
             |     |   (User Feeds & Photo Metadata)  |            |
             |     +----------------------------------+            |
             |                                                     |
             +-----------------------+                             |
             |                       |                             |
             v                       v                             |
+--------------------------+   +--------------------------+        |
|  Primary Database (SQL)  |   | Database Read Replica(s) |        |
|      (Master / Writes)   |   |      (Slaves / Reads)    |        |
+--------------------------+   +--------------------------+        |
             |  Replication              ^                         |
             +---------------------------+                         |
             |                                                     |
             | 1. Enqueue Job                                      |
             v                                                     |
+--------------------------+                                       |
|      Message Queue       |                                       |
|   (RabbitMQ / AWS SQS)   |                                       |
+--------------------------+                                       |
             |                                                     |
             | 2. Consume Job                                      |
             v                                                     |
+--------------------------+                                       |
|     Thumbnail Worker     |---------------------------------------+
|  (Background Processor)  | Uploads Thumbnail & Reads Original    |
+--------------------------+                                       |
             |                                                     |
             | Reads Original (2 MB)                               |
             | Writes Thumbnail (50 KB)                            |
             v                                                     v
+------------------------------------------------------------------+
|                      Cloud Object Storage                        |
|            (AWS S3 / GCS - Raw Photos & Thumbnails)              |
+------------------------------------------------------------------+
```

---

## 5. Component Explanations (Problem Solved by Each Component)

1. **Content Delivery Network (CDN)**: Solves high latency and origin network congestion by caching photo files and thumbnails at geographically distributed edge servers closest to end users.
2. **Load Balancer**: Solves single-point-of-failure and uneven server traffic issues by evenly distributing incoming HTTP requests across a fleet of healthy application servers.
3. **Application Servers**: Solves business logic execution and request coordination by handling user authentication, validating uploads, formatting feed responses, and dispatching background tasks.
4. **In-Memory Cache (Redis)**: Solves slow database query bottlenecks by storing precomputed user feeds, session tokens, and frequently accessed photo metadata in ultra-fast RAM for sub-millisecond retrieval.
5. **Primary Database (Write DB)**: Solves data consistency and transactional integrity challenges by serving as the authoritative single source of truth for all write operations (new photo records, user follows, and account updates).
6. **Database Read Replica**: Solves primary database overload and read contention by serving read-only queries (such as user profile queries and follower lookups) independently from the primary database.
7. **Object Storage**: Solves the high cost, bloat, and poor scalability of storing massive binary files in databases by offering virtually infinite, highly durable, low-cost storage specifically designed for media files.
8. **Message Queue**: Solves slow request-response upload cycles by buffering image-processing jobs and decoupling synchronous web requests from heavy, asynchronous thumbnail rendering tasks.
9. **Thumbnail Worker**: Solves CPU exhaustion and latency on user-facing servers by asynchronously fetching original photos, generating optimized 50 KB thumbnails in the background, and updating storage and database records.

---

## 6. Step-by-Step Flow of Uploading a Photo

```
[User App] ---> (1. Request Upload) ---> [App Server]
                                              |
                   (2. S3 Pre-signed URL) <---+
[User App] ---> (3. Direct Binary Upload 2 MB) ---> [Object Storage]
[User App] ---> (4. Confirm Upload & Metadata) ---> [App Server]
                                                          |
                                    (5. Save Metadata) -> [Primary DB]
                                    (6. Enqueue Job)   -> [Message Queue]
                                    (7. HTTP 201 OK)   -> [User App]
                                                                |
                                             [Worker] <---------+ (8. Consume Job)
                                                |
                                                +---> (9. Fetch 2 MB Photo) ---> [Object Storage]
                                                +---> (10. Generate 50 KB Thumbnail)
                                                +---> (11. Put Thumbnail) -----> [Object Storage]
                                                +---> (12. Update Record) -----> [Primary DB]
                                                +---> (13. Fanout/Invalidate) -> [Redis Cache]
```

### Detailed Lifecycle Steps:

1. **Initiation & Pre-Signed URL Generation**:
   The user's mobile app sends an authenticated `POST /api/photos/upload-intent` request to the **Application Server** containing image metadata (file size, image format, checksum).
2. **Direct Storage Authorization**:
   The application server validates the user's session and generates a time-limited, cryptographically signed pre-signed upload URL from **Object Storage** (e.g., S3 Pre-Signed PUT URL) along with a unique `photo_id`, returning it to the client.
3. **Direct Binary Upload**:
   The mobile app uploads the 2 MB raw photo directly to **Object Storage** using the pre-signed URL via HTTP PUT, bypassing application servers completely and avoiding network and memory saturation.
4. **Metadata Persistence**:
   Upon upload completion to Object Storage, the client issues a `POST /api/photos/complete` call. The application server writes a new record into the **Primary Database** with status `PROCESSING`, saving `photo_id`, `user_id`, `photo_url`, caption, and timestamps.
5. **Enqueueing Thumbnail Job**:
   The application server immediately publishes an image processing message `{"photo_id": "...", "original_url": "...", "user_id": "..."}` onto the **Message Queue** (e.g., RabbitMQ or AWS SQS).
6. **Immediate User Acknowledgment**:
   The application server returns an immediate `HTTP 201 Created` response to the user's device with the pending photo details, providing a fast, non-blocking user experience (< 200 ms).
7. **Background Worker Consumption**:
   An available instance of the **Thumbnail Worker** fleet dequeues the message from the queue.
8. **Thumbnail Generation**:
   The worker downloads the 2 MB original image from **Object Storage**, resizes and compresses it into a high-quality 50 KB thumbnail using an optimized image library (e.g., `libvips` or `sharp`).
9. **Uploading Thumbnail**:
   The worker uploads the generated 50 KB thumbnail into **Object Storage** under a predictable key (`/thumbnails/{photo_id}.jpg`).
10. **Database & Cache Update (Fan-out)**:
    The worker executes an `UPDATE photos SET thumbnail_url = ..., status = 'READY'` statement on the **Primary Database**. It then publishes a cache update/invalidation to the **Redis In-Memory Cache**, pushing the new photo ID into the feed lists of the uploader's active followers (or invalidating follower feed caches).
11. **Edge Propagation**:
    When followers open their feed, their client requests thumbnail URLs through the **CDN**, which caches the 50 KB images at edge points worldwide on the very first access.

---

## 7. Architectural Trade-offs

### Trade-off 1: Pre-signed Object Storage Upload vs. Uploading Through Application Servers
- **Approach A (Direct via Pre-signed URLs - Chosen)**:
  Clients obtain a signed URL and upload media binaries directly to cloud object storage (S3/GCS); application servers only handle lightweight metadata.
- **Approach B (Proxy via Application Servers)**:
  Clients upload multipart binary payloads directly to application servers, which stream the bytes to object storage.
- **Evaluation**:
  - *Pros of Approach A*: Relieves application servers of handling 2 MB binary streams at peak 58 uploads/sec (~116 MB/sec sustained network bandwidth). Prevents thread starvation and cuts compute server footprint significantly.
  - *Cons of Approach A*: Clients must coordinate two separate network round-trips (requesting signed URL, then uploading). Content validation (e.g., virus scans, MIME-type verification) must be performed asynchronously after the upload arrives in storage.
- **Conclusion**: Approach A is vastly superior for scaling SnapShare to 10M users because bandwidth and I/O bottlenecks on app servers are completely eliminated.

---

### Trade-off 2: Feed Generation Strategy: Fan-out on Write (Push) vs. Fan-out on Read (Pull)
- **Approach A (Fan-out on Read / Pull Model)**:
  When a user views their feed, the system queries the database/cache for all accounts they follow, fetches their latest photos, and merges/sorts them by timestamp in real time.
- **Approach B (Fan-out on Write / Push Model)**:
  When a user uploads a photo, a background worker looks up all their followers and writes the photo ID directly into each follower's pre-computed inbox feed in Redis.
- **Evaluation**:
  - *Pros of Fan-out on Write (Push)*: Feed reads are instantaneous $O(1)$ operations (reading a simple list from Redis cache), matching our 50:1 read-heavy workload perfectly.
  - *Cons of Fan-out on Write (Push)*: For "celebrity" accounts with millions of followers, a single photo upload causes massive write amplification, requiring millions of Redis writes (the "Celebrity Problem").
  - *Pros of Fan-out on Read (Pull)*: Uploads are cheap ($O(1)$); no wasted feed computation for inactive followers.
  - *Cons of Fan-out on Read (Pull)*: Feed queries become very expensive ($O(N)$ joins across followee lists), crippling read latency at 2,894 peak views/sec.
- **Conclusion**: A **Hybrid Architecture** is best. Use Fan-out on Write (Push) for 99% of normal users (fast feeds for the 50:1 read workload), but switch to Fan-out on Read (Pull) for high-follower celebrity accounts, merging their new posts into the user's feed on-demand when the feed is requested.

---

### Trade-off 3: Asynchronous Thumbnail Processing vs. Synchronous Inline Resizing
- **Approach A (Asynchronous via Queue & Workers - Chosen)**:
  The upload endpoint accepts the image, enqueues a background job, and immediately returns success to the client while background workers generate thumbnails.
- **Approach B (Synchronous Inline Processing)**:
  The application server holds the HTTP connection open, resizes the 2 MB image to a 50 KB thumbnail in memory, saves both files, and then responds to the client.
- **Evaluation**:
  - *Pros of Approach A*: Fast upload response time (< 200 ms vs. 1500–3000 ms); queue buffers traffic spikes safely during peak hours without crashing servers.
  - *Cons of Approach A*: Adds system complexity (message broker and worker fleets to monitor); introduces a brief delay (eventual consistency) where the thumbnail is processing and not immediately viewable.
- **Conclusion**: Approach A is essential. Holding connections open for CPU-heavy image manipulation during peak hours (58 uploads/sec = 116 MB/sec of image processing) would saturate CPU cores and cause server timeouts.

---

### Trade-off 4: Database Read Replicas & Cache Eventual Consistency vs. Strong Consistency
- **Approach A (Eventual Consistency with Read Replicas & Redis - Chosen)**:
  Read queries read from Redis and database read replicas, accepting a replication lag of a few hundred milliseconds before a new upload appears in a follower's feed.
- **Approach B (Strong Consistency on Primary Database)**:
  All read requests query the primary database with read-your-writes guarantees, bypassing replicas or locking rows.
- **Evaluation**:
  - *Pros of Approach A*: Read throughput scales linearly by simply adding read replicas and Redis nodes, easily serving 2,894 peak queries/sec without impacting the primary database.
  - *Cons of Approach A*: A user might refresh their feed a split-second after their friend posts and not see the photo immediately until cache replication catches up.
- **Conclusion**: For a social photo app like SnapShare, eventual consistency is completely acceptable. A user noticing a 500 ms propagation delay has zero negative business impact, whereas a database crash caused by 2,894 queries/sec hitting a single primary instance would cause a complete platform outage.
