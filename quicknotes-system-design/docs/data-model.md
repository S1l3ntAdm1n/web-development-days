# QuickNotes Data Model Specification

A rigorous relational data model and schema definition for **QuickNotes**, specifying entities, column types, integrity constraints, relationship semantics, indexing strategies, and database technology selection.

---

## 1. Entity Definitions & Schema Overview

The QuickNotes persistence model comprises four primary relational entities:

### 1.1. `users`
Stores registered user accounts, authentication credentials, and account lifecycle timestamps.
- **`user_id`**: `UUID` — Primary Key. Uniquely identifies each user across the system.
- **`username`**: `VARCHAR(50)` — Unique, Not Null. Lowercase unique handle.
- **`email`**: `VARCHAR(255)` — Unique, Not Null. User email address used for login and notifications.
- **`password_hash`**: `VARCHAR(255)` — Not Null. Cryptographically hashed password (e.g., Argon2id or bcrypt).
- **`created_at`**: `TIMESTAMPTZ` — Default `CURRENT_TIMESTAMP`, Not Null.
- **`updated_at`**: `TIMESTAMPTZ` — Default `CURRENT_TIMESTAMP`, Not Null.

---

### 1.2. `notes`
Represents individual text notes created and owned by users.
- **`note_id`**: `UUID` — Primary Key. Uniquely identifies each note.
- **`user_id`**: `UUID` — Foreign Key referencing `users(user_id)` with `ON DELETE CASCADE`. Not Null.
- **`title`**: `VARCHAR(100)` — Not Null. Title with an enforced maximum length of 100 characters.
- **`body`**: `TEXT` — Optional text content of the note.
- **`is_pinned`**: `BOOLEAN` — Default `FALSE`, Not Null. Flags notes pinned to the top of the user's list.
- **`created_at`**: `TIMESTAMPTZ` — Default `CURRENT_TIMESTAMP`, Not Null.
- **`updated_at`**: `TIMESTAMPTZ` — Default `CURRENT_TIMESTAMP`, Not Null.

---

### 1.3. `tags`
Stores categorization labels that users can define and attach to notes.
- **`tag_id`**: `SERIAL` (`INTEGER`) — Primary Key. Auto-incrementing identifier.
- **`user_id`**: `UUID` — Foreign Key referencing `users(user_id)` with `ON DELETE CASCADE`. Not Null.
- **`name`**: `VARCHAR(30)` — Not Null. Lowercase tag label (e.g., `work`, `architecture`, `personal`).
- **`color`**: `VARCHAR(7)` — Default `'#2563eb'`. Hex color code for UI rendering.
- **`created_at`**: `TIMESTAMPTZ` — Default `CURRENT_TIMESTAMP`, Not Null.
- *Constraint*: `UNIQUE (user_id, name)` — Prevents duplicate tag names for the same user.

---

### 1.4. `note_tags` (Junction Table)
The associative junction table that resolves the many-to-many ($M:N$) relationship between `notes` and `tags`.
- **`note_id`**: `UUID` — Foreign Key referencing `notes(note_id)` with `ON DELETE CASCADE`. Not Null.
- **`tag_id`**: `INTEGER` — Foreign Key referencing `tags(tag_id)` with `ON DELETE CASCADE`. Not Null.
- **`attached_at`**: `TIMESTAMPTZ` — Default `CURRENT_TIMESTAMP`, Not Null.
- *Primary Key*: Composite `PRIMARY KEY (note_id, tag_id)` — Guarantees that a tag cannot be attached to the same note more than once.

---

## 2. Entity Relationships Explanation

```
   +--------------+                 +--------------+
   |    users     | 1             * |    notes     |
   |--------------|-----------------|--------------|
   | user_id (PK) |                 | note_id (PK) |
   +--------------+                 | user_id (FK) |
          | 1                       +--------------+
          |                                | *
          |                                |
          | *                       +---------------+
          |                         |   note_tags   |
   +--------------+                 |---------------|
   |     tags     | 1             * | note_id (FK)  |
   |--------------|-----------------| tag_id  (FK)  |
   | tag_id  (PK) |                 +---------------+
   | user_id (FK) |
   +--------------+
```

### One-to-Many Relationships ($1:N$):
1. **`users` $\rightarrow$ `notes`**:
   - A single user can create zero, one, or many notes.
   - Each note belongs strictly to exactly one owning user.
   - Enforced by `notes.user_id` referencing `users.user_id`. When a user deletes their account, cascading deletion (`ON DELETE CASCADE`) ensures all their notes are cleanly purged.

2. **`users` $\rightarrow$ `tags`**:
   - A user can define zero, one, or many custom tags.
   - Each tag belongs to a single user namespace, preventing tag collisions across users.
   - Enforced by `tags.user_id` referencing `users.user_id` with `ON DELETE CASCADE`.

### Many-to-Many Relationship ($M:N$):
3. **`notes` $\leftrightarrow$ `tags` (via `note_tags`)**:
   - A single note can be categorized under multiple tags (e.g., both `#architecture` and `#work`).
   - A single tag can be linked to multiple notes.
   - Direct many-to-many associations cannot be represented cleanly in relational normalization without repeating groups or array anti-patterns.
   - The junction table `note_tags` breaks this down into two clean $1:N$ relationships (`notes` $\rightarrow$ `note_tags` and `tags` $\rightarrow$ `note_tags`).
   - Composite primary key `(note_id, tag_id)` prevents redundant linkages.

---

## 3. SQL DDL Statements (`CREATE TABLE`)

