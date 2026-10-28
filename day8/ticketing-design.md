# TicketHub: System Architecture & Flash-Sale Ticketing Design

A comprehensive, production-grade system architecture and engineering specification for **TicketHub**, a high-scale event and concert ticketing platform. This document defines the system requirements, capacity calculations, RESTful API contracts, relational data model, concurrency controls preventing double-booking, distributed cloud architecture, and architectural trade-offs.

---

## 1. System Requirements

### 1.1. Functional Requirements
1. **Event Browsing & Discovery**: Users can browse, search, and filter upcoming concerts and events by performer, venue, date, and genre with paginated results.
2. **Interactive Seat Map & Real-Time Availability**: Users can select an event and inspect real-time seat statuses (`AVAILABLE`, `HELD`, `BOOKED`) across venue sections and rows.
3. **Temporary Seat Reservations (Holds)**: Authenticated users can reserve (hold) up to 4 specific available seats for a strict 10-minute checkout window. During this window, the held seats are locked and hidden from other buyers.
4. **Checkout & Secure Payment**: Users can submit payment details for their held seats. Upon successful payment authorization, the system transitions the hold into a permanently confirmed ticket order.
5. **Automatic Hold Expiration**: If a user abandons checkout or the 10-minute timer lapses, the hold automatically expires and the seats immediately return to the available inventory pool without manual intervention.
6. **Digital Ticket Access**: Users can retrieve their confirmed orders and display digital tickets containing unique cryptographic QR codes/barcodes for venue gate entry.

### 1.2. Non-Functional Requirements

#### 1. Speed (Low Latency Under Concurrency)
- **Read Latency**: Event catalog browsing and seat map queries must maintain a P95 latency $< 100\text{ ms}$ and P99 latency $< 250\text{ ms}$, leveraging distributed edge caching and in-memory caches.
- **Write Latency**: Seat hold requests and checkout operations must complete with a P95 latency $< 200\text{ ms}$ to avoid browser timeout cascades during peak traffic.
- **Connection Scalability**: The network ingress and API tier must support tens of thousands of concurrent open TCP/TLS connections without connection resets or socket exhaustion.

#### 2. Correctness (Zero Double-Booking & ACID Guarantees)
- **Strict Seat Invariance**: Under no circumstances may two different users hold, buy, or be billed for the same physical seat for the same event (100% mutual exclusivity).
- **Transactional Consistency**: Financial payment captures and seat status transitions must execute atomically. If payment processing fails, the seat reservation must either remain held for the user's retry or roll back cleanly without stranded orphaned states.
- **Idempotency**: All payment and hold mutations must enforce idempotency via unique tokens to prevent duplicate credit card charges and redundant seat allocations caused by network retries or client double-clicks.

#### 3. Fairness & Anti-Scalping Protection
- **First-Come, First-Served Access**: When demand outstrips supply, admission to purchase seats must follow a deterministic, orderly queue using a virtual waiting room.
- **Bot Mitigation & Rate Limiting**: Anti-bot verification (invisible CAPTCHA / proof-of-work) and IP/user rate limiting must prevent automated script scrapers from front-running human fans.
- **Allocation Caps**: A strict limit of 4 tickets per user account and credit card fingerprint prevents bulk inventory hoarding by secondary ticket brokers.

#### 4. High Availability & Fault Tolerance
- **Service Uptime**: Maintain $99.99\%$ service availability during high-profile on-sale events (no more than 52 minutes of downtime per year).
- **Graceful Degradation**: If backend databases reach peak capacity, the ingress virtual queue must absorb and throttle traffic rather than permitting database crashes or 500-series server errors.

---

## 2. Capacity Estimations & Load Profile

### 2.1. Baseline Parameters & Assumptions
- **Total Registered User Base**: 2,000,000 users.
- **Normal Day Operations**:
  - Daily active visitors: 50,000 people.
  - Page views per visitor: 10 pages/day.
  - Daily ticket sales: 5,000 tickets sold across all catalog events.
- **"Big Sale" Flash-Sale Operations**:
  - Event capacity: 20,000 seats.
  - Concurrency window: First 10 minutes (600 seconds) after sale launch.
  - Competing buyers: 200,000 concurrent users attempting to secure seats.
  - Oversubscription ratio: $200{,}000 \text{ buyers} : 20{,}000 \text{ seats} = 10 : 1$.
  - User behavior: Each active buyer refreshes the seat map and event details an average of 15 times during the 10-minute scramble, and submits at least 1 hold request.
- **Time Conversions**: 1 day = 86,400 seconds; 10 minutes = 600 seconds.

---

### 2.2. Quantitative Calculations

