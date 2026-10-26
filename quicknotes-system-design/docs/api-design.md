# QuickNotes REST API Specification

A comprehensive, production-grade RESTful API specification for **QuickNotes**, defining resource endpoints, request/response contracts, serialization formats, validation constraints, and standardized error handling.

---

## 1. Overview & General Conventions

- **Base URL**: `https://api.quicknotes.io/api/v1`
- **Protocol**: HTTPS (TLS 1.3 enforced)
- **Data Serialization**: JSON (`application/json; charset=utf-8`)
- **Authentication**: Bearer Token in standard HTTP header:
  ```http
  Authorization: Bearer <jwt_access_token>
  ```
- **Idempotency**: All `GET`, `PUT`, and `DELETE` operations are fully idempotent.

---

## 2. API Endpoints Summary

| Method | Endpoint Path | Description | Success Status |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/v1/notes` | Retrieves a paginated list of notes for the authenticated user, supporting optional search keyword and tag filters. | `200 OK` |
| **`GET`** | `/api/v1/notes/:id` | Retrieves a specific note by its unique identifier, including its associated tags and metadata. | `200 OK` |
| **`POST`** | `/api/v1/notes` | Creates a new note record with title, optional body, and optional initial tag associations. | `201 Created` |
| **`PUT`** | `/api/v1/notes/:id` | Replaces all modifiable fields of an existing note (full update). | `200 OK` |
| **`PATCH`** | `/api/v1/notes/:id` | Modifies one or more specific fields of an existing note (partial update). | `200 OK` |
| **`DELETE`** | `/api/v1/notes/:id` | Permanently deletes a note and its junction tag associations. | `204 No Content` |
| **`GET`** | `/api/v1/tags` | Retrieves all tags created or utilized by the authenticated user with note counts. | `200 OK` |
| **`POST`** | `/api/v1/notes/:id/tags` | Attaches one or more tags to an existing note. | `201 Created` |

---

## 3. Detailed Endpoint Contracts

### 3.1. List Notes (`GET /api/v1/notes`)
- **Method**: `GET`
- **Path**: `/api/v1/notes`
- **Query Parameters**:
  - `page` *(integer, optional, default: 1)*: Page number for pagination.
  - `limit` *(integer, optional, default: 10, max: 50)*: Number of notes per page.
  - `q` *(string, optional)*: Keyword query to match in title or body.
  - `tag` *(string, optional)*: Filter notes associated with a specific tag name.
- **Success Status**: `200 OK`

#### Example Request
```http
GET /api/v1/notes?page=1&limit=2&tag=architecture HTTP/1.1
Host: api.quicknotes.io
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

