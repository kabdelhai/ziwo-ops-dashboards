// Main Application File
import Session from './session.js';
import AuthService from './auth-service.js';
import AgentsView from './agents-view.js';
import QueuesView from './queues-view.js';
import NumbersView from './numbers-view.js';

class ZiwoAutomationApp {
    constructor() {
        this.session = new Session();
        this.authService = new AuthService();
        
        this.initElements();
        this.initViews();
        this.attachEventListeners();
    }

    initElements() {
        // Containers
        this.loginContainer = document.getElementById('loginContainer');
        this.dashboardContainer = document.getElementById('dashboardContainer');
        
        // Login form
        this.loginForm = document.getElementById('authForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.loginResult = document.getElementById('result');
        
        // Dashboard
        this.displayUsername = document.getElementById('displayUsername');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.logoutBtn2 = document.getElementById('logoutBtn2');
        
        // Menu links
        this.agentsLink = document.getElementById('agentsLink');
        this.numbersLink = document.getElementById('numbersLink');
        this.queuesLink = document.getElementById('queuesLink');
    }

    initViews() {
        this.agentsView = new AgentsView(this.session, () => this.showDashboard());
        this.queuesView = new QueuesView(this.session, () => this.showDashboard());
        this.numbersView = new NumbersView(this.session, () => this.showDashboard());
    }

    attachEventListeners() {
        // Login
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        
        // Logout
        this.logoutBtn.addEventListener('click', () => this.handleLogout());
        this.logoutBtn2.addEventListener('click', () => this.handleLogout());
        
        // Menu navigation
        this.agentsLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAgentsView();
        });
        
        this.numbersLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.showNumbersView();
        });
        
        this.queuesLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.showQueuesView();
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const clientName = document.getElementById('clientName').value.trim();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        this.loginResult.style.display = 'none';
        this.submitBtn.disabled = true;
        this.submitBtn.innerHTML = '<span class="loader"></span>Logging in...';

        try {
            const accessToken = await this.authService.login(clientName, username, password);
            this.session.set(accessToken, username, clientName);
            this.showDashboard();
        } catch (error) {
            console.error('Authentication error:', error);
            this.loginResult.className = 'result error';
            this.loginResult.textContent = `✗ ${error.message}`;
            this.loginResult.style.display = 'block';
        } finally {
            this.submitBtn.disabled = false;
            this.submitBtn.innerHTML = 'Login';
        }
    }

    handleLogout() {
        this.session.clear();
        this.loginForm.reset();
        this.loginResult.style.display = 'none';
        this.agentsView.hide();
        this.queuesView.hide();
        this.numbersView.hide();
        this.dashboardContainer.classList.remove('active');
        this.loginContainer.style.display = 'block';
    }

    showDashboard() {
        this.loginContainer.style.display = 'none';
        this.agentsView.hide();
        this.queuesView.hide();
        this.numbersView.hide();
        this.dashboardContainer.classList.add('active');
        this.displayUsername.textContent = this.session.getUsername();
    }

    showAgentsView() {
        this.dashboardContainer.classList.remove('active');
        this.queuesView.hide();
        this.numbersView.hide();
        this.agentsView.show();
    }

    showQueuesView() {
        this.dashboardContainer.classList.remove('active');
        this.agentsView.hide();
        this.numbersView.hide();
        this.queuesView.show();
    }

    showNumbersView() {
        this.dashboardContainer.classList.remove('active');
        this.agentsView.hide();
        this.queuesView.hide();
        this.numbersView.show();
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ZiwoAutomationApp();
});
