// Queues View Component
import QueuesService from './queues-service.js';

class QueuesView {
    constructor(session, onBack) {
        this.session = session;
        this.onBack = onBack;
        this.queuesService = new QueuesService();
        this.queues = [];
        
        this.createView();
        this.attachEventListeners();
    }

    createView() {
        this.container = document.createElement('div');
        this.container.id = 'queuesView';
        this.container.className = 'view-container';
        this.container.style.display = 'none';

        this.container.innerHTML = `
            <div class="view-header">
                <button id="backFromQueues" class="back-btn">← Back to Dashboard</button>
                <h2>📞 Queues Management</h2>
            </div>

            <div class="view-content">
                <div class="stats-card">
                    <h3>Queue Statistics</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Total Queues:</span>
                            <span id="queuesTotal" class="stat-value">-</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Active:</span>
                            <span id="queuesActive" class="stat-value">-</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Inactive:</span>
                            <span id="queuesInactive" class="stat-value">-</span>
                        </div>
                    </div>
                </div>

                <div class="actions-card">
                    <button id="downloadQueuesBtn" class="action-btn" disabled>
                        <span class="btn-icon">📥</span>
                        <span class="btn-text">Download Queues List</span>
                    </button>
                    <div id="queuesProgress" class="progress-info" style="display: none;">
                        <span id="queuesProgressText">Loading queues...</span>
                        <div class="progress-bar">
                            <div id="queuesProgressBar" class="progress-fill"></div>
                        </div>
                    </div>
                </div>

                <div id="queuesTableContainer" class="table-container">
                    <table id="queuesTable" class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Extension</th>
                                <th>Status</th>
                                <th>Strategy</th>
                                <th>Agents</th>
                                <th>Priority</th>
                                <th>Max Wait</th>
                            </tr>
                        </thead>
                        <tbody id="queuesTableBody">
                            <tr>
                                <td colspan="8" class="no-data">No queues loaded. Click "Download Queues List" to fetch data.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);
    }

    attachEventListeners() {
        document.getElementById('backFromQueues').addEventListener('click', () => {
            this.hide();
            this.onBack();
        });

        document.getElementById('downloadQueuesBtn').addEventListener('click', () => {
            this.downloadQueues();
        });
    }

    async downloadQueues() {
        const btn = document.getElementById('downloadQueuesBtn');
        const progressDiv = document.getElementById('queuesProgress');
        const progressText = document.getElementById('queuesProgressText');
        const progressBar = document.getElementById('queuesProgressBar');

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="loader"></span>Fetching queues...';
            progressDiv.style.display = 'block';

            const accessToken = this.session.getToken();

            this.queues = await this.queuesService.fetchAllQueues(
                accessToken,
                (progress) => {
                    const percentage = (progress.current / progress.total) * 100;
                    progressText.textContent = `Loading queues: ${progress.current} / ${progress.total} (Page ${progress.page})`;
                    progressBar.style.width = `${percentage}%`;
                }
            );

            this.updateStats();
            this.renderTable();
            
            // Download CSV
            const clientName = sessionStorage.getItem('clientName');
            const timestamp = new Date().toISOString().split('T')[0];
            this.queuesService.downloadAsCSV(this.queues, `${clientName}-queues-${timestamp}.csv`);

            progressText.textContent = `✓ Downloaded ${this.queues.length} queues successfully!`;
            setTimeout(() => {
                progressDiv.style.display = 'none';
            }, 3000);

        } catch (error) {
            console.error('Error downloading queues:', error);
            progressText.textContent = `✗ Error: ${error.message}`;
            progressDiv.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-icon">📥</span><span class="btn-text">Download Queues List</span>';
        }
    }

    updateStats() {
        const total = this.queues.length;
        const active = this.queues.filter(q => q.status === 'active').length;
        const inactive = total - active;

        document.getElementById('queuesTotal').textContent = total;
        document.getElementById('queuesActive').textContent = active;
        document.getElementById('queuesInactive').textContent = inactive;
    }

    renderTable() {
        const tbody = document.getElementById('queuesTableBody');
        
        if (this.queues.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">No queues found.</td></tr>';
            return;
        }

        tbody.innerHTML = this.queues.map(queue => `
            <tr>
                <td>${queue.id}</td>
                <td><strong>${queue.name}</strong></td>
                <td>${queue.extension}</td>
                <td><span class="status-badge ${queue.status}">${queue.status}</span></td>
                <td>${this.formatStrategy(queue.strategyType)}</td>
                <td>${queue.agents?.length || 0} agents</td>
                <td>${queue.priority}</td>
                <td>${queue.maxWaitTime}s</td>
            </tr>
        `).join('');
    }

    formatStrategy(strategy) {
        const strategies = {
            'agent-with-fewest-conversations': 'Fewest Conversations',
            'longest-idle-agent': 'Longest Idle',
            'round-robin': 'Round Robin',
            'random': 'Random'
        };
        return strategies[strategy] || strategy;
    }

    show() {
        this.container.style.display = 'block';
        document.getElementById('downloadQueuesBtn').disabled = false;
    }

    hide() {
        this.container.style.display = 'none';
    }
}

export default QueuesView;
