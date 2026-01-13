class UIManager {
    constructor(app) {
        this.app = app;
        this.isPanelCollapsed = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateSliderValues();
    }

    bindEvents() {
        // Pattern selection
        document.querySelectorAll('.pattern-option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.pattern-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');
            });
        });

        // Color picker
        document.getElementById('particle-color').addEventListener('input', (e) => {
            this.app.particleSystem.updateSettings({ particleColor: e.target.value });
        });

        // Color presets
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                document.getElementById('particle-color').value = color;
                this.app.particleSystem.updateSettings({ particleColor: color });
            });
        });

        // Sliders
        document.getElementById('particle-count').addEventListener('input', (e) => {
            document.getElementById('count-value').textContent = e.target.value;
        });

        document.getElementById('particle-size').addEventListener('input', (e) => {
            const size = parseFloat(e.target.value);
            document.getElementById('size-value').textContent = size.toFixed(1);
            this.app.particleSystem.updateSettings({ particleSize: size });
        });

        document.getElementById('animation-speed').addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            document.getElementById('speed-value').textContent = speed.toFixed(1);
            this.app.updateSettings({ animationSpeed: speed });
        });

        // Generate button
        document.getElementById('generate-btn').addEventListener('click', () => {
            const pattern = document.querySelector('.pattern-option.active').dataset.pattern;
            const color = document.getElementById('particle-color').value;
            const count = parseInt(document.getElementById('particle-count').value);
            const size = parseFloat(document.getElementById('particle-size').value);
            
            this.app.generateParticles(pattern, color, count, size);
        });

        // Reset button
        document.getElementById('reset-btn').addEventListener('click', () => {
            if (this.app.particleSystem) {
                this.app.particleSystem.reset();
            }
        });

        // Fullscreen button
        document.getElementById('fullscreen-btn').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Toggle panel
        document.getElementById('toggle-panel').addEventListener('click', () => {
            this.togglePanel();
        });
    }

    updateSliderValues() {
        const sliders = ['particle-count', 'particle-size', 'animation-speed'];
        sliders.forEach(id => {
            const slider = document.getElementById(id);
            const valueSpan = document.getElementById(id.replace('particle-', '').replace('animation-', '') + '-value');
            if (slider && valueSpan) {
                slider.addEventListener('input', () => {
                    valueSpan.textContent = parseFloat(slider.value).toFixed(1);
                });
            }
        });
    }

    updateGestureDisplay(gesture) {
        const icon = document.getElementById('gesture-icon');
        const status = document.getElementById('hand-status');
        const confidence = document.getElementById('confidence');
        
        let iconClass = 'fas fa-question';
        let statusText = 'Unknown';
        
        switch(gesture.type) {
            case 'open':
                iconClass = 'fas fa-hand-paper';
                statusText = 'Open Hand';
                break;
            case 'closed':
                iconClass = 'fas fa-hand-rock';
                statusText = 'Closed Fist';
                break;
            case 'pinch':
                iconClass = 'fas fa-hand-peace';
                statusText = 'Pinch Gesture';
                break;
            case 'point':
                iconClass = 'fas fa-hand-point-up';
                statusText = 'Pointing';
                break;
        }
        
        icon.className = iconClass;
        status.textContent = statusText;
        confidence.textContent = `${Math.round(gesture.confidence * 100)}%`;
    }

    togglePanel() {
        this.isPanelCollapsed = !this.isPanelCollapsed;
        const panel = document.querySelector('.control-panel');
        const toggleBtn = document.getElementById('toggle-panel');
        
        if (this.isPanelCollapsed) {
            panel.style.transform = 'translateX(100%)';
            toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        } else {
            panel.style.transform = 'translateX(0)';
            toggleBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        }
    }

    toggleFullscreen() {
        const container = document.querySelector('.container');
        
        if (!document.fullscreenElement) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

// Di dalam class UIManager, tambah method:

updateGestureDisplay(gesture) {
    // Method ini sudah ada, pastikan memanggil dengan confidence
    if (this.app && this.app.gestureDetector) {
        // Biarkan gestureDetector yang handle display
        // Karena dia sudah punya method showGestureMessage yang diperbarui
    }
}

// Tambah di bindEvents():
setupGestureStabilization() {
    // Debounce untuk perubahan UI terlalu cepat
    let lastUpdate = 0;
    const updateInterval = 500; // 0.5 detik
    
    const stableUpdate = () => {
        const now = Date.now();
        if (now - lastUpdate > updateInterval) {
            lastUpdate = now;
            return true;
        }
        return false;
    };
    
    // Monitor dan stabilkan display
    setInterval(() => {
        if (stableUpdate()) {
            // Refresh display
            const statusEl = document.getElementById('hand-status');
            if (statusEl && statusEl.textContent.includes('Waiting')) {
                // Reset ke default jika terlalu lama waiting
                statusEl.textContent = 'Show your hand';
            }
        }
    }, 1000);
}
}