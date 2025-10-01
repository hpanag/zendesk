// Dashboard JavaScript - Call Center Data Visualization
class CallCenterDashboard {
    constructor() {
        this.charts = {};
        this.data = null;
        this.autoRefresh = true;
        this.refreshInterval = 30000; // 30 seconds
        this.refreshTimer = null;
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing Call Center Dashboard...');
        
        // Load initial data
        await this.loadData();
        
        // Initialize charts
        this.initializeCharts();
        
        // Update UI
        this.updateUI();
        
        // Start auto-refresh
        this.startAutoRefresh();
        
        // Hide loading overlay
        this.hideLoading();
        
        console.log('✅ Dashboard initialized successfully');
    }
    
    async loadData() {
        try {
            console.log('📡 Loading dashboard data...');
            
            // In production, this would fetch from an API endpoint
            // For now, we'll load the latest JSON file from the data directory
            const response = await fetch('./assets/data/live-feed-latest.json');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.data = await response.json();
            console.log('✅ Data loaded successfully:', this.data);
            
        } catch (error) {
            console.error('❌ Error loading data:', error);
            
            // Use mock data for demonstration
            this.data = this.getMockData();
            console.log('📊 Using mock data for demonstration');
        }
    }
    
    getMockData() {
        // Mock data based on your actual structure
        return {
            timestamp: new Date().toISOString(),
            lastUpdated: new Date().toLocaleString(),
            callsInQueue: 7,
            agents: {
                totalAgents: 57,
                agentsOnline: 3,
                agentsOnCall: 0,
                agentsAway: 19,
                agentsOffline: 32,
                agentsTransfersOnly: 0,
                agentsOutboundCall: 0,
                currentlyWorking: 12,
                activeToday: 22
            },
            dailyMetrics: {
                totalCalls: 27,
                totalInboundCalls: 26,
                totalOutboundCalls: 1,
                totalCallbackCalls: 0,
                abandonedInQueue: 32,
                exceededQueueWaitTime: 21,
                maxCallsWaitingToday: 7,
                averageDuration: 10.79,
                averageWaitTime: 36.1,
                averageTimeToAnswer: 265,
                averageHoldTime: 7.42,
                averageCallbackWaitTime: 0,
                currentAverageWaitTime: 36.1,
                currentLongestWaitTime: 60.15
            },
            status: "live"
        };
    }
    
    updateUI() {
        if (!this.data) return;
        
        // Update header timestamp
        document.getElementById('lastUpdated').textContent = `Last Updated: ${this.data.lastUpdated}`;
        
        // Update main stat cards
        document.getElementById('callsInQueue').textContent = this.data.callsInQueue;
        document.getElementById('agentsOnline').textContent = this.data.agents.agentsOnline;
        document.getElementById('totalAgents').textContent = `of ${this.data.agents.totalAgents} agents`;
        document.getElementById('totalCalls').textContent = this.data.dailyMetrics.totalCalls;
        document.getElementById('callBreakdown').textContent = 
            `${this.data.dailyMetrics.totalInboundCalls} inbound, ${this.data.dailyMetrics.totalOutboundCalls} outbound`;
        document.getElementById('avgWaitTime').textContent = `${this.data.dailyMetrics.averageWaitTime}`;
        
        // Update detailed metrics
        this.updateDetailedMetrics();
        
        // Update charts
        this.updateCharts();
    }
    
    updateDetailedMetrics() {
        const metrics = this.data.dailyMetrics;
        
        // Call Volume
        document.getElementById('detailTotalCalls').textContent = metrics.totalCalls;
        document.getElementById('detailInboundCalls').textContent = metrics.totalInboundCalls;
        document.getElementById('detailOutboundCalls').textContent = metrics.totalOutboundCalls;
        document.getElementById('detailCallbackCalls').textContent = metrics.totalCallbackCalls;
        
        // Queue Performance
        document.getElementById('detailAbandonedCalls').textContent = metrics.abandonedInQueue;
        document.getElementById('detailExceededWait').textContent = metrics.exceededQueueWaitTime;
        document.getElementById('detailMaxWaiting').textContent = metrics.maxCallsWaitingToday;
        
        // Timing Metrics
        document.getElementById('detailAvgDuration').textContent = `${metrics.averageDuration} min`;
        document.getElementById('detailAvgAnswer').textContent = `${metrics.averageTimeToAnswer} sec`;
        document.getElementById('detailAvgHold').textContent = `${metrics.averageHoldTime} min`;
        document.getElementById('detailAvgCallbackWait').textContent = `${metrics.averageCallbackWaitTime} min`;
    }
    
    initializeCharts() {
        // Agent Status Pie Chart
        this.createAgentStatusChart();
        
        // Call Volume Line Chart
        this.createCallVolumeChart();
        
        // Queue Performance Bar Chart
        this.createQueuePerformanceChart();
        
        // Wait Time Distribution
        this.createWaitTimeChart();
    }
    
