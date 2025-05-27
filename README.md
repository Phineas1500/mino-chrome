# Minomize Chrome Extension

A Chrome extension that integrates with YouTube to provide AI-powered video summaries, key points, and flashcards through the Minomize platform.

## Features

- 🎯 **One-click Processing**: Add a "Minomize" button directly to YouTube videos
- 📊 **Real-time Progress**: Track processing status with live updates
- 🔔 **Smart Notifications**: Get notified when your video is ready
- 📱 **Modern UI**: Clean, responsive design that matches YouTube's interface
- 💾 **Job History**: Keep track of recent processing jobs

## Setup Instructions

### 1. Backend Configuration

First, make sure your backend server has the correct endpoints. Based on your provided code, you should have:

- `POST /process/youtube-url` - Start processing a YouTube video
- `GET /process/status/:jobId` - Check processing status

Update your backend server code to ensure these endpoints match what the extension expects.

### 2. Extension Configuration

Update the API URLs in the extension files:

#### In `content.js`:
```javascript
const API_BASE_URL = 'https://your-backend-domain.com'; // Replace with your backend URL
```

#### In `background.js`:
```javascript
const API_BASE_URL = 'https://your-backend-domain.com'; // Replace with your backend URL
```

#### In `popup.js`:
```javascript
const API_BASE_URL = 'https://your-backend-domain.com'; // Replace with your backend URL
const FRONTEND_BASE_URL = 'https://your-frontend-domain.com'; // Replace with your frontend URL
```

#### In `manifest.json`:
Update the `host_permissions` array:
```json
"host_permissions": [
  "https://www.youtube.com/*",
  "https://youtube.com/*",
  "https://your-backend-domain.com/*"
]
```

### 3. Install the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this directory
4. The Minomize extension should now appear in your extensions list

### 4. Usage

1. Navigate to any YouTube video
2. Click the "Minomize" button that appears next to the like/dislike buttons
3. The extension will start processing the video and show progress updates
4. You'll receive a notification when processing is complete
5. Click the notification or use the extension popup to view results

## File Structure

```
mino-chrome/
├── manifest.json          # Extension configuration
├── content.js            # Content script (runs on YouTube pages)
├── content.css           # Styles for the Minomize button
├── background.js         # Background service worker
├── popup.html           # Extension popup interface
├── popup.css            # Popup styles
├── popup.js             # Popup functionality
├── icon.png             # Extension icon
└── README.md            # This file
```

## Backend API Requirements

Your backend should implement these endpoints:

### POST /process/youtube-url
Start processing a YouTube video.

**Request Body:**
```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Success Response (202):**
```json
{
  "jobId": "unique-job-id"
}
```

**Error Response (400/409/500):**
```json
{
  "error": "Error message"
}
```

### GET /process/status/:jobId
Check the status of a processing job.

**Success Response (200):**
```json
{
  "status": "processing|complete|error",
  "stage": "downloading|transcribing|analyzing|etc",
  "progress": 75,
  "message": "Optional status message",
  "data": {
    // Only present when status is "complete"
    "transcript": "...",
    "summary": "...",
    "keyPoints": [...],
    "flashcards": [...]
  }
}
```

**Error Response (404):**
```json
{
  "status": "not_found",
  "message": "Job not found"
}
```

## Development

### Testing

1. Load the extension in Chrome
2. Open the Developer Tools (F12)
3. Check the Console for any errors
4. Test on various YouTube videos

### Debugging

- Background script logs: `chrome://extensions/` → Click "Inspect views: Service Worker"
- Content script logs: Open DevTools on any YouTube page
- Popup logs: Right-click extension icon → "Inspect popup"

## CORS Configuration

Make sure your backend allows requests from Chrome extensions. Add these headers:

```javascript
app.use(cors({
  origin: true, // Allow all origins for development
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: false
}));
```

## Security Notes

- Update URLs in production to use HTTPS
- Consider implementing API authentication
- Validate all inputs on the backend
- Use Content Security Policy (CSP) headers

## Troubleshooting

### Common Issues

1. **Button doesn't appear on YouTube**
   - Check if content script is loading in DevTools
   - Verify the extension has permission for YouTube
   - Try refreshing the YouTube page

2. **API calls failing**
   - Check CORS configuration on backend
   - Verify API URLs are correct
   - Check network requests in DevTools

3. **Notifications not working**
   - Ensure notification permission is granted
   - Check if notifications are enabled in Chrome settings

4. **Processing jobs not updating**
   - Verify status polling is working
   - Check background script logs
   - Ensure backend status endpoint is working

### Logs

Check these locations for debugging information:
- Extension popup: Right-click extension icon → Inspect popup
- Background script: chrome://extensions → Service Worker
- Content script: F12 on YouTube page → Console
- Network requests: F12 → Network tab

## License

This extension is part of the Minomize platform. See your main project for licensing information. 