import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { $el } from "../../../scripts/ui.js";
import * as pngMetadata from "../../../scripts/metadata/png.js";


class PromptGallery {
    constructor(app) {
        this.app = app;
        this.allImages = [];
        this.filteredImages = [];
        this.sortAscending = true;
        this.searchInput = this.createSearchInput();
        this.sortToggle = this.createSortToggle();
        this.accordion = $el("div.prompt-accordion");
        this.yamlFiles = [
            { name: "PonyXl-artstyles.yaml", type: "Art Styles", skipLevels: 0, sections: null, order: 1 },
            { name: "PonyXl-game_persona.yaml", type: "Game Characters", skipLevels: 0, sections: null, order: 2 },
            { name: "PonyXl-show_persona.yaml", type: "Show Characters", skipLevels: 0, sections: null, order: 3 },
            { name: "PonyXl-f-body.yaml", type: "Female Body", skipLevels: 0, sections: { body_race: "Race", body_form: "Build" }, order: 4 },
            { name: "PonyXl-poses.yaml", type: "Poses", skipLevels: 0, sections: null, order: 5 },
            { name: "PonyXl-expressions.yaml", type: "Expressions", skipLevels: 0, sections: null, order: 6, ignoreKey: "chara_expression" },
            { name: "PonyXl-scenes.yaml", type: "Scenes", skipLevels: 0, sections: null, order: 7 }
            // will add more datasets here over time
        ];
        this.baseUrl = `${window.location.protocol}//${window.location.host}`;
        this.placeholderImageUrl = `${this.baseUrl}/prompt_gallery/image?filename=SKIP.jpeg`;
        this.customImages = [];
        this.isSearchActive = false;
        this.debouncedSaveState = this.debounce(this.savePluginData.bind(this), 600000); // 10 minute delay
        this.resetButton = this.createResetCustomImagesButton();
        this.missingFiles = new Set();
    
        this.element = $el("div.prompt-gallery-popup", [
            $el("h3", "Prompt Image Gallery"),
            $el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } }, [
                this.searchInput,
                this.sortToggle
            ]),
            this.accordion
        ]);
    
        // Load plugin data and update
        this.loadPluginData().then(() => {
            this.updateDownloadButtonVisibility();
            this.update();
        });
        
        window.addEventListener('beforeunload', () => {
            this.savePluginData();
        });
    }

    createResetCustomImagesButton() {
        const button = $el("button", {
            textContent: "Reset Custom Images",
            onclick: () => this.resetCustomImages(),
            style: {
                padding: "5px 10px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                width: "100%",
                height: "30px",  // Set a fixed height
                fontSize: "14px",
                textAlign: "center",
                lineHeight: "20px"
            }
        });
        return button;
    }

    async resetCustomImages() {
        if (confirm("Are you sure you want to reset all custom images? This action cannot be undone!")) {
            this.customImages = [];
            await this.savePluginData();
            this.update();
            console.log("Custom images have been reset.");
            app.extensionManager.toast.add({
                severity: "info",
                summary: "Custom Images Reset",
                detail: "All custom images have been cleared.",
                life: 3000
            });
        }
    }
    
    async savePluginData() {
        const pluginData = {
            customImages: this.customImages,
            sectionStates: this.sectionStates,
            sortAscending: this.sortAscending,
            noFilesWarningDismissed: this.noFilesWarningDismissed,
            downloadLinkDismissed: this.downloadLinkDismissed,
            allYamlFilesPresent: this.allYamlFilesPresent
        };
    
        try {
            const response = await api.fetchApi('/userdata/prompt_gallery_data.json?overwrite=true', {
                method: 'POST',
                body: JSON.stringify(pluginData),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error('Failed to save plugin data');
            }
            console.log('Plugin data saved successfully:', pluginData);
        } catch (error) {
            console.error('Error saving plugin data:', error);
        }
    }

    async loadPluginData() {
        try {
            const response = await api.fetchApi('/userdata/prompt_gallery_data.json');
            if (response.ok) {
                const data = await response.json();
                this.customImages = data.customImages || [];
                this.sectionStates = data.sectionStates || {};
                this.sortAscending = data.sortAscending !== undefined ? data.sortAscending : true;
                this.noFilesWarningDismissed = data.noFilesWarningDismissed || false;
                this.downloadLinkDismissed = data.downloadLinkDismissed || false;
                // Always set allYamlFilesPresent to false on startup
                this.allYamlFilesPresent = false;
    
                console.log('Plugin data loaded successfully:', data);
            } else if (response.status === 404) {
                console.log('No plugin data found. Starting with default values.');
                this.customImages = [];
                this.sectionStates = {};
                this.sortAscending = true;
                this.noFilesWarningDismissed = false;
                this.downloadLinkDismissed = false;
                this.allYamlFilesPresent = false;
            } else {
                throw new Error('Failed to load plugin data');
            }
        } catch (error) {
            console.error('Error loading plugin data:', error);
            this.customImages = [];
            this.sectionStates = {};
            this.sortAscending = true;
            this.noFilesWarningDismissed = false;
            this.downloadLinkDismissed = false;
            this.allYamlFilesPresent = false;
        }
    
        // Check YAML files after setting allYamlFilesPresent to false
        this.allYamlFilesPresent = await this.checkYamlFiles();
        await this.savePluginData();
    
        this.updateDownloadButtonVisibility();
    }
    
    async checkYamlFiles() {
        for (const file of this.yamlFiles) {
            try {
                const response = await fetch(`${this.baseUrl}/prompt_gallery/yaml?filename=${file.name}`);
                if (!response.ok) {
                    console.log(`YAML file not found: ${file.name}`);
                    return false;
                }
            } catch (error) {
                console.error(`Error checking YAML file ${file.name}:`, error);
                return false;
            }
        }
        console.log('All YAML files present');
        return true;
    }
    
    updateDownloadButtonVisibility() {
        console.log("Updating download button visibility");
        console.log("allYamlFilesPresent:", this.allYamlFilesPresent);
        console.log("downloadLinkDismissed:", this.downloadLinkDismissed);
    
        const existingButton = this.element.querySelector('.download-image-sets-button');
        console.log("Existing button:", existingButton);
    
        if (!this.allYamlFilesPresent && !this.downloadLinkDismissed) {
            console.log("Conditions met to show button");
            if (!existingButton) {
                console.log("Creating new button");
                const button = this.createDownloadImageSetsButton();
                this.element.insertBefore(button, this.element.children[1]);
            }
        } else {
            console.log("Conditions met to hide button");
            if (existingButton) {
                console.log("Removing existing button");
                existingButton.remove();
            }
        }
    }

    createAddCustomImageButton() {
        const button = $el("div", {
            style: {
                width: "100px",
                height: "100px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                cursor: "pointer",
                border: "2px dashed #ccc",
                borderRadius: "5px",
                backgroundColor: "#2a2a2a"
            },
            onclick: () => this.showAddCustomImageDialog()
        });

        const plusSign = $el("div", {
            textContent: "+",
            style: {
                fontSize: "40px",
                color: "#ccc"
            }
        });

        const addText = $el("div", {
            textContent: "Add",
            style: {
                marginTop: "5px",
                fontSize: "12px",
                color: "#ccc"
            }
        });

        button.appendChild(plusSign);
        button.appendChild(addText);

        return button;
    }

    createDownloadImageSetsButton() {
        const container = $el("div", {
            className: "download-image-sets-button",
            style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
                padding: "5px 10px",
                backgroundColor: "#236692",
                color: "white",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "background-color 0.3s"
            }
        });
    
        const link = $el("a", {
            href: "https://civitai.com/models/615967?modelVersionId=789576",
            target: "_blank",
            textContent: "Download Image Sets",
            style: {
                color: "white",
                textDecoration: "none",
                flexGrow: 1,
                textAlign: "center"
            }
        });
    
        const dismissButton = $el("button", {
            textContent: "×",
            onclick: async (e) => {
                e.stopPropagation();
                this.downloadLinkDismissed = true;
                await this.savePluginData(); // Save the updated state
                container.remove();
            },
            style: {
                background: "none",
                border: "none",
                color: "white",
                fontSize: "20px",
                cursor: "pointer",
                padding: "0 5px"
            }
        });
    
        container.appendChild(link);
        container.appendChild(dismissButton);
    
        container.addEventListener("mouseover", () => {
            container.style.backgroundColor = "#2c7cb0";
        });
    
        container.addEventListener("mouseout", () => {
            container.style.backgroundColor = "#236692";
        });
    
        return container;
    }

    setupDragAndDrop() {
        console.log("Setting up drag and drop");

        const customSection = this.accordion.querySelector('.custom-section');
        console.log("Custom section found:", customSection);
        if (!customSection) {
            console.error("Custom section not found in the DOM");
            return;
        }
    
        const dropZone = customSection.querySelector('.accordion-content');
        console.log("Drop zone found:", dropZone);
        if (!dropZone) {
            console.error("Drop zone not found in the custom section");
            return;
        }
    
        dropZone.style.transition = 'all 0.3s ease';
        
        const addHighlight = () => {
            dropZone.style.border = '2px dashed #4CAF50';
            dropZone.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        };
    
        const removeHighlight = () => {
            dropZone.style.border = '';
            dropZone.style.backgroundColor = '';
        };
    
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });
    
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                console.log("Drag enter/over");
                addHighlight();
            }, false);
        });
    
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                console.log("Drag leave/drop");
                removeHighlight();
            }, false);
        });
    
        dropZone.addEventListener('drop', (e) => {
            console.log("File dropped");
            let dt = e.dataTransfer;
            let files = dt.files;
            this.handleFiles(files);
        }, false);
    }
    
    handleFiles(files) {
        console.log("Handling files:", files);
        //[...files].forEach(file => this.uploadAndProcessFile(file));
        [...new Set(files)].forEach(file => this.uploadAndProcessFile(file));
    }

    showAddCustomImageDialog() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                await this.uploadAndProcessFile(file);
            }
            document.body.removeChild(fileInput);
        });

        fileInput.click();
    }

    async uploadAndProcessFile(file) {
        try {
            // Prepare the form data with the correct path
            const formData = new FormData();
            formData.append('image', file);
            formData.append('subfolder', 'custom'); // Specify the subfolder - not needed anymore
    
            // Upload file directly to the correct directory
            const uploadResponse = await api.fetchApi('/prompt_gallery/upload', {
                method: 'POST',
                body: formData
            });
    
            if (!uploadResponse.ok) {
                throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
            }
    
            let uploadResult;
            try {
                uploadResult = await uploadResponse.json();
            } catch (jsonError) {
                console.error('Error parsing JSON response:', jsonError);
                throw new Error('Invalid response from server');
            }
    
            if (!uploadResult || !uploadResult.name) {
                throw new Error('Invalid response from server: missing image name');
            }
    
            const imagePath = uploadResult.name.split('\\').pop(); // Just get the filename

            // Add a delay or file existence check here
            await this.ensureFileExists(imagePath);
    
            // Check if the image already exists in customImages
            const existingImageIndex = this.customImages.findIndex(img => img.name === imagePath);
            
            if (existingImageIndex === -1) {
                // Add to custom images only if it doesn't already exist
                await this.addCustomImage(imagePath, "");
            } else {
                console.log(`Image ${imagePath} already exists in custom images. Updating metadata.`);
            }
    
            // Attempt to fetch metadata
            try {
                const metadata = await this.fetchImageMetadata(imagePath);
                const tags = this.extractPromptFromMetadata(metadata);
                // Update the custom image with tags if available
                this.updateCustomImageTags(imagePath, tags);
            } catch (metadataError) {
                console.warn("Metadata not available for custom image:", metadataError);
            }
    
            this.showToast('success', 'Upload Successful', `Added custom image: ${imagePath}`);
        } catch (error) {
            console.error("Error handling file upload:", error);
            this.showToast('error', 'Upload Failed', `Failed to add custom image: ${error.message}`);
        }
    }

    async ensureFileExists(filename) {
        const maxAttempts = 10;
        const delayMs = 500;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await fetch(`${this.baseUrl}/prompt_gallery/image?filename=${encodeURIComponent(filename)}&subfolder=custom`, {method: 'HEAD'});
                if (response.ok) {
                    console.log(`File ${filename} exists after ${attempt + 1} attempts`);
                    return;
                }
            } catch (error) {
                console.warn(`Attempt ${attempt + 1} to verify file existence failed:`, error);
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        throw new Error(`File ${filename} not found after ${maxAttempts} attempts`);
    }

    async fetchImageMetadata(imagePath) {
        const fullImagePath = `${this.baseUrl}/prompt_gallery/image?filename=${encodeURIComponent(imagePath)}&subfolder=custom`;
        
        console.log(`Attempting to fetch metadata from: ${fullImagePath}`);
        
        try {
            const response = await fetch(fullImagePath);
            if (!response.ok) {
                console.error(`Failed to fetch image. Status: ${response.status}, StatusText: ${response.statusText}`);
                throw new Error(`Failed to fetch image: ${response.statusText}`);
            }
            
            console.log(`Successfully fetched image from: ${fullImagePath}`);
            
            const arrayBuffer = await response.arrayBuffer();
            console.log(`ArrayBuffer size: ${arrayBuffer.byteLength} bytes`);
            
            console.log('About to extract metadata...');
            const metadata = await pngMetadata.getFromPngBuffer(new Uint8Array(arrayBuffer));
            console.log(`Extracted metadata:`, metadata);
            
            return metadata;
        } catch (error) {
            console.error(`Error in fetchImageMetadata: ${error.message}`);
            console.error(error.stack);  // Log the full error stack
            throw error;
        }
    }

    extractPromptFromMetadata(metadata) {
        console.log('Extracting prompt from metadata:', metadata);
        if (!metadata || !metadata.prompt) {
            console.log('No prompt found in metadata');
            return "";
        }
    
        const promptData = JSON.parse(metadata.prompt);
    
        // Look for clip_l first
        for (const key in promptData) {
            if (promptData[key].inputs && promptData[key].inputs.clip_l) {
                return promptData[key].inputs.clip_l;
            }
        }
    
        // Then look for text_g or text_l in any top-level object
        for (const key in promptData) {
            if (promptData[key].inputs && (promptData[key].inputs.text_g || promptData[key].inputs.text_l)) {
                return promptData[key].inputs.text_g || promptData[key].inputs.text_l;
            }
        }
    
        // Look for 'positive' reference and follow it
        let positiveRef = null;
        for (const key in promptData) {
            if (promptData[key].inputs && promptData[key].inputs.positive) {
                positiveRef = promptData[key].inputs.positive[0];
                break;
            }
        }
    
        if (positiveRef && promptData[positiveRef]) {
            const positiveNode = promptData[positiveRef];
            if (positiveNode.inputs && positiveNode.inputs.text) {
                return positiveNode.inputs.text;
            }
        }
    
        // If all else fails, look for any 'text' input in a CLIPTextEncode node
        for (const key in promptData) {
            if (promptData[key].class_type === "CLIPTextEncode" && promptData[key].inputs && promptData[key].inputs.text) {
                return promptData[key].inputs.text;
            }
        }
    
        return ""; // Return empty string if no prompt found
    }

    async addCustomImage(imagePath, tags) {
        let newImage = {
            name: imagePath,
            path: `/prompt_gallery/image?filename=${encodeURIComponent(imagePath)}&subfolder=custom`,
            tags: tags,
            type: "Custom"
        };
    
        // Check if the image already exists
        const existingImageIndex = this.customImages.findIndex(img => img.name === newImage.name);
        
        let imageAdded = false;
        if (existingImageIndex === -1) {
            this.customImages.push(newImage);
            imageAdded = true;
        } else {
            console.log(`Image ${newImage.name} already exists in custom images. Updating metadata.`);
            newImage = this.customImages[existingImageIndex]; // Use the existing image object
            newImage.path = `/prompt_gallery/image?filename=${encodeURIComponent(imagePath)}&subfolder=custom`; // Update path
            app.extensionManager.toast.add({
                severity: "info",
                summary: "Image Updated",
                detail: `Metadata for "${newImage.name}" has been updated.`,
                life: 3000
            });
        }
    
        // Attempt to extract metadata
        try {
            const metadata = await this.fetchImageMetadata(imagePath); // Pass imagePath directly
            const extractedTags = this.extractPromptFromMetadata(metadata);
            if (extractedTags) {
                newImage.tags = extractedTags;
                app.extensionManager.toast.add({
                    severity: "success",
                    summary: "Metadata Extracted",
                    detail: "Prompt tags were successfully extracted from the image.",
                    life: 3000
                });
            } else {
                app.extensionManager.toast.add({
                    severity: "info",
                    summary: "No Metadata Found",
                    detail: "No prompt tags were found in the image metadata.",
                    life: 3000
                });
            }
        } catch (error) {
            console.error("Error extracting metadata:", error);
            app.extensionManager.toast.add({
                severity: "error",
                summary: "Metadata Extraction Failed",
                detail: "An error occurred while trying to extract metadata.",
                life: 3000
            });
        }
    
        // Save custom images
        await this.savePluginData();

        // Update the UI
        this.update();
    
        return imageAdded;
    }

    updateCustomImageTags(imagePath, tags) {
        const image = this.customImages.find(img => img.path.includes(imagePath));
        if (image) {
            image.tags = tags;
            this.savePluginData();
        }
    }

    createSearchInput() {
        const input = $el("input", {
            type: "text",
            placeholder: "Search prompt images...",
            style: {
                width: "70%",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #ccc"
            }
        });
        input.addEventListener("input", this.debounce(() => this.handleSearch(input.value), 300));
        return input;
    }

    createSortToggle() {
        const button = $el("button", {
            textContent: "Sort: A-Z",
            onclick: () => this.toggleSort(),
            style: {
                padding: "8px 12px",
                borderRadius: "4px",
                border: "none",
                background: "#2a2a2a",
                color: "white",
                cursor: "pointer",
                fontSize: "14px",
                transition: "background-color 0.3s"
            }
        });

        button.addEventListener("mouseenter", () => {
            button.style.backgroundColor = "#3a3a3a";
        });
        button.addEventListener("mouseleave", () => {
            button.style.backgroundColor = "#2a2a2a";
        });

        return button;
    }

    toggleSort() {
        this.sortAscending = !this.sortAscending;
        this.sortToggle.textContent = this.sortAscending ? "Sort: A-Z" : "Sort: Z-A";
        this.debouncedSaveState();
        this.sortAndDisplayImages();
    }

    sortAndDisplayImages() {
        this.accordion.innerHTML = "";
    
        const imagesToDisplay = this.isSearchActive ? this.filteredImages : this.allImages;
        const customImagesToDisplay = this.isSearchActive ? this.filteredCustomImages : this.customImages;
      
        if (imagesToDisplay.length === 0 && this.customImages.length === 0 && !this.isSearchActive && localStorage.getItem('noFilesWarningDismissed') !== 'true') {
            this.displayNoFilesMessage();
        }
        
        if (imagesToDisplay.length === 0 && customImagesToDisplay.length === 0 && this.isSearchActive) {
            const noImagesFoundMessage = $el("div", {
                style: {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "200px",
                    width: "100%",
                    backgroundColor: "#1a1a1a",
                    borderRadius: "8px",
                    border: "1px solid #333"
                }
            });
        
            const sadEmoji = $el("div", {
                textContent: "😔",
                style: {
                    fontSize: "64px",
                    color: "#666666",
                    marginBottom: "20px"
                }
            });
        
            const messageText = $el("div", {
                textContent: this.isSearchActive ? "No matching images found" : "No images available",
                style: {
                    fontSize: "18px",
                    color: "#aaaaaa"
                }
            });
        
            noImagesFoundMessage.appendChild(sadEmoji);
            noImagesFoundMessage.appendChild(messageText);
            this.accordion.appendChild(noImagesFoundMessage);
            return;
        }
        
        const groupedImages = {};
        
        for (const image of imagesToDisplay) {
            const category = image.section || image.type;
            if (!groupedImages[category]) {
                groupedImages[category] = [];
            }
            if (!groupedImages[category].some(img => img.name === image.name && img.path === image.path)) {
                groupedImages[category].push(image);
            }
        }
    
        // Always include the Custom category
        groupedImages["Custom"] = customImagesToDisplay;
    
        const categoryOrder = new Map(this.yamlFiles.flatMap(file => {
            const orders = [[file.type, file.order]];
            if (file.sections) {
                Object.values(file.sections).forEach((sectionName, index) => {
                    orders.push([sectionName, file.order + index / 100]);
                });
            }
            return orders;
        }));
    
        const categories = Object.keys(groupedImages).sort((a, b) => {
            if (a === "Custom") return 1;
            if (b === "Custom") return -1;
            const orderA = categoryOrder.get(a) || Infinity;
            const orderB = categoryOrder.get(b) || Infinity;
            return orderA - orderB;
        });
    
        for (const category of categories) {
            const images = groupedImages[category];
            const sortedImages = [...images].sort((a, b) => {
                return this.sortAscending 
                    ? a.name.localeCompare(b.name)
                    : b.name.localeCompare(a.name);
            });
    
            // Always create section for Custom, even if empty
            if (sortedImages.length > 0 || category === "Custom") {
                const accordionSection = this.createAccordionSection(category, sortedImages);
                this.accordion.appendChild(accordionSection);
            }
        }
    
        this.setupDragAndDrop();
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    handleSearch(searchTerm) {
        searchTerm = searchTerm.toLowerCase();
        this.isSearchActive = searchTerm.length > 0;
        this.filteredImages = this.allImages.filter(image => 
            image && image.name && image.name.toLowerCase().includes(searchTerm)
        );
        // Filter custom images
        this.filteredCustomImages = this.customImages.filter(image => 
            image && image.name && image.name.toLowerCase().includes(searchTerm)
        );
        this.sortAndDisplayImages();
    }

    flattenAllImages() {
        return this.allImages.flatMap(category => {
            if (Array.isArray(category.images)) {
                return category.images;
            } else if (typeof category === 'object') {
                return Object.entries(category)
                    .filter(([key, value]) => key !== 'type' && Array.isArray(value))
                    .flatMap(([subType, images]) => images.map(img => ({...img, type: subType})));
            }
            return [];
        });
    }

    groupImagesByType(images) {
        return images.reduce((acc, image) => {
            if (image && typeof image === 'object' && image.type) {
                if (!acc[image.type]) {
                    acc[image.type] = [];
                }
                acc[image.type].push(image);
            }
            return acc;
        }, {});
    }

    async update() {
        this.accordion.innerHTML = "Loading...";
        
        try {
            if (this.allImages.length === 0) {
                let filesFound = false;
    
                for (const file of this.yamlFiles) {
                    if (!this.missingFiles.has(file.name)) {
                        try {
                            const yamlContent = await this.fetchYamlContent(file.name);
                            if (yamlContent) {
                                const parsedContent = this.parseYamlForImages(
                                    yamlContent,
                                    file.type,
                                    file.skipLevels,
                                    file.sections,
                                    file.pathAdjustment,
                                    file.ignoreKey
                                );
                                
                                this.allImages.push(...parsedContent);
                                filesFound = true;
                            }
                        } catch (error) {
                            console.warn(`File ${file.name} couldn't be processed. Skipping.`);
                        }
                    }
                }
    
                if (!filesFound && this.customImages.length === 0 && localStorage.getItem('noFilesWarningDismissed') !== 'true') {
                    this.displayNoFilesMessage();
                }
            }
    
            this.accordion.innerHTML = "";
            this.filteredImages = this.allImages;
            this.sortAndDisplayImages();
            
            setTimeout(() => {
                this.setupDragAndDrop();
            }, 0);
    
        } catch (error) {
            console.error("Error loading prompt images:", error);
            this.accordion.innerHTML = "Error loading prompt images: " + error.message;
        }
    }

    displayNoFilesMessage() {
        const messageContainer = $el("div", {
            style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                minHeight: "200px",
                textAlign: "center",
                backgroundColor: "#FFF3CD",
                border: "1px solid #FFEEBA",
                borderRadius: "5px",
                padding: "20px",
                margin: "20px 0"
            }
        });
    
        const iconElement = $el("div", {
            innerHTML: "&#9888;", // Warning icon
            style: {
                fontSize: "48px",
                color: "#856404",
                marginBottom: "15px"
            }
        });
    
        const textElement = $el("p", {
            innerHTML: "No prompt images found.",
            style: {
                fontSize: "18px",
                color: "#856404",
                marginBottom: "10px"
            }
        });
    
        const linkElement = $el("a", {
            href: "https://civitai.com/models/615967?modelVersionId=789576",
            target: "_blank",
            innerHTML: "Download officially supported file packages here",
            style: {
                color: "#856404",
                textDecoration: "underline"
            }
        });
    
        const text2Element = $el("p", {
            innerHTML: "After downloading a package simply extract it to your promptImages folder in this custom node directory.",
            style: {
                fontSize: "18px",
                color: "#856404",
                marginBottom: "10px"
            }
        });
    
        const dismissButton = $el("button", {
            textContent: "Dismiss",
            onclick: () => {
                this.savePluginData({ noFilesWarningDismissed: true });
                messageContainer.remove();
                this.update();
            },
            style: {
                marginTop: "10px",
                padding: "5px 10px",
                backgroundColor: "#856404",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
            }
        });
    
        messageContainer.appendChild(iconElement);
        messageContainer.appendChild(textElement);
        messageContainer.appendChild(linkElement);
        messageContainer.appendChild(text2Element);
        messageContainer.appendChild(dismissButton);
    
        this.accordion.appendChild(messageContainer);
    }

    async fetchYamlContent(filename) {
        if (this.missingFiles.has(filename)) {
            return null;
        }
        const response = await fetch(`${this.baseUrl}/prompt_gallery/yaml?filename=${filename}`);
        if (response.status === 404) {
            this.missingFiles.add(filename);
            return null;
        }
        if (!response.ok) {
            console.warn(`Failed to fetch YAML file ${filename}: ${response.statusText}`);
            return null;
        }
        const content = await response.text();
        return content.trim() === "" ? null : content;
    }
    

    parseYamlForImages(yamlContent, type, skipLevels, sections = null, pathAdjustment = null, ignoreKey = null) {
        const lines = yamlContent.split('\n');
        const stack = [];
        const images = [];
    
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine === '' || trimmedLine.startsWith('#')) return;
    
            const indent = line.search(/\S|$/);
            while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
                stack.pop();
            }
    
            const key = trimmedLine.split(':')[0].trim();
            stack.push({ key, indent });
    
            const nextLine = lines[index + 1];
            if (nextLine && nextLine.trim().startsWith('-')) {
                let path = stack.slice(skipLevels, -1).map(item => item.key).join('/');
                
                // Remove any duplicate 'ponyxl' in the path
                path = path.replace(/^ponyxl\//, '');
    
                const tags = nextLine.trim().substring(1).trim();
                
                // Skip empty tags or tags that are just a space
                if (tags === '' || tags === ' ' || key.toLowerCase() === 'skip') {
                    return; // Skip this iteration
                }
    
                if (ignoreKey) {
                    path = path.split('/').filter(segment => segment !== ignoreKey).join('/');
                }
    
                if (pathAdjustment) {
                    if (pathAdjustment.remove) {
                        path = path.split('/').filter(segment => !pathAdjustment.remove.includes(segment)).join('/');
                    }
                    if (pathAdjustment.add) {
                        path = `${pathAdjustment.add}/${path}`;
                    }
                }
    
                const imageFilename = `${key}`;
                const subfolderPath = `ponyxl/${path}`;
                const imageUrl = `${this.baseUrl}/prompt_gallery/image?filename=${encodeURIComponent(imageFilename)}&subfolder=${encodeURIComponent(subfolderPath)}`;
                
                const image = { name: key, path: imageUrl, tags: tags, type: type };
                
                if (sections) {
                    for (const [sectionKey, sectionName] of Object.entries(sections)) {
                        if (path.includes(sectionKey)) {
                            image.section = sectionName;
                            break;
                        }
                    }
                }
                
                images.push(image);
            }
        });
    
        return images;
    }

    displaypromptImages(images) {
        this.accordion.innerHTML = "";
        if (images.length === 0) {
            this.accordion.innerHTML = "No matching prompts found.";
            return;
        }

        const groupedImages = this.groupImagesByType(images);

        for (const [type, typeImages] of Object.entries(groupedImages)) {
            const section = this.createAccordionSection(type, typeImages);
            this.accordion.appendChild(section);
        }
    }

    updateGallery() {
        // Add custom images to allImages
        const customImageSection = this.allImages.find(section => section.type === "Custom");
        if (customImageSection) {
            customImageSection.images = this.customImages;
        } else {
            this.allImages.push({ type: "Custom", images: this.customImages });
        }

        this.filteredImages = this.allImages.flatMap(section => section.images);
        this.sortAndDisplayImages();
    }

    groupImagesByType(images) {
        return images.reduce((acc, image) => {
            if (image && typeof image === 'object') {
                const type = image.type || 'Unknown';
                if (!acc[type]) {
                    acc[type] = [];
                }
                acc[type].push(image);
            } else {
                console.warn('Invalid image object:', image);
            }
            return acc;
        }, {});
    }

    createAccordionSection(type, images) {
        const section = $el("div", { 
            className: `accordion-section ${type === "Custom" ? "custom-section" : ""}`,
            style: { marginBottom: "10px" },
            "data-type": type
        });
    
        const header = $el("div.accordion-header", {
            style: {
                cursor: "pointer",
                padding: "10px",
                backgroundColor: "#2a2a2a",
                borderRadius: "4px",
                marginBottom: "5px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
            }
        });
        
        const itemCount = type === "Custom" ? images.length + 1 : images.length;
        const headerText = $el("span", { textContent: `${type} (${itemCount})` });
        const isOpen = this.sectionStates[type] !== false;
        const indicator = $el("span", { 
            textContent: this.sectionStates[type] ? "-" : "+",
            style: {
                fontSize: "18px",
                fontWeight: "bold"
            }
        });
        
        header.appendChild(headerText);
        header.appendChild(indicator);
    
        const content = $el("div.accordion-content", {
            style: {
                display: isOpen ? "flex" : "none",
                flexDirection: "column",
                gap: "10px",
                padding: "10px",
                backgroundColor: "#1a1a1a",
                borderRadius: "4px"
            }
        });
    
        header.onclick = () => {
            if (content.style.display === "none") {
                content.style.display = "flex";
                indicator.textContent = "-";
                this.sectionStates[type] = true;
            } else {
                content.style.display = "none";
                indicator.textContent = "+";
                this.sectionStates[type] = false;
            }
            this.savePluginData();
        };
    
        if (type === "Custom") {
            const imageGrid = $el("div", {
                style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                    gap: "10px",
                    width: "100%"
                }
            });
    
            const addButton = this.createAddCustomImageButton();
            imageGrid.appendChild(addButton);
    
            images.forEach(image => {
                const imgElement = this.createImageElement(image);
                imageGrid.appendChild(imgElement);
            });
    
            content.appendChild(imageGrid);
    
            if (images.length > 0) {
                const resetButton = this.createResetCustomImagesButton();
                resetButton.style.marginTop = "10px";
                content.appendChild(resetButton);
            }
        } else {
            const imageGrid = $el("div", {
                style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                    gap: "10px",
                    width: "100%"
                }
            });
    
            images.forEach(image => {
                const imgElement = this.createImageElement(image);
                imageGrid.appendChild(imgElement);
            });
    
            content.appendChild(imageGrid);
        }
    
        section.appendChild(header);
        section.appendChild(content);
    
        return section;
    }

    createImageElement(image) {
        const imgContainer = $el("div.prompt-image-container", {
            style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                cursor: "pointer",
                width: "100px",
                height: "140px",
                overflow: "hidden"
            },
            onclick: () => this.copyToClipboard(image.name, image.tags)
        });
    
        const img = $el("img", {
            src: this.missingFiles.has(image.path) ? this.placeholderImageUrl : image.path,
            alt: image.name,
            style: {
                width: "100px",
                height: "100px",
                objectFit: "cover",
                borderRadius: "5px"
            },
            onerror: () => {
                if (!this.missingFiles.has(image.path)) {
                    this.missingFiles.add(image.path);
                    img.src = this.placeholderImageUrl;
                } else {
                    // If even the placeholder fails to load, hide the image
                    img.style.display = 'none';
                    console.error("Failed to load placeholder image for:", image.name);
                }
            }
        });
    
        const label = $el("span", {
            textContent: image.name,
            style: {
                marginTop: "5px",
                fontSize: "12px",
                textAlign: "center",
                width: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                "-webkit-line-clamp": "2",
                "-webkit-box-orient": "vertical",
                wordBreak: "break-word"
            }
        });
    
        imgContainer.appendChild(img);
        imgContainer.appendChild(label);
    
        return imgContainer;
    }

    copyToClipboard(imageName, tags) {
        let textToCopy = tags;
        
        // If tags is an object or array, convert it to a string
        if (typeof tags === 'object') {
            textToCopy = JSON.stringify(tags);
        }
    
        // Ensure textToCopy is a string and trim any whitespace
        textToCopy = String(textToCopy).trim();
    
        navigator.clipboard.writeText(textToCopy).then(() => {
            console.log('Tags copied to clipboard');
            this.showToast('success', 'Tags Copied!', `Tags for "${imageName}" copied to clipboard`);
        }).catch(err => {
            console.error('Failed to copy tags: ', err);
            this.showToast('error', 'Copy Failed', `Failed to copy tags for "${imageName}"`);
        });
    }

    showToast(severity, summary, detail) {
        app.extensionManager.toast.add({
            severity: severity,
            summary: summary,
            detail: detail,
            life: 5000
        });
    }
}

app.registerExtension({
    name: "comfy.prompt.gallery",
    async setup() {
        const gallery = new PromptGallery(app);

        app.extensionManager.registerSidebarTab({
            id: "prompt.gallery",
            icon: "pi pi-id-card",
            title: "Prompt Gallery",
            tooltip: "Prompt Gallery",
            type: "custom",
            render: (el) => {
                el.appendChild(gallery.element);
                gallery.update(); // Load wildcard images when the tab is rendered
            },
        });
    },
});