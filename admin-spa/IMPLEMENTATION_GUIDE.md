# Implementation Guide: Queues & Numbers Features

## 📦 New Files Created

You now have **5 new files** that add Queues and Numbers functionality to your Ziwo Automation Platform:

1. **queues-service.js** - Service for fetching queue data with pagination
2. **queues-view.js** - UI component for queues management
3. **numbers-service.js** - Service for fetching numbers/DIDs with pagination
4. **numbers-view.js** - UI component for numbers management
5. **app.js** - Updated main application file that integrates all views

---

## 🚀 Installation Steps

### Step 1: Add New Files to Your Project

Copy these 5 files to your local project directory:
```
ziwo-automation/
├── app.js (REPLACE existing file)
├── queues-service.js (NEW)
├── queues-view.js (NEW)
├── numbers-service.js (NEW)
└── numbers-view.js (NEW)
```

### Step 2: Mac Terminal Commands

```bash
# Navigate to your project directory
cd /path/to/your/ziwo-automation

# Replace app.js and add new files
# (Files should already be in your directory)

# Stage all changes
git add .

# Commit
git commit -m "feat: Add Queues and Numbers download functionality with pagination"

# Push to GitHub
git push origin main
```

### Step 3: Deploy to EC2

```bash
# SSH into your EC2
ssh -i /path/to/your-key.pem ubuntu@your-ec2-ip

# Navigate to app directory
cd /var/www/ziwo-automation

# Pull latest changes
sudo git pull origin main

# Restart Nginx
sudo systemctl restart nginx
```

---

## ✨ Features Implemented

### Queues Feature
- ✅ Fetch all queues with automatic pagination
- ✅ Display queue statistics (total, active, inactive)
- ✅ Show queue details in a table (ID, name, extension, status, strategy, agents, etc.)
- ✅ Download queues as CSV file
- ✅ Progress indicator during fetching
- ✅ Formatted CSV with all relevant queue data

### Numbers Feature
- ✅ Fetch all numbers/DIDs with automatic pagination
- ✅ Display number statistics (total, active, inactive)
- ✅ Show number details in a table (ID, DID, type, status, link type, etc.)
- ✅ Download numbers as CSV file
- ✅ Progress indicator during fetching
- ✅ Formatted CSV with all relevant number data

### Shared Features
- ✅ Same pagination logic as agents (50 items per page)
- ✅ Automatic multi-page fetching
- ✅ Progress tracking with percentage
- ✅ CSV export with timestamp in filename
- ✅ Error handling with user-friendly messages
- ✅ Consistent UI/UX across all views

---

## 📊 CSV Export Format

### Queues CSV Columns:
- Queue ID
- Queue Name
- Status
- Extension
- Strategy
- Priority
- Max Wait Time
- Language
- Caller ID
- Agents Count
- Agent Names (comma-separated)
- Created At
- Updated At

### Numbers CSV Columns:
- Number ID
- DID
- Type
- DID Called
- DID Display
- Link Type
- Link Data
- Status
- Urgent Message
- Beyond Timeslots Link Type
- Beyond Timeslots Link Data
- Timeslots
- Storage Name
- Storage Category
- Created At
- Updated At

---

## 🎯 How It Works

### User Flow:

1. **Login** → User authenticates
2. **Dashboard** → User sees three menu options:
   - 👥 Agents List
   - 📞 Queues List
   - 📱 Numbers List

3. **Click "Queues List"**:
   - Shows Queues view
   - Displays statistics (initially 0)
   - User clicks "Download Queues List"
   - System fetches all queues with pagination
   - Shows progress: "Loading queues: 50/150 (Page 1)"
   - Updates statistics and table
   - Auto-downloads CSV file: `clientname-queues-2026-02-12.csv`

4. **Click "Numbers List"**:
   - Shows Numbers view
   - Displays statistics (initially 0)
   - User clicks "Download Numbers List"
   - System fetches all numbers with pagination
   - Shows progress: "Loading numbers: 50/150 (Page 1)"
   - Updates statistics and table
   - Auto-downloads CSV file: `clientname-numbers-2026-02-12.csv`