    createAgentStatusChart() {
        const ctx = document.getElementById('agentStatusChart').getContext('2d');
        
        this.charts.agentStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Online', 'Away', 'Offline', 'On Call'],
                datasets: [{
                    data: [
                        this.data.agents.agentsOnline,
                        this.data.agents.agentsAway,
                        this.data.agents.agentsOffline,
                        this.data.agents.agentsOnCall
                    ],
                    backgroundColor: [
                        '#059669', // Green for online
                        '#d97706', // Orange for away
                        '#dc2626', // Red for offline
                        '#2563eb'  // Blue for on call
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const percentage = ((context.raw / context.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
                                return `${context.label}: ${context.raw} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    createCallVolumeChart() {
        const ctx = document.getElementById('callVolumeChart').getContext('2d');
        
        // Generate sample hourly data for today
        const hours = [];
        const inboundData = [];
        const outboundData = [];
        
        for (let i = 0; i < 24; i++) {
            hours.push(`${i.toString().padStart(2, '0')}:00`);
            // Simulate call distribution throughout the day
            const baseInbound = Math.floor(Math.random() * 5) + 1;
            const baseOutbound = Math.floor(Math.random() * 2);
            inboundData.push(baseInbound);
            outboundData.push(baseOutbound);
        }
        
        this.charts.callVolume = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours,
                datasets: [{
                    label: 'Inbound Calls',
                    data: inboundData,
                    borderColor: '#059669',
                    backgroundColor: 'rgba(5, 150, 105, 0.1)',
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'Outbound Calls',
                    data: outboundData,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    }
    
    createQueuePerformanceChart() {
        const ctx = document.getElementById('queuePerformanceChart').getContext('2d');
        
        this.charts.queuePerformance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Answered', 'Abandoned', 'Exceeded Wait', 'In Queue'],
                datasets: [{
                    label: 'Calls',
                    data: [
                        this.data.dailyMetrics.totalCalls - this.data.dailyMetrics.abandonedInQueue,
                        this.data.dailyMetrics.abandonedInQueue,
                        this.data.dailyMetrics.exceededQueueWaitTime,
                        this.data.callsInQueue
                    ],
                    backgroundColor: [
                        '#059669', // Green for answered
                        '#dc2626', // Red for abandoned
                        '#d97706', // Orange for exceeded wait
                        '#2563eb'  // Blue for in queue
                    ],
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    createWaitTimeChart() {
        const ctx = document.getElementById('waitTimeChart').getContext('2d');
        
        this.charts.waitTime = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['0-1 min', '1-3 min', '3-5 min', '5-10 min', '10+ min'],
                datasets: [{
                    label: 'Number of Calls',
                    data: [5, 8, 6, 4, 4], // Sample distribution
                    backgroundColor: [
                        '#059669',
                        '#84cc16',
                        '#d97706',
                        '#dc2626',
                        '#7c2d12'
                    ],
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    updateCharts() {
        // Update agent status chart
        if (this.charts.agentStatus) {
            this.charts.agentStatus.data.datasets[0].data = [
                this.data.agents.agentsOnline,
                this.data.agents.agentsAway,
                this.data.agents.agentsOffline,
                this.data.agents.agentsOnCall
            ];
            this.charts.agentStatus.update('none');
        }
        
        // Update queue performance chart
        if (this.charts.queuePerformance) {
            this.charts.queuePerformance.data.datasets[0].data = [
                this.data.dailyMetrics.totalCalls - this.data.dailyMetrics.abandonedInQueue,
                this.data.dailyMetrics.abandonedInQueue,
                this.data.dailyMetrics.exceededQueueWaitTime,
                this.data.callsInQueue
            ];
            this.charts.queuePerformance.update('none');
        }
    }
    
    startAutoRefresh() {
        if (this.autoRefresh) {
            this.refreshTimer = setInterval(async () => {
                console.log('🔄 Auto-refreshing dashboard data...');
                await this.loadData();
                this.updateUI();
            }, this.refreshInterval);
        }
    }
    
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
    
    toggleAutoRefresh() {
        this.autoRefresh = !this.autoRefresh;
        
        const icon = document.getElementById('autoRefreshIcon');
        const text = document.getElementById('autoRefreshText');
        
        if (this.autoRefresh) {
            icon.className = 'fas fa-pause';
            text.textContent = 'Pause Auto-Refresh';
            this.startAutoRefresh();
        } else {
            icon.className = 'fas fa-play';
            text.textContent = 'Resume Auto-Refresh';
            this.stopAutoRefresh();
        }
    }
    
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.add('hidden');
    }
    
    showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.remove('hidden');
    }
    
    async refresh() {
        this.showLoading();
        await this.loadData();
        this.updateUI();
        this.hideLoading();
    }
    
    exportData() {
        if (!this.data) return;
        
        const dataStr = JSON.stringify(this.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `call-center-data-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }
}

// Global functions for HTML event handlers
function toggleAutoRefresh() {
    if (window.dashboard) {
        window.dashboard.toggleAutoRefresh();
    }
}

function refreshAgentChart() {
    if (window.dashboard) {
        window.dashboard.refresh();
    }
}

function updateCallChart() {
    // Handle time range selection
    console.log('📊 Updating call chart for selected time range...');
}

function exportData() {
    if (window.dashboard) {
        window.dashboard.exportData();
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.dashboard = new CallCenterDashboard();
});

// Handle visibility change to pause/resume refresh when tab is not active
document.addEventListener('visibilitychange', function() {
    if (window.dashboard) {
        if (document.hidden) {
            window.dashboard.stopAutoRefresh();
        } else if (window.dashboard.autoRefresh) {
            window.dashboard.startAutoRefresh();
        }
    }
});