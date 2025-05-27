// Content script for YouTube pages
console.log('Minomize extension content script loaded');

// Configuration - Update this with your actual backend URL
const API_BASE_URL = 'http://100.70.34.122:3001'; // 🔧 Change YOUR_RASPBERRY_PI_IP to your actual Pi IP
const FRONTEND_BASE_URL = 'http://localhost:3000';

// State management
let currentVideoUrl = '';
let processingJobs = new Map(); // jobId -> { url, status, startTime }

// Initialize the extension
function init() {
  // Wait for YouTube to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMinomizeButton);
  } else {
    setupMinomizeButton();
  }

  // Listen for navigation changes (YouTube is a SPA)
  window.addEventListener('yt-navigate-finish', setupMinomizeButton);
  
  // Fallback for navigation detection
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(setupMinomizeButton, 1000); // Give YouTube time to load
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Setup the Minomize button
function setupMinomizeButton() {
  // Only run on video watch pages
  if (!location.pathname.startsWith('/watch')) {
    return;
  }

  // Remove existing button if it exists
  const existingButton = document.querySelector('#minomize-button');
  if (existingButton) {
    existingButton.remove();
  }

  // Wait for YouTube's action buttons to load
  const checkForActionButtons = () => {
    const actionButtons = document.querySelector('#actions-inner, #menu-container, #top-level-buttons-computed');
    
    if (actionButtons) {
      createMinomizeButton(actionButtons);
    } else {
      // Retry after a short delay
      setTimeout(checkForActionButtons, 500);
    }
  };

  checkForActionButtons();
}

// Create and insert the Minomize button
function createMinomizeButton(actionButtonsContainer) {
  const videoUrl = getCurrentVideoUrl();
  if (!videoUrl) return;

  // Create the button container
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'minomize-button';
  buttonContainer.className = 'minomize-button-container';

  // Check if this video is already being processed
  const isProcessing = Array.from(processingJobs.values()).some(job => job.url === videoUrl);
  
  const button = document.createElement('button');
  button.className = 'minomize-btn';
  button.innerHTML = `
    <svg class="minomize-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
    <span class="minomize-text">${isProcessing ? 'Processing...' : 'Minomize'}</span>
  `;
  
  if (isProcessing) {
    button.disabled = true;
    button.classList.add('processing');
  }

  button.addEventListener('click', () => handleMinomizeClick(videoUrl, button));

  buttonContainer.appendChild(button);

  // Insert the button next to YouTube's action buttons
  const targetContainer = actionButtonsContainer.querySelector('#top-level-buttons-computed') || actionButtonsContainer;
  targetContainer.appendChild(buttonContainer);

  console.log('Minomize button added to YouTube page');
}

// Handle the Minomize button click
async function handleMinomizeClick(videoUrl, button) {
  console.log('🎯 Minomize button clicked for URL:', videoUrl);
  
  try {
    // Update button state
    updateButtonState(button, 'loading', 'Starting...');
    console.log('📤 Sending message to background script...');

    // Wake up service worker and send message
    let response;
    try {
      response = await chrome.runtime.sendMessage({
        action: 'startProcessing',
        videoUrl: videoUrl
      });
    } catch (error) {
      console.error('🔴 Failed to send message to background script:', error);
      
      // Try to wake up the service worker and retry
      console.log('⏰ Attempting to wake up service worker...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      response = await chrome.runtime.sendMessage({
        action: 'startProcessing',
        videoUrl: videoUrl
      });
    }

    console.log('📥 Received response from background script:', response);

    if (response && response.success) {
      const jobId = response.jobId;
      console.log('✅ Processing started successfully with jobId:', jobId);
      
      // Store the job
      processingJobs.set(jobId, {
        url: videoUrl,
        status: 'processing',
        startTime: Date.now()
      });

      // Update button state
      updateButtonState(button, 'processing', 'Processing...');

      // Start polling for status
      pollJobStatus(jobId, button);

      // Show notification
      showNotification('Processing started!', 'Your video is being processed by Minomize.');

    } else {
      console.error('❌ Background script returned error:', response?.error || 'No response');
      throw new Error(response?.error || 'Failed to start processing - no response from background script');
    }

  } catch (error) {
    console.error('💥 Error in handleMinomizeClick:', error);
    updateButtonState(button, 'error', 'Error');
    showNotification('Error', error.message || 'Failed to start processing');
    
    // Reset button after 3 seconds
    setTimeout(() => {
      updateButtonState(button, 'default', 'Minomize');
    }, 3000);
  }
}

