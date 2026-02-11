// Agents Service Class - Reusable module for agent operations
class AgentsService {
    constructor(session) {
        this.session = session;
    }

    /**
     * Get agents list with pagination
     * @param {number} limit - Number of agents to fetch
     * @param {number} skip - Number of agents to skip
     * @returns {Promise<Array>} Array of agents
     */
    async getAgents(limit = 50, skip = 0) {
        const apiUrl = `${this.session.getApiBaseUrl()}/admin/agents/?limit=${limit}&skip=${skip}`;

        console.log('Fetching agents from:', apiUrl);

        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'access_token': this.session.getAccessToken(),
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Agents data received');

            if (data.result && data.content) {
                return data.content;
            } else {
                throw new Error('Invalid response format');
            }

        } catch (error) {
            console.error('Error fetching agents:', error);
            throw error;
        }
    }

    /**
     * Get all agents (for export purposes)
     * @returns {Promise<Array>} Array of all agents
     */
    async getAllAgents() {
        return await this.getAgents(10000, 0);
    }

    /**
     * Get single agent by ID
     * @param {number} agentId - Agent ID
     * @returns {Promise<Object>} Agent object
     */
    async getAgentById(agentId) {
        const apiUrl = `${this.session.getApiBaseUrl()}/admin/agents/${agentId}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'access_token': this.session.getAccessToken(),
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();

            if (data.result && data.content) {
                return data.content;
            } else {
                throw new Error('Invalid response format');
            }

        } catch (error) {
            console.error('Error fetching agent:', error);
            throw error;
        }
    }

    /**
     * Export agents to CSV format
     * @param {Array} agents - Array of agents
     * @param {string} clientName - Client name for filename
     * @returns {string} CSV content
     */
    exportToCSV(agents, clientName) {
        const headers = [
            'id',
            'firstName',
            'lastName',
            'username',
            'ccLogin',
            'ccPassword',
            'autoAnswer',
            'noAnswerTimeout',
            'roamingContactNumber',
            'pauseRecording',
            'wrapUpTime',
            'status',
            'type',
            'lastLoginAt',
            'createdAt',
            'updatedAt'
        ];

        let csvContent = headers.join(',') + '\n';

        agents.forEach(agent => {
            const row = headers.map(header => {
                let value = agent[header];
                
                if (value === null || value === undefined) {
                    return '';
                }
                
                if (typeof value === 'boolean') {
                    return value;
                }
                
                if (typeof value === 'string') {
                    value = value.replace(/"/g, '""');
                    if (value.includes(',') || value.includes('\n')) {
                        value = `"${value}"`;
                    }
                }
                
                return value;
            });
            
            csvContent += row.join(',') + '\n';
        });

        return csvContent;
    }

    /**
     * Download agents as CSV file
     * @param {Array} agents - Array of agents
     * @param {string} clientName - Client name for filename
     */
    downloadCSV(agents, clientName) {
        const csvContent = this.exportToCSV(agents, clientName);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const today = new Date().toISOString().split('T')[0];
        const filename = `${clientName}_agents_list_${today}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export default AgentsService;
