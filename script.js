class PixelCipher {
    constructor() {
        // Visible preview canvas
        this.previewCanvas = document.getElementById('imageCanvas');
        this.previewCtx = this.previewCanvas.getContext('2d');

        // Hidden processing canvas
        this.processingCanvas = document.createElement('canvas');
        this.processingCtx = this.processingCanvas.getContext('2d');

        // Fixed dimensions for preview
        this.PREVIEW_WIDTH = 600;  // or any desired width
        this.PREVIEW_HEIGHT = 400; // or any desired height

        this.originalImageData = null;
        this.currentImageData = null;
        this.isImageTransformed = false;
        this.transformBtn = document.getElementById('transformBtn');
        this.revertBtn = document.getElementById('revertBtn');
        
        // Initially disable revert button
        this.revertBtn.disabled = true;
        this.revertBtn.classList.add('opacity-50', 'cursor-not-allowed');
        this.setupEventListeners();
        this.setupThemeToggle();
        this.setupImageUI();
    }

    setupEventListeners() {
        document.getElementById('imageInput').addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('transformBtn').addEventListener('click', () => this.transformImage());
        document.getElementById('revertBtn').addEventListener('click', () => this.revertImage());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadImage());
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        
        // Check for saved theme preference or use system preference
        if (localStorage.theme === 'dark' || 
            (!('theme' in localStorage) && 
             window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Toggle theme on button click
        themeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            
            // Save preference
            if (document.documentElement.classList.contains('dark')) {
                localStorage.theme = 'dark';
            } else {
                localStorage.theme = 'light';
            }
        });
    }

    setupImageUI() {
        const uploadPrompt = document.getElementById('uploadPrompt');
        const previewContainer = document.getElementById('previewContainer');
        const reselectBtn = document.getElementById('reselectBtn');
        const imageInput = document.getElementById('imageInput');
        const secretKeyInput = document.getElementById('secretKey');
        const shareBtn = document.getElementById('shareBtn');
        const imageDownloadBtn = document.getElementById('imageDownloadBtn');

        // Click on upload prompt
        uploadPrompt.addEventListener('click', () => {
            imageInput.click();
        });

        // Click on reselect button
        reselectBtn.addEventListener('click', () => {
            imageInput.click();
        });

        // When image is selected
        imageInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                uploadPrompt.classList.add('hidden');
                previewContainer.classList.remove('hidden');
                this.handleImageUpload(e);
                // Focus on secret key input
                secretKeyInput.focus();
                
                // Enable both buttons when new image is selected
                this.enableTransformButton();
                this.enableRevertButton();
                this.isImageTransformed = false;

                // Hide image actions for new image
                const imageActions = document.getElementById('imageActions');
                imageActions.classList.add('opacity-0');
                imageActions.classList.remove('opacity-100');
            }
        });

        // Share button click
        shareBtn.addEventListener('click', async () => {
            try {
                const blob = await new Promise(resolve => 
                    this.processingCanvas.toBlob(resolve, 'image/png')
                );
                const file = new File([blob], 'encrypted-image.png', { type: 'image/png' });
                
                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    // Use native share on supported mobile devices
                    await navigator.share({
                        files: [file],
                        title: 'Encrypted Image from PixelCipher',
                        text: 'Check out this encrypted image!'
                    });
                } else if (navigator.share) {
                    // Fallback to URL sharing if file sharing is not supported
                    const dataUrl = this.processingCanvas.toDataURL('image/png');
                    await navigator.share({
                        title: 'Encrypted Image from PixelCipher',
                        text: 'Check out this encrypted image!',
                        url: window.location.href
                    });
                } else {
                    // Fallback for desktop or unsupported browsers
                    this.downloadImage();
                    this.showToast('Share not supported on this device. Image downloaded instead.');
                }
            } catch (error) {
                console.error('Error sharing:', error);
                if (error.name === 'AbortError') {
                    // User cancelled sharing
                    return;
                }
                this.showToast('Failed to share. Try downloading instead.');
            }
        });

        // Image download button click
        imageDownloadBtn.addEventListener('click', () => {
            this.downloadImage();
        });
    }

    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        img.onload = () => {
            // Set processing canvas to actual image dimensions
            this.processingCanvas.width = img.width;
            this.processingCanvas.height = img.height;
            this.processingCtx.drawImage(img, 0, 0);

            // Store original data from processing canvas
            this.originalImageData = this.processingCtx.getImageData(
                0, 0, 
                this.processingCanvas.width, 
                this.processingCanvas.height
            );
            this.currentImageData = new ImageData(
                new Uint8ClampedArray(this.originalImageData.data),
                this.processingCanvas.width,
                this.processingCanvas.height
            );

            // Calculate scaled dimensions maintaining aspect ratio
            const { width, height } = this.calculateAspectRatio(
                img.width,
                img.height,
                this.PREVIEW_WIDTH,
                this.PREVIEW_HEIGHT
            );

            // Set preview canvas dimensions
            this.previewCanvas.width = width;
            this.previewCanvas.height = height;

            // Clear preview canvas
            this.previewCtx.clearRect(0, 0, width, height);

            // Draw scaled image on preview canvas
            this.previewCtx.drawImage(
                this.processingCanvas,
                0, 0,
                this.processingCanvas.width,
                this.processingCanvas.height,
                0, 0,
                width,
                height
            );
        };
    }

    calculateAspectRatio(imgWidth, imgHeight, maxWidth, maxHeight) {
        const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
        return {
            width: Math.round(imgWidth * ratio),
            height: Math.round(imgHeight * ratio)
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
            this.showToast('Please enter a secret key', 'error');
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

            // Update processing canvas
            this.processingCtx.putImageData(this.currentImageData, 0, 0);

            // Clear preview canvas before drawing
            this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);

            // Draw scaled encrypted image to preview canvas
            this.previewCtx.drawImage(
                this.processingCanvas,
                0, 0,
                this.processingCanvas.width,
                this.processingCanvas.height,
                0, 0,
                this.previewCanvas.width,
                this.previewCanvas.height
            );

            // Update button states after successful transformation
            this.disableTransformButton();
            this.enableRevertButton();
            this.isImageTransformed = true;

            // Show image actions after encryption
            const imageActions = document.getElementById('imageActions');
            imageActions.classList.remove('opacity-0');
            imageActions.classList.add('opacity-100');

            this.showToast('Image transformed successfully', 'success');
        } catch (error) {
            console.error('Encryption failed:', error);
            this.showToast('Encryption failed. Please try again.', 'error');
        }
    }

    async revertImage() {
        if (!this.originalImageData || !this.currentImageData || !this.iv || !this.encryptedData) return;

        const secretKey = document.getElementById('secretKey').value;
        if (!secretKey) {
            this.showToast('Please enter the same secret key used for transformation', 'error');
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

            // Update processing canvas
            this.processingCtx.putImageData(this.currentImageData, 0, 0);

            // Scale and draw to preview canvas
            this.previewCtx.drawImage(
                this.processingCanvas,
                0, 0,
                this.processingCanvas.width,
                this.processingCanvas.height,
                0, 0,
                this.previewCanvas.width,
                this.previewCanvas.height
            );

            // Update button states after successful reversion
            this.enableTransformButton();
            this.disableRevertButton();

            // Hide image actions after decryption
            const imageActions = document.getElementById('imageActions');
            imageActions.classList.add('opacity-0');
            imageActions.classList.remove('opacity-100');

            this.showToast('Image restored successfully', 'success');
        } catch (error) {
            console.error('Decryption failed:', error);
            this.showToast('Decryption failed. Please make sure you are using the correct key.', 'error');
        }
    }

    downloadImage() {
        // Use the processing canvas for download to maintain original quality
        const link = document.createElement('a');
        link.download = 'pixel-cipher-image.png';
        link.href = this.processingCanvas.toDataURL('image/png');
        link.click();
        this.showToast('Image downloaded successfully', 'success');
    }

    enableTransformButton() {
        this.transformBtn.disabled = false;
        this.transformBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    disableTransformButton() {
        this.transformBtn.disabled = true;
        this.transformBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    enableRevertButton() {
        this.revertBtn.disabled = false;
        this.revertBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    disableRevertButton() {
        this.revertBtn.disabled = true;
        this.revertBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // Enhance the toast to support different types
    showToast(message, type = 'info') {
        // Remove existing toast if any
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast-notification fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg 
                          backdrop-blur-xl border border-white/20 dark:border-white/10 text-sm shadow-lg
                          transition-all duration-300 z-50`;

        // Add type-specific styles
        switch (type) {
            case 'error':
                toast.className += ' bg-red-500/10 dark:bg-red-900/30 text-red-700 dark:text-red-200';
                break;
            case 'success':
                toast.className += ' bg-green-500/10 dark:bg-green-900/30 text-green-700 dark:text-green-200';
                break;
            default: // info
                toast.className += ' bg-white/10 dark:bg-black/30 text-sky-700 dark:text-gray-200';
        }

        toast.textContent = message;

        // Add to document
        document.body.appendChild(toast);

        // Set initial opacity to 0
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 20px)';

        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translate(-50%, 0)';
        });

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new PixelCipher();
}); 