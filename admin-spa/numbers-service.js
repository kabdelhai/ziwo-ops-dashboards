// Numbers Service - Handles API calls for number/DID management
import config from './config.js';

class NumbersService {
    constructor() {
        this.baseUrl = config.apiBaseUrl;
    }

    /**
     * Fetch numbers with pagination
     * @param {string} accessToken - Authentication token
     * @param {number} page - Page number (starts at 1)
     * @param {number} limit - Number of items per page
     * @returns {Promise} - Number data with pagination info
     */
    async fetchNumbers(accessToken, page = 1, limit = 50) {
        const clientName = this.extractClientName(accessToken);
        const offset = (page - 1) * limit;
        
        const url = `${this.baseUrl.replace('<client-name>', clientName)}/admin/numbers/?limit=${limit}&offset=${offset}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'access_token': accessToken,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch numbers: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.result) {
            throw new Error('Failed to fetch numbers');
        }

        return {
            numbers: data.content || [],
            total: data.info?.total || data.content?.length || 0,
            page,
            limit
        };
    }

    /**
     * Fetch all numbers with automatic pagination
     * @param {string} accessToken - Authentication token
     * @param {Function} onProgress - Callback for progress updates
     * @returns {Promise<Array>} - All numbers
     */
    async fetchAllNumbers(accessToken, onProgress = null) {
        let allNumbers = [];
        let page = 1;
        let hasMore = true;
        const limit = 50;

        while (hasMore) {
            const { numbers, total } = await this.fetchNumbers(accessToken, page, limit);
            allNumbers = [...allNumbers, ...numbers];

            if (onProgress) {
                onProgress({
                    current: allNumbers.length,
                    total: total || allNumbers.length,
                    page
                });
            }

            hasMore = numbers.length === limit && allNumbers.length < (total || Infinity);
            page++;
        }

        return allNumbers;
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
     * Format number data for export
     * @param {Array} numbers - Raw number data
     * @returns {Array} - Formatted number data
     */
    formatNumbersForExport(numbers) {
        return numbers.map(number => ({
            'Number ID': number.id,
            'DID': number.did,
            'Type': number.type,
            'DID Called': number.didCalled,
            'DID Display': number.didDisplay,
            'Link Type': number.linkType,
            'Link Data': number.linkData,
            'Status': number.status,
            'Urgent Message': number.urgentMessage || 'None',
            'Beyond Timeslots Link Type': number.beyondTimeslotsLinkType || 'None',
            'Beyond Timeslots Link Data': number.beyondTimeslotsLinkData || 'None',
            'Timeslots': Array.isArray(number.timeslots) ? number.timeslots.length : 0,
            'Storage Name': number.storage?.originalName || 'None',
            'Storage Category': number.storage?.category || 'None',
            'Created At': new Date(number.createdAt).toLocaleString(),
            'Updated At': new Date(number.updatedAt).toLocaleString()
        }));
    }

    /**
     * Convert numbers to CSV format
     * @param {Array} numbers - Number data
     * @returns {string} - CSV string
     */
    convertToCSV(numbers) {
        if (!numbers || numbers.length === 0) {
            return '';
        }

        const formatted = this.formatNumbersForExport(numbers);
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
     * Download numbers as CSV file
     * @param {Array} numbers - Number data
     * @param {string} filename - Output filename
     */
    downloadAsCSV(numbers, filename = 'numbers.csv') {
        const csv = this.convertToCSV(numbers);
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

export default NumbersService;