#### Example Response Body
```json
{
  "status": "success",
  "data": {
    "notes": [
      {
        "id": "c7a84e20-5692-49d7-8d19-482d499ec241",
        "user_id": "u109283-a7b2-4cd8-b0e1",
        "title": "System Architecture Review",
        "body": "Ensure primary-replica database replication lag remains under 100ms during peak writes.",
        "tags": [
          {
            "id": 14,
            "name": "architecture",
            "color": "#2563eb"
          },
          {
            "id": 8,
            "name": "infrastructure",
            "color": "#0d9488"
          }
        ],
        "created_at": "2026-10-26T20:15:30.000Z",
        "updated_at": "2026-10-26T21:04:12.000Z"
      },
      {
        "id": "f891b901-2134-4b58-9a4d-0f1352a177e3",
        "user_id": "u109283-a7b2-4cd8-b0e1",
        "title": "Cache Invalidation Strategy",
        "body": "Implement write-through caching in Redis for active note feeds to maintain high cache-hit ratios.",
        "tags": [
          {
            "id": 14,
            "name": "architecture",
            "color": "#2563eb"
          }
        ],
        "created_at": "2026-10-26T18:40:00.000Z",
        "updated_at": "2026-10-26T18:40:00.000Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 2,
      "total_items": 47,
      "total_pages": 24,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

---

### 3.2. Create a Note (`POST /api/v1/notes`)
- **Method**: `POST`
- **Path**: `/api/v1/notes`
- **Request Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Validation Constraints**:
  - `title`: Required, string, trimmed, min length 1, max length 100 characters.
  - `body`: Optional, string, max length 10,000 characters.
  - `tag_ids`: Optional, array of positive integers representing existing tags.
- **Success Status**: `201 Created`
- **Response Headers**:
  - `Location: /api/v1/notes/d48b1f09-7d88-44fb-9d21-f09b5791c102`

#### Example Request Body
```json
{
  "title": "Distributed Caching Guidelines",
  "body": "All read queries for user note lists should first check the Redis cluster before querying the database read replica.",
  "tag_ids": [14, 22]
}
```

#### Example Response Body
```json
{
  "status": "success",
  "data": {
    "note": {
      "id": "d48b1f09-7d88-44fb-9d21-f09b5791c102",
      "user_id": "u109283-a7b2-4cd8-b0e1",
      "title": "Distributed Caching Guidelines",
      "body": "All read queries for user note lists should first check the Redis cluster before querying the database read replica.",
      "tags": [
        {
          "id": 14,
          "name": "architecture",
          "color": "#2563eb"
        },
        {
          "id": 22,
          "name": "performance",
          "color": "#16a34a"
        }
      ],
      "created_at": "2026-10-26T22:30:00.000Z",
      "updated_at": "2026-10-26T22:30:00.000Z"
    }
  }
}
```

---

### 3.3. Get Note by ID (`GET /api/v1/notes/:id`)
- **Method**: `GET`
- **Path**: `/api/v1/notes/:id`
- **Description**: Returns the details of a single note owned by the authenticated user.
- **Success Status**: `200 OK`

---

### 3.4. Full Update of Note (`PUT /api/v1/notes/:id`)
- **Method**: `PUT`
- **Path**: `/api/v1/notes/:id`
- **Description**: Replaces the entire note resource with the supplied payload.
- **Success Status**: `200 OK`

---

### 3.5. Partial Update of Note (`PATCH /api/v1/notes/:id`)
- **Method**: `PATCH`
- **Path**: `/api/v1/notes/:id`
- **Description**: Modifies only the provided fields (e.g., updating just the `title` or just the `body`).
- **Success Status**: `200 OK`

---

### 3.6. Delete Note (`DELETE /api/v1/notes/:id`)
- **Method**: `DELETE`
- **Path**: `/api/v1/notes/:id`
- **Description**: Removes the note permanently from storage.
- **Success Status**: `204 No Content` (Empty response body).

---

## 4. Standardized Error Handling

All error responses return a standardized RFC 7807-compatible JSON payload containing machine-readable error codes and human-readable diagnostics.

### Standard Error Status Codes

| Status Code | Reason Phrase | Trigger Condition |
| :--- | :--- | :--- |
| **`400 Bad Request`** | Bad Request | Syntactically malformed JSON body, invalid query parameter format, or missing required payload. |
| **`401 Unauthorized`** | Unauthorized | Missing, expired, malformed, or invalid `Authorization: Bearer <token>` header. |
| **`403 Forbidden`** | Forbidden | The authenticated user does not have permission to access or modify the specified note or resource. |
| **`404 Not Found`** | Not Found | The requested resource URI or note ID does not exist in the system. |
| **`422 Unprocessable Entity`** | Validation Error | Syntactically valid JSON that violates domain validation rules (e.g., title exceeding 100 characters). |
| **`500 Internal Server Error`** | Server Error | Unhandled server exception, database connection failure, or downstream service timeout. |

---

### Standard Error JSON Schema & Examples

#### 1. Example 400 Bad Request (Malformed JSON Payload)
```json
{
  "status": "error",
  "error": {
    "code": "BAD_REQUEST",
    "message": "Malformed JSON payload in request body.",
    "timestamp": "2026-10-26T22:45:10.120Z",
    "path": "/api/v1/notes"
  }
}
```

#### 2. Example 401 Unauthorized (Missing or Invalid Token)
```json
{
  "status": "error",
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Authentication credentials were missing or invalid. Please provide a valid Bearer token.",
    "timestamp": "2026-10-26T22:45:15.842Z",
    "path": "/api/v1/notes"
  }
}
```

#### 3. Example 403 Forbidden (Unauthorized Resource Access)
```json
{
  "status": "error",
  "error": {
    "code": "FORBIDDEN_ACCESS",
    "message": "You do not have permission to modify or delete this note.",
    "timestamp": "2026-10-26T22:45:20.301Z",
    "path": "/api/v1/notes/c7a84e20-5692-49d7-8d19-482d499ec241"
  }
}
```

#### 4. Example 404 Not Found (Resource Does Not Exist)
```json
{
  "status": "error",
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "Note with ID 'e1122334-0000-0000-0000-000000000000' was not found.",
    "timestamp": "2026-10-26T22:45:25.619Z",
    "path": "/api/v1/notes/e1122334-0000-0000-0000-000000000000"
  }
}
```

#### 5. Example 422 Unprocessable Entity (Field-Level Validation Failure)
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request payload failed input validation constraints.",
    "timestamp": "2026-10-26T22:45:30.450Z",
    "path": "/api/v1/notes",
    "details": [
      {
        "field": "title",
        "rule": "max_length",
        "message": "Title must be 100 characters or fewer (received 142 characters)."
      }
    ]
  }
}
```

#### 6. Example 500 Internal Server Error (Server Failure)
```json
{
  "status": "error",
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected server error occurred while processing your request. Please try again later.",
    "timestamp": "2026-10-26T22:45:35.918Z",
    "path": "/api/v1/notes",
    "incident_id": "err-f921-99ab"
  }
}
```
