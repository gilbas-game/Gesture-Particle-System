class GestureParticleSystem {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.particleSystem = null;
        this.gestureDetector = null;
        this.uiManager = null;
        this.animationSpeed = 1;
        
        this.init();
    }

    async init() {
        try {
            // Initialize UI
            this.uiManager = new UIManager(this);
            
            // Initialize Three.js
            this.initThreeJS();
            
            // Initialize gesture detection
            this.gestureDetector = new GestureDetector(this);
            await this.gestureDetector.init();
            
            // Initialize particle system
            this.particleSystem = new ParticleSystem(this);
            
            // Start animation
            this.animate();
            
            // Hide loading overlay
            document.getElementById('loading-overlay').style.display = 'none';
            
        } catch (error) {
            console.error('Initialization error:', error);
            alert('Failed to initialize application. Please check console for details.');
        }
    }

    initThreeJS() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f2027);
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 50;
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('particle-canvas'),
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update particle system
        if (this.particleSystem) {
            this.particleSystem.update();
        }
        
        // Update gesture effects
        if (this.gestureDetector && this.gestureDetector.currentGesture) {
            this.handleGesture(this.gestureDetector.currentGesture);
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    handleGesture(gesture) {
        if (!this.particleSystem) return;
        
        // Cek apakah ini gestur ASL (I, LOVE, YOU)
        if (gesture.type && (gesture.type === 'letter_i' || 
                            gesture.type === 'love' || 
                            gesture.type === 'you')) {
            this.particleSystem.handleASLGesture(gesture);
        } 
        // Gestur biasa
        else {
            switch(gesture.type) {
                case 'open':
                    this.particleSystem.expand();
                    break;
                case 'closed':
                    this.particleSystem.contract();
                    break;
                case 'pinch':
                    this.particleSystem.disperse();
                    break;
                case 'point':
                    this.particleSystem.attractToPoint();
                    break;
            }
        }
        
        // Update UI
        if (this.uiManager) {
            this.uiManager.updateGestureDisplay(gesture);
        }
    }

    generateParticles(pattern, color, count, size) {
        if (this.particleSystem) {
            this.particleSystem.generate(pattern, color, count, size);
        }
    }

    updateSettings(settings) {
        if (this.particleSystem) {
            this.particleSystem.updateSettings(settings);
        }
        if (settings.animationSpeed !== undefined) {
            this.animationSpeed = settings.animationSpeed;
        }
    }

    enableTrainingMode() {
        // Tampilkan panduan visual untuk gestur
        const trainingOverlay = document.createElement('div');
        trainingOverlay.className = 'training-overlay';
        trainingOverlay.innerHTML = `
            <div class="training-guide">
                <h3><i class="fas fa-graduation-cap"></i> Gesture Training</h3>
                <div class="gesture-example">
                    <div class="example-item">
                        <div class="example-hand">✋</div>
                        <p>Show "I": Pinkie finger up, others closed</p>
                    </div>
                    <div class="example-item">
                        <div class="example-hand">🤟</div>
                        <p>Show "LOVE": Cross arms on chest</p>
                    </div>
                    <div class="example-item">
                        <div class="example-hand">👉</div>
                        <p>Show "YOU": Point forward</p>
                    </div>
                </div>
                <button id="close-training" class="btn-primary">Got it!</button>
            </div>
        `;
        
        document.body.appendChild(trainingOverlay);
        
        document.getElementById('close-training').addEventListener('click', () => {
            document.body.removeChild(trainingOverlay);
        });
    }
}

// Initialize application
let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new GestureParticleSystem();
    
    // Optional: Add training button event listener
    setTimeout(() => {
        const trainingBtn = document.createElement('button');
        trainingBtn.id = 'training-btn';
        trainingBtn.className = 'btn-secondary floating-btn';
        trainingBtn.innerHTML = '<i class="fas fa-graduation-cap"></i> Learn Gestures';
        trainingBtn.style.position = 'fixed';
        trainingBtn.style.bottom = '20px';
        trainingBtn.style.right = '20px';
        trainingBtn.style.zIndex = '1000';
        
        trainingBtn.addEventListener('click', () => {
            app.enableTrainingMode();
        });
        
        document.body.appendChild(trainingBtn);
    }, 3000); // Tampilkan setelah 3 detik
});