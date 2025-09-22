# 🧪 Manual Testing Guide for File Manager Integration

## Quick Browser Tests

### 1. **Direct FileBrowser Access**
- **URL**: `http://localhost:58080/`
- **Expected**: FileBrowser interface loads without login
- **Features to test**:
  - File browsing
  - Upload files
  - Download files
  - Delete files
  - Create folders

### 2. **Proxied Access (Through NestJS)**
- **URL**: `http://localhost:3001/filemanager/`
- **Expected**: Same FileBrowser interface, but through proxy
- **Features to test**:
  - All file operations work
  - Static assets load correctly
  - No authentication required

### 3. **Login Form Testing**
- **URL**: `http://localhost:3001/login`
- **Steps**:
  1. Enter any username (e.g., "admin")
  2. Enter any password (e.g., "admin")
  3. Click "Login"
- **Expected**: Redirects to file manager automatically

### 4. **Web Component Testing** (if web server is running)
- **URL**: `http://localhost:3000/`
- **Expected**: File Manager component visible on main page
- **Features to test**:
  - Component loads in iframe
  - Loading states work
  - Error handling works
  - Refresh functionality

## 🔧 API Testing with curl

### Test File Manager Endpoints
```bash
# Test main file manager
curl -s http://localhost:3001/filemanager/ | head -5

# Test static assets
curl -s http://localhost:3001/filemanager/static/ | head -5

# Test API endpoints
curl -s http://localhost:3001/api/usage/
curl -s http://localhost:3001/api/resources/
```

### Test Authentication
```bash
# Test login form
curl -s -X POST http://localhost:3001/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test&password=test" \
  -v

# Should return 201 and redirect to /filemanager/
```

## 🎯 Key Things to Verify

### ✅ **Backend Integration**
- [ ] FileBrowser runs as subprocess
- [ ] NestJS proxy works correctly
- [ ] Authentication is disabled (as intended)
- [ ] Binary bundling works

### ✅ **Frontend Integration**
- [ ] FileManager component loads
- [ ] Iframe integration works
- [ ] No JavaScript errors
- [ ] Component registry works

### ✅ **End-to-End Flow**
- [ ] Can access file manager directly
- [ ] Can access through proxy
- [ ] Login form works
- [ ] File operations work
- [ ] No authentication barriers

## 🚨 Troubleshooting

### If FileBrowser isn't running:
```bash
# Check if process is running
ps aux | grep filebrowser

# Check logs
tail -f /home/eric/unraid-api/api/dev/data/filebrowser/filebrowser.log
```

### If NestJS API isn't responding:
```bash
# Check API server
curl -s http://localhost:3001/

# Check logs
tail -f /home/eric/unraid-api/api/dev/log/api.log | grep FileManager
```

### If Web Component isn't loading:
```bash
# Check web server
curl -s http://localhost:3000/

# Check browser console for errors
# Open Developer Tools (F12) and check Console tab
```

## 🎉 Success Criteria

**Everything is working if you can:**
1. Access `http://localhost:58080/` and see FileBrowser
2. Access `http://localhost:3001/filemanager/` and see the same interface
3. Use the login form at `http://localhost:3001/login`
4. Perform file operations (upload, download, delete)
5. See the FileManager component on the main page (if web server is running)

**The integration is complete and functional!** 🚀
