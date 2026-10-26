/**
 * QuickNotes - Asynchronous REST API Client
 * Interacts with JSONPlaceholder posts endpoint with full state handling,
 * defensive error checking, input validation, and secure DOM manipulation.
 */

// 1. Base API URL Constant
const API_URL = 'https://jsonplaceholder.typicode.com/posts';

// 2. Application State
let notes = [];
let isRequestInProgress = false;

// 3. DOM Element References
const loadBtn = document.getElementById('load-btn');
const statusEl = document.getElementById('status');
const noteForm = document.getElementById('note-form');
const titleInput = document.getElementById('title-input');
const bodyInput = document.getElementById('body-input');
const submitBtn = document.getElementById('submit-btn');
const notesList = document.getElementById('notes-list');
const notesCounter = document.getElementById('notes-counter');

/**
 * Reusable asynchronous request wrapper.
 * Calls fetch, validates response.ok, and throws an error on non-2xx status codes.
 *
 * @param {string} url - Target URL endpoint
 * @param {object} [options={}] - Standard fetch configuration options
 * @returns {Promise<any>} Parsed JSON response body
 */
async function request(url, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`HTTP Error ${response.status} (${response.statusText}): ${errorText || 'Server responded with an error.'}`);
  }

  // Handle 204 No Content responses where response.json() would fail
  if (response.status === 204) {
    return null;
  }

  return await response.json();
}

/**
 * Updates the UI status message with dedicated styling classes.
 *
 * @param {'loading'|'success'|'error'|'info'|'clear'} type - Category of status
 * @param {string} [message=''] - Text content to display
 */
function setStatus(type, message = '') {
  if (!statusEl) return;

  statusEl.className = '';

  if (type === 'clear' || !message) {
    statusEl.textContent = '';
    statusEl.style.display = 'none';
    return;
  }

  statusEl.textContent = message;
  statusEl.classList.add(`status-${type}`);
  statusEl.style.display = type === 'loading' ? 'flex' : 'block';
}

/**
 * Disables or enables interactive action buttons while network requests run.
 *
 * @param {boolean} busy - Whether a request is currently active
 */
function setBusy(busy) {
  isRequestInProgress = busy;

  if (loadBtn) {
    loadBtn.disabled = busy;
  }
  if (submitBtn) {
    submitBtn.disabled = busy;
  }

  // Disable all active note deletion buttons
  const deleteButtons = document.querySelectorAll('.btn-delete-note');
  deleteButtons.forEach((btn) => {
    btn.disabled = busy;
  });
}

/**
 * Updates the notes count indicator.
 */
function updateCounter() {
  if (!notesCounter) return;
  const count = notes.length;
  notesCounter.textContent = count === 1 ? '1 note' : `${count} notes`;
}

/**
 * Safely renders the list of notes into the DOM using textContent only.
 * Displays a dedicated empty state card if the notes array has zero items.
 */
function renderNotes() {
  if (!notesList) return;

  // Clear existing items
  notesList.textContent = '';
  updateCounter();

  // Empty State Handling
  if (notes.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'empty-state';

    const emptyTitle = document.createElement('p');
    emptyTitle.className = 'empty-state-title';
    emptyTitle.textContent = 'No notes available';

    const emptyText = document.createElement('p');
    emptyText.className = 'empty-state-text';
    emptyText.textContent = "Click 'Load Notes' to fetch items from the API, or fill out the form above to add a new note.";

    emptyLi.appendChild(emptyTitle);
    emptyLi.appendChild(emptyText);
    notesList.appendChild(emptyLi);
    return;
  }

  // Render Note Cards
  notes.forEach((note) => {
    const li = document.createElement('li');
    li.className = 'note-item';
    li.id = `note-${note.id}`;

    // Header (Title & ID Badge)
    const header = document.createElement('div');
    header.className = 'note-header';

    const titleHeading = document.createElement('h3');
    titleHeading.className = 'note-title';
    titleHeading.textContent = note.title;

    const idBadge = document.createElement('span');
    idBadge.className = 'note-id-badge';
    idBadge.textContent = `#${note.id}`;

    header.appendChild(titleHeading);
    header.appendChild(idBadge);
    li.appendChild(header);

    // Note Body (if present)
    if (note.body) {
      const bodyParagraph = document.createElement('p');
      bodyParagraph.className = 'note-body';
      bodyParagraph.textContent = note.body;
      li.appendChild(bodyParagraph);
    }

    // Footer (Delete Button)
    const footer = document.createElement('div');
    footer.className = 'note-footer';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger btn-delete-note';
    deleteBtn.textContent = 'Delete Note';
    deleteBtn.disabled = isRequestInProgress;
    deleteBtn.setAttribute('aria-label', `Delete note titled ${note.title}`);

    deleteBtn.addEventListener('click', () => {
      deleteNote(note.id);
    });

    footer.appendChild(deleteBtn);
    li.appendChild(footer);

    notesList.appendChild(li);
  });
}

