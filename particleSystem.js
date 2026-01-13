class ParticleSystem {
    constructor(app) {
        this.app = app;
        this.particles = null;
        this.particleCount = 5000;
        this.particleSize = 2;
        this.particleColor = new THREE.Color('#ff6b6b');
        this.currentPattern = 'sphere';
        this.basePositions = [];
        this.targetPositions = [];
        this.isAnimating = false;
        this.gestureInfluence = 0;
        this.velocity = new THREE.Vector3();
    }

    generate(pattern = 'sphere', color = '#ff6b6b', count = 5000, size = 2) {
        this.currentPattern = pattern;
        this.particleCount = count;
        this.particleSize = size;
        this.particleColor.set(color);
        
        // Remove existing particles
        if (this.particles) {
            this.app.scene.remove(this.particles);
        }
        
        // Create particle geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        
        // Generate positions based on pattern
        this.basePositions = [];
        this.targetPositions = [];
        
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            let x, y, z;
            
            switch(pattern) {
                case 'sphere':
                    const radius = 20;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const theta = Math.random() * Math.PI * 2;
                    x = radius * Math.sin(phi) * Math.cos(theta);
                    y = radius * Math.sin(phi) * Math.sin(theta);
                    z = radius * Math.cos(phi);
                    break;
                    
                case 'cube':
                    const size = 25;
                    x = (Math.random() - 0.5) * size;
                    y = (Math.random() - 0.5) * size;
                    z = (Math.random() - 0.5) * size;
                    break;
                    
                case 'torus':
                    const torusRadius = 15;
                    const tubeRadius = 5;
                    const torusTheta = Math.random() * Math.PI * 2;
                    const torusPhi = Math.random() * Math.PI * 2;
                    x = (torusRadius + tubeRadius * Math.cos(torusTheta)) * Math.cos(torusPhi);
                    y = (torusRadius + tubeRadius * Math.cos(torusTheta)) * Math.sin(torusPhi);
                    z = tubeRadius * Math.sin(torusTheta);
                    break;
                    
                case 'galaxy':
                    const arms = 3;
                    const armAngle = (i % arms) * (2 * Math.PI / arms);
                    const distance = 15 + Math.random() * 10;
                    const angle = armAngle + Math.random() * 0.5;
                    x = Math.cos(angle) * distance;
                    y = (Math.random() - 0.5) * 5;
                    z = Math.sin(angle) * distance;
                    break;
                    
                case 'wave':
                    const waveWidth = 30;
                    const waveHeight = 10;
                    x = (Math.random() - 0.5) * waveWidth;
                    z = (Math.random() - 0.5) * waveWidth;
                    y = Math.sin(x * 0.3) * Math.cos(z * 0.3) * waveHeight;
                    break;
                    
                case 'custom':
                    const customRadius = 20;
                    const angle1 = Math.random() * Math.PI * 2;
                    const angle2 = Math.random() * Math.PI * 2;
                    x = Math.sin(angle1) * Math.cos(angle2) * customRadius;
                    y = Math.sin(angle1) * Math.sin(angle2) * customRadius;
                    z = Math.cos(angle1) * customRadius;
                    break;
            }
            
            positions[i3] = x;
            positions[i3 + 1] = y;
            positions[i3 + 2] = z;
            
            // Store base position
            this.basePositions.push(new THREE.Vector3(x, y, z));
            this.targetPositions.push(new THREE.Vector3(x, y, z));
            
            // Set colors with variation
            const colorVariation = 0.2;
            colors[i3] = this.particleColor.r + (Math.random() - 0.5) * colorVariation;
            colors[i3 + 1] = this.particleColor.g + (Math.random() - 0.5) * colorVariation;
            colors[i3 + 2] = this.particleColor.b + (Math.random() - 0.5) * colorVariation;
            
            // Set sizes with variation
            sizes[i] = size * (0.5 + Math.random() * 0.5);
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Create material
        const material = new THREE.PointsMaterial({
            size: size,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        // Create particle system
        this.particles = new THREE.Points(geometry, material);
        this.app.scene.add(this.particles);
        
        // Add subtle rotation
        this.particles.rotation.x = Math.random() * Math.PI;
        this.particles.rotation.y = Math.random() * Math.PI;
    }

    update() {
        if (!this.particles || !this.isAnimating) return;
        
        const time = Date.now() * 0.001 * this.app.animationSpeed;
        const positions = this.particles.geometry.attributes.position.array;
        
        // Add gentle floating motion
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            const basePos = this.basePositions[i];
            const targetPos = this.targetPositions[i];
            
            // Calculate noise-based movement
            const noise = new THREE.Vector3(
                Math.sin(time + i * 0.01),
                Math.cos(time * 0.7 + i * 0.01),
                Math.sin(time * 0.5 + i * 0.01)
            ).multiplyScalar(0.5);
            
            // Apply gesture influence
            const gestureOffset = this.velocity.clone().multiplyScalar(this.gestureInfluence);
            
            // Interpolate towards target position
            const currentPos = new THREE.Vector3(
                positions[i3],
                positions[i3 + 1],
                positions[i3 + 2]
            );
            
            const newPos = currentPos.lerp(
                targetPos.clone().add(noise).add(gestureOffset),
                0.1
            );
            
            positions[i3] = newPos.x;
            positions[i3 + 1] = newPos.y;
            positions[i3 + 2] = newPos.z;
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        
        // Slow rotation
        this.particles.rotation.x += 0.001 * this.app.animationSpeed;
        this.particles.rotation.y += 0.002 * this.app.animationSpeed;
        
        // Gradually reduce gesture influence
        this.gestureInfluence = Math.max(0, this.gestureInfluence - 0.01);
        this.velocity.multiplyScalar(0.95);
    }

    expand() {
        this.isAnimating = true;
        this.gestureInfluence = 1.5;
        this.velocity.set(0, 0, 0);
        
        const expansionForce = 1.5;
        for (let i = 0; i < this.particleCount; i++) {
            const direction = this.basePositions[i].clone().normalize();
            this.targetPositions[i] = this.basePositions[i].clone()
                .add(direction.multiplyScalar(expansionForce));
        }
    }

    contract() {
        this.isAnimating = true;
        this.gestureInfluence = 1.5;
        this.velocity.set(0, 0, 0);
        
        const contractionForce = 0.7;
        for (let i = 0; i < this.particleCount; i++) {
            this.targetPositions[i] = this.basePositions[i].clone()
                .multiplyScalar(contractionForce);
        }
    }

    disperse() {
        this.isAnimating = true;
        this.gestureInfluence = 2.0;
        
        // Create outward explosion force
        for (let i = 0; i < this.particleCount; i++) {
            const direction = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            ).normalize();
            
            this.velocity.add(direction.multiplyScalar(0.1));
            this.targetPositions[i] = this.basePositions[i].clone()
                .add(direction.multiplyScalar(30));
        }
    }

    attractToPoint() {
        this.isAnimating = true;
        this.gestureInfluence = 1.0;
        
        const attractPoint = new THREE.Vector3(
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 40
        );
        
        for (let i = 0; i < this.particleCount; i++) {
            const direction = attractPoint.clone()
                .sub(this.basePositions[i])
                .normalize();
            
            this.targetPositions[i] = this.basePositions[i].clone()
                .add(direction.multiplyScalar(10));
        }
    }

    updateSettings(settings) {
        if (settings.particleSize && this.particles) {
            this.particles.material.size = settings.particleSize;
            this.particleSize = settings.particleSize;
        }
        
        if (settings.particleColor && this.particles) {
            this.particleColor.set(settings.particleColor);
            const colors = this.particles.geometry.attributes.color.array;
            
            for (let i = 0; i < this.particleCount; i++) {
                const i3 = i * 3;
                const variation = 0.2;
                colors[i3] = this.particleColor.r + (Math.random() - 0.5) * variation;
                colors[i3 + 1] = this.particleColor.g + (Math.random() - 0.5) * variation;
                colors[i3 + 2] = this.particleColor.b + (Math.random() - 0.5) * variation;
            }
            
            this.particles.geometry.attributes.color.needsUpdate = true;
        }
    }

    reset() {
        for (let i = 0; i < this.particleCount; i++) {
            this.targetPositions[i] = this.basePositions[i].clone();
        }
        this.gestureInfluence = 0;
        this.velocity.set(0, 0, 0);
    }


// Tambahkan method-method baru di class ParticleSystem:

createLetterParticles(letter) {
    if (!this.particles) return;
    
    const positions = this.particles.geometry.attributes.position.array;
    const count = this.particleCount;
    
    switch(letter.toLowerCase()) {
        case 'i':
            this.formLetterI(positions, count);
            break;
        case 'love':
            this.formHeart(positions, count);
            break;
        case 'you':
            this.formWordYou(positions, count);
            break;
    }
    
    this.particles.geometry.attributes.position.needsUpdate = true;
}

formLetterI(positions, count) {
    // Bentuk huruf I vertikal
    const letterWidth = 10;
    const letterHeight = 30;
    
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const segment = i % 3; // Bagi menjadi 3 bagian: atas, tengah, bawah
        
        if (segment === 0) { // Bagian atas (-)
            positions[i3] = (Math.random() - 0.5) * letterWidth;
            positions[i3 + 1] = letterHeight/2;
            positions[i3 + 2] = (Math.random() - 0.5) * 2;
        } 
        else if (segment === 1) { // Batang tengah (|)
            positions[i3] = (Math.random() - 0.5) * 2;
            positions[i3 + 1] = (Math.random() - 0.5) * letterHeight;
            positions[i3 + 2] = (Math.random() - 0.5) * 2;
        } 
        else { // Bagian bawah (-)
            positions[i3] = (Math.random() - 0.5) * letterWidth;
            positions[i3 + 1] = -letterHeight/2;
            positions[i3 + 2] = (Math.random() - 0.5) * 2;
        }
    }
}

formHeart(positions, count) {
    // Bentuk hati matematis
    const heartSize = 25;
    
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const t = Math.random() * Math.PI * 2;
        
        // Rumus parametrik untuk bentuk hati
        const x = heartSize * 16 * Math.pow(Math.sin(t), 3);
        const y = heartSize * (13 * Math.cos(t) - 
                              5 * Math.cos(2*t) - 
                              2 * Math.cos(3*t) - 
                              Math.cos(4*t));
        const z = (Math.random() - 0.5) * 5;
        
        positions[i3] = x / 100; // Scale down
        positions[i3 + 1] = -y / 100; // Flip vertical
        positions[i3 + 2] = z;
    }
}