#### A. Normal Day Traffic
1. **Normal Read Throughput (Page Views)**:
   $$\text{Total Daily Page Views} = 50{,}000 \text{ visitors} \times 10 \text{ views} = 500{,}000 \text{ views/day}$$
   $$\text{Average Read QPS} = \frac{500{,}000 \text{ views}}{86{,}400 \text{ seconds}} \approx 5.79 \text{ requests/sec}$$
   $$\text{Normal Peak Read QPS } (3\times \text{ diurnal factor}) = 5.79 \times 3 \approx 17.36 \text{ requests/sec} \quad (\approx 18 \text{ req/sec})$$

2. **Normal Write Throughput (Ticket Purchases)**:
   $$\text{Average Write QPS} = \frac{5{,}000 \text{ sales}}{86{,}400 \text{ seconds}} \approx 0.058 \text{ writes/sec} \quad (\approx 1 \text{ purchase every 17.3 seconds})$$
   $$\text{Normal Peak Write QPS } (5\times \text{ burst factor}) = 0.058 \times 5 \approx 0.29 \text{ writes/sec} \quad (\approx 1 \text{ purchase every 3.5 seconds})$$

3. **Normal Read-to-Write Ratio**:
   $$\text{Ratio} = \frac{500{,}000 \text{ reads}}{5{,}000 \text{ writes}} = 100 : 1 \quad (\text{Overwhelmingly Read-Heavy})$$

---

#### B. "Big Sale" Peak Traffic (10-Minute Surge)
1. **Big Sale Read Throughput (Event Page & Seat Map Views)**:
   $$\text{Total Views in 10 min} = 200{,}000 \text{ users} \times 15 \text{ views} = 3{,}000{,}000 \text{ page views}$$
   $$\text{Average Surge Read QPS} = \frac{3{,}000{,}000 \text{ views}}{600 \text{ seconds}} = \mathbf{5{,}000 \text{ requests/sec}}$$
   $$\text{Initial Minute Spike Read QPS } (3\times \text{ opening rush}) = 5{,}000 \times 3 = \mathbf{15{,}000 \text{ requests/sec}}$$

2. **Big Sale Write Throughput (Seat Hold & Purchase Attempts)**:
   - **Seat Hold Attempts**: 200,000 eager users all attempting to acquire seats within the 600-second window:
     $$\text{Average Hold Attempt QPS} = \frac{200{,}000 \text{ attempts}}{600 \text{ seconds}} \approx \mathbf{333.33 \text{ hold writes/sec}}$$
     $$\text{Initial 60-Second Surge Hold QPS } (6\times \text{ opening burst}) = 333.33 \times 6 \approx \mathbf{2{,}000 \text{ hold writes/sec}}$$
   - **Successful Purchases Completed**: All 20,000 seats sell out within the 10-minute window:
     $$\text{Successful Purchase QPS} = \frac{20{,}000 \text{ tickets}}{600 \text{ seconds}} \approx \mathbf{33.33 \text{ committed orders/sec}}$$

---

### 2.3. Traffic Comparison & Engineering Implications

| Metric / Dimension | Normal Day Traffic | "Big Sale" Peak (10-Min Flash Sale) | Growth Factor / Surge Magnitude |
| :--- | :--- | :--- | :--- |
| **Concurrent Active Users** | ~500–1,000 concurrent | 200,000 concurrent | **200× – 400× increase** |
| **Average Read Throughput** | ~5.8 req/sec | 5,000 req/sec (15,000 peak) | **863× – 2,586× surge** |
| **Write Attempt Throughput** | ~0.06 writes/sec | 333 req/sec (2,000 peak) | **5,550× – 33,333× surge** |
| **Committed Purchases** | 5,000 / day | 20,000 / 10 minutes | **40× daily sales volume compressed into 0.7% of the time** |
| **Inventory Contention** | Near zero (seats freely chosen) | Extreme (10 buyers per seat) | Massive database lock contention if unbuffered |

#### Architectural Takeaways
1. **Relational Database Collapse Risk**: A standard monolithic PostgreSQL or MySQL server cannot handle 2,000 write transactions per second attempting to mutate the exact same rows under pessimistic locking without thread pool exhaustion and lock wait timeouts.
2. **Mandatory Ingress Throttling**: The architecture must separate browsing from purchasing and route flash-sale traffic through an edge-managed **Virtual Waiting Room (Queue)** to admit only as many users into checkout as the backend can process synchronously.
3. **Multi-Tiered Caching**: The 15,000 read QPS must be absorbed by edge CDNs (for static seating maps) and distributed in-memory caches (Redis for seat status bitmasks), keeping read traffic entirely off the primary database.

---

## 3. RESTful API Specification

The TicketHub REST API follows strict RESTful resource design, JSON formatting, TLS 1.3 encryption, and standard HTTP response codes.

### API Summary Table

