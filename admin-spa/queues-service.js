// Queues Service - Handles API calls for queue management
import config from './config.js';

class QueuesService {
    constructor() {
        this.baseUrl = config.apiBaseUrl;
    }

    /**
     * Fetch queues with pagination
     * @param {string} accessToken - Authentication token
     * @param {number} page - Page number (starts at 1)
     * @param {number} limit - Number of items per page
     * @returns {Promise} - Queue data with pagination info
     */
    async fetchQueues(accessToken, page = 1, limit = 50) {
        const clientName = this.extractClientName(accessToken);
        const offset = (page - 1) * limit;
        
        const url = `${this.baseUrl.replace('<client-name>', clientName)}/admin/queues/?limit=${limit}&offset=${offset}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'access_token': accessToken,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch queues: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.result) {
            throw new Error('Failed to fetch queues');
        }

        return {
            queues: data.content || [],
            total: data.info?.total || data.content?.length || 0,
            page,
            limit
        };
    }

    /**
     * Fetch all queues with automatic pagination
     * @param {string} accessToken - Authentication token
     * @param {Function} onProgress - Callback for progress updates
     * @returns {Promise<Array>} - All queues
     */
    async fetchAllQueues(accessToken, onProgress = null) {
        let allQueues = [];
        let page = 1;
        let hasMore = true;
        const limit = 50;

        while (hasMore) {
            const { queues, total } = await this.fetchQueues(accessToken, page, limit);
            allQueues = [...allQueues, ...queues];

            if (onProgress) {
                onProgress({
                    current: allQueues.length,
                    total: total || allQueues.length,
                    page
                });
            }

            hasMore = queues.length === limit && allQueues.length < (total || Infinity);
            page++;
        }

        return allQueues;
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
     * Format queue data for export
     * @param {Array} queues - Raw queue data
     * @returns {Array} - Formatted queue data
     */
    formatQueuesForExport(queues) {
        return queues.map(queue => ({
            'Queue ID': queue.id,
            'Queue Name': queue.name,
            'Status': queue.status,
            'Extension': queue.extension,
            'Strategy': queue.strategyType,
            'Priority': queue.priority,
            'Max Wait Time': queue.maxWaitTime,
            'Language': queue.language,
            'Caller ID': queue.callerIDNumber,
            'Agents Count': queue.agents?.length || 0,
            'Agent Names': queue.agents?.map(a => `${a.firstName} ${a.lastName}`).join(', ') || 'None',
            'Created At': new Date(queue.createdAt).toLocaleString(),
            'Updated At': new Date(queue.updatedAt).toLocaleString()
        }));
    }

    /**
     * Convert queues to CSV format
     * @param {Array} queues - Queue data
     * @returns {string} - CSV string
     */
    convertToCSV(queues) {
        if (!queues || queues.length === 0) {
            return '';
        }

        const formatted = this.formatQueuesForExport(queues);
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
     * Download queues as CSV file
     * @param {Array} queues - Queue data
     * @param {string} filename - Output filename
     */
    downloadAsCSV(queues, filename = 'queues.csv') {
        const csv = this.convertToCSV(queues);
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

export default QueuesService;
