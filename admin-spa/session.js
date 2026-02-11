// Session Management Class
class Session {
    constructor() {
        this.accessToken = null;
        this.username = null;
        this.clientName = null;
    }

    set(accessToken, username, clientName) {
        this.accessToken = accessToken;
        this.username = username;
        this.clientName = clientName;
    }

    clear() {
        this.accessToken = null;
        this.username = null;
        this.clientName = null;
    }

    isAuthenticated() {
        return this.accessToken !== null;
    }

    getAccessToken() {
        return this.accessToken;
    }

    getUsername() {
        return this.username;
    }

    getClientName() {
        return this.clientName;
    }

    getApiBaseUrl() {
        return `https://${this.clientName}-api.aswat.co`;
    }
}

export default Session;