| Method | Endpoint | Description | Auth Required | Success Status |
| :--- | :--- | :--- | :--- | :--- |
| **`GET`** | `/api/v1/events` | Browse and filter upcoming concerts and events. | No | `200 OK` |
| **`GET`** | `/api/v1/events/:eventId/seats` | View real-time seating availability map for an event. | No | `200 OK` |
| **`POST`** | `/api/v1/events/:eventId/holds` | Temporarily hold up to 4 available seats for 10 minutes. | Yes (Bearer JWT) | `201 Created` |
| **`POST`** | `/api/v1/orders/checkout` | Pay for held seats and finalize ticket purchase. | Yes (Bearer JWT) | `201 Created` |
| **`GET`** | `/api/v1/users/me/tickets` | View authenticated user's confirmed tickets and entry QR codes. | Yes (Bearer JWT) | `200 OK` |

---

### 3.1. Browse Events (`GET /api/v1/events`)
Retrieves a paginated list of published events with optional filtering by performer, city, or date range.

- **Request**:
  ```http
  GET /api/v1/events?genre=rock&city=Los+Angeles&page=1&limit=10 HTTP/1.1
  Host: api.tickethub.com
  Accept: application/json
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "status": "success",
    "data": {
      "total_events": 142,
      "page": 1,
      "limit": 10,
      "events": [
        {
          "event_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
          "title": "Cosmic Echoes World Tour",
          "artist": "Starlight Orchestra",
          "venue": "Grand Arena",
          "city": "Los Angeles",
          "event_date": "2026-11-15T20:00:00Z",
          "sale_start_time": "2026-10-28T17:00:00Z",
          "status": "ON_SALE",
          "total_seats": 20000,
          "available_seats": 4820,
          "min_price_cents": 7500
        }
      ]
    }
  }
  ```

---

### 3.2. View Seating Map (`GET /api/v1/events/:eventId/seats`)
Retrieves the real-time availability status and pricing for all seats within an event.

- **Request**:
  ```http
  GET /api/v1/events/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/seats?section=Floor-A HTTP/1.1
  Host: api.tickethub.com
  Accept: application/json
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "status": "success",
    "data": {
      "event_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "section": "Floor-A",
      "seats": [
        {
          "seat_id": "4c38d4a9-8260-4e56-bc9b-3ecb453e0110",
          "row": "1",
          "seat_number": "12",
          "price_cents": 15000,
          "status": "AVAILABLE"
        },
        {
          "seat_id": "5d49e5ba-9371-5f67-cd0c-4fdc564f0221",
          "row": "1",
          "seat_number": "13",
          "price_cents": 15000,
          "status": "HELD"
        },
        {
          "seat_id": "6e50f6cb-0482-6078-de1d-5aed67500332",
          "row": "1",
          "seat_number": "14",
          "price_cents": 15000,
          "status": "BOOKED"
        }
      ]
    }
  }
  ```

---

### 3.3. Hold Seats (`POST /api/v1/events/:eventId/holds`)
Places a temporary 10-minute hold on up to 4 selected seats for checkout.

- **Request**:
  ```http
  POST /api/v1/events/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/holds HTTP/1.1
  Host: api.tickethub.com
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Content-Type: application/json

  {
    "seat_ids": [
      "4c38d4a9-8260-4e56-bc9b-3ecb453e0110"
    ]
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "status": "success",
    "data": {
      "hold_id": "a82c4789-9831-419b-a359-548483f98c61",
      "event_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "user_id": "11112222-3333-4444-5555-666677778888",
      "held_seat_ids": [
        "4c38d4a9-8260-4e56-bc9b-3ecb453e0110"
      ],
      "held_at": "2026-10-28T19:50:00Z",
      "expires_at": "2026-10-28T20:00:00Z",
      "expires_in_seconds": 600
    }
  }
  ```
- **Error Response (`409 Conflict`)** *(When another user held or bought the seat)*:
  ```json
  {
    "status": "fail",
    "code": "SEAT_UNAVAILABLE",
    "message": "One or more requested seats are no longer available.",
    "conflicting_seat_ids": [
      "4c38d4a9-8260-4e56-bc9b-3ecb453e0110"
    ]
  }
  ```

---

### 3.4. Pay and Confirm Order (`POST /api/v1/orders/checkout`)
Processes payment for held seats using a client-side payment token and converts the hold into a permanently booked ticket order.

- **Request**:
  ```http
  POST /api/v1/orders/checkout HTTP/1.1
  Host: api.tickethub.com
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Content-Type: application/json
  Idempotency-Key: b7f14fae-9d21-4f9e-a612-4cf019e0787e

  {
    "hold_id": "a82c4789-9831-419b-a359-548483f98c61",
    "payment_method_token": "pm_tok_1N3xyzMasterCard4242",
    "expected_amount_cents": 15000
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "status": "success",
    "data": {
      "order_id": "f5e4d3c2-b1a0-4988-8776-655443322110",
      "status": "CONFIRMED",
      "total_amount_cents": 15000,
      "currency": "USD",
      "confirmed_at": "2026-10-28T19:54:12Z",
      "tickets": [
        {
          "ticket_id": "tkt_89f0e1d2-c3b4-4a59-b678-7890abcdef12",
          "seat_id": "4c38d4a9-8260-4e56-bc9b-3ecb453e0110",
          "section": "Floor-A",
          "row": "1",
          "seat_number": "12",
          "entry_barcode": "TH-2026-9B1D-4C38-SECUREQR"
        }
      ]
    }
  }
  ```