formWordYou(positions, count) {
    // Bentuk kata "YOU" sederhana
    const letterSpacing = 8;
    const particlesPerLetter = Math.floor(count / 3);
    
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        let x, y, z;
        
        if (i < particlesPerLetter) { // Huruf Y
            const t = i / particlesPerLetter;
            if (t < 0.5) {
                // V shape
                x = -letterSpacing + Math.sin(t * Math.PI) * 3;
                y = 10 - t * 20;
            } else {
                // Batang
                x = -letterSpacing;
                y = -10 + (t - 0.5) * 10;
            }
        } 
        else if (i < particlesPerLetter * 2) { // Huruf O
            const t = (i - particlesPerLetter) / particlesPerLetter;
            const angle = t * Math.PI * 2;
            x = 0 + Math.cos(angle) * 4;
            y = Math.sin(angle) * 4;
        } 
        else { // Huruf U
            const t = (i - particlesPerLetter * 2) / (count - particlesPerLetter * 2);
            if (t < 0.5) {
                // Batang kiri
                x = letterSpacing - 2;
                y = 10 - t * 40;
            } else {
                // Kurva bawah
                const angle = (t - 0.5) * Math.PI;
                x = letterSpacing - 2 + Math.sin(angle) * 4;
                y = -10 + Math.cos(angle) * 4;
            }
        }
        
        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = (Math.random() - 0.5) * 3;
    }
}

