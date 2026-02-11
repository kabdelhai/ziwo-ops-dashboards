// Authentication Service Class
class AuthService {
    constructor() {
        this.baseUrl = 'aswat.co';
    }

    /**
     * Authenticate with Ziwo API
     * @param {string} clientName - Client identifier
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {Promise<string>} Access token
     */
    async login(clientName, username, password) {
        const apiUrl = `https://${clientName}-api.${this.baseUrl}/auth/login`;

        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        console.log('Attempting to authenticate with:', apiUrl);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
                mode: 'cors'
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}. Please check your credentials.`);
            }

            const data = await response.json();
            console.log('Authentication successful');

            if (data.content && data.content.access_token) {
                return data.content.access_token;
            } else {
                throw new Error('No access token received. Please check your credentials.');
            }

        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Unable to connect to Ziwo API. This may be due to CORS restrictions. Please ensure you are using a proxy server or the API allows browser requests.');
            }
            throw error;
        }
    }
}

export default AuthService;
