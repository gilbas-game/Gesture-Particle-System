class GestureDetector {
    constructor(app) {
        this.app = app;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.detector = null;
        this.currentGesture = null;
        this.isDetecting = false;
        this.lastStableGesture = null;
        this.gestureHistory = [];
        this.historySize = 5;
    }

    async init() {
        try {
            // Setup video element
            this.video = document.createElement('video');
            this.canvas = document.getElementById('webcam-canvas');
            this.ctx = this.canvas.getContext('2d');
            
            // Initialize camera
            await this.setupCamera();
            
            // Load hand pose model
            const model = handPoseDetection.SupportedModels.MediaPipeHands;
            const detectorConfig = {
                runtime: 'tfjs',
                modelType: 'full',
                maxHands: 2
            };
            
            this.detector = await handPoseDetection.createDetector(model, detectorConfig);
            
            // Start detection
            this.isDetecting = true;
            this.detectGestures();
            
        } catch (error) {
            console.error('Failed to initialize gesture detection:', error);
            throw error;
        }
    }

    async setupCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });
        
        this.video.srcObject = stream;
        await this.video.play();
        
        // Draw video to canvas
        this.drawVideo();
    }

    drawVideo() {
        if (this.video && this.video.readyState === 4) {
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        }
        requestAnimationFrame(() => this.drawVideo());
    }

    async detectGestures() {
        if (!this.isDetecting) return;
        
        try {
            const hands = await this.detector.estimateHands(this.canvas);
            
            if (hands.length > 0) {
                const hand = hands[0];
                
                // 1. Cek gestur ASL terlebih dahulu dengan threshold tinggi
                const aslGesture = this.analyzeASLGesture(hand);
                
                if (aslGesture && aslGesture.confidence > 0.7) {
                    this.updateGestureHistory(aslGesture);
                    const stableGesture = this.getStableGesture();
                    if (stableGesture) {
                        this.currentGesture = stableGesture;
                        this.drawLandmarks(hand);
                        this.showGestureMessage(stableGesture.message, stableGesture.confidence);
                    }
                } 
                // 2. Jika bukan ASL, cek gestur biasa
                else {
                    const gesture = this.analyzeGesture(hand);
                    if (gesture.confidence > 0.75) {
                        this.updateGestureHistory(gesture);
                        const stableGesture = this.getStableGesture();
                        if (stableGesture) {
                            this.currentGesture = stableGesture;
                            this.drawLandmarks(hand);
                            this.showGestureMessage(stableGesture.type, stableGesture.confidence);
                        }
                    } else {
                        this.currentGesture = null;
                        this.showGestureMessage("Show clear gesture", gesture.confidence);
                    }
                }
            } else {
                this.currentGesture = null;
                this.gestureHistory = [];
                this.showGestureMessage("Waiting for hand...", 0);
            }
        } catch (error) {
            console.error('Gesture detection error:', error);
        }
        
        // Gunakan interval yang lebih stabil
        setTimeout(() => this.detectGestures(), 100);
    }

    analyzeGesture(hand) {
        const landmarks = hand.keypoints;
        
        // Normalize coordinates untuk konsistensi
        const normalizedLandmarks = this.normalizeCoordinates(landmarks);
        
        // Calculate distances between key points
        const thumbTip = normalizedLandmarks[4];
        const indexTip = normalizedLandmarks[8];
        const middleTip = normalizedLandmarks[12];
        const ringTip = normalizedLandmarks[16];
        const pinkyTip = normalizedLandmarks[20];
        const wrist = normalizedLandmarks[0];
        
        // Calculate distances from wrist to finger tips
        const distances = [
            this.distance(thumbTip, wrist),
            this.distance(indexTip, wrist),
            this.distance(middleTip, wrist),
            this.distance(ringTip, wrist),
            this.distance(pinkyTip, wrist)
        ];
        
        // Calculate average distance
        const avgDistance = distances.reduce((a, b) => a + b) / distances.length;
        if (avgDistance < 0.01) return { type: 'unknown', confidence: 0, landmarks };
        
        // Calculate finger extension ratios
        const extensionRatios = distances.map(d => d / avgDistance);
        
        // Determine gesture type dengan threshold yang lebih ketat
        let type = 'unknown';
        let confidence = 0;
        
        // Check for open hand (all fingers extended)
        const isOpen = extensionRatios.every(ratio => ratio > 0.85) && 
                       extensionRatios.every(ratio => ratio < 1.3);
        if (isOpen) {
            type = 'open';
            confidence = this.calculateOpenHandConfidence(extensionRatios);
        }
        
        // Check for closed fist (all fingers close to wrist)
        const isClosed = extensionRatios.every(ratio => ratio < 0.45);
        if (isClosed && !type) {
            type = 'closed';
            confidence = 0.95 - (Math.max(...extensionRatios) * 0.5);
        }
        
        // Check for pinch gesture (thumb and index close)
        const thumbIndexDistance = this.distance(thumbTip, indexTip);
        const handSize = this.distance(wrist, normalizedLandmarks[9]);
        const pinchThreshold = handSize * 0.18;
        
        if (thumbIndexDistance < pinchThreshold && !isClosed && !type) {
            const otherFingersExtended = extensionRatios.slice(2).every(ratio => ratio > 0.5);
            if (otherFingersExtended) {
                type = 'pinch';
                confidence = 1.0 - (thumbIndexDistance / (handSize * 0.25));
            }
        }
        
        // Check for pointing gesture (only index extended)
        const isIndexExtended = extensionRatios[1] > 1.15;
        const otherFingersClosed = 
            extensionRatios[0] < 0.55 && 
            extensionRatios[2] < 0.65 && 
            extensionRatios[3] < 0.65 && 
            extensionRatios[4] < 0.65;
        const isNotPinching = thumbIndexDistance > handSize * 0.22;
        
        if (isIndexExtended && otherFingersClosed && isNotPinching && !type) {
            type = 'point';
            confidence = Math.min(0.95, (extensionRatios[1] - 1.0) * 1.8);
        }
        
        // Minimum confidence threshold
        if (confidence < 0.72) {
            type = 'unknown';
            confidence = 0;
        }
        
        return {
            type,
            confidence: Math.min(0.99, confidence),
            landmarks
        };
    }

    analyzeASLGesture(hand) {
        const landmarks = hand.keypoints;
        const modelConfidence = hand.score || 0.8;
        
        // Normalize coordinates terlebih dahulu
        const normalizedLandmarks = this.normalizeCoordinates(landmarks);
        
        // Ambil posisi jari-jari
        const thumbTip = normalizedLandmarks[4];
        const indexTip = normalizedLandmarks[8];
        const middleTip = normalizedLandmarks[12];
        const ringTip = normalizedLandmarks[16];
        const pinkyTip = normalizedLandmarks[20];
        const wrist = normalizedLandmarks[0];
        
        // Calculate hand size untuk threshold dinamis
        const handSize = this.distance(wrist, normalizedLandmarks[9]);
        if (handSize < 0.05) return null;
        
        // Helper functions dengan threshold adaptif
        const isFingerExtended = (fingerTip, wrist) => {
            const distance = this.distance(fingerTip, wrist);
            return distance > handSize * 0.75;
        };
        
        const isFingerClosed = (fingerTip, wrist) => {
            const distance = this.distance(fingerTip, wrist);
            return distance < handSize * 0.35;
        };
        
        // DETEKSI "I" - lebih spesifik
        const pinkyExtended = isFingerExtended(pinkyTip, wrist);
        const otherFingersClosed = 
            isFingerClosed(indexTip, wrist) &&
            isFingerClosed(middleTip, wrist) &&
            isFingerClosed(ringTip, wrist);
        const thumbClosed = this.distance(thumbTip, wrist) < handSize * 0.45;
        
        const isLetterI = pinkyExtended && otherFingersClosed && thumbClosed;
        
        // DETEKSI "LOVE" - deteksi tangan di dada
        const isHandLow = wrist.y > 0.65;
        const isHandCentered = wrist.x > 0.35 && wrist.x < 0.65;
        const fingersTogether = this.areFingersTogether(normalizedLandmarks);
        
        const isLoveSign = isHandLow && isHandCentered && fingersTogether;
        
        // DETEKSI "YOU"
        const indexExtended = isFingerExtended(indexTip, wrist);
        const otherFingersForYou = 
            isFingerClosed(thumbTip, wrist) &&
            isFingerClosed(middleTip, wrist) &&
            isFingerClosed(ringTip, wrist) &&
            isFingerClosed(pinkyTip, wrist);
        const isNotPinch = this.distance(indexTip, thumbTip) > handSize * 0.28;
        
        const isYouSign = indexExtended && otherFingersForYou && isNotPinch;
        
        // Confidence calculation
        let finalConfidence = modelConfidence;
        let gestureType = null;
        let message = "";
        
        if (isLetterI) {
            const pinkyConfidence = Math.min(1.0, this.distance(pinkyTip, wrist) / handSize);
            const otherConfidence = 1.0 - Math.min(1.0, (
                this.distance(indexTip, wrist) +
                this.distance(middleTip, wrist) +
                this.distance(ringTip, wrist)
            ) / (handSize * 3));
            
            finalConfidence = (pinkyConfidence + otherConfidence) / 2;
            if (finalConfidence > 0.78) {
                gestureType = 'letter_i';
                message = "I";
            }
        }
        
        if (isLoveSign && !gestureType) {
            const positionConfidence = Math.min(1.0, (wrist.y - 0.65) * 2.86);
            const togetherness = this.areFingersTogetherScore(normalizedLandmarks);
            const togethernessConfidence = 1.0 - togetherness;
            finalConfidence = (positionConfidence + togethernessConfidence + modelConfidence) / 3;
            if (finalConfidence > 0.68) {
                gestureType = 'love';
                message = "LOVE";
            }
        }
        
        if (isYouSign && !gestureType) {
            const indexConfidence = Math.min(1.0, this.distance(indexTip, wrist) / handSize);
            const otherConfidence = 1.0 - Math.min(1.0, (
                this.distance(thumbTip, wrist) +
                this.distance(middleTip, wrist) +
                this.distance(ringTip, wrist) +
                this.distance(pinkyTip, wrist)
            ) / (handSize * 4));
            
            finalConfidence = (indexConfidence + otherConfidence) / 2;
            if (finalConfidence > 0.78) {
                gestureType = 'you';
                message = "YOU";
            }
        }
        
        if (gestureType) {
            return { 
                type: gestureType, 
                confidence: Math.min(0.99, finalConfidence), 
                message 
            };
        }
        
        return null;
    }

    distance(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    normalizeCoordinates(landmarks) {
        if (!landmarks || landmarks.length === 0) return [];
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        landmarks.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
        
        const width = maxX - minX;
        const height = maxY - minY;
        const size = Math.max(width, height, 0.001); // Hindari pembagi 0
        
        return landmarks.map(point => ({
            x: (point.x - minX) / size,
            y: (point.y - minY) / size
        }));
    }

    calculateOpenHandConfidence(ratios) {
        if (ratios.length === 0) return 0;
        
        const variance = this.calculateVariance(ratios);
        const avgRatio = ratios.reduce((a, b) => a + b) / ratios.length;
        const idealDeviation = Math.abs(avgRatio - 1.0);
        
        return Math.max(0, 0.92 - (variance * 1.8) - (idealDeviation * 2.5));
    }

    calculateVariance(numbers) {
        if (numbers.length === 0) return 0;
        
        const mean = numbers.reduce((a, b) => a + b) / numbers.length;
        const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b) / numbers.length;
    }

    areFingersTogether(landmarks) {
        return this.areFingersTogetherScore(landmarks) < 0.12;
    }

    areFingersTogetherScore(landmarks) {
        const tips = [8, 12, 16, 20];
        if (tips.some(i => !landmarks[i])) return 1.0;
        
        let totalDistance = 0;
        let count = 0;
        
        for (let i = 0; i < tips.length; i++) {
            for (let j = i + 1; j < tips.length; j++) {
                totalDistance += this.distance(landmarks[tips[i]], landmarks[tips[j]]);
                count++;
            }
        }
        
        if (count === 0) return 1.0;
        
        const avgDistance = totalDistance / count;
        const handSize = this.distance(landmarks[0], landmarks[9]) || 1.0;
        
        return Math.min(1.0, avgDistance / (handSize * 0.35));
    }

    updateGestureHistory(gesture) {
        this.gestureHistory.push({
            type: gesture.type,
            confidence: gesture.confidence,
            message: gesture.message || gesture.type,
            timestamp: Date.now()
        });
        
        // Keep only recent gestures
        if (this.gestureHistory.length > this.historySize) {
            this.gestureHistory.shift();
        }
    }

    getStableGesture() {
        if (this.gestureHistory.length < 3) return null;
        
        // Cari gesture yang konsisten dalam history
        const recentGestures = this.gestureHistory.slice(-3);
        const gestureCounts = {};
        
        recentGestures.forEach(g => {
            gestureCounts[g.type] = (gestureCounts[g.type] || 0) + 1;
        });
        
        // Cari gesture yang muncul minimal 2 dari 3 frame terakhir
        for (const [type, count] of Object.entries(gestureCounts)) {
            if (count >= 2) {
                const gesture = recentGestures.find(g => g.type === type);
                if (gesture && gesture.confidence > 0.75) {
                    return gesture;
                }
            }
        }
        
        return null;
    }

    drawLandmarks(hand) {
        if (!this.ctx || !this.video) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Draw landmarks
        this.ctx.fillStyle = '#4ecdc4';
        this.ctx.strokeStyle = '#4ecdc4';
        this.ctx.lineWidth = 2;
        
        hand.keypoints.forEach(point => {
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
            this.ctx.fill();
        });
        
        // Draw connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [0, 9], [9, 10], [10, 11], [11, 12],
            [0, 13], [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20]
        ];
        
        connections.forEach(([i, j]) => {
            const point1 = hand.keypoints[i];
            const point2 = hand.keypoints[j];
            
            if (point1 && point2) {
                this.ctx.beginPath();
                this.ctx.moveTo(point1.x, point1.y);
                this.ctx.lineTo(point2.x, point2.y);
                this.ctx.stroke();
            }
        });
    }

    showGestureMessage(message, confidence = 0) {
        const messageEl = document.getElementById('gesture-message');
        const handStatusEl = document.getElementById('hand-status');
        const confidenceEl = document.getElementById('confidence');
        
        if (!messageEl || !handStatusEl || !confidenceEl) return;
        
        const icon = messageEl.querySelector('i');
        const text = messageEl.querySelector('span');
        
        if (!icon || !text) return;
        
        // Update icon berdasarkan pesan
        const msgLower = message.toLowerCase();
        let displayText = '';
        let statusText = '';
        
        if (msgLower.includes('i') || msgLower.includes('letter')) {
            icon.className = 'fas fa-i';
            displayText = 'Letter "I" detected!';
            statusText = 'Letter I';
        } else if (msgLower.includes('love')) {
            icon.className = 'fas fa-heart';
            displayText = 'Word "LOVE" detected!';
            statusText = 'LOVE';
        } else if (msgLower.includes('you')) {
            icon.className = 'fas fa-hand-point-up';
            displayText = 'Word "YOU" detected!';
            statusText = 'YOU';
        } else if (msgLower.includes('open')) {
            icon.className = 'fas fa-hand-paper';
            displayText = 'Open Hand';
            statusText = 'Open Hand';
        } else if (msgLower.includes('closed')) {
            icon.className = 'fas fa-hand-rock';
            displayText = 'Closed Fist';
            statusText = 'Closed Fist';
        } else if (msgLower.includes('pinch')) {
            icon.className = 'fas fa-hand-peace';
            displayText = 'Pinch Gesture';
            statusText = 'Pinch';
        } else if (msgLower.includes('point')) {
            icon.className = 'fas fa-hand-point-up';
            displayText = 'Pointing Gesture';
            statusText = 'Pointing';
        } else {
            icon.className = 'fas fa-comment-alt';
            displayText = message || 'Show your hand clearly';
            statusText = message || 'Ready';
        }
        
        text.textContent = displayText;
        handStatusEl.textContent = statusText;
        
        // Update confidence dengan warna berdasarkan level
        const confidencePercent = Math.round(confidence * 100);
        confidenceEl.textContent = `${confidencePercent}%`;
        
        if (confidence > 0.85) {
            confidenceEl.style.color = '#4ecdc4';
            confidenceEl.className = 'status-high';
        } else if (confidence > 0.7) {
            confidenceEl.style.color = '#feca57';
            confidenceEl.className = 'status-medium';
        } else if (confidence > 0.5) {
            confidenceEl.style.color = '#ff9f43';
            confidenceEl.className = 'status-medium';
        } else {
            confidenceEl.style.color = '#ff6b6b';
        }
    }
}