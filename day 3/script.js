
let notes = [
    { id: 1, text: "Buy milk and bread", category: "personal" },
    { id: 2, text: "Finish the Day 3 assignment", category: "study" },
    { id: 3, text: "Email the project report to Grace", category: "work" },
    { id: 4, text: "Revise JavaScript arrays", category: "study" },
    { id: 5, text: "Call mum", category: "personal" },
];



function searchNotes(word) {
    const searchTerm = word.toLowerCase();
    return notes.filter((note) => note.text.toLowerCase().includes(searchTerm));
}


function longestNote() {
    if (notes.length === 0) {
        return null;
    }

    let longest = notes[0];
    for (let i = 1; i < notes.length; i++) {
        if (notes[i].text.length > longest.text.length) {
            longest = notes[i];
        }
    }
    return longest;
}


function countByCategory() {
    const counts = {};
    for (const note of notes) {
        const category = note.category;
        if (counts[category]) {
            counts[category]++;
        } else {
            counts[category] = 1;
        }
    }
    return counts;
}


function getSummary() {
    const counts = countByCategory();
    const total = notes.length;
    const noteWord = total === 1 ? "note" : "notes";


    const preferredOrder = ["personal", "work", "study"];
    const categories = Object.keys(counts).sort((a, b) => {
        const idxA = preferredOrder.indexOf(a);
        const idxB = preferredOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    const categoryDetails = categories
        .map((category) => `${counts[category]} ${category}`)
        .join(", ");

    return categoryDetails
        ? `${total} ${noteWord}: ${categoryDetails}.`
        : `${total} ${noteWord}.`;
}


function isDuplicate(text) {
    if (typeof text !== "string") {
        return false;
    }
    const cleanText = text.trim().toLowerCase();
    return notes.some(
        (note) => note.text.trim().toLowerCase() === cleanText
    );
}


function addNote(text, category) {

    if (typeof text !== "string" || text.trim().length === 0 || text.length > 200) {
        console.log("Failed to add note: Note text must be between 1 and 200 characters.");
        return false;
    }


    const validCategories = ["personal", "work", "study"];
    const normalizedCategory = typeof category === "string" ? category.toLowerCase() : "";
    if (!validCategories.includes(normalizedCategory)) {
        console.log(`Failed to add note: Invalid category "${category}". Must be personal, work, or study.`);
        return false;
    }


    if (isDuplicate(text)) {
        console.log(`Failed to add note: A note with the text "${text.trim()}" already exists.`);
        return false;
    }

    const nextId = notes.length > 0 ? Math.max(...notes.map((n) => n.id)) + 1 : 1;
    const newNote = {
        id: nextId,
        text: text.trim(),
        category: normalizedCategory,
    };
    notes.push(newNote);
    console.log(`Note added successfully: ID ${newNote.id} - "${newNote.text}" [${newNote.category}]`);
    return true;
}

/

console.log("--- 1. Testing searchNotes ---");
// Normal case: search for word ignoring case
console.log(searchNotes("javascript")); // Expected: [ { id: 4, text: "Revise JavaScript arrays", category: "study" } ]
// Edge case: word not present in any note
console.log(searchNotes("xylophone")); // Expected: []

console.log("\n--- 2. Testing longestNote ---");
// Normal case: find note with most characters
console.log(longestNote()); // Expected: { id: 3, text: "Email the project report to Grace", category: "work" }
// Edge case: empty notes array returns null
const savedNotesForLongest = [...notes];
notes = [];
console.log(longestNote()); // Expected: null
notes = savedNotesForLongest; // Restore notes array

console.log("\n--- 3. Testing countByCategory ---");
// Normal case: count categories in starting notes
console.log(countByCategory()); // Expected: { personal: 2, study: 2, work: 1 }
// Edge case: empty notes array returns empty object
const savedNotesForCount = [...notes];
notes = [];
console.log(countByCategory()); // Expected: {}
notes = savedNotesForCount; // Restore notes array

console.log("\n--- 4. Testing getSummary ---");
// Normal case: summary sentence with 5 notes
console.log(getSummary()); // Expected: "5 notes: 2 personal, 1 work, 2 study."
// Edge case: exactly one note uses singular "note"
const savedNotesForSummary = [...notes];
notes = [{ id: 1, text: "Buy milk and bread", category: "personal" }];
console.log(getSummary()); // Expected: "1 note: 1 personal."
notes = savedNotesForSummary; // Restore notes array

console.log("\n--- 5. Testing isDuplicate ---");
// Normal case: duplicate text with differing case and extra whitespace
console.log(isDuplicate("   BUY milk AND bread   ")); // Expected: true
// Edge case: unique note text
console.log(isDuplicate("Attend afternoon meeting")); // Expected: false

console.log("\n--- 6. Testing addNote ---");
// Normal case: successfully add a valid note
console.log(addNote("Attend afternoon meeting", "work")); // Expected: true
// Edge case 1: reject duplicate text
console.log(addNote("Buy milk and bread", "personal")); // Expected: false
// Edge case 2: reject invalid category
console.log(addNote("Cook dinner tonight", "cooking")); // Expected: false
// Edge case 3: reject empty text
console.log(addNote("", "study")); // Expected: false
