// Multi-method Video Comparison Tool JavaScript

let videosData = [];
let statistics = {};
let currentVideo = null;
let isPlaying = false;
let selectedMethods = new Set();
let currentGridLayout = 'grid-4x2';

// Grid layout configuration
const GRID_LAYOUTS = ['grid-2x1', 'grid-2x2', 'grid-3x2', 'grid-3x3', 'grid-4x2'];
let currentLayoutIndex = 4; // Default 4x2

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadVideosData();
    initializeMethodSelector();
    renderVideoList();  // renderVideoList will automatically call updateVideoCards
    setupEventListeners();
});

// Load video data
async function loadVideosData() {
    try {
        // Add timestamp parameter to prevent browser caching
        const timestamp = new Date().getTime();
        const response = await fetch(`data.json?t=${timestamp}`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        const data = await response.json();
        videosData = data.videos || [];
        statistics = data.statistics || {};
        // updateStats();
    } catch (error) {
        console.error('Failed to load data:', error);
        document.getElementById('videoList').innerHTML = 
            '<div class="loading">⚠️ Failed to load data. Please run generate_data_multi.py first.</div>';
    }
}

// Update statistics
function updateStats() {
    const count = videosData.length;
    const methodCount = Object.keys(statistics.methods || {}).length;
    document.getElementById('videoCount').textContent = 
        `${count} videos | ${methodCount} methods`;
}

// Initialize method selector
function initializeMethodSelector() {
    const container = document.getElementById('methodCheckboxes');
    
    if (!statistics.methods) {
        return;
    }
    
    // Select all methods by default
    const methodIds = Object.keys(statistics.methods);
    selectedMethods = new Set(methodIds);
    
    // Create checkboxes
    for (const [methodId, methodInfo] of Object.entries(statistics.methods)) {
        const checkbox = document.createElement('div');
        checkbox.className = 'method-checkbox';
        
        const isChecked = selectedMethods.has(methodId);
        
        checkbox.innerHTML = `
            <input type="checkbox" id="method-${methodId}" 
                   ${isChecked ? 'checked' : ''} data-method="${methodId}">
            <label for="method-${methodId}">
                <span class="method-color-dot" style="background-color: ${methodInfo.color}"></span>
                <span style="color: ${methodInfo.color};">${methodInfo.name}</span>
            </label>
        `;
        
        container.appendChild(checkbox);
        
        // Add event listener
        const input = checkbox.querySelector('input');
        input.addEventListener('change', (e) => {
            console.log(`[Checkbox Change] Method: ${methodId}, Status: ${e.target.checked}`);
            if (e.target.checked) {
                selectedMethods.add(methodId);
            } else {
                selectedMethods.delete(methodId);
            }
            console.log(`[Checkbox Change] Updated selected methods:`, Array.from(selectedMethods));
            updateVideoCards();  // Update video cards in sync
        });
    }
}

// Render video list
function renderVideoList(filter = '') {
    const videoList = document.getElementById('videoList');
    
    const filteredVideos = videosData.filter(video => 
        video.name.toLowerCase().includes(filter.toLowerCase())
    );
    
    if (filteredVideos.length === 0) {
        videoList.innerHTML = '<div class="loading">😕 No matching videos found</div>';
        return;
    }
    
    videoList.innerHTML = filteredVideos.map(video => {
        // Get all available methods
        const methodsList = Object.entries(video.methods)
            .map(([id, data]) => {
                const methodInfo = statistics.methods[id];
                return `<div class="track-badge" data-method="${id}" style="border-color: ${methodInfo.color}; color: ${methodInfo.color};">
                    ${methodInfo.name}
                </div>`;
            })
            .join('');
        
        // Get RGB video and Ground Truth thumbnails
        const rgbThumbnail = video.methods['rgb_video']?.thumbnail;
        const gtThumbnail = video.methods['annotations']?.thumbnail;
        
        // Default thumbnail: prefer RGB, then GT, then first available
        let defaultThumbnail = rgbThumbnail || gtThumbnail;
        if (!defaultThumbnail) {
            const firstMethod = Object.values(video.methods)[0];
            defaultThumbnail = firstMethod?.thumbnail;
        }
        
        // If both RGB and GT thumbnails exist, create dual-layer structure
        let thumbnailHTML;
        if (rgbThumbnail && gtThumbnail) {
            thumbnailHTML = `
                <img src="${rgbThumbnail}" alt="${video.name}" loading="lazy" class="thumbnail-rgb">
                <img src="${gtThumbnail}" alt="${video.name} GT" loading="lazy" class="thumbnail-gt">
            `;
        } else if (defaultThumbnail) {
            thumbnailHTML = `<img src="${defaultThumbnail}" alt="${video.name}" loading="lazy">`;
        } else {
            thumbnailHTML = '<span class="video-card-placeholder">🎬</span>';
        }
        
        return `
            <div class="video-card" data-video="${video.name}">
                <div class="video-card-thumbnail">
                    ${thumbnailHTML}
                </div>
                <div class="video-card-title">${video.name}</div>
                <div class="video-card-tags">
                    ${methodsList}
                </div>
            </div>
        `;
    }).join('');
    
    // Add click event for each card
    document.querySelectorAll('.video-card').forEach(card => {
        card.addEventListener('click', () => {
            const videoName = card.dataset.video;
            openVideoViewer(videoName);
        });
    });
    
    // Apply method filtering immediately after rendering
    updateVideoCards();
}

// Update video card display status (based on selected methods)
function updateVideoCards() {
    const videoCards = document.querySelectorAll('.video-card');
    console.log(`[updateVideoCards] Found ${videoCards.length} video cards`);
    console.log(`[updateVideoCards] Currently selected methods:`, Array.from(selectedMethods));
    
    videoCards.forEach(card => {
        const videoName = card.dataset.video;
        const video = videosData.find(v => v.name === videoName);
        if (!video) return;
        
        // Get all method badges for this video
        const methodBadges = card.querySelectorAll('.track-badge');
        let visibleBadgesCount = 0;
        
        // Update display of each badge based on selection status
        methodBadges.forEach(badge => {
            const methodId = badge.dataset.method;
            if (selectedMethods.has(methodId)) {
                badge.style.display = '';  // Show
                visibleBadgesCount++;
            } else {
                badge.style.display = 'none';  // Hide
            }
        });
        
        // If all badges are hidden, hide the entire card
        if (visibleBadgesCount === 0) {
            card.style.display = 'none';
        } else {
            card.style.display = '';  // Show
        }
    });
}

// Open video viewer
function openVideoViewer(videoName) {
    currentVideo = videosData.find(v => v.name === videoName);
    if (!currentVideo) return;
    
    const viewer = document.getElementById('videoViewer');
    const title = document.getElementById('viewerTitle');
    const container = document.getElementById('comparisonContainer');
    
    // Set title
    title.textContent = `Comparison: ${videoName}`;
    
    // Clear container
    container.innerHTML = '';
    
    // Only show selected methods
    let methodsToShow = Array.from(selectedMethods)
        .filter(methodId => currentVideo.methods[methodId]);
    
    // If rgb_video exists and not selected, add it to display list
    if (currentVideo.methods['rgb_video'] && !methodsToShow.includes('rgb_video')) {
        methodsToShow.unshift('rgb_video');
    }
    
    // Ensure rgb_video is always at the front
    if (methodsToShow.includes('rgb_video')) {
        methodsToShow = ['rgb_video', ...methodsToShow.filter(id => id !== 'rgb_video')];
    }
    
    if (methodsToShow.length === 0) {
        container.innerHTML = '<div class="loading">⚠️ No results available for selected methods</div>';
        viewer.classList.remove('hidden');
        return;
    }
    
    // Create video panels
    methodsToShow.forEach((methodId, index) => {
        const methodData = currentVideo.methods[methodId];
        const methodInfo = statistics.methods[methodId];
        
        const panel = document.createElement('div');
        panel.className = 'video-panel';
        panel.innerHTML = `
            <h3 style="color: ${methodInfo.color}">${methodInfo.name}</h3>
            <video class="comparison-video" preload="metadata" 
                   data-method="${methodId}" data-index="${index}">
                <source src="${methodData.video}" type="video/mp4">
            </video>
        `;
        
        container.appendChild(panel);
    });
    
    // Update grid layout
    updateGridLayout(methodsToShow.length);
    
    // Show viewer
    viewer.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Reset play state
    isPlaying = false;
    updatePlayButton();
    
    // Setup video event listeners
    setupVideoListeners();
}

// Update grid layout
function updateGridLayout(methodCount) {
    const container = document.getElementById('comparisonContainer');
    
    // Remove all grid classes
    GRID_LAYOUTS.forEach(layout => container.classList.remove(layout));
    
    // Use currently selected layout
    container.classList.add(currentGridLayout);
    
    // Update dropdown menu
    const select = document.getElementById('layoutSelect');
    if (select) {
        select.value = currentGridLayout;
    }
}

// Close video viewer
function closeVideoViewer() {
    const viewer = document.getElementById('videoViewer');
    const videos = document.querySelectorAll('.comparison-video');
    
    // Pause all videos
    videos.forEach(video => video.pause());
    
    // Hide viewer
    viewer.classList.add('hidden');
    document.body.style.overflow = 'auto';
    
    currentVideo = null;
}

// Setup video listeners
function setupVideoListeners() {
    const videos = document.querySelectorAll('.comparison-video');
    const progressBar = document.getElementById('progressBar');
    
    if (videos.length === 0) return;
    
    const firstVideo = videos[0];
    
    // Time update
    firstVideo.addEventListener('timeupdate', () => {
        if (firstVideo.duration) {
            const progress = (firstVideo.currentTime / firstVideo.duration) * 100;
            progressBar.value = progress;
            updateTimeDisplay(firstVideo);
        }
    });
    
    // Progress bar drag
    progressBar.addEventListener('input', (e) => {
        videos.forEach(video => {
            if (video.duration) {
                video.currentTime = (e.target.value / 100) * video.duration;
            }
        });
    });
    
    // Synchronized play/pause
    videos.forEach((video, index) => {
        video.addEventListener('play', () => {
            videos.forEach((v, i) => {
                if (i !== index && v.paused) {
                    v.play().catch(() => {});
                }
            });
            isPlaying = true;
            updatePlayButton();
        });
        
        video.addEventListener('pause', () => {
            videos.forEach((v, i) => {
                if (i !== index && !v.paused) {
                    v.pause();
                }
            });
            isPlaying = false;
            updatePlayButton();
        });
    });
}

// Play/Pause
function togglePlayPause() {
    const videos = document.querySelectorAll('.comparison-video');
    
    videos.forEach(video => {
        if (isPlaying) {
            video.pause();
        } else {
            video.play().catch(() => {});
        }
    });
    
    isPlaying = !isPlaying;
    updatePlayButton();
}

// Update play button
function updatePlayButton() {
    const btn = document.getElementById('playPauseBtn');
    btn.textContent = isPlaying ? '⏸️ Pause' : '▶️ Play';
}

// Sync videos
function syncVideos() {
    const videos = document.querySelectorAll('.comparison-video');
    if (videos.length === 0) return;
    
    const firstVideo = videos[0];
    const targetTime = firstVideo.currentTime;
    
    videos.forEach((video, index) => {
        if (index !== 0) {
            video.currentTime = targetTime;
        }
    });
    
    // Show feedback
    const btn = document.getElementById('syncBtn');
    const originalText = btn.textContent;
    btn.textContent = '✓ Synced';
    setTimeout(() => {
        btn.textContent = originalText;
    }, 1000);
}

// Update time display
function updateTimeDisplay(video) {
    const current = formatTime(video.currentTime);
    const total = formatTime(video.duration);
    document.getElementById('timeDisplay').textContent = `${current} / ${total}`;
}

// Format time
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Change grid layout
function changeLayout(layoutClass) {
    const container = document.getElementById('comparisonContainer');
    
    // Apply new layout
    GRID_LAYOUTS.forEach(layout => container.classList.remove(layout));
    container.classList.add(layoutClass);
    currentGridLayout = layoutClass;
    
    // Update dropdown menu selection
    const select = document.getElementById('layoutSelect');
    if (select) {
        select.value = layoutClass;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
        renderVideoList(e.target.value);
    });
    
    // Layout dropdown menu
    document.getElementById('layoutSelect').addEventListener('change', (e) => {
        changeLayout(e.target.value);
    });
    
    // Close viewer
    document.getElementById('closeViewer').addEventListener('click', closeVideoViewer);
    
    // Play/Pause
    document.getElementById('playPauseBtn').addEventListener('click', togglePlayPause);
    
    // Sync
    document.getElementById('syncBtn').addEventListener('click', syncVideos);
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeVideoViewer();
        }
    });
    
    // Space key to play/pause
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ' && !document.getElementById('videoViewer').classList.contains('hidden')) {
            e.preventDefault();
            togglePlayPause();
        }
    });
    
    // Evaluation page events
    setupEvaluationListeners();
}