// Update button visual state
function updateButtonState(button, state, text) {
  const textElement = button.querySelector('.minomize-text');
  const iconElement = button.querySelector('.minomize-icon');
  
  // Remove all state classes
  button.classList.remove('processing', 'completed', 'error');
  
  switch (state) {
    case 'loading':
      button.disabled = true;
      button.classList.add('processing');
      iconElement.innerHTML = `
        <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
        </path>
      `;
      break;
      
    case 'processing':
      button.disabled = true;
      button.classList.add('processing');
      iconElement.innerHTML = `
        <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
        </path>
      `;
      break;
      
    case 'completed':
      button.disabled = false;
      button.classList.add('completed');
      iconElement.innerHTML = `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>`;
      break;
      
    case 'error':
      button.disabled = false;
      button.classList.add('error');
      iconElement.innerHTML = `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>`;
      break;
      
    default: // 'default'
      button.disabled = false;
      iconElement.innerHTML = `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>`;
      break;
  }
  
  if (textElement) {
    textElement.textContent = text;
  }
}

// Poll job status
async function pollJobStatus(jobId, button) {
  const maxPollTime = 10 * 60 * 1000; // 10 minutes
  const pollInterval = 5000; // 5 seconds
  const startTime = Date.now();

  const poll = async () => {
    try {
      // Check if we've exceeded max poll time
      if (Date.now() - startTime > maxPollTime) {
        throw new Error('Processing timeout');
      }

      const response = await chrome.runtime.sendMessage({
        action: 'checkStatus',
        jobId: jobId
      });

      if (response.success) {
        const status = response.status;
        
        // Update stored job
        if (processingJobs.has(jobId)) {
          processingJobs.set(jobId, {
            ...processingJobs.get(jobId),
            status: status.status
          });
        }

        // Update button with progress
        if (status.status === 'processing') {
          const progressText = status.message || `Processing... ${status.progress || 0}%`;
          updateButtonState(button, 'processing', progressText);
          
          // Continue polling
          setTimeout(poll, pollInterval);
          
        } else if (status.status === 'complete') {
          // Processing completed!
          updateButtonState(button, 'completed', 'View Results');
          
          // Remove from processing jobs
          processingJobs.delete(jobId);
          
          // Show completion notification with link
          const resultUrl = `${FRONTEND_BASE_URL}/video/${jobId}`;
          showNotification(
            'Video processed!', 
            'Your Minomized video is ready. Click to view.',
            resultUrl
          );
          
          // Make button clickable to open results
          button.onclick = () => {
            chrome.runtime.sendMessage({
              action: 'openTab',
              url: resultUrl
            });
          };
          
        } else if (status.status === 'error') {
          // Processing failed
          updateButtonState(button, 'error', 'Failed');
          processingJobs.delete(jobId);
          
          showNotification('Processing failed', status.message || 'An error occurred during processing');
          
          // Reset button after 3 seconds
          setTimeout(() => {
            updateButtonState(button, 'default', 'Minomize');
            button.onclick = () => handleMinomizeClick(getCurrentVideoUrl(), button);
          }, 3000);
        }
        
      } else {
        throw new Error(response.error || 'Failed to check status');
      }
      
    } catch (error) {
      console.error('Error polling job status:', error);
      updateButtonState(button, 'error', 'Error');
      processingJobs.delete(jobId);
      
      // Reset button after 3 seconds
      setTimeout(() => {
        updateButtonState(button, 'default', 'Minomize');
        button.onclick = () => handleMinomizeClick(getCurrentVideoUrl(), button);
      }, 3000);
    }
  };

  // Start polling
  setTimeout(poll, pollInterval);
}

// Get current YouTube video URL
function getCurrentVideoUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('v');
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

// Show notification
function showNotification(title, message, actionUrl = null) {
  chrome.runtime.sendMessage({
    action: 'showNotification',
    title: title,
    message: message,
    actionUrl: actionUrl
  });
}

// Initialize when script loads
init(); 