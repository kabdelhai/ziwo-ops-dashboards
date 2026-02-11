// Agents View Component Class
import AgentsService from '../services/agents-service.js';

class AgentsView {
    constructor(session, onBackToMenu) {
        this.session = session;
        this.onBackToMenu = onBackToMenu;
        this.agentsService = new AgentsService(session);
        
        this.currentPage = 1;
        this.pageSize = 50;
        this.agents = [];
        
        this.initElements();
        this.attachEventListeners();
    }

    initElements() {
        this.container = document.getElementById('agentsContainer');
        this.tableContainer = document.getElementById('agentsTableContainer');
        this.agentsCount = document.getElementById('agentsCount');
        this.paginationControls = document.getElementById('paginationControls');
        this.prevPageBtn = document.getElementById('prevPageBtn');
        this.nextPageBtn = document.getElementById('nextPageBtn');
        this.pageInfo = document.getElementById('pageInfo');
        this.downloadBtn = document.getElementById('downloadAgentsBtn');
        this.backBtn = document.getElementById('backToMenuBtn');
    }

    attachEventListeners() {
        this.prevPageBtn.addEventListener('click', () => this.previousPage());
        this.nextPageBtn.addEventListener('click', () => this.nextPage());
        this.downloadBtn.addEventListener('click', () => this.downloadAgentsCSV());
        this.backBtn.addEventListener('click', () => this.onBackToMenu());
    }

    async show() {
        this.container.classList.add('active');
        this.currentPage = 1;
        await this.loadAgents();
    }

    hide() {
        this.container.classList.remove('active');
    }

    async loadAgents() {
        this.showLoading();
        this.paginationControls.style.display = 'none';

        try {
            const skip = (this.currentPage - 1) * this.pageSize;
            this.agents = await this.agentsService.getAgents(this.pageSize, skip);
            this.displayAgentsTable();
            this.updatePaginationControls();
        } catch (error) {
            this.showError(error.message);
        }
    }

    showLoading() {
        this.tableContainer.innerHTML = `
            <div class="loading-spinner">
                <div class="loader"></div>
                <p>Loading agents...</p>
            </div>
        `;
    }

    showError(message) {
        this.tableContainer.innerHTML = `
            <div class="error-message">
                ✗ Error: ${message}
            </div>
        `;
    }

    displayAgentsTable() {
        if (this.agents.length === 0) {
            this.tableContainer.innerHTML = `
                <div class="error-message">
                    No agents found.
                </div>
            `;
            this.agentsCount.textContent = 'No agents found';
            return;
        }

        this.agentsCount.textContent = `Total Agents: ${this.agents.length}`;

        const tableHTML = `
            <div class="table-container">
                <table class="agents-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>First Name</th>
                            <th>Last Name</th>
                            <th>Username</th>
                            <th>CC Login</th>
                            <th>Status</th>
                            <th>Type</th>
                            <th>Last Login</th>
                            <th>Created At</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.agents.map(agent => this.renderAgentRow(agent)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        this.tableContainer.innerHTML = tableHTML;
    }

    renderAgentRow(agent) {
        return `
            <tr>
                <td>${agent.id}</td>
                <td>${agent.firstName || '-'}</td>
                <td>${agent.lastName || '-'}</td>
                <td>${agent.username || '-'}</td>
                <td>${agent.ccLogin || '-'}</td>
                <td>
                    <span class="status-badge ${agent.status}">
                        ${agent.status}
                    </span>
                </td>
                <td>${agent.type || '-'}</td>
                <td>${agent.lastLoginAt ? new Date(agent.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                <td>${new Date(agent.createdAt).toLocaleDateString()}</td>
            </tr>
        `;
    }

    updatePaginationControls() {
        this.pageInfo.textContent = `Page ${this.currentPage}`;
        this.prevPageBtn.disabled = this.currentPage === 1;
        this.nextPageBtn.disabled = this.agents.length < this.pageSize;
        this.paginationControls.style.display = 'flex';
    }

    async previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            await this.loadAgents();
        }
    }

    async nextPage() {
        this.currentPage++;
        await this.loadAgents();
    }

    async downloadAgentsCSV() {
        try {
            this.downloadBtn.disabled = true;
            this.downloadBtn.innerHTML = '<span class="loader"></span>Downloading...';

            const allAgents = await this.agentsService.getAllAgents();
            this.agentsService.downloadCSV(allAgents, this.session.getClientName());

        } catch (error) {
            alert('Error downloading CSV: ' + error.message);
        } finally {
            this.downloadBtn.disabled = false;
            this.downloadBtn.innerHTML = '📥 Download CSV';
        }
    }
}

export default AgentsView;