// Tambahkan efek visual khusus untuk setiap gestur
handleASLGesture(gesture) {
    if (!this.particles) return;
    
    this.isAnimating = true;
    this.gestureInfluence = 1.0;
    
    switch(gesture.type) {
        case 'letter_i':
            this.createLetterParticles('i');
            this.sparkleEffect('#4ecdc4'); // Warna cyan
            break;
            
        case 'love':
            this.createLetterParticles('love');
            this.heartBeatEffect('#ff6b6b'); // Warna merah
            break;
            
        case 'you':
            this.createLetterParticles('you');
            this.pointingEffect('#feca57'); // Warna kuning
            break;
    }
}

// Efek khusus untuk setiap gestur
sparkleEffect(color) {
    // Efek berkilau untuk huruf I
    const colors = this.particles.geometry.attributes.color.array;
    
    for (let i = 0; i < this.particleCount; i++) {
        const i3 = i * 3;
        const c = new THREE.Color(color);
        
        // Tambahkan variasi kilau
        const sparkle = Math.random() * 0.5 + 0.5;
        colors[i3] = c.r * sparkle;
        colors[i3 + 1] = c.g * sparkle;
        colors[i3 + 2] = c.b * sparkle;
    }
    
    this.particles.geometry.attributes.color.needsUpdate = true;
    
    // Animasi pulsing
    this.particles.material.opacity = 0.9;
    setTimeout(() => {
        this.particles.material.opacity = 0.7;
    }, 300);
}

heartBeatEffect(color) {
    // Efek detak jantung untuk LOVE
    const colors = this.particles.geometry.attributes.color.array;
    const c = new THREE.Color(color);
    
    for (let i = 0; i < this.particleCount; i++) {
        const i3 = i * 3;
        colors[i3] = c.r;
        colors[i3 + 1] = c.g;
        colors[i3 + 2] = c.b;
    }
    
    this.particles.geometry.attributes.color.needsUpdate = true;
    
    // Animasi detak jantung
    const originalSize = this.particles.material.size;
    this.particles.material.size = originalSize * 1.3;
    
    setTimeout(() => {
        this.particles.material.size = originalSize;
    }, 200);
    
    setTimeout(() => {
        this.particles.material.size = originalSize * 1.2;
    }, 400);
    
    setTimeout(() => {
        this.particles.material.size = originalSize;
    }, 600);
}

pointingEffect(color) {
    // Efek pointing untuk YOU
    this.velocity.set(0, 0, 0.5); // Dorong ke depan
    
    // Ubah warna
    const colors = this.particles.geometry.attributes.color.array;
    const c = new THREE.Color(color);
    
    for (let i = 0; i < this.particleCount; i++) {
        const i3 = i * 3;
        const intensity = 0.7 + Math.random() * 0.3;
        colors[i3] = c.r * intensity;
        colors[i3 + 1] = c.g * intensity;
        colors[i3 + 2] = c.b * intensity;
    }
    
    this.particles.geometry.attributes.color.needsUpdate = true;
}
}