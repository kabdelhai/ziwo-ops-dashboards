// Ziwo Automation - Authentication Logic
// This handles the API authentication and token generation

const form = document.getElementById('authForm');
const submitBtn = document.getElementById('submitBtn');
const result = document.getElementById('result');
const tokenDisplay = document.getElementById('tokenDisplay');
const tokenValue = document.getElementById('tokenValue');
const copyBtn = document.getElementById('copyBtn');

// Handle form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const clientName = document.getElementById('clientName').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Reset displays
    result.style.display = 'none';
    tokenDisplay.style.display = 'none';

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span>Authenticating...';

    try {
        // Call the authentication function
        const accessToken = await authenticateWithZiwo(clientName, username, password);
        
        // Success - display token
        tokenValue.textContent = accessToken;
        tokenDisplay.style.display = 'block';
        
        result.className = 'result success';
        result.textContent = '✓ Authentication successful! Your access token is ready.';
        result.style.display = 'block';

    } catch (error) {
        // Error handling
        console.error('Authentication error:', error);
        result.className = 'result error';
        result.textContent = `✗ ${error.message}`;
        result.style.display = 'block';
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Generate Access Token';
    }
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

// Copy token functionality
copyBtn.addEventListener('click', async () => {
    const token = tokenValue.textContent;
    
    try {
        await navigator.clipboard.writeText(token);
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
            copyBtn.textContent = '📋 Copy Token';
        }, 2000);
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = token;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
            copyBtn.textContent = '📋 Copy Token';
        }, 2000);
    }
});
