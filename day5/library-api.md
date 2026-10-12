# Library Books REST API Design

A RESTful API specification for managing a library's book resources.

## Overview

- **Base URL**: `https://api.library.example.com/v1`
- **Resource**: `books`
- **Content Type**: `application/json`

## Endpoints

### 1. List Books

- **Method**: `GET`
- **Path**: `/books`
- **Description**: Retrieves a list of all books in the library catalog.
- **Request Body**: None (not needed for GET requests).
- **Success Status Code**: `200 OK`

### 2. Get One Book

- **Method**: `GET`
- **Path**: `/books/{id}`
- **Description**: Retrieves the complete details of a specific book by its unique ID.
- **Request Body**: None (not needed for GET requests).
- **Success Status Code**: `200 OK`

### 3. Create a Book

- **Method**: `POST`
- **Path**: `/books`
- **Description**: Adds a new book to the library catalog.
- **Example Request Body**:
  ```json
  {
    "title": "To Kill a Mockingbird",
    "author": "Harper Lee",
    "isbn": "978-0061120084",
    "publishedYear": 1960,
    "genre": "Fiction",
    "availableCopies": 4
  }
  ```
- **Success Status Code**: `201 Created`

### 4. Update a Book

- **Method**: `PUT`
- **Path**: `/books/{id}`
- **Description**: Updates the information of an existing book identified by its unique ID.
- **Example Request Body**:
  ```json
  {
    "title": "To Kill a Mockingbird (Anniversary Edition)",
    "author": "Harper Lee",
    "isbn": "978-0061120084",
    "publishedYear": 1960,
    "genre": "Classic Fiction",
    "availableCopies": 7
  }
  ```
- **Success Status Code**: `200 OK`

### 5. Delete a Book

- **Method**: `DELETE`
- **Path**: `/books/{id}`
- **Description**: Permanently removes a book from the library catalog by its unique ID.
- **Request Body**: None (not needed for DELETE requests).
- **Success Status Code**: `204 No Content`

### 6. List Books by Author (Query Parameter)

- **Method**: `GET`
- **Path**: `/books?author={authorName}`
- **Description**: Retrieves all books written by a specific author filtered via a query parameter.
- **Request Body**: None (not needed for GET requests).
- **Success Status Code**: `200 OK`

## Error Codes

### 400 Bad Request

- **Description**: The server cannot process the request due to invalid client input, missing required parameters, or malformed JSON syntax.
- **Example Scenario**: A client sends a `POST /books` request with a missing required field (e.g. omitting `"title"`) or supplying an invalid data type (e.g. `"publishedYear": "nineteen-sixty"` instead of an integer).

### 404 Not Found

- **Description**: The requested resource cannot be found on the server because no record exists with the provided identifier.
- **Example Scenario**: A client issues a `GET /books/999` or `DELETE /books/999` request, but no book with ID `999` exists in the database.
