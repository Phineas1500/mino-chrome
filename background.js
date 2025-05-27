// Background service worker for Minomize Chrome Extension
console.log('🚀 Minomize background service worker loaded');

// Immediate activation to ensure service worker is ready
self.addEventListener('activate', (event) => {
  console.log('🔄 Service worker activated');
  event.waitUntil(self.clients.claim());
});

// Install event
self.addEventListener('install', (event) => {
  console.log('📦 Service worker installed');
  self.skipWaiting();
});

// Configuration - Update this with your actual backend URL
const API_BASE_URL = 'http://100.70.34.122:3001'; // 🔧 Change YOUR_RASPBERRY_PI_IP to your actual Pi IP

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background received message:', request);

  // Test message to ensure service worker is working
  if (request.action === 'ping') {
    console.log('🏓 Ping received, sending pong');
    sendResponse({ success: true, message: 'pong' });
    return false;
  }

  switch (request.action) {
    case 'startProcessing':
      handleStartProcessing(request.videoUrl, sendResponse);
      return true; // Will respond asynchronously

    case 'checkStatus':
      handleCheckStatus(request.jobId, sendResponse);
      return true; // Will respond asynchronously

    case 'showNotification':
      handleShowNotification(request.title, request.message, request.actionUrl);
      sendResponse({ success: true });
      return false;

    case 'openTab':
      handleOpenTab(request.url);
      sendResponse({ success: true });
      return false;

    default:
      console.warn('Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

// Handle starting video processing
async function handleStartProcessing(videoUrl, sendResponse) {
  console.log('🚀 handleStartProcessing called with URL:', videoUrl);
  console.log('🔗 API_BASE_URL:', API_BASE_URL);
  
  try {
    console.log('📡 Making fetch request to:', `${API_BASE_URL}/process/youtube-url`);

    const response = await fetch(`${API_BASE_URL}/process/youtube-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        youtubeUrl: videoUrl
      })
    });

    console.log('📊 Fetch response status:', response.status);
    console.log('📊 Fetch response ok:', response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Processing started successfully:', data);
      
      sendResponse({
        success: true,
        jobId: data.jobId
      });
    } else {
      const errorText = await response.text();
      console.error('❌ Backend responded with error:', response.status, errorText);
      
      let errorMessage = 'Failed to start processing';
      if (response.status === 409) {
        errorMessage = 'This video is already being processed. Please wait.';
      } else if (response.status === 400) {
        errorMessage = 'Invalid YouTube URL provided.';
      }
      
      sendResponse({
        success: false,
        error: errorMessage
      });
    }
  } catch (error) {
    console.error('💥 Network error in handleStartProcessing:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    sendResponse({
      success: false,
      error: 'Network error. Please check your connection and try again.'
    });
  }
}

// Handle checking job status
async function handleCheckStatus(jobId, sendResponse) {
  try {
    console.log('Checking status for job:', jobId);

    const response = await fetch(`${API_BASE_URL}/process/status/${jobId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const statusData = await response.json();
      console.log('Status check successful:', statusData);
      
      sendResponse({
        success: true,
        status: statusData
      });
    } else if (response.status === 404) {
      console.error('Job not found:', jobId);
      sendResponse({
        success: false,
        error: 'Processing job not found'
      });
    } else {
      const errorText = await response.text();
      console.error('Failed to check status:', response.status, errorText);
      sendResponse({
        success: false,
        error: 'Failed to check processing status'
      });
    }
  } catch (error) {
    console.error('Error checking status:', error);
    sendResponse({
      success: false,
      error: 'Network error while checking status'
    });
  }
}

// Handle showing notifications
function handleShowNotification(title, message, actionUrl = null) {
  const notificationOptions = {
    type: 'basic',
    iconUrl: 'icon.png',
    title: title,
    message: message
  };

  chrome.notifications.create('minomize-notification', notificationOptions, (notificationId) => {
    console.log('Notification created:', notificationId);
    
    // Store action URL if provided
    if (actionUrl) {
      chrome.storage.local.set({
        [`notification-${notificationId}`]: actionUrl
      });
    }
  });
}

// Handle opening new tabs
function handleOpenTab(url) {
  chrome.tabs.create({ url: url }, (tab) => {
    console.log('Opened new tab:', tab.id, url);
  });
}

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('Notification clicked:', notificationId);
  
  // Get stored action URL
  chrome.storage.local.get([`notification-${notificationId}`], (result) => {
    const actionUrl = result[`notification-${notificationId}`];
    
    if (actionUrl) {
      // Open the results page
      handleOpenTab(actionUrl);
      
      // Clean up stored URL
      chrome.storage.local.remove([`notification-${notificationId}`]);
    }
    
    // Clear the notification
    chrome.notifications.clear(notificationId);
  });
});

// Handle extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details);
  
  if (details.reason === 'install') {
    console.log('Extension installed for the first time');
    
    // Show welcome notification
    handleShowNotification(
      'Minomize Extension Installed!',
      'Visit any YouTube video and click the Minomize button to get started.'
    );
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
});

// Error handling for unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in background script:', event.reason);
  event.preventDefault();
});

// Global error handler
self.addEventListener('error', (event) => {
  console.error('Error in background script:', event.error);
});

// Simple keep-alive mechanism (alternative to chrome.alarms)
setInterval(() => {
  console.log('🔄 Service worker keep-alive ping');
}, 60000); // Every minute

console.log('Background service worker setup complete'); 