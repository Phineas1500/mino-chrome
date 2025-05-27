// Popup script for Minomize Chrome Extension
console.log('Popup script loaded');

// Configuration
const API_BASE_URL = 'http://100.70.34.122:3001'; // 🔧 Change YOUR_RASPBERRY_PI_IP to your actual Pi IP
const FRONTEND_BASE_URL = 'http://localhost:3000'; // 🔧 Change YOUR_RASPBERRY_PI_IP to your actual Pi IP

// DOM elements
let processButton;
let youtubeStatusText;
let jobsList;

// State
let currentTab = null;
let recentJobs = [];

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup DOM loaded');
  
  // Get DOM elements
  processButton = document.getElementById('process-current-video');
  youtubeStatusText = document.getElementById('youtube-status-text');
  jobsList = document.getElementById('jobs-list');
  
  // Set up event listeners
  setupEventListeners();
  
  // Check current tab
  await checkCurrentTab();
  
  // Load recent jobs
  await loadRecentJobs();
  
  console.log('Popup initialized');
});

// Set up event listeners
function setupEventListeners() {
  // Process current video button
  processButton?.addEventListener('click', handleProcessCurrentVideo);
  
  // Open website link
  document.getElementById('open-website')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: FRONTEND_BASE_URL });
    window.close();
  });
  
  // Help link
  document.getElementById('help-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: `${FRONTEND_BASE_URL}/help` });
    window.close();
  });
}

// Check current tab and update UI accordingly
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    
    if (tab?.url) {
      const isYouTube = tab.url.includes('youtube.com/watch') || tab.url.includes('youtu.be/');
      
      if (isYouTube) {
        youtubeStatusText.textContent = 'YouTube video detected';
        processButton.disabled = false;
        
        // Extract video title from tab title
        const videoTitle = tab.title?.replace(' - YouTube', '') || 'Current Video';
        processButton.querySelector('.button-text').textContent = `Minomize "${truncateText(videoTitle, 20)}"`;
        
      } else {
        youtubeStatusText.textContent = 'Visit a YouTube video to get started';
        processButton.disabled = true;
        processButton.querySelector('.button-text').textContent = 'Minomize This Video';
      }
    }
  } catch (error) {
    console.error('Error checking current tab:', error);
    youtubeStatusText.textContent = 'Unable to detect current page';
    processButton.disabled = true;
  }
}

// Handle process current video button click
async function handleProcessCurrentVideo() {
  if (!currentTab?.url) {
    showErrorMessage('No active tab found');
    return;
  }
  
  try {
    // Update button state
    updateProcessButtonState('loading', 'Starting...');
    
    // Send message to background script
    const response = await chrome.runtime.sendMessage({
      action: 'startProcessing',
      videoUrl: currentTab.url
    });
    
    if (response.success) {
      // Store job info
      const jobInfo = {
        id: response.jobId,
        url: currentTab.url,
        title: currentTab.title?.replace(' - YouTube', '') || 'YouTube Video',
        status: 'processing',
        startTime: Date.now()
      };
      
      // Add to recent jobs
      recentJobs.unshift(jobInfo);
      await saveRecentJobs();
      
      // Update UI
      updateProcessButtonState('success', 'Processing Started!');
      await loadRecentJobs();
      
      // Show success message
      showSuccessMessage('Processing started! You\'ll be notified when it\'s ready.');
      
      // Reset button after 2 seconds
      setTimeout(() => {
        updateProcessButtonState('default', `Minomize "${truncateText(jobInfo.title, 20)}"`);
      }, 2000);
      
    } else {
      throw new Error(response.error || 'Failed to start processing');
    }
    
  } catch (error) {
    console.error('Error processing video:', error);
    updateProcessButtonState('error', 'Error');
    showErrorMessage(error.message || 'Failed to start processing');
    
    // Reset button after 3 seconds
    setTimeout(() => {
      const videoTitle = currentTab.title?.replace(' - YouTube', '') || 'Current Video';
      updateProcessButtonState('default', `Minomize "${truncateText(videoTitle, 20)}"`);
    }, 3000);
  }
}

