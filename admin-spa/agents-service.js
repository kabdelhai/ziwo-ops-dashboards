// Agents Service - Handles API calls for agent management
import config from './config.js';

class AgentsService {
    constructor() {
        this.baseUrl = config.apiBaseUrl;
    }

    /**
     * Fetch agents with pagination
     * @param {string} accessToken - Authentication token
     * @param {number} page - Page number (starts at 1)
     * @param {number} limit - Number of items per page
     * @returns {Promise} - Agent data with pagination info
     */
    async fetchAgents(accessToken, page = 1, limit = 50) {
        const clientName = this.extractClientName(accessToken);
        const skip = (page - 1) * limit;
        
        const url = `${this.baseUrl.replace('<client-name>', clientName)}/admin/users/?limit=${limit}&skip=${skip}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'access_token': accessToken,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch agents: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.result) {
            throw new Error('Failed to fetch agents');
        }

        return {
            agents: data.content || [],
            total: data.info?.total || data.content?.length || 0,
            page,
            limit
        };
    }

    /**
     * Fetch all agents with automatic pagination
     * @param {string} accessToken - Authentication token
     * @param {Function} onProgress - Callback for progress updates
     * @returns {Promise<Array>} - All agents
     */
    async fetchAllAgents(accessToken, onProgress = null) {
        let allAgents = [];
        let page = 1;
        let hasMore = true;
        const limit = 50;

        while (hasMore) {
            const { agents, total } = await this.fetchAgents(accessToken, page, limit);
            allAgents = [...allAgents, ...agents];

            if (onProgress) {
                onProgress({
                    current: allAgents.length,
                    total: total || allAgents.length,
                    page
                });
            }

            hasMore = agents.length === limit && allAgents.length < (total || Infinity);
            page++;
        }

        return allAgents;
    }

    /**
     * Extract client name from stored data
     */
    extractClientName(accessToken) {
        // Client name should be stored in session
        const clientName = sessionStorage.getItem('clientName');
        if (!clientName) {
            throw new Error('Client name not found in session');
        }
        return clientName;
    }

    /**
     * Format agent data for export
     * @param {Array} agents - Raw agent data
     * @returns {Array} - Formatted agent data
     */
    formatAgentsForExport(agents) {
        return agents.map(agent => ({
            'Agent ID': agent.id,
            'First Name': agent.firstName,
            'Last Name': agent.lastName,
            'Username': agent.username,
            'Email': agent.username,
            'Status': agent.status,
            'Type': agent.type,
            'Role ID': agent.roleId,
            'CC Login': agent.ccLogin,
            'Auto Answer': agent.autoAnswer ? 'Yes' : 'No',
            'Wrap Up Time': agent.wrapUpTime,
            'Contact Number': agent.contactNumber || 'N/A',
            'Language': agent.languageCode || 'N/A',
            'Country': agent.countryCode || 'N/A',
            'Plan': agent.plan,
            'Internal': agent.internal ? 'Yes' : 'No',
            'Last Login': agent.lastLoginAt ? new Date(agent.lastLoginAt).toLocaleString() : 'Never',
            'Created At': new Date(agent.createdAt).toLocaleString(),
            'Updated At': new Date(agent.updatedAt).toLocaleString()
        }));
    }

    /**
     * Convert agents to CSV format
     * @param {Array} agents - Agent data
     * @returns {string} - CSV string
     */
    convertToCSV(agents) {
        if (!agents || agents.length === 0) {
            return '';
        }

        const formatted = this.formatAgentsForExport(agents);
        const headers = Object.keys(formatted[0]);
        const csvRows = [];

        // Add headers
        csvRows.push(headers.join(','));

        // Add data rows
        for (const row of formatted) {
            const values = headers.map(header => {
                const value = row[header];
                // Escape quotes and wrap in quotes if contains comma
                const escaped = ('' + value).replace(/"/g, '""');
                return escaped.includes(',') ? `"${escaped}"` : escaped;
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    }

    /**
     * Download agents as CSV file
     * @param {Array} agents - Agent data
     * @param {string} filename - Output filename
     */
    downloadAsCSV(agents, filename = 'agents.csv') {
        const csv = this.convertToCSV(agents);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export default AgentsService;
