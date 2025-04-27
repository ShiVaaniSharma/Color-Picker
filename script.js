// --- DOM Elements ---
const saturationValueBox = document.getElementById('saturation-value-box');
const pickerHandle = document.getElementById('picker-handle');
const hueSlider = document.getElementById('hue-slider');
const opacitySlider = document.getElementById('opacity-slider');
const opacitySliderBg = document.getElementById('opacity-slider-bg');
const previewColorLayer = document.getElementById('preview-color-layer');
const rgbaCodeInput = document.getElementById('rgba-code');
const hexCodeInput = document.getElementById('hex-code');
const hslaCodeInput = document.getElementById('hsla-code');
const copyBtns = document.querySelectorAll('.copy-btn');
const imageUpload = document.getElementById('image-upload');
const imageCanvas = document.getElementById('image-canvas');
const canvasPlaceholder = document.getElementById('canvas-placeholder');
const clearImageBtn = document.getElementById('clear-image-btn');
const statusMessage = document.getElementById('status-message');
const pickerCanvasArea = document.getElementById('picker-canvas-area');
const pixelPreviewCursor = document.getElementById('pixel-preview-cursor'); // Pixel Preview Element
const pixelGrid = pixelPreviewCursor.querySelector('.pixel-grid');         // Inner grid element (though not directly manipulated anymore)
const refreshBtn = document.getElementById('refresh-btn');
const pasteDropZone = document.getElementById('paste-drop-zone');
const ctx = imageCanvas.getContext('2d', { willReadFrequently: true }); // Optimize for frequent reads

// --- State Variables ---
let currentMode = 'picker'; // 'picker' or 'image'
let hue = 0, saturation = 100, value = 100, alpha = 1; // HSV + Alpha state
let currentImage = null; // Stores the loaded Image object
let currentImageSource = null; // Store the source (URL/DataURL) - might be needed if we add back features
let isDraggingPicker = false; // Track dragging on the S/V picker
// const zoomLevel = 10; // No longer needed for CSS grid cursor

// --- Helper Functions ---