- **Error Response (`410 Gone`)** *(When the hold expired prior to checkout submission)*:
  ```json
  {
    "status": "fail",
    "code": "HOLD_EXPIRED",
    "message": "Your reservation has expired. Please select seats again."
  }
  ```

---

### 3.5. View Tickets (`GET /api/v1/users/me/tickets`)
Retrieves all confirmed tickets and secure entry barcodes belonging to the authenticated user.

- **Request**:
  ```http
  GET /api/v1/users/me/tickets?status=ACTIVE HTTP/1.1
  Host: api.tickethub.com
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Accept: application/json
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "status": "success",
    "data": {
      "tickets": [
        {
          "ticket_id": "tkt_89f0e1d2-c3b4-4a59-b678-7890abcdef12",
          "order_id": "f5e4d3c2-b1a0-4988-8776-655443322110",
          "event_title": "Cosmic Echoes World Tour",
          "venue": "Grand Arena",
          "event_date": "2026-11-15T20:00:00Z",
          "section": "Floor-A",
          "row": "1",
          "seat_number": "12",
          "barcode_payload": "https://tickets.tickethub.com/pass/verify?sig=9e8d7c6b5a",
          "status": "VALID"
        }
      ]
    }
  }
  ```

---

## 4. Relational Data Model

TicketHub utilizes an ACID-compliant relational database (PostgreSQL) to enforce referential integrity, strong isolation levels, and mathematical uniqueness constraints across tickets and seats.

### 4.1. Entity-Relationship Overview

```
 +--------------------+       1        * +--------------------+
 |       users        |------------------|       orders       |
 +--------------------+                  +--------------------+
 | PK user_id         |                  | PK order_id        |
 |    email (UQ)      |                  | FK user_id         |
 |    password_hash   |                  | FK event_id        |
 +--------------------+                  |    idempotency_key |
           | 1                           +--------------------+
           |                                       | 1
           | * (holds)                             |
           v                                       | *
 +--------------------+                  +--------------------+
 |       events       | 1              * |   tickets/items    |
 +--------------------+------------------+--------------------+
 | PK event_id        |                  | PK ticket_id       |
 |    title           |                  | FK order_id        |
 |    venue_name      |                  | FK seat_id (UQ)    |
 +--------------------+                  +--------------------+
           | 1                                     | 1
           |                                       |
           | *                                     | 1
           v                                       v
 +------------------------------------------------------------+
 |                           seats                            |
 +------------------------------------------------------------+
 | PK seat_id                                                 |
 | FK event_id                                                |
 |    section, row_number, seat_number                         |
 |    status ('AVAILABLE', 'HELD', 'BOOKED')                  |
 | FK hold_user_id (nullable)                                 |
 |    hold_id (nullable), hold_expires_at (nullable)          |
 |    version (optimistic locking counter)                    |
 | UQ (event_id, section, row_number, seat_number)             |
 +------------------------------------------------------------+
```

---

### 4.2. Production SQL DDL & Table Schemas

```sql
-- 1. USERS TABLE
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. EVENTS TABLE
CREATE TABLE events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    artist VARCHAR(150) NOT NULL,
    venue_name VARCHAR(150) NOT NULL,
    venue_capacity INTEGER NOT NULL CHECK (venue_capacity > 0),
    event_date TIMESTAMPTZ NOT NULL,
    sale_start_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UPCOMING' 
        CHECK (status IN ('DRAFT', 'UPCOMING', 'ON_SALE', 'SOLD_OUT', 'COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. SEATS TABLE
CREATE TABLE seats (
    seat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    section VARCHAR(50) NOT NULL,
    row_number VARCHAR(10) NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' 
        CHECK (status IN ('AVAILABLE', 'HELD', 'BOOKED')),
    hold_id UUID NULL,
    hold_user_id UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
    hold_expires_at TIMESTAMPTZ NULL,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Invariance Constraint 1: Physical seat uniqueness per event
    CONSTRAINT uq_event_section_row_seat UNIQUE (event_id, section, row_number, seat_number)
);

-- 4. ORDERS TABLE
CREATE TABLE orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    event_id UUID NOT NULL REFERENCES events(event_id),
    total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (payment_status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED')),
    payment_intent_id VARCHAR(100),
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. TICKETS TABLE (Order Items & Admittance Proof)
CREATE TABLE tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES seats(seat_id) ON DELETE RESTRICT,
    barcode_hash VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'USED', 'REVOKED')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Invariance Constraint 2: A seat can only ever belong to ONE active ticket
    CONSTRAINT uq_ticket_seat_id UNIQUE (seat_id)
);
```