// Tab switching function
function switchTab(tabName) {
    // Update button state
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update content display
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// Setup evaluation page event listeners
function setupEvaluationListeners() {
    // Toggle explanation
    const toggleBtn = document.getElementById('toggleExplanation');
    const explanationContent = document.getElementById('explanationContent');
    
    if (toggleBtn && explanationContent) {
        toggleBtn.addEventListener('click', () => {
            if (explanationContent.classList.contains('collapsed')) {
                explanationContent.classList.remove('collapsed');
                toggleBtn.textContent = '▼ Hide';
            } else {
                explanationContent.classList.add('collapsed');
                toggleBtn.textContent = '▶ Show';
            }
        });
    }
    
    // Toggle Tab1 method comparison explanation
    const toggleComparisonBtn = document.getElementById('toggleComparison');
    const comparisonContent = document.getElementById('comparisonContent');
    
    if (toggleComparisonBtn && comparisonContent) {
        toggleComparisonBtn.addEventListener('click', () => {
            if (comparisonContent.classList.contains('collapsed')) {
                comparisonContent.classList.remove('collapsed');
                toggleComparisonBtn.textContent = '▼ Hide';
            } else {
                comparisonContent.classList.add('collapsed');
                toggleComparisonBtn.textContent = '▶ Show';
            }
        });
    }
    
    // Add listener for each video row's play button
    document.querySelectorAll('.video-control-btn').forEach(btn => {
        const videoName = btn.dataset.video;
        let isPlaying = false;
        
        btn.addEventListener('click', () => {
            const videos = document.querySelectorAll(`.eval-video[data-video="${videoName}"]`);
            
            if (isPlaying) {
                // Pause all videos in this row
                videos.forEach(video => video.pause());
                btn.textContent = '▶️ Play All';
                isPlaying = false;
            } else {
                // Play all videos in this row
                videos.forEach(video => video.play().catch(() => {}));
                btn.textContent = '⏸️ Pause All';
                isPlaying = true;
            }
        });
    });
}