// HSV to RGB
function hsvToRgb(h, s, v) {
    s /= 100; v /= 100;
    let r, g, b;
    let i = Math.floor(h / 60);
    let f = h / 60 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// RGB to HSV
function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    let d = max - min;
    s = max == 0 ? 0 : d / max;
    if (max == min) { h = 0; } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

// HSV to HSL
function hsvToHsl(h, s, v) {
    s /= 100; v /= 100;
    let l = v * (1 - s / 2);
    let s_hsl;
    if (l === 0 || l === 1) {
        s_hsl = 0;
    } else {
        s_hsl = (v - l) / Math.min(l, 1 - l);
    }
    return { h: h, s: Math.round(s_hsl * 100), l: Math.round(l * 100) };
}

// RGB to HEX (with Alpha - #RRGGBBAA format)
function rgbToHex(r, g, b, a = 1) {
    const toHex = (c) => c.toString(16).padStart(2, '0').toUpperCase();
    const rHex = toHex(r);
    const gHex = toHex(g);
    const bHex = toHex(b);
    // Convert alpha (0-1) to 0-255 and then to hex
    const aHex = toHex(Math.round(a * 255));
    // Only include alpha component in the string if it's not fully opaque (FF)
    return `#${rHex}${gHex}${bHex}${aHex !== 'FF' ? aHex : ''}`;
}

// --- Update UI Function ---
function updateUI(updateSliders = true) {
    // 1. Calculate RGB from current HSV state
    const { r, g, b } = hsvToRgb(hue, saturation, value);
    const rgbaString = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;

    // --- Calculate other color formats ---
    const hexString = rgbToHex(r, g, b, alpha);
    const { h: hsl_h, s: hsl_s, l: hsl_l } = hsvToHsl(hue, saturation, value);
    const hslaString = `hsla(${hsl_h}, ${hsl_s}%, ${hsl_l}%, ${alpha.toFixed(2)})`;

    // 2. Update Saturation/Value Box background (uses pure hue)
    const pureHueRgb = hsvToRgb(hue, 100, 100);
    saturationValueBox.style.backgroundColor = `rgb(${pureHueRgb.r}, ${pureHueRgb.g}, ${pureHueRgb.b})`;

    // 3. Update Picker Handle position *if* in picker mode
    if (currentMode === 'picker') {
        const boxWidth = saturationValueBox.offsetWidth;
        const boxHeight = saturationValueBox.offsetHeight;
        if (boxWidth > 0 && boxHeight > 0) { // Ensure dimensions are available
           const handleX = (saturation / 100) * boxWidth;
           const handleY = (1 - value / 100) * boxHeight; // Y is inverted (0=bottom, 100=top)
           pickerHandle.style.left = `${handleX}px`;
           pickerHandle.style.top = `${handleY}px`;
           // Set handle border color based on perceived brightness for better contrast
           pickerHandle.style.borderColor = (value > 50 || saturation < 20) ? '#000' : '#fff';
        }
    }

    // 4. Update Opacity Slider background gradient
    const opaqueColor = `rgb(${r}, ${g}, ${b})`; // Base color without alpha
    // Combined background: gradient + checkerboard pattern
    opacitySliderBg.style.background = `linear-gradient(to right, rgba(${r}, ${g}, ${b}, 0), ${opaqueColor}), linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)`;
    opacitySliderBg.style.backgroundSize = '100% 100%, 10px 10px, 10px 10px, 10px 10px, 10px 10px'; // Size for gradient and checkerboard tiles
    opacitySliderBg.style.backgroundPosition = '0 0, 0 0, 0 5px, 5px -5px, -5px 0px'; // Position for checkerboard tiles

    // 5. Update Color Preview box
    previewColorLayer.style.backgroundColor = rgbaString;

    // 6. Update ALL Color Code Input fields
    rgbaCodeInput.value = rgbaString;
    hexCodeInput.value = hexString;
    hslaCodeInput.value = hslaString;

    // 7. Update Slider positions (optional, prevents feedback loops if called from slider 'input' events)
    if (updateSliders) {
        hueSlider.value = hue;
        opacitySlider.value = alpha * 100; // Convert alpha back to 0-100 range for slider
    }
}

// Set Status Message for user feedback
function setStatus(message, type = 'info') { // type can be 'info', 'success', 'error'
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`; // Apply class for styling
}

// --- Mode Switching ---
function setMode(newMode) {
    currentMode = newMode;
    imageCanvas.classList.remove('image-mode-active'); // Remove class by default
    pixelPreviewCursor.style.display = 'none'; // Hide pixel cursor by default

    if (newMode === 'picker') {
        saturationValueBox.style.display = 'block';
        pickerHandle.style.display = 'block';
        imageCanvas.style.display = 'none';
        canvasPlaceholder.style.display = 'none';
        clearImageBtn.style.display = 'none';
        updateUI(false); // Update UI without resetting sliders
        setStatus('Using direct color picker.');
    } else if (newMode === 'image') {
        saturationValueBox.style.display = 'none';
        pickerHandle.style.display = 'none';
        imageCanvas.style.display = 'block';
        canvasPlaceholder.style.display = 'none';
        clearImageBtn.style.display = 'inline-block';
        imageCanvas.classList.add('image-mode-active'); // Add class to hide default cursor
        // Pixel preview cursor will be shown on mouseenter/mousemove over canvas
        setStatus('Image loaded. Click image to pick color.', 'success');
    } else if (newMode === 'placeholder') {
        // State when no image is loaded yet, but not necessarily picker mode
        saturationValueBox.style.display = 'none';
        pickerHandle.style.display = 'none';
        imageCanvas.style.display = 'none';
        canvasPlaceholder.style.display = 'block'; // Show placeholder text
        clearImageBtn.style.display = 'none';
        setStatus('Upload or paste an image.');
    }
}

// --- Image Handling ---
function loadImage(source) {
    setStatus('Loading image...', 'info');
    const img = new Image();
    img.onload = () => {
        currentImage = img; // Store the loaded Image object
        currentImageSource = source; // Store the data URL/URL (still useful if needed later)
        drawImageToCanvas(img); // Draw it scaled onto the canvas
        setMode('image'); // Switch to image picking mode
    };
    img.onerror = () => {
        // Handle image loading errors
        setStatus('Error loading image.', 'error');
        currentImage = null;
        currentImageSource = null;
        setMode('picker'); // Revert to picker mode on error
    };
    img.src = source; // Set the source to trigger loading
}

// Draws the loaded image onto the canvas, scaled and centered
function drawImageToCanvas(img) {
    const containerWidth = pickerCanvasArea.clientWidth;
    const containerHeight = pickerCanvasArea.clientHeight;

    // Calculate image dimensions to fit container while maintaining aspect ratio
    let drawWidth = img.naturalWidth; // Start with original image size
    let drawHeight = img.naturalHeight;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = containerWidth / containerHeight;

    if (imgRatio > containerRatio) { // Image is wider than container aspect ratio
        drawWidth = containerWidth;
        drawHeight = drawWidth / imgRatio;
    } else { // Image is taller or same aspect ratio
        drawHeight = containerHeight;
        drawWidth = drawHeight * imgRatio;
    }

    // Calculate offset to center the scaled image on the canvas
    const offsetX = (containerWidth - drawWidth) / 2;
    const offsetY = (containerHeight - drawHeight) / 2;

    // Set canvas dimensions to match the container size
    imageCanvas.width = containerWidth;
    imageCanvas.height = containerHeight;

    // Clear previous canvas content and draw the new image
    ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight); // Draw scaled image
}

// Handle file input change event
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0]; // Get the selected file
    if (file && file.type.startsWith('image/')) { // Check if it's an image
        const reader = new FileReader();
        reader.onload = (event) => loadImage(event.target.result); // Load image from Data URL
        reader.onerror = () => setStatus('Error reading file.', 'error');
        reader.readAsDataURL(file); // Read file as Data URL
    } else if (file) {
        // If a file was selected but wasn't an image
        setStatus('Please select a valid image file.', 'error');
    }
    e.target.value = null; // Reset input to allow uploading the same file again if needed
});

// --- Drag and Drop Handling ---
// Make the drop zone clickable to trigger file input
pasteDropZone.addEventListener('click', () => {
    imageUpload.click();
});

// Highlight drop zone when a file is dragged over the window
window.addEventListener('dragenter', (e) => {
    e.preventDefault(); // Prevent default browser behavior
    // Check if dragged items include files
    if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
         pasteDropZone.classList.add('drag-over'); // Add highlight class
    }
});

// Prevent default behavior for dragover is necessary to allow drop
window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
         pasteDropZone.classList.add('drag-over'); // Keep highlight class
    }
});

// Remove highlight effect when dragged file leaves the window or drop zone
window.addEventListener('dragleave', (e) => {
    // Check if the mouse is leaving the drop zone or its children
     if (!pasteDropZone.contains(e.relatedTarget)) {
       pasteDropZone.classList.remove('drag-over'); // Remove highlight class
     }
});

// Handle the file drop event
window.addEventListener('drop', (e) => {
    e.preventDefault(); // Prevent browser from opening the file
    pasteDropZone.classList.remove('drag-over'); // Remove highlight
    // Check if files were dropped
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0]; // Get the first dropped file
        if (file.type.startsWith('image/')) { // Check if it's an image
            const reader = new FileReader();
            reader.onload = (event) => loadImage(event.target.result); // Load dropped image
            reader.onerror = () => setStatus('Error reading dropped file.', 'error');
            reader.readAsDataURL(file);
        } else {
            setStatus('Please drop an image file.', 'error'); // Feedback for non-image file
        }
    }
});

// --- Paste Handling ---
// Listen for paste events on the document
document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || window.clipboardData).items; // Get clipboard items
    if (!items) return; // Exit if no items
    let foundImage = false;
    for (let i = 0; i < items.length; i++) {
        // Check if the item is an image
        if (items[i].type.startsWith('image/')) {
            const blob = items[i].getAsFile(); // Get image as a file blob
            if (blob) {
                // Provide visual feedback on the paste zone
                pasteDropZone.classList.add('drag-over');
                setTimeout(() => pasteDropZone.classList.remove('drag-over'), 300); // Briefly highlight

                const reader = new FileReader();
                reader.onload = (event) => loadImage(event.target.result); // Load pasted image
                reader.onerror = () => setStatus('Error reading pasted data.', 'error');
                reader.readAsDataURL(blob); // Read blob as Data URL
                foundImage = true;
                e.preventDefault(); // Prevent default paste action (e.g., pasting text)
                break; // Process only the first image found
            }
        }
    }
     if(foundImage) {
        setStatus('Pasted image loaded.', 'success');
    }
});

// Handle "Clear Image" button click
clearImageBtn.addEventListener('click', () => {
    currentImage = null; // Clear stored image object
    currentImageSource = null; // Clear stored image source
    ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height); // Clear the canvas visually
    setMode('picker'); // Revert to picker mode
});

// --- Direct Picker Interaction (Saturation/Value) ---
function handleSaturationValueChange(event) {
    // Only proceed if dragging or initial click/touch
    if (!isDraggingPicker && event.type !== 'mousedown' && event.type !== 'touchstart') return;

    const boxRect = saturationValueBox.getBoundingClientRect();
    // Get coordinates, handling both mouse and touch events
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    // Calculate coordinates relative to the picker box
    let x = clientX - boxRect.left;
    let y = clientY - boxRect.top;
    // Clamp coordinates within the box bounds
    x = Math.max(0, Math.min(boxRect.width, x));
    y = Math.max(0, Math.min(boxRect.height, y));

    // Calculate Saturation (0-100) based on X position
    saturation = Math.round((x / boxRect.width) * 100);
    // Calculate Value (0-100) based on Y position (inverted: top is 100, bottom is 0)
    value = Math.round((1 - y / boxRect.height) * 100);

    updateUI(false); // Update UI but not sliders (avoids feedback loop)
}

// Mouse down on picker starts dragging
saturationValueBox.addEventListener('mousedown', (e) => {
     if (currentMode !== 'picker') return; // Only allow in picker mode
    isDraggingPicker = true;
    handleSaturationValueChange(e); // Handle initial click position
    // Add listeners to document to track mouse movement outside the box during drag
    document.addEventListener('mousemove', handleSaturationValueChange);
    document.addEventListener('mouseup', stopPickerDragging);
});
// Touch start on picker starts dragging
saturationValueBox.addEventListener('touchstart', (e) => {
    if (currentMode !== 'picker') return;
    if (e.cancelable) e.preventDefault(); // Prevent page scroll on touch devices
    isDraggingPicker = true;
    handleSaturationValueChange(e);
    // Add listeners to document for touch events
    document.addEventListener('touchmove', handleSaturationValueChange, { passive: false }); // passive:false to allow preventDefault
    document.addEventListener('touchend', stopPickerDragging);
    document.addEventListener('touchcancel', stopPickerDragging); // Handle cancelled touches
});

// Stops the dragging state and removes document listeners
function stopPickerDragging() {
    if (isDraggingPicker) {
        isDraggingPicker = false;
        document.removeEventListener('mousemove', handleSaturationValueChange);
        document.removeEventListener('mouseup', stopPickerDragging);
        document.removeEventListener('touchmove', handleSaturationValueChange);
        document.removeEventListener('touchend', stopPickerDragging);
        document.removeEventListener('touchcancel', stopPickerDragging);
    }
}

// --- Image Canvas Interaction (Click) ---
imageCanvas.addEventListener('click', (e) => {
    // Only proceed if in image mode and an image is loaded
    if (currentMode !== 'image' || !currentImage) return;

    const rect = imageCanvas.getBoundingClientRect();
    // Calculate click coordinates relative to the canvas
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);

    try {
        // Get the pixel data for the clicked point (1x1 pixel area)
        const pixelData = ctx.getImageData(x, y, 1, 1).data;

        // Extract RGB values
        const r = pixelData[0], g = pixelData[1], b = pixelData[2];
        // Note: We typically keep the alpha value from the slider, not from the image pixel directly.

        // Convert picked RGB to HSV to update the internal color state
        const hsv = rgbToHsv(r, g, b);
        hue = hsv.h;
        saturation = hsv.s;
        value = hsv.v;

        updateUI(true); // Update everything, including sliders, based on the picked color
        setStatus(`Picked color from image at (${x}, ${y}).`, 'success');

    } catch (error) {
        // Handle potential errors (e.g., security restrictions, though less likely with local/pasted images)
        console.error("Error getting pixel data:", error);
        setStatus('Could not pick color from image.', 'error');
    }
});


// --- Image Canvas Mouse Events for Pixel Preview Cursor ---
imageCanvas.addEventListener('mouseenter', (e) => {
    // Show pixel preview cursor when mouse enters the canvas in image mode
    if (currentMode === 'image' && currentImage) {
        pixelPreviewCursor.style.display = 'block';
    }
});

imageCanvas.addEventListener('mouseleave', (e) => {
    // Hide pixel preview cursor when mouse leaves the canvas
    pixelPreviewCursor.style.display = 'none';
});

imageCanvas.addEventListener('mousemove', (e) => {
    // Only proceed if in image mode and an image is loaded
    if (currentMode !== 'image' || !currentImage) {
        pixelPreviewCursor.style.display = 'none'; // Ensure hidden otherwise
        return;
    };

    // Position the preview cursor centered on the mouse pointer (relative to viewport)
    pixelPreviewCursor.style.left = `${e.clientX}px`;
    pixelPreviewCursor.style.top = `${e.clientY}px`;
    pixelPreviewCursor.style.display = 'block'; // Ensure visible while moving

    // Note: We no longer need to update the background of the pixelGrid div here,
    // as the grid pattern is now handled purely by CSS.
    // The underlying canvas image shows through the transparent grid.
});


// --- Slider Interaction ---
// Update hue state and UI when hue slider changes
hueSlider.addEventListener('input', () => {
    hue = parseInt(hueSlider.value);
    updateUI(false); // Update UI without re-setting slider value
});

// Update alpha state and UI when opacity slider changes
opacitySlider.addEventListener('input', () => {
    alpha = parseInt(opacitySlider.value) / 100; // Convert 0-100 range to 0-1
    updateUI(false); // Update UI without re-setting slider value
});

// --- Copy Button ---
// Add event listener to all copy buttons
copyBtns.forEach(button => {
    button.addEventListener('click', () => {
        // Get the target input field ID from the button's data attribute
        const targetInputId = button.getAttribute('data-target');
        const targetInput = document.getElementById(targetInputId);

        // Check if the input field exists and has a value
        if (!targetInput || !targetInput.value) {
             setStatus('Nothing to copy yet.', 'error');
             return;
        }

        targetInput.select(); // Select the text in the input field
        try {
            // Use the modern Clipboard API to copy text
            navigator.clipboard.writeText(targetInput.value);
            // Provide success feedback, extract format name (RGBA, HEX, HSLA) from input ID
            setStatus(`${targetInput.id.split('-')[0].toUpperCase()} code copied!`, 'success');
            // Visual feedback on the button itself
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => { button.textContent = originalText; }, 1500); // Reset button text after 1.5s
        } catch (err) {
            // Handle potential errors during copy operation
            console.error('Failed to copy: ', err);
            setStatus('Failed to copy code.', 'error');
            // Consider adding a fallback method using document.execCommand('copy') for older browsers if needed
        }
    });
});

// --- Refresh Button ---
// Reload the current page when the refresh button is clicked
refreshBtn.addEventListener('click', () => {
    location.reload();
});

// --- Initial Setup ---
// Run when the DOM is fully loaded and ready
document.addEventListener('DOMContentLoaded', () => {
     setMode('picker'); // Start the application in the direct picker mode
     updateUI(); // Render the initial UI based on default state
});