class PixelCipher {
    constructor() {
        this.canvas = document.getElementById('imageCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.originalImageData = null;
        this.currentImageData = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('imageInput').addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('transformBtn').addEventListener('click', () => this.transformImage());
        document.getElementById('revertBtn').addEventListener('click', () => this.revertImage());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadImage());
    }

    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        img.onload = () => {
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            this.ctx.drawImage(img, 0, 0);
            this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            this.currentImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        };
    }

    async generateKey(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        
        // Generate a key using PBKDF2
        const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
        const iterations = 100000;
        
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            data,
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: iterations,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }

    async transformImage() {
        if (!this.currentImageData) return;

        const secretKey = document.getElementById('secretKey').value;
        if (!secretKey) {
            alert('Please enter a secret key');
            return;
        }

        try {
            // Generate AES key from password
            const key = await this.generateKey(secretKey);

            // Convert ImageData to ArrayBuffer for encryption
            const pixelArray = new Uint8Array(this.currentImageData.data);
            
            // Generate IV
            const iv = crypto.getRandomValues(new Uint8Array(12));
            this.iv = iv; // Store for decryption

            // Encrypt the pixel data
            const encryptedData = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                pixelArray
            );

            // Store the full encrypted data for later decryption
            this.encryptedData = encryptedData;

            // Create a visual representation of the encrypted data
            const visualArray = new Uint8ClampedArray(this.currentImageData.data.length);
            const encryptedArray = new Uint8Array(encryptedData);
            
            // Copy encrypted data to visual array, handling overflow
            for (let i = 0; i < this.currentImageData.data.length; i++) {
                visualArray[i] = encryptedArray[i % encryptedArray.length];
            }
            
            // Update the image with visual encrypted data
            this.currentImageData = new ImageData(
                visualArray,
                this.currentImageData.width,
                this.currentImageData.height
            );

            this.ctx.putImageData(this.currentImageData, 0, 0);
        } catch (error) {
            console.error('Encryption failed:', error);
            alert('Encryption failed. Please try again.');
        }
    }

    async revertImage() {
        if (!this.originalImageData || !this.currentImageData || !this.iv || !this.encryptedData) return;

        const secretKey = document.getElementById('secretKey').value;
        if (!secretKey) {
            alert('Please enter the same secret key used for transformation');
            return;
        }

        try {
            // Generate the same key from password
            const key = await this.generateKey(secretKey);

            // Decrypt the stored encrypted data
            const decryptedData = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: this.iv
                },
                key,
                this.encryptedData
            );

            // Convert decrypted data back to ImageData format
            const decryptedArray = new Uint8ClampedArray(decryptedData);
            this.currentImageData = new ImageData(
                decryptedArray,
                this.currentImageData.width,
                this.currentImageData.height
            );

            this.ctx.putImageData(this.currentImageData, 0, 0);
        } catch (error) {
            console.error('Decryption failed:', error);
            alert('Decryption failed. Please make sure you are using the correct key.');
        }
    }

    downloadImage() {
        const link = document.createElement('a');
        link.download = 'pixel-cipher-image.png';
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new PixelCipher();
}); 