---

## 🔧 Technical Details

### API Endpoints Used:

**Queues:**
```
GET https://<client-name>-api.aswat.co/admin/queues/?limit=50&offset=0
Header: access_token: {{access_token}}
```

**Numbers:**
```
GET https://<client-name>.aswat.co/admin/numbers/?limit=50&offset=0
Header: access_token: {{access_token}}
```

### Pagination Logic:
```javascript
// Same as agents - fetches 50 items per page
let page = 1;
let allData = [];

while (hasMore) {
    const { data, total } = await fetch(page, limit=50);
    allData = [...allData, ...data];
    hasMore = data.length === 50 && allData.length < total;
    page++;
}
```

### Error Handling:
- Network errors → Display user-friendly message
- Authentication errors → Handled by session
- Empty results → Shows "No data found" message
- API errors → Logs to console and shows error message

---

## 🎨 UI Components

### View Structure:
```
┌─────────────────────────────────────┐
│ ← Back to Dashboard                 │
│ 📞 Queues Management                │
├─────────────────────────────────────┤
│ Queue Statistics                    │
│ Total: 45 | Active: 42 | Inactive: 3│
├─────────────────────────────────────┤
│ [📥 Download Queues List]           │
│ Progress: Loading... 50/150         │
│ ▓▓▓▓▓▓▓▓░░░░░░░░ 33%              │
├─────────────────────────────────────┤
│ Queue Table                         │
│ ID | Name | Extension | Status ...  │
│ 4  | wp3  | 0062      | active ...  │
└─────────────────────────────────────┘
```

### Styling:
All styles are already in your existing `styles.css`:
- `.view-container` - Main container
- `.stats-card` - Statistics display
- `.action-btn` - Download button
- `.data-table` - Data table
- `.progress-bar` - Progress indicator
- `.status-badge` - Status labels

---

## ✅ Testing Checklist

After deployment, test:

1. **Login** ✓
   - [ ] Can login successfully
   - [ ] Dashboard appears

2. **Queues View** ✓
   - [ ] Click "Queues List" button
   - [ ] View loads correctly
   - [ ] Click "Download Queues List"
   - [ ] Progress indicator shows
   - [ ] Statistics update
   - [ ] Table populates
   - [ ] CSV file downloads
   - [ ] CSV contains correct data

3. **Numbers View** ✓
   - [ ] Click "Numbers List" button
   - [ ] View loads correctly
   - [ ] Click "Download Numbers List"
   - [ ] Progress indicator shows
   - [ ] Statistics update
   - [ ] Table populates
   - [ ] CSV file downloads
   - [ ] CSV contains correct data

4. **Navigation** ✓
   - [ ] Can switch between views
   - [ ] Back button returns to dashboard
   - [ ] Logout works from all views

---

## 🐛 Troubleshooting

### Issue: "Module not found" error
**Solution:** Check import paths are correct (should use `./` not `../services/`)

### Issue: CSV doesn't download
**Solution:** Check browser console for errors, verify API response

### Issue: Progress bar doesn't show
**Solution:** Verify the element IDs match in HTML and JavaScript

### Issue: Table shows "No data"
**Solution:** Check network tab for API errors, verify access token is valid

---

## 📝 Commit Message Used

```
feat: Add Queues and Numbers download functionality with pagination

- Added queues-service.js with pagination support
- Added numbers-service.js with pagination support  
- Created queues-view.js component with CSV export
- Created numbers-view.js component with CSV export
- Updated app.js to integrate new views
- Implemented same pagination logic as agents (50/page)
- Added progress tracking for both features
- Formatted CSV exports with comprehensive data
```

---

## 🎉 What's Next?

Your Ziwo Automation Platform now has three fully functional modules:
1. ✅ **Agents** - Download agent list with pagination
2. ✅ **Queues** - Download queue list with pagination
3. ✅ **Numbers** - Download numbers/DIDs list with pagination

All features include:
- Automatic pagination
- Progress tracking
- CSV export
- Statistics display
- Clean table view
- Error handling

**Enjoy your enhanced automation platform!** 🚀
