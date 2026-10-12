// DOM Elements
const loadButton = document.getElementById('load-users');
const filterInput = document.getElementById('filter-input');
const statusParagraph = document.getElementById('status');
const usersList = document.getElementById('users-list');

// Stored array of loaded users
let users = [];

/**
 * Renders an array of user objects into the #users-list element.
 * Displays user name, email, city, and company name using createElement and textContent.
 * Displays "No users match your filter." when the list is empty.
 * @param {Array} list - Array of user objects
 */
function renderUsers(list) {
  if (!usersList) return;

  // Clear existing items
  usersList.textContent = '';

  if (!list || list.length === 0) {
    const noMatchItem = document.createElement('li');
    noMatchItem.className = 'no-match';
    noMatchItem.textContent = 'No users match your filter.';
    usersList.appendChild(noMatchItem);
    return;
  }

  list.forEach((user) => {
    const cardItem = document.createElement('li');
    cardItem.className = 'user-card';

    const nameHeading = document.createElement('h3');
    nameHeading.className = 'user-name';
    nameHeading.textContent = user.name;

    const emailParagraph = document.createElement('p');
    emailParagraph.className = 'user-email';
    emailParagraph.textContent = user.email;

    const cityParagraph = document.createElement('p');
    cityParagraph.className = 'user-city';
    cityParagraph.textContent = user.address?.city || 'Unknown City';

    const companyParagraph = document.createElement('p');
    companyParagraph.className = 'user-company';
    companyParagraph.textContent = user.company?.name || 'Unknown Company';

    cardItem.appendChild(nameHeading);
    cardItem.appendChild(emailParagraph);
    cardItem.appendChild(cityParagraph);
    cardItem.appendChild(companyParagraph);

    usersList.appendChild(cardItem);
  });
}

/**
 * Asynchronously loads users from JSONPlaceholder API.
 * Uses fetch, async / await, and try / catch / finally.
 * Disables the load button while loading and updates #status with loading, success, or error messages.
 */
async function loadUsers() {
  if (loadButton) {
    loadButton.disabled = true;
  }

  if (statusParagraph) {
    statusParagraph.textContent = 'Loading users...';
    statusParagraph.className = 'status-loading';
  }

  try {
    const response = await fetch('https://jsonplaceholder.typicode.com/users');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    users = await response.json();

    if (statusParagraph) {
      statusParagraph.textContent = `Users loaded successfully (${users.length} users).`;
      statusParagraph.className = 'status-success';
    }

    if (filterInput) {
      filterInput.value = '';
    }

    renderUsers(users);
  } catch (error) {
    if (statusParagraph) {
      statusParagraph.textContent = `Error loading users: ${error.message}`;
      statusParagraph.className = 'status-error';
    }

    if (usersList) {
      usersList.textContent = '';
    }
  } finally {
    if (loadButton) {
      loadButton.disabled = false;
    }
  }
}

// Event Listeners
if (loadButton) {
  loadButton.addEventListener('click', loadUsers);
}

if (filterInput) {
  filterInput.addEventListener('input', (event) => {
    const searchTerm = event.target.value.toLowerCase();
    const filteredUsers = users.filter((user) =>
      user.name.toLowerCase().includes(searchTerm)
    );
    renderUsers(filteredUsers);
  });
}

// Export for testing environments if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadUsers, renderUsers };
}
