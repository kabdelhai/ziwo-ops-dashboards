# Ziwo Automation Platform

A modular, OOP-based automation platform for Ziwo API operations.

## 📁 Project Structure

```
ziwo-automation/
├── index.html              # Main HTML file
├── styles.css              # Global styles
├── app.js                  # Main application entry point
├── config.js               # Application configuration
├── session.js              # Session management class
├── services/               # API service modules (reusable)
│   ├── auth-service.js     # Authentication API calls
│   └── agents-service.js   # Agents API calls (REUSABLE MODULE)
└── views/                  # UI components
    └── agents-view.js      # Agents list view component
```

## 🏗️ Architecture

### **1. Session Management** (`session.js`)
- Manages user authentication state
- Stores: access token, username, client name
- Provides helper methods for API URLs

### **2. Services Layer** (`services/`)
Reusable API modules following OOP principles:

#### **AuthService** (`auth-service.js`)
- `login(clientName, username, password)` - Authenticate user

#### **AgentsService** (`agents-service.js`) ⭐ REUSABLE MODULE
- `getAgents(limit, skip)` - Get paginated agents
- `getAllAgents()` - Get all agents
- `getAgentById(agentId)` - Get single agent
- `exportToCSV(agents, clientName)` - Convert to CSV
- `downloadCSV(agents, clientName)` - Download CSV file

**Usage Example:**
```javascript
import AgentsService from './services/agents-service.js';

const agentsService = new AgentsService(session);

// Get agents
const agents = await agentsService.getAgents(50, 0);

// Get single agent
const agent = await agentsService.getAgentById(7);

// Download CSV
await agentsService.downloadCSV(agents, 'my-company');
```

### **3. Views Layer** (`views/`)
UI components that use services:

#### **AgentsView** (`agents-view.js`)
- Manages agents list UI
- Handles pagination
- Integrates with AgentsService

### **4. Main App** (`app.js`)
- Initializes all components
- Manages navigation
- Handles authentication flow

## 🔄 Adding New Features

### Example: Add Numbers Service

1. **Create service:**
```javascript
// services/numbers-service.js
class NumbersService {
    constructor(session) {
        this.session = session;
    }

    async getNumbers(limit, skip) {
        const apiUrl = `${this.session.getApiBaseUrl()}/admin/numbers/?limit=${limit}&skip=${skip}`;
        // ... implementation
    }
}
export default NumbersService;
```

2. **Create view:**
```javascript
// views/numbers-view.js
import NumbersService from '../services/numbers-service.js';

class NumbersView {
    constructor(session, onBackToMenu) {
        this.numbersService = new NumbersService(session);
        // ... implementation
    }
}
export default NumbersView;
```

3. **Integrate in app.js:**
```javascript
import NumbersView from './views/numbers-view.js';

// In initViews():
this.numbersView = new NumbersView(this.session, () => this.showDashboard());

// In menu link handler:
this.numbersLink.addEventListener('click', (e) => {
    e.preventDefault();
    this.showNumbersView();
});
```

## ✅ Benefits

1. **Reusable**: Services can be used anywhere in the app
2. **Maintainable**: Each module has a single responsibility
3. **Testable**: Each class can be tested independently
4. **Scalable**: Easy to add new features without touching existing code
5. **OOP**: Clean class-based structure

## 🚀 Deployment

Upload all files to GitHub maintaining the folder structure. Enable GitHub Pages.

**Important**: Use a web server (GitHub Pages, local server) to avoid CORS issues with ES6 modules.
