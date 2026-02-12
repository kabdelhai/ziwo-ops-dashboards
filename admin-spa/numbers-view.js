// Numbers View Component
import NumbersService from './numbers-service.js';

class NumbersView {
    constructor(session, onBack) {
        this.session = session;
        this.onBack = onBack;
        this.numbersService = new NumbersService();
        this.numbers = [];
        
        this.createView();
        this.attachEventListeners();
    }

    createView() {
        this.container = document.createElement('div');
        this.container.id = 'numbersView';
        this.container.className = 'view-container';
        this.container.style.display = 'none';

        this.container.innerHTML = `
            <div class="view-header">
                <button id="backFromNumbers" class="back-btn">← Back to Dashboard</button>
                <h2>📱 Numbers/DIDs Management</h2>
            </div>

            <div class="view-content">
                <div class="stats-card">
                    <h3>Number Statistics</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Total Numbers:</span>
                            <span id="numbersTotal" class="stat-value">-</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Active:</span>
                            <span id="numbersActive" class="stat-value">-</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Inactive:</span>
                            <span id="numbersInactive" class="stat-value">-</span>
                        </div>
                    </div>
                </div>

                <div class="actions-card">
                    <button id="downloadNumbersBtn" class="action-btn" disabled>
                        <span class="btn-icon">📥</span>
                        <span class="btn-text">Download Numbers List</span>
                    </button>
                    <div id="numbersProgress" class="progress-info" style="display: none;">
                        <span id="numbersProgressText">Loading numbers...</span>
                        <div class="progress-bar">
                            <div id="numbersProgressBar" class="progress-fill"></div>
                        </div>
                    </div>
                </div>

                <div id="numbersTableContainer" class="table-container">
                    <table id="numbersTable" class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>DID</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Link Type</th>
                                <th>Link Data</th>
                                <th>Display</th>
                                <th>Storage</th>
                            </tr>
                        </thead>
                        <tbody id="numbersTableBody">
                            <tr>
                                <td colspan="8" class="no-data">No numbers loaded. Click "Download Numbers List" to fetch data.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);
    }

    attachEventListeners() {
        document.getElementById('backFromNumbers').addEventListener('click', () => {
            this.hide();
            this.onBack();
        });

        document.getElementById('downloadNumbersBtn').addEventListener('click', () => {
            this.downloadNumbers();
        });
    }

    async downloadNumbers() {
        const btn = document.getElementById('downloadNumbersBtn');
        const progressDiv = document.getElementById('numbersProgress');
        const progressText = document.getElementById('numbersProgressText');
        const progressBar = document.getElementById('numbersProgressBar');

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="loader"></span>Fetching numbers...';
            progressDiv.style.display = 'block';

            const accessToken = this.session.getToken();

            this.numbers = await this.numbersService.fetchAllNumbers(
                accessToken,
                (progress) => {
                    const percentage = (progress.current / progress.total) * 100;
                    progressText.textContent = `Loading numbers: ${progress.current} / ${progress.total} (Page ${progress.page})`;
                    progressBar.style.width = `${percentage}%`;
                }
            );

            this.updateStats();
            this.renderTable();
            
            // Download CSV
            const clientName = sessionStorage.getItem('clientName');
            const timestamp = new Date().toISOString().split('T')[0];
            this.numbersService.downloadAsCSV(this.numbers, `${clientName}-numbers-${timestamp}.csv`);

            progressText.textContent = `✓ Downloaded ${this.numbers.length} numbers successfully!`;
            setTimeout(() => {
                progressDiv.style.display = 'none';
            }, 3000);

        } catch (error) {
            console.error('Error downloading numbers:', error);
            progressText.textContent = `✗ Error: ${error.message}`;
            progressDiv.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-icon">📥</span><span class="btn-text">Download Numbers List</span>';
        }
    }

    updateStats() {
        const total = this.numbers.length;
        const active = this.numbers.filter(n => n.status === 'active').length;
        const inactive = total - active;

        document.getElementById('numbersTotal').textContent = total;
        document.getElementById('numbersActive').textContent = active;
        document.getElementById('numbersInactive').textContent = inactive;
    }

    renderTable() {
        const tbody = document.getElementById('numbersTableBody');
        
        if (this.numbers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">No numbers found.</td></tr>';
            return;
        }

        tbody.innerHTML = this.numbers.map(number => `
            <tr>
                <td>${number.id}</td>
                <td><strong>${number.did}</strong></td>
                <td>${number.type}</td>
                <td><span class="status-badge ${number.status}">${number.status}</span></td>
                <td>${this.formatLinkType(number.linkType)}</td>
                <td>${this.truncate(number.linkData, 20)}</td>
                <td>${this.truncate(number.didDisplay, 25)}</td>
                <td>${number.storage?.originalName || '-'}</td>
            </tr>
        `).join('');
    }

    formatLinkType(linkType) {
        const types = {
            'queue': '📞 Queue',
            'ivr': '🔀 IVR',
            'dialplan': '📋 Dialplan',
            'agent': '👤 Agent'
        };
        return types[linkType] || linkType;
    }

    truncate(str, maxLength) {
        if (!str) return '-';
        return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    }

    show() {
        this.container.style.display = 'block';
        document.getElementById('downloadNumbersBtn').disabled = false;
    }

    hide() {
        this.container.style.display = 'none';
    }
}

export default NumbersView;
