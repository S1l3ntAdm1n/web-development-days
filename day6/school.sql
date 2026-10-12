-- ============================================================================
-- Day 6: School Database Schema & Queries (SQLite Compatible)
-- ============================================================================

-- Enable foreign key constraint support in SQLite
PRAGMA foreign_keys = ON;

-- Drop existing tables to allow re-running script cleanly
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- ============================================================================
-- 1. CREATE TABLE Statements
-- ============================================================================

-- Students table
CREATE TABLE students (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

-- Courses table
CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE
);

-- Enrolments junction table (Many-to-Many relationship with grade attribute)
CREATE TABLE enrolments (
    enrolment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    -- Prevent duplicate enrolments: same student cannot enrol on same course twice
    UNIQUE (student_id, course_id)
);

-- ============================================================================
-- 2. INSERT Sample Data (At least 3 students, 3 courses, 5 enrolments)
-- ============================================================================

-- Insert Students (4 students: 3 enrolled, 1 without enrolments)
INSERT INTO students (name, email) VALUES
    ('Alice Smith', 'alice.smith@example.com'),
    ('Bob Jones', 'bob.jones@example.com'),
    ('Charlie Brown', 'charlie.brown@example.com'),
    ('Diana Prince', 'diana.prince@example.com');

-- Insert Courses (3 courses)
INSERT INTO courses (title, code) VALUES
    ('Introduction to Computer Science', 'CS101'),
    ('Web Development Essentials', 'WEB201'),
    ('Database Systems', 'DB301');

-- Insert Enrolments (5 enrolments linking students and courses with grades)
INSERT INTO enrolments (student_id, course_id, grade) VALUES
    (1, 1, 'A'),   -- Alice enrolled in CS101
    (1, 2, 'B+'),  -- Alice enrolled in WEB201
    (2, 1, 'B'),   -- Bob enrolled in CS101
    (2, 3, 'A-'),  -- Bob enrolled in DB301
    (3, 2, 'C+');  -- Charlie enrolled in WEB201

-- ============================================================================
-- 3. Required Queries
-- ============================================================================

-- Query 1: All courses for one student (by name)
SELECT 
    s.name AS student_name,
    c.code AS course_code,
    c.title AS course_title,
    e.grade
FROM students s
JOIN enrolments e ON s.student_id = e.student_id
JOIN courses c ON e.course_id = c.course_id
WHERE s.name = 'Alice Smith';

-- Query 2: All students on one course
SELECT 
    c.title AS course_title,
    s.name AS student_name,
    s.email AS student_email,
    e.grade
FROM courses c
JOIN enrolments e ON c.course_id = e.course_id
JOIN students s ON e.student_id = s.student_id
WHERE c.title = 'Introduction to Computer Science';

-- Query 3: The number of students per course (includes courses with 0 students)
SELECT 
    c.course_id,
    c.code AS course_code,
    c.title AS course_title,
    COUNT(e.student_id) AS enrolled_students_count
FROM courses c
LEFT JOIN enrolments e ON c.course_id = e.course_id
GROUP BY c.course_id, c.code, c.title
ORDER BY c.course_id;

-- Query 4: Students who have no enrolments
SELECT 
    s.student_id,
    s.name,
    s.email
FROM students s
LEFT JOIN enrolments e ON s.student_id = e.student_id
WHERE e.enrolment_id IS NULL;

-- Query 5: An update of one enrolment's grade
UPDATE enrolments
SET grade = 'A+'
WHERE student_id = (SELECT student_id FROM students WHERE name = 'Alice Smith')
  AND course_id = (SELECT course_id FROM courses WHERE code = 'WEB201');

-- Verification of Query 5: Check updated grade
SELECT 
    s.name AS student_name,
    c.title AS course_title,
    e.grade AS updated_grade
FROM enrolments e
JOIN students s ON e.student_id = s.student_id
JOIN courses c ON e.course_id = c.course_id
WHERE s.name = 'Alice Smith' AND c.code = 'WEB201';
