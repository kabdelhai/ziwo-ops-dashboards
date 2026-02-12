# API Calls Reference - Ziwo Automation Platform

This document shows exactly how each service calls the Ziwo API.

---

## 🔑 Parameters Used

All APIs now use:
- `limit` - Number of items per page (default: 50)
- `skip` - Number of items to skip (calculated as: `(page - 1) * limit`)

---

## 👥 Agents API

### Endpoint:
```
GET https://<client-name>-api.aswat.co/admin/users/
```

### Example Curl Command:
```bash
# Page 1 (first 50 agents)
curl --location 'https://your-client-api.aswat.co/admin/users/?limit=50&skip=0' \
--header 'access_token: YOUR_ACCESS_TOKEN' \
--header 'Content-Type: application/json'

# Page 2 (next 50 agents)
curl --location 'https://your-client-api.aswat.co/admin/users/?limit=50&skip=50' \
--header 'access_token: YOUR_ACCESS_TOKEN' \
--header 'Content-Type: application/json'

# Page 3 (next 50 agents)
curl --location 'https://your-client-api.aswat.co/admin/users/?limit=50&skip=100' \
--header 'access_token: YOUR_ACCESS_TOKEN' \
--header 'Content-Type: application/json'
```

### Code Implementation:
```javascript
const skip = (page - 1) * limit;
const url = `${this.baseUrl.replace('<client-name>', clientName)}/admin/users/?limit=${limit}&skip=${skip}`;
```

---

## 📞 Queues API

### Endpoint:
```
GET https://<client-name>-api.aswat.co/admin/queues/
```

### Example Curl Command:
```bash
# Page 1 (first 50 queues)
curl --location 'https://your-client-api.aswat.co/admin/queues/?limit=50&skip=0' \
--header 'access_token: YOUR_ACCESS_TOKEN' \
--header 'Content-Type: application/json'

# Page 2 (next 50 queues)
curl --location 'https://your-client-api.aswat.co/admin/queues/?limit=50&skip=50' \
--header 'access_token: YOUR_ACCESS_TOKEN' \
--header 'Content-Type: application/json'
```

### Code Implementation:
```javascript
const skip = (page - 1) * limit;
const url = `${this.baseUrl.replace('<client-name>', clientName)}/admin/queues/?limit=${limit}&skip=${skip}`;
```

---

## 📱 Numbers API

### Endpoint:
```
GET https://<client-name>.aswat.co/admin/numbers/
```

**Note:** Numbers API uses different subdomain format (no `-api` suffix)

### Example Curl Command:
```bash
# Page 1 (first 50 numbers)
curl --location 'https://your-client.aswat.co/admin/numbers/?limit=50&skip=0' \
--header 'access_token: YOUR_ACCESS_TOKEN' \
--header 'Content-Type: application/json'

# Page 2 (next 50 numbers)
curl --location 'https://your-client.aswat.co/admin/numbers/?limit=50&skip=50' \
--header 'access_token: YOUR_ACCESS_TOKEN' \
--header 'Content-Type: application/json'
```

### Code Implementation:
```javascript
const skip = (page - 1) * limit;
const url = `${this.baseUrl.replace('<client-name>', clientName)}/admin/numbers/?limit=${limit}&skip=${skip}`;
```

---

## 🔄 Pagination Logic

All three services use the same pagination algorithm:

```javascript
async fetchAll(accessToken, onProgress = null) {
    let allData = [];
    let page = 1;
    let hasMore = true;
    const limit = 50;

    while (hasMore) {
        // Calculate skip value
        const skip = (page - 1) * limit;
        
        // Fetch data
        const { data, total } = await this.fetch(accessToken, page, limit);
        allData = [...allData, ...data];

        // Update progress
        if (onProgress) {
            onProgress({
                current: allData.length,
                total: total || allData.length,
                page
            });
        }

        // Check if there's more data
        hasMore = data.length === limit && allData.length < (total || Infinity);
        page++;
    }

    return allData;
}
```

### Pagination Examples:

| Page | Limit | Skip | Description |
|------|-------|------|-------------|
| 1 | 50 | 0 | First 50 items |
| 2 | 50 | 50 | Items 51-100 |
| 3 | 50 | 100 | Items 101-150 |
| 4 | 50 | 150 | Items 151-200 |

**Formula:** `skip = (page - 1) * limit`

---

## 📊 Response Format

All APIs return the same structure:

```json
{
  "result": true,
  "content": [
    { /* item 1 */ },
    { /* item 2 */ },
    // ... up to 'limit' items
  ],
  "info": {
    "total": 150  // Total number of items available
  }
}
```

---

## ⚙️ Configuration

The base URL is configured in `config.js`:

```javascript
const config = {
    apiBaseUrl: 'https://<client-name>-api.aswat.co'
};
```

**Note:** Numbers API automatically handles the different subdomain format internally.

---

## 🔍 Testing Your APIs

You can test these exact curl commands by replacing:
- `<client-name>` with your actual client name (e.g., `your-client`)
- `YOUR_ACCESS_TOKEN` with your actual access token

Example:
```bash
curl --location 'https://your-client-api.aswat.co/admin/users/?limit=50&skip=0' \
--header 'access_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--header 'Content-Type: application/json'
```

---

## ✅ Summary

All three services now consistently use:
- ✅ `limit` parameter (default: 50)
- ✅ `skip` parameter (calculated from page number)
- ✅ Same pagination logic
- ✅ Progress tracking
- ✅ CSV export functionality