/**
 * GET: Loads 10 notes from the API.
 * Uses query parameter `_limit=10`.
 */
async function loadNotes() {
  setStatus('loading', 'Loading notes from API...');
  setBusy(true);

  try {
    const fetchedNotes = await request(`${API_URL}?_limit=10`, {
      method: 'GET'
    });

    notes = Array.isArray(fetchedNotes) ? fetchedNotes : [];
    renderNotes();
    setStatus('success', `Successfully loaded ${notes.length} notes from the API.`);
  } catch (error) {
    console.error('Failed to load notes:', error);
    setStatus('error', `Error loading notes: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

/**
 * POST: Creates a new note via the API.
 * Validates that title is required and does not exceed 100 characters.
 *
 * @param {string} rawTitle - User-provided note title
 * @param {string} rawBody - User-provided note body
 */
async function createNote(rawTitle, rawBody) {
  const title = (rawTitle || '').trim();
  const body = (rawBody || '').trim();

  // Input Validation
  if (!title) {
    setStatus('error', 'Validation Error: Note title is required.');
    if (titleInput) titleInput.focus();
    return;
  }

  if (title.length > 100) {
    setStatus('error', `Validation Error: Title must be 100 characters or fewer (currently ${title.length} characters).`);
    if (titleInput) titleInput.focus();
    return;
  }

  setStatus('loading', 'Creating and publishing your note...');
  setBusy(true);

  try {
    const payload = {
      title: title,
      body: body,
      userId: 1
    };

    const newNote = await request(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // Provide a unique client ID fallback if necessary
    const createdNote = {
      ...newNote,
      id: newNote.id || Date.now()
    };

    // Prepend newly created note to the top of the feed
    notes.unshift(createdNote);
    renderNotes();

    // Reset Form Inputs
    if (noteForm) {
      noteForm.reset();
    }

    setStatus('success', `Note #${createdNote.id} created successfully!`);
  } catch (error) {
    console.error('Failed to create note:', error);
    setStatus('error', `Error creating note: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

/**
 * DELETE: Removes a note by ID via the API and removes it from the UI list.
 *
 * @param {number|string} id - The ID of the note to delete
 */
async function deleteNote(id) {
  setStatus('loading', `Deleting note #${id}...`);
  setBusy(true);

  try {
    await request(`${API_URL}/${id}`, {
      method: 'DELETE'
    });

    // Remove note from local state
    notes = notes.filter((n) => n.id !== id);
    renderNotes();

    setStatus('success', `Note #${id} deleted successfully.`);
  } catch (error) {
    console.error(`Failed to delete note #${id}:`, error);
    setStatus('error', `Error deleting note #${id}: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

// 4. Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Initial empty state render
  renderNotes();

  // Load Notes Button Click
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      loadNotes();
    });
  }

  // Form Submission
  if (noteForm) {
    noteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const titleValue = titleInput ? titleInput.value : '';
      const bodyValue = bodyInput ? bodyInput.value : '';
      createNote(titleValue, bodyValue);
    });
  }
});