```sql
-- Enable UUID extension (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Notes Table
CREATE TABLE notes (
    note_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title VARCHAR(100) NOT NULL,
    body TEXT,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notes_user FOREIGN KEY (user_id) 
        REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_title_length CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 100)
);

-- 3. Tags Table
CREATE TABLE tags (
    tag_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    name VARCHAR(30) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#2563eb',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tags_user FOREIGN KEY (user_id) 
        REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT uq_user_tag UNIQUE (user_id, name),
    CONSTRAINT chk_tag_name CHECK (char_length(trim(name)) > 0)
);

-- 4. Note-Tags Junction Table
CREATE TABLE note_tags (
    note_id UUID NOT NULL,
    tag_id INTEGER NOT NULL,
    attached_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (note_id, tag_id),
    CONSTRAINT fk_notetags_note FOREIGN KEY (note_id) 
        REFERENCES notes(note_id) ON DELETE CASCADE,
    CONSTRAINT fk_notetags_tag FOREIGN KEY (tag_id) 
        REFERENCES tags(tag_id) ON DELETE CASCADE
);
```

---

## 4. Example SQL Queries

### Query 1: Fetch Notes with Aggregated Tags (`JOIN`)
Fetches all notes for an authenticated user with their associated tags aggregated into a JSON array, ordered by pinned status and latest update timestamp.

```sql
SELECT 
    n.note_id,
    n.title,
    n.body,
    n.is_pinned,
    n.created_at,
    n.updated_at,
    COALESCE(
        json_agg(
            json_build_object('id', t.tag_id, 'name', t.name, 'color', t.color)
        ) FILTER (WHERE t.tag_id IS NOT NULL), 
        '[]'::json
    ) AS tags
FROM notes n
LEFT JOIN note_tags nt ON n.note_id = nt.note_id
LEFT JOIN tags t ON nt.tag_id = t.tag_id
WHERE n.user_id = 'u109283-a7b2-4cd8-b0e1'
GROUP BY n.note_id
ORDER BY n.is_pinned DESC, n.updated_at DESC
LIMIT 10 OFFSET 0;
```

---

### Query 2: Full-Text Keyword Search Across User Notes
Performs case-insensitive keyword filtering across both title and body fields with pagination.

```sql
SELECT 
    note_id,
    title,
    body,
    created_at,
    updated_at
FROM notes
WHERE user_id = 'u109283-a7b2-4cd8-b0e1'
  AND (title ILIKE '%architecture%' OR body ILIKE '%architecture%')
ORDER BY updated_at DESC
LIMIT 10 OFFSET 0;
```

---

### Query 3: Tag Usage Statistics
Calculates note count per tag for a user to display a tag sidebar or usage cloud.

```sql
SELECT 
    t.tag_id,
    t.name,
    t.color,
    COUNT(nt.note_id) AS total_notes
FROM tags t
LEFT JOIN note_tags nt ON t.tag_id = nt.tag_id
WHERE t.user_id = 'u109283-a7b2-4cd8-b0e1'
GROUP BY t.tag_id, t.name, t.color
ORDER BY total_notes DESC, t.name ASC;
```

---

## 5. Performance Indexing & Justifications

### Recommended Composite Indexes:

```sql
-- 1. Accelerates user note list retrieval and sorting
CREATE INDEX idx_notes_user_updated 
ON notes (user_id, is_pinned DESC, updated_at DESC);

-- 2. Accelerates reverse tag lookups (finding all notes with a given tag)
CREATE INDEX idx_note_tags_tag_id 
ON note_tags (tag_id, note_id);
```

### Reason & Technical Justification:
- **`idx_notes_user_updated`**: The most frequent query in QuickNotes is loading a user's recent notes list (`WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC`). Without an index, the database engine must execute a full table scan ($O(N)$) across all users' notes and perform an expensive in-memory sort ($O(M \log M)$). By indexing `(user_id, is_pinned DESC, updated_at DESC)` together, PostgreSQL performs a direct B-Tree index range scan ($O(\log N)$) that already returns rows in the exact pre-sorted order required by the `LIMIT 10` clause, cutting query latency from hundreds of milliseconds to under 2 milliseconds.
- **`idx_note_tags_tag_id`**: The primary key on `note_tags` (`note_id, tag_id`) automatically indexes `note_id` as the leading column. However, filtering notes by a tag (`WHERE tag_id = ?`) cannot use that index efficiently because `tag_id` is the secondary column. Creating `idx_note_tags_tag_id` allows immediate logarithmic lookups when clicking a tag in the UI to view all associated notes.

---

## 6. Architectural Choice: SQL vs. NoSQL

For QuickNotes, a **Relational SQL Database (PostgreSQL)** is the optimal and correct architectural choice over a NoSQL document or key-value store. 

The domain data is strictly relational and highly structured: notes have a strict $1:N$ ownership by users and an $M:N$ relationship with tags. Relational databases enforce referential integrity natively (`FOREIGN KEY ... ON DELETE CASCADE`), guaranteeing that deleting a note automatically cleans up its junction associations and preventing orphaned records. Furthermore, SQL provides native declarative joins (`LEFT JOIN`), aggregation (`json_agg`, `COUNT`), and ACID transaction guarantees that ensure multi-table updates (such as updating a note and its tags simultaneously) remain atomic and consistent. In contrast, a NoSQL document database would require either embedding tags (causing data duplication and synchronization nightmares whenever a tag name or color is edited) or implementing manual client-side joins without integrity guarantees. Therefore, PostgreSQL delivers the ideal balance of consistency, normalized integrity, and low-latency indexed queries.