---

### 4.3. Indexing Strategy for Extreme Read/Write Performance

```sql
-- Fast Seat Map Rendering: Index covering event and status filtering
CREATE INDEX idx_seats_event_status ON seats(event_id, status) 
INCLUDE (section, row_number, seat_number, price_cents);

-- Fast Hold Expiration Sweep: Partial index on currently held seats
CREATE INDEX idx_seats_held_expiry ON seats(hold_expires_at) 
WHERE status = 'HELD';

-- User Ticket History: Fast lookups of user orders sorted chronologically
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);

-- Fast Hold Lookups: Quick verification of hold ownership by hold_id
CREATE INDEX idx_seats_hold_id ON seats(hold_id) 
WHERE hold_id IS NOT NULL;
```

---

## 5. Concurrency Control: Double-Booking Prevention

Preventing two people from reserving or buying the exact same seat is the single most critical correctness requirement of TicketHub.

### 5.1. The Race Condition Danger
Imagine two users, **Alice** and **Bob**, viewing the last remaining front-row seat (`Floor-A, Row 1, Seat 12`). At the exact same microsecond ($T_0$), both click "Hold Seat":
1. Both requests reach separate application server instances.
2. If application servers run uncoordinated code:
   - Server 1 executes `SELECT status FROM seats WHERE seat_id = X` $\rightarrow$ reads `AVAILABLE`.
   - Server 2 executes `SELECT status FROM seats WHERE seat_id = X` $\rightarrow$ reads `AVAILABLE`.