// Update process button state
function updateProcessButtonState(state, text) {
  const buttonIcon = processButton.querySelector('.button-icon');
  const buttonText = processButton.querySelector('.button-text');
  
  // Remove all state classes
  processButton.classList.remove('loading', 'success', 'error');
  
  switch (state) {
    case 'loading':
      processButton.disabled = true;
      processButton.classList.add('loading');
      buttonIcon.textContent = '⏳';
      break;
      
    case 'success':
      processButton.disabled = false;
      processButton.classList.add('success');
      buttonIcon.textContent = '✅';
      break;
      
    case 'error':
      processButton.disabled = false;
      processButton.classList.add('error');
      buttonIcon.textContent = '❌';
      break;
      
    default: // 'default'
      processButton.disabled = false;
      buttonIcon.textContent = '✨';
      break;
  }
  
  buttonText.textContent = text;
}

// Load recent jobs from storage
async function loadRecentJobs() {
  try {
    const result = await chrome.storage.local.get(['recentJobs']);
    recentJobs = result.recentJobs || [];
    
    // Clean up old jobs (older than 7 days)
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    recentJobs = recentJobs.filter(job => job.startTime > oneWeekAgo);
    
    // Update jobs status if needed
    await updateJobsStatus();
    
    // Render jobs list
    renderJobsList();
    
  } catch (error) {
    console.error('Error loading recent jobs:', error);
  }
}

// Save recent jobs to storage
async function saveRecentJobs() {
  try {
    await chrome.storage.local.set({ recentJobs: recentJobs });
  } catch (error) {
    console.error('Error saving recent jobs:', error);
  }
}

// Update status of processing jobs
async function updateJobsStatus() {
  const processingJobs = recentJobs.filter(job => job.status === 'processing');
  
  for (const job of processingJobs) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'checkStatus',
        jobId: job.id
      });
      
      if (response.success) {
        job.status = response.status.status;
        job.progress = response.status.progress;
        job.message = response.status.message;
      }
    } catch (error) {
      console.error(`Error checking status for job ${job.id}:`, error);
    }
  }
  
  await saveRecentJobs();
}

// Render jobs list
function renderJobsList() {
  if (!jobsList) return;
  
  if (recentJobs.length === 0) {
    jobsList.innerHTML = '<p class="no-jobs">No recent processing jobs</p>';
    return;
  }
  
  const jobsHTML = recentJobs.slice(0, 5).map(job => {
    const statusIcon = getStatusIcon(job.status);
    const actionButton = getActionButton(job);
    
    return `
      <div class="job-item">
        <div class="job-info">
          <div class="job-title" title="${job.title}">${truncateText(job.title, 25)}</div>
          <div class="job-status ${job.status}">
            <span class="job-status-icon">${statusIcon}</span>
            ${getStatusText(job)}
          </div>
        </div>
        ${actionButton}
      </div>
    `;
  }).join('');
  
  jobsList.innerHTML = jobsHTML;
  
  // Add event listeners for action buttons
  jobsList.querySelectorAll('.job-action').forEach(button => {
    button.addEventListener('click', handleJobAction);
  });
}

// Get status icon for job
function getStatusIcon(status) {
  switch (status) {
    case 'processing': return '🔄';
    case 'complete': return '✅';
    case 'error': return '❌';
    default: return '⏳';
  }
}

// Get status text for job
function getStatusText(job) {
  switch (job.status) {
    case 'processing':
      return job.message || `${job.progress || 0}%`;
    case 'complete':
      return 'Ready';
    case 'error':
      return 'Failed';
    default:
      return 'Unknown';
  }
}

// Get action button for job
function getActionButton(job) {
  switch (job.status) {
    case 'complete':
      return `<button class="job-action" data-job-id="${job.id}" data-action="view">View</button>`;
    case 'processing':
      return `<button class="job-action" data-job-id="${job.id}" data-action="check">Check</button>`;
    default:
      return '';
  }
}

// Handle job action button clicks
async function handleJobAction(event) {
  const jobId = event.target.dataset.jobId;
  const action = event.target.dataset.action;
  
  if (action === 'view') {
    const resultUrl = `${FRONTEND_BASE_URL}/video/${jobId}`;
    chrome.tabs.create({ url: resultUrl });
    window.close();
    
  } else if (action === 'check') {
    // Refresh job status
    await updateJobsStatus();
    renderJobsList();
  }
}

// Utility functions
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function showSuccessMessage(message) {
  // You could implement a toast notification here
  console.log('Success:', message);
}

function showErrorMessage(message) {
  // You could implement a toast notification here
  console.error('Error:', message);
}

// Auto-refresh jobs every 30 seconds if popup is open
setInterval(async () => {
  if (document.visibilityState === 'visible') {
    await updateJobsStatus();
    renderJobsList();
  }
}, 30000); 