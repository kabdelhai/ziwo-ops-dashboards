// Ziwo Automation - Authentication Logic
// This handles the API authentication and token generation

// Global variables to store session data
let accessToken = null;
let currentUsername = null;
let currentClientName = null;

// DOM elements
const loginContainer = document.getElementById('loginContainer');
const dashboardContainer = document.getElementById('dashboardContainer');
const form = document.getElementById('authForm');
const submitBtn = document.getElementById('submitBtn');
const result = document.getElementById('result');
const displayUsername = document.getElementById('displayUsername');
const logoutBtn = document.getElementById('logoutBtn');

// Menu links
const agentsLink = document.getElementById('agentsLink');
const numbersLink = document.getElementById('numbersLink');
const queuesLink = document.getElementById('queuesLink');

// Handle form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const clientName = document.getElementById('clientName').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Reset displays
    result.style.display = 'none';

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span>Logging in...';

    try {
        // Call the authentication function
        const token = await authenticateWithZiwo(clientName, username, password);
        
        // Success - save credentials and show dashboard
        accessToken = token;
        currentUsername = username;
        currentClientName = clientName;
        
        showDashboard();

    } catch (error) {
        // Error handling
        console.error('Authentication error:', error);
        result.className = 'result error';
        result.textContent = `✗ ${error.message}`;
        result.style.display = 'block';
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Login';
    }
});

// Show dashboard after successful login
function showDashboard() {
    loginContainer.style.display = 'none';
    dashboardContainer.classList.add('active');
    displayUsername.textContent = currentUsername;
}

// Handle logout
logoutBtn.addEventListener('click', () => {
    // Clear session data
    accessToken = null;
    currentUsername = null;
    currentClientName = null;
    
    // Reset form
    form.reset();
    result.style.display = 'none';
    
    // Show login screen
    dashboardContainer.classList.remove('active');
    loginContainer.style.display = 'block';
});

// Menu link handlers (placeholders for now)
agentsLink.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Agents List feature - Coming soon!\nAccess Token: ' + accessToken.substring(0, 20) + '...');
});

numbersLink.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Numbers List feature - Coming soon!\nAccess Token: ' + accessToken.substring(0, 20) + '...');
});

queuesLink.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Queues List feature - Coming soon!\nAccess Token: ' + accessToken.substring(0, 20) + '...');
});

// Authentication function
async function authenticateWithZiwo(clientName, username, password) {
    // Construct the API URL
    const apiUrl = `https://${clientName}-api.aswat.co/auth/login`;

    // Create form data
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    console.log('Attempting to authenticate with:', apiUrl);

    try {
        // Make the API request
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
            mode: 'cors'
        });

        console.log('Response status:', response.status);

        // Check if response is ok
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}. Please check your credentials.`);
        }

        const data = await response.json();
        console.log('Response received');

        // Extract access token
        if (data.content && data.content.access_token) {
            return data.content.access_token;
        } else {
            throw new Error('No access token received. Please check your credentials.');
        }

    } catch (error) {
        // Handle different types of errors
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Unable to connect to Ziwo API. This may be due to CORS restrictions. Please ensure you are using a proxy server or the API allows browser requests.');
        }
        throw error;
    }
}