3. Server 1 updates the seat to `HELD` for Alice.
4. Server 2 updates the seat to `HELD` for Bob (overwriting Alice's hold).
5. Both users proceed to enter payment details, leading to duplicate financial charges and catastrophic failure at the venue door.

---

### 5.2. How the System Guarantees Zero Double-Booking

To eliminate race conditions, TicketHub uses a multi-layered defense combining **relational database constraints**, **atomic conditional writes**, and **in-memory distributed mutex locks**.

#### Layer 1: Atomic Database Updates with Strict Row-Level Locking
At the database layer, we enforce strict isolation using **atomic conditional updates**:

```sql
-- Step 1: Open Transaction with Read Committed Isolation
BEGIN;

-- Step 2: Atomic Update with Status & Expiry Predicate
UPDATE seats
SET status = 'HELD',
    hold_id = 'a82c4789-9831-419b-a359-548483f98c61',
    hold_user_id = '11112222-3333-4444-5555-666677778888',
    hold_expires_at = NOW() + INTERVAL '10 minutes',
    version = version + 1,
    updated_at = NOW()
WHERE seat_id = '4c38d4a9-8260-4e56-bc9b-3ecb453e0110'
  AND (
      status = 'AVAILABLE' 
      OR (status = 'HELD' AND hold_expires_at < NOW()) -- Re-claim naturally expired holds
  );

-- Step 3: Verify Affected Rows
-- If rows_updated == 1: Hold secured successfully! COMMIT.
-- If rows_updated == 0: Seat was grabbed by another user or is booked! ROLLBACK.
COMMIT;
```

**Why this guarantees safety**:
- In PostgreSQL and MySQL InnoDB, an `UPDATE` statement targeting a primary key row automatically acquires an **exclusive write lock (X-lock)** on that specific row.
- Even if 500 application server threads attempt this exact SQL statement concurrently, the database engine **serializes** their execution one by one on the row lock.
- The first transaction to acquire the lock observes `status = 'AVAILABLE'`, mutates the row to `HELD`, increments the `version`, and commits.
- The remaining 499 transactions queue behind the row lock. When they evaluate the `WHERE` clause, `status` is now `'HELD'` and `hold_expires_at > NOW()`. The condition fails, `rows_updated` evaluates to `0`, and the application server immediately returns `HTTP 409 Conflict` back to those users.

---

#### Layer 2: Final Payment & Ticket Issuance Guard
When the user submits payment, checkout validates that the caller still holds the seat before capturing payment:

```sql
BEGIN;

-- Lock the seat for update and verify hold ownership
SELECT seat_id, price_cents 
FROM seats
WHERE seat_id = $seat_id 
  AND status = 'HELD' 
  AND hold_id = $hold_id 
  AND hold_user_id = $user_id 
  AND hold_expires_at > NOW()
FOR UPDATE;

-- Transition seat to BOOKED
UPDATE seats 
SET status = 'BOOKED', 
    hold_id = NULL, 
    hold_user_id = NULL, 
    hold_expires_at = NULL, 
    version = version + 1
WHERE seat_id = $seat_id;

-- Insert permanent order and ticket
INSERT INTO orders (order_id, user_id, event_id, total_amount_cents, payment_status, idempotency_key)
VALUES ($order_id, $user_id, $event_id, $total_cents, 'SUCCEEDED', $idempotency_key);

INSERT INTO tickets (ticket_id, order_id, seat_id, barcode_hash, status)
VALUES ($ticket_id, $order_id, $seat_id, $barcode, 'ACTIVE');

COMMIT;
```

**Database Constraint Invariant**:
The `tickets` table contains `CONSTRAINT uq_ticket_seat_id UNIQUE (seat_id)`. Even if application code suffered a fatal bug, the database engine would reject any attempt to insert a duplicate ticket for the same seat, rolling back the entire transaction.

---

#### Layer 3: Fast In-Memory Redis Pre-Claim (Shielding the Database)
During the "Big Sale" peak, sending 2,000 competing write transactions/second to the database would cause severe lock contention and connection pool exhaustion. To prevent database saturation, an **in-memory atomic lock** in Redis Cluster acts as a gatekeeper:

```lua
-- Redis Lua Script executed atomically via EVALSHA
local seat_key = "event:" .. KEYS[1] .. ":seat:" .. KEYS[2]
local user_id = ARGV[1]
local hold_ttl_seconds = 600

-- Check if seat is already locked in Redis
if redis.call("EXISTS", seat_key) == 1 then
    return 0 -- Failed: seat currently locked or sold
else
    redis.call("SET", seat_key, user_id, "EX", hold_ttl_seconds)
    return 1 -- Success: fast in-memory lock acquired!
end
```
Only the single user who successfully acquires the Redis lock is permitted to execute the PostgreSQL update transaction. The other 199,999 competing requests are rejected at the in-memory cache layer in $< 2\text{ ms}$, shielding the primary database from 99.9% of lock contention.

---

## 6. System Architecture & "Big Sale" Survival Plan

### 6.1. End-to-End System Architecture Diagram

```
                              +---------------------------------------+
                              |         200,000 Active Users          |
                              |       (Browsers / Mobile Apps)        |
                              +---------------------------------------+
                                                  |
                                                  | HTTPS / TLS 1.3
                                                  v
                              +---------------------------------------+
                              |         Anycast DNS (Route 53)        |
                              +---------------------------------------+
                                                  |
                                                  v
                              +---------------------------------------+
                              |   Edge CDN & WAF (Cloudflare/Fastly)  |
                              |  - Static Seat Maps & Catalog Cached  |
                              |  - Bot Detection & DDoS Protection    |
                              +---------------------------------------+
                                                  |
                                                  v
                              +---------------------------------------+
                              |     Virtual Waiting Room (Queue)      |
                              |  - Admitted Users get Signed JWT      |
                              |  - Throttles Traffic to 500 users/min |
                              +---------------------------------------+
                                                  |
                                                  v
                              +---------------------------------------+
                              |   Application Load Balancer (ALB)     |
                              +---------------------------------------+
                                                  |
                        +-------------------------+-------------------------+
                        |                                                   |
                        v                                                   v
          +---------------------------+                       +---------------------------+
          |  App Server Fleet Node 1  |                       |  App Server Fleet Node N  |
          |  (Stateless API Cluster)  |                       |  (Stateless API Cluster)  |
          +---------------------------+                       +---------------------------+
                  |                 |                                   |                 |
     Seat Status  |                 | Fast In-Memory                    |                 |
     Bitmasks     |                 | Holds (SETNX)                     |                 |
                  v                 v                                   v                 v
          +-------------------------------------------------------------------------------+
          |                        Distributed Redis Cluster                              |
          |  - Fast Seat Availability Bitmaps & Inventory Caches                          |
          |  - Atomic Seat Hold Key Mutexes (`SETNX` with 10-Min TTL)                     |
          |  - Virtual Waiting Room Queue Token Verification                              |
          +-------------------------------------------------------------------------------+
                                            |
                                            | Verified Holds & Checkouts
                                            v
          +-------------------------------------------------------------------------------+
          |                         PgBouncer Connection Pooler                           |
          +-------------------------------------------------------------------------------+
                           |                                               |
              Strict ACID  |                                  Read-Only    | Catalog &
              Writes/Holds |                                  Queries      | History
                           v                                               v
          +-----------------------------------+               +---------------------------+
          |    Primary PostgreSQL Database    |  Replication  | PostgreSQL Read Replicas  |
          |  - Multi-AZ Hot Standby Failover  |-------------->| (Load-Balanced Query Pool)|
          |  - Strict Row Locks & Constraints | (Streaming)   |                           |
          +-----------------------------------+               +---------------------------+
                           |
                           | 201 Order Confirmed Event
                           v
          +-------------------------------------------------------------------------------+
          |                      Message Broker (RabbitMQ / AWS SQS)                      |
          |  - Topic: `order.confirmed` (Ticket PDF generation & Email dispatch)          |
          |  - Delayed Topic: `hold.check_expiration` (Scheduled sweep after 10 min)     |
          +-------------------------------------------------------------------------------+
                                            |
                                            v
          +-------------------------------------------------------------------------------+
          |                           Asynchronous Worker Fleet                           |
          |  - Generates Cryptographic QR Codes & PDF Tickets                             |
          |  - Sends Confirmation Emails & SMS via SendGrid/Twilio                        |
          |  - Periodically Sweeps Expired Holds in Database & Releases Redis Keys        |
          +-------------------------------------------------------------------------------+
```

---

### 6.2. Detailed Component Explanations & Big Sale Defense

#### 1. Edge CDN & Web Application Firewall (WAF)
- **Component**: Distributed Cloudflare / Fastly Points of Presence (PoPs).
- **Big Sale Defense**: Venue layouts, static stadium seat maps, performer biographies, and CSS/JS assets are cached at hundreds of worldwide edge locations with high TTLs. During the big sale, **95% of incoming GET requests** for static assets never reach the origin servers. The WAF inspects incoming requests, applying rate limiting per IP and blocking automated credential-stuffing and scalper scraping bots.

#### 2. Virtual Waiting Room (Cloudflare Waiting Room / Redis Token Queue)
- **Component**: Edge-based FIFO traffic valve.
- **Big Sale Defense**: When 200,000 fans arrive simultaneously at 10:00 AM, admitting them all at once would crash backend application servers and databases. The Virtual Waiting Room intercepts all users at the edge, assigning each user an encrypted, cryptographically signed queue position cookie/token (`queue_pos=42150; sig=...`). The queue systematically admits users at a controlled rate (e.g., 500 users every 30 seconds), perfectly matching the primary database's maximum write capacity. Users see a friendly countdown screen showing their estimated wait time.

#### 3. Application Load Balancers (ALB) & Stateless API Cluster
- **Component**: AWS ALB distributing to an Auto-Scaling Group of containerized (Node.js/Go) application instances across multiple Availability Zones.
- **Big Sale Defense**: Application servers maintain zero local state; user sessions are verified using self-contained signed JWTs. Pre-warmed auto-scaling clusters automatically expand from 5 instances to 50+ instances ahead of scheduled on-sale drops. Health checks (`GET /healthz`) automatically drop unhealthy or overloaded instances.

#### 4. Distributed In-Memory Cache (Redis Cluster)
- **Component**: Multi-node Redis Cluster configured with primary-replica replication across Availability Zones.
- **Big Sale Defense**:
  - **Seat Availability**: Stored as high-efficiency Redis Bitmaps or Hash sets (`event:{id}:seats`), allowing seat map status queries to be resolved in microseconds without querying Postgres.
  - **Atomic Pre-Holds**: Executes atomic `SETNX` commands to prevent redundant database row lock acquisition.
  - **Automatic Expiration**: Redis keys are set with `EX 600` (10 minutes) so that expired reservations automatically vanish from the hold cache.

#### 5. Database Connection Pooler (PgBouncer)
- **Component**: Lightweight connection pool manager deployed adjacent to PostgreSQL.
- **Big Sale Defense**: PostgreSQL creates a dedicated OS process per client connection, consuming significant memory. If 1,000 API worker threads open concurrent connections, Postgres suffers process starvation and context-switching churn. PgBouncer maintains a lean pool of 50–100 active connections to Postgres, multiplexing thousands of incoming API hold requests seamlessly without connection dropouts.

#### 6. Relational Database Tier (Primary & Read Replicas)
- **Component**: Managed PostgreSQL cluster (e.g., AWS RDS Aurora Multi-AZ) with 1 Primary Writer and 3 Read Replicas.
- **Big Sale Defense**: All read-heavy queries (browsing events, viewing order histories) are directed to Read Replicas. The Primary instance is exclusively reserved for high-priority write transactions (holds and purchases), maximizing available IOPS and transactional throughput.

#### 7. Asynchronous Message Broker & Worker Fleet
- **Component**: RabbitMQ / AWS SQS queues with dedicated worker microservices.
- **Big Sale Defense**: Heavy, non-blocking tasks—such as creating PDF ticket files, generating digital signatures, uploading barcodes to Cloud Storage, and emailing receipts—are offloaded to background message queues. The user receives immediate checkout confirmation ($< 150\text{ ms}$) without waiting for external email servers or PDF renderers.

---

### 6.3. The 10-Minute Hold Expiration Lifecycle
To prevent abandoned seats from remaining permanently locked:
1. When a hold is created, the system publishes a delayed event to RabbitMQ/SQS with a 10-minute visibility delay:
   `{ "event": "hold.check_expiration", "hold_id": "a82c4789...", "seat_id": "4c38d4a9..." }`
2. Exactly 10 minutes later, a background worker consumes the event and executes:
   ```sql
   UPDATE seats
   SET status = 'AVAILABLE', hold_id = NULL, hold_user_id = NULL, hold_expires_at = NULL
   WHERE seat_id = $seat_id AND hold_id = $hold_id AND status = 'HELD';
   ```
3. If the seat was already bought (`status = 'BOOKED'`), the update affects 0 rows and does nothing.
4. If the seat is still held, it is instantly restored to `'AVAILABLE'`, the Redis key is deleted, and the seat appears live on the seat map for the next fan in queue.

---

## 7. Architectural Trade-offs

### Trade-off 1: Pessimistic Row Locking vs. Optimistic Locking with Atomic Conditional Updates

- **Option A (Pessimistic Row Locking - `SELECT ... FOR UPDATE`)**:
  - The transaction queries the database and explicitly locks the seat row before inspecting its status, holding the exclusive lock until the transaction commits or aborts.
- **Option B (Optimistic Locking via Atomic Conditional `UPDATE` - Chosen)**:
  - The transaction issues an immediate `UPDATE seats SET status = 'HELD' WHERE seat_id = $1 AND status = 'AVAILABLE'`, checking whether `rows_updated == 1`.
- **Engineering Evaluation**:
  - *Pros of Option B*: Significantly shorter lock retention times. In pessimistic locking, network latency between the app server and database keeps the lock active across multiple round trips. In Option B, the row lock is acquired and released within the single `UPDATE` execution, dramatically reducing lock wait queue depths and eliminating deadlocks.
  - *Cons of Option B*: In scenarios where complex business logic must be evaluated prior to updating, optimistic conditional updates can lead to high application retry rates. However, for seat reservation, the criteria are simple and binary (`status == 'AVAILABLE'`).
- **Conclusion**: Option B (Atomic Conditional Update) was selected because it maximizes transactional throughput under the high concurrency of the 20,000-seat big sale.

---

### Trade-off 2: Distributed In-Memory Holds (Redis) vs. Direct Relational Database Holds

- **Option A (Pure Relational Database Holds)**:
  - All seat hold requests bypass Redis and write directly to PostgreSQL.
- **Option B (Two-Tier Hybrid: In-Memory Redis Pre-Claim + PostgreSQL Persistence - Chosen)**:
  - Application servers first attempt an atomic in-memory reservation via Redis (`SETNX` with 10-minute TTL). Only if Redis succeeds is the PostgreSQL update transaction executed.
- **Engineering Evaluation**:
  - *Pros of Option B*: Extreme resilience under flash crowds. When 200,000 users attempt to reserve 20,000 seats, over 180,000 requests fail immediately at the ultra-fast Redis layer ($< 2\text{ ms}$) without consuming database connections, disk IOPS, or row lock queues.
  - *Cons of Option B*: Introduces dual-state synchronization complexity. If the Redis write succeeds but the subsequent Postgres transaction fails (e.g., database timeout), application logic must cleanly delete the Redis key (compensating action) to prevent an orphaned hold.
- **Conclusion**: Option B was selected because shielding the primary database from 200,000 concurrent lock contentions is mandatory to prevent total platform outage during high-demand on-sale drops.

---

### Trade-off 3: Virtual Waiting Room (Queue Throttling) vs. Pure Unconstrained Horizontal Scaling

- **Option A (Unconstrained Auto-Scaling)**:
  - Provision massive application server clusters and scalable sharded databases designed to process all 200,000 incoming user requests simultaneously without queuing.
- **Option B (Edge Virtual Waiting Room / Admission Control - Chosen)**:
  - Enqueue all 200,000 users at the edge CDN, metering admission into the active booking funnel at a deterministic rate of 500 users every 30 seconds.
- **Engineering Evaluation**:
  - *Pros of Option B*: Guarantees system stability and deterministic performance. Under Option B, the backend operates within a proven, pre-tested capacity envelope (low latency, zero 500 errors). It also enforces authentic fairness (first-come, first-served) and protects against scalper bot swarms.
  - *Cons of Option B*: Adds an extra layer of infrastructure (queue management, queue status polling) and requires users to wait in a virtual line rather than immediately accessing the site.
  - *Pros/Cons of Option A*: Immensely expensive (idle cloud resources 99% of the year), and ultimately constrained by the physical limits of relational database write locks on shared inventory tables.
- **Conclusion**: The Virtual Waiting Room is the industry-standard architecture for high-demand ticketing (used by Ticketmaster and AXS) because it converts an uncontrolled traffic spike into a predictable, stable stream.
