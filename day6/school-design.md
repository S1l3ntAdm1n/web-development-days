# School Database System Design

A comprehensive architectural explanation of the database schema, table entities, relationships, performance indexing, and database technology selection.

---

## 1. Table Explanations

- **`students`**:
  - **Purpose**: Stores records of individual students registered in the academic institution.
  - **Columns**:
    - `student_id`: Primary key uniquely identifying each student (`INTEGER PRIMARY KEY AUTOINCREMENT`).
    - `name`: Full name of the student (`TEXT NOT NULL`).
    - `email`: Contact email address (`TEXT NOT NULL UNIQUE`), preventing multiple student accounts with the same email.

- **`courses`**:
  - **Purpose**: Represents catalog courses offered by the academic institution.
  - **Columns**:
    - `course_id`: Primary key uniquely identifying each course (`INTEGER PRIMARY KEY AUTOINCREMENT`).
    - `title`: Name/title of the course (`TEXT NOT NULL`).
    - `code`: Official alphanumeric course code (e.g., `'CS101'`, `TEXT NOT NULL UNIQUE`).

- **`enrolments`**:
  - **Purpose**: The junction (associative) table that captures the many-to-many relationship between students and courses, along with instance-specific academic outcomes.
  - **Columns**:
    - `enrolment_id`: Primary key for the specific enrolment record (`INTEGER PRIMARY KEY AUTOINCREMENT`).
    - `student_id`: Foreign key referencing `students(student_id)` (`INTEGER NOT NULL`).
    - `course_id`: Foreign key referencing `courses(course_id)` (`INTEGER NOT NULL`).
    - `grade`: Academic letter grade or score attained (`TEXT`), nullable initially until a grade is awarded.
    - **Constraints**: A composite constraint `UNIQUE (student_id, course_id)` prevents duplicate enrolments for the same student on the same course.

---

## 2. Relationships & Join Table Architecture

- **Many-to-Many (M:N) Relationship**:
  - The relationship between **Students** and **Courses** is many-to-many: a single student can enrol in multiple courses, and a single course can enrol multiple students.
  - Relational databases cannot directly store many-to-many associations in a single table without violating database normalization rules.

- **One-to-Many (1:N) Relationships**:
  - **`students` to `enrolments` (1:N)**: One student can have zero, one, or many enrolment records.
  - **`courses` to `enrolments` (1:N)**: One course can have zero, one, or many enrolment records.

- **Why a Join Table is Needed**:
  - **Eliminates Repeating Groups (1NF)**: Storing an array or comma-separated string of course IDs inside a student row violates First Normal Form (1NF), making indexing, filtering, and foreign key verification impossible.
  - **Prevents Schema Bloat**: Adding multiple course columns (`course_1`, `course_2`, etc.) introduces arbitrary limits, wastes space with NULL values, and complicates query logic.
  - **Enforces Referential Integrity**: The join table uses foreign keys (`FOREIGN KEY (student_id) REFERENCES students(...)` and `FOREIGN KEY (course_id) REFERENCES courses(...)`) with cascading deletes, ensuring invalid student or course references cannot exist.
  - **Holds Relationship-Specific Attributes**: The grade earned by a student on a course belongs neither to the student alone nor to the course alone; it is an attribute of the *enrolment instance* and naturally belongs in the join table.
  - **Prevents Duplicate Enrolments**: The `UNIQUE (student_id, course_id)` constraint cleanly prohibits double-enrolment at the database level.

---

## 3. Recommended Index & Justification

- **Index**:
  ```sql
  CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);
  ```
- **Reason**:
  - In SQLite, the table's composite constraint `UNIQUE (student_id, course_id)` automatically generates an index with `student_id` as the leading column.
  - While this default index quickly satisfies queries filtering by `student_id`, queries filtering or joining by `course_id` (e.g. `WHERE course_id = ?` or `JOIN enrolments ON courses.course_id = enrolments.course_id`) cannot effectively use the index because `course_id` is not the leftmost column.
  - Creating `idx_enrolments_course_id` eliminates full table scans ($O(N)$) when looking up all students on a given course or counting enrolments per course (`GROUP BY course_id`), reducing lookup times to logarithmic complexity ($O(\log N)$).

*(Additionally, an index on `students(name)` via `CREATE INDEX idx_students_name ON students(name);` is highly beneficial for accelerating student searches by name).*

---

## 4. Architectural Choice: SQL vs. NoSQL

For this school management system, **SQL (Relational Database)** is the optimal and correct architectural choice. The domain data is deeply structured and relational, characterized by clear entities (`students`, `courses`) with a many-to-many relationship (`enrolments`) that demands strict referential integrity and ACID compliance to prevent invalid enrollments, duplicate records, or data anomalies when updating grades. In a NoSQL document database, one would be forced to either embed data (leading to massive duplication and synchronization headaches whenever a course title changes) or maintain manual references without database-enforced foreign keys. SQL provides native declarative joins (`JOIN`, `LEFT JOIN`), foreign key cascading, composite unique constraints, and aggregate functions (`GROUP BY`, `COUNT`) that ensure complete consistency, data integrity, and performant querying.
