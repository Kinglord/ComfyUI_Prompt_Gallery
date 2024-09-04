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
        this.element = $el("div.prompt-gallery-popup", [
            $el("h3", "Prompt Image Gallery"),
            $el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } }, [
                this.searchInput,
                this.sortToggle
            ]),
            this.accordion
        ]);
        this.yamlFiles = [
            { name: "PonyXl-artstyles.yaml", type: "Art Styles", skipLevels: 0, sections: null, order: 1 },
            { name: "PonyXl-game_persona.yaml", type: "Game Characters", skipLevels: 0, sections: null, order: 2 },
            { name: "PonyXl-show_persona.yaml", type: "Show Characters", skipLevels: 0, sections: null, order: 3 },
            { name: "PonyXl-f-body.yaml", type: "Female Body", skipLevels: 0, sections: { body_race: "Race", body_form: "Build" }, order: 4 },
            { name: "PonyXl-poses.yaml", type: "Poses", skipLevels: 0, sections: null, order: 5 },
            { name: "PonyXl-expressions.yaml", type: "Expressions", skipLevels: 0, sections: null, order: 6, ignoreKey: "chara_expression" },
            { name: "PonyXl-scenes.yaml", type: "Scenes", skipLevels: 0, sections: null, order: 7 }
            // Add custom yaml files here if you want and know how to do it :D
        ];

        this.baseUrl = `${window.location.protocol}//${window.location.host}`;
        this.sectionStates = this.loadSectionStates();
        this.placeholderImageUrl = `${this.baseUrl}/prompt_gallery/image?filename=SKIP`;
        this.customImages = this.loadCustomImages();
        this.isSearchActive = false;

        this.resetButton = this.createResetCustomImagesButton();
        this.element = $el("div.prompt-gallery-popup", [
            $el("h3", "Prompt Image Gallery"),
            this.resetButton, // Add the reset button here
            $el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } }, [
                this.searchInput,
                this.sortToggle
            ]),
            this.accordion
        ]);

    }

    createResetCustomImagesButton() {
        const button = $el("button", {
            textContent: "Reset Custom Images",
            onclick: () => this.resetCustomImages(),
            style: {
                marginBottom: "10px",
                padding: "5px 10px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                width: "100%", // Make the button full width
            }
        });
        return button;
    }

    resetCustomImages() {
        if (confirm("Are you sure you want to reset all custom images? This action cannot be undone! (This does not delete the images in the directory)")) {
            localStorage.removeItem('customGalleryImages');
            this.customImages = [];
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

    loadCustomImages() {
        const savedImages = localStorage.getItem('customGalleryImages');
        return savedImages ? JSON.parse(savedImages) : [];
    }

    saveCustomImages() {
        localStorage.setItem('customGalleryImages', JSON.stringify(this.customImages));
    }

    loadSectionStates() {
        const savedStates = localStorage.getItem('wildcardGallerySectionStates');
        if (savedStates) {
            return JSON.parse(savedStates);
        } else {
            // If no saved states, return an empty object
            // Sections will default to open
            return {};
        }
    }

    saveSectionStates() {
        localStorage.setItem('wildcardGallerySectionStates', JSON.stringify(this.sectionStates));
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
            formData.append('subfolder', 'custom'); // Specify the subfolder
    
            // Upload file directly to the correct directory
            const uploadResponse = await api.fetchApi('/prompt_gallery/upload', {
                method: 'POST',
                body: formData
            });
    
            if (!uploadResponse.ok) {
                throw new Error("Failed to upload file");
            }
    
            const uploadResult = await uploadResponse.json();
            const imagePath = uploadResult.name; // This should now be the full path including the subfolder
    
            // Check if the image already exists in customImages
            const existingImageIndex = this.customImages.findIndex(img => img.name === imagePath.split('/').pop());
            
            if (existingImageIndex === -1) {
                // Add to custom images only if it doesn't already exist
                await this.addCustomImage(imagePath, "");
            } else {
                console.log(`Image ${imagePath} already exists in custom images. Skipping addition.`);
            }
    
            // Attempt to fetch metadata (this might not be available for custom images)
            try {
                const metadata = await this.fetchImageMetadata(imagePath);
                const tags = this.extractTagsFromMetadata(metadata);
                // Update the custom image with tags if available
                this.updateCustomImageTags(imagePath, tags);
            } catch (metadataError) {
                console.warn("Metadata not available for custom image:", metadataError);
            }
    
            api.toast.add({
                severity: "success",
                summary: "Upload Successful",
                detail: `Added custom image: ${imagePath.split('/').pop()}`,
                life: 3000
            });
        } catch (error) {
            console.error("Error handling file upload:", error);
            api.toast.add({
                severity: "error",
                summary: "Upload Failed",
                detail: "Failed to add custom image. Please try again.",
                life: 3000
            });
        }
    }

    async fetchImageMetadata(imagePath) {
        const fullImagePath = imagePath.startsWith('http') ? imagePath : `${this.baseUrl}${imagePath}`;
        
        const response = await fetch(fullImagePath);
        if (!response.ok) {
            throw new Error("Failed to fetch image");
        }
        const arrayBuffer = await response.arrayBuffer();
        return await pngMetadata.getFromPngBuffer(new Uint8Array(arrayBuffer));
    }

    extractPromptFromMetadata(metadata) {
        if (!metadata || !metadata.prompt) {
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
        const newImage = {
            name: imagePath.split('/').pop(),
            path: `/prompt_gallery/image?filename=${imagePath}&subfolder=custom`,
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
        }
    
        // Attempt to extract metadata
        try {
            const metadata = await this.fetchImageMetadata(newImage.path);
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
    
        this.saveCustomImages();
        this.update();
        return imageAdded;
    }

    updateCustomImageTags(imagePath, tags) {
        const image = this.customImages.find(img => img.path.includes(imagePath));
        if (image) {
            image.tags = tags;
            this.saveCustomImages();
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
        this.sortAndDisplayImages();
    }

    sortAndDisplayImages() {
        this.accordion.innerHTML = "";

        const imagesToDisplay = this.isSearchActive ? this.filteredImages : this.allImages;
        
        if (imagesToDisplay.length === 0) {
            const noImagesFoundMessage = $el("div", {
                style: {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "200px",
                    width: "100%",
                    backgroundColor: "#1a1a1a",  // Dark background
                    borderRadius: "8px",
                    border: "1px solid #333"  // Subtle border
                }
            });
    
            const sadEmoji = $el("div", {
                textContent: "😔",
                style: {
                    fontSize: "64px",
                    color: "#666666",  // Darker gray for the emoji
                    marginBottom: "20px"
                }
            });
    
            const messageText = $el("div", {
                textContent: this.isSearchActive ? "No matching images found" : "No images available",
                style: {
                    fontSize: "18px",
                    color: "#aaaaaa"  // Light gray for better readability on dark background
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
    
        // Handle custom images separately
        groupedImages["Custom"] = this.customImages;
    
        // Ensure Custom category always exists
        if (!groupedImages["Custom"]) {
            groupedImages["Custom"] = [];
        }
    
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
            this.allImages = [];
            let filesFound = false;
    
            for (const file of this.yamlFiles) {
                try {
                    const yamlContent = await this.fetchYamlContent(file.name);
                    const parsedContent = this.parseYamlForImages(
                        yamlContent,
                        file.type,
                        file.skipLevels,
                        file.sections,
                        file.pathAdjustment,
                        file.ignoreKey
                    );
                    
                    console.log(`Parsed content for ${file.name}:`, parsedContent);
    
                    this.allImages.push(...parsedContent);
                    filesFound = true;
                } catch (error) {
                    console.warn(`File ${file.name} not found or couldn't be processed. Skipping.`, error);
                }
            }
    
            console.log("All Images after parsing:", this.allImages);
    
            this.accordion.innerHTML = ""; // Clear the "Loading..." message
    
            // Display warning if conditions are met
            if (!filesFound && this.customImages.length === 0 && localStorage.getItem('noFilesWarningDismissed') !== 'true') {
                this.displayNoFilesMessage();
            }
    
            // Always display the accordion
            this.filteredImages = this.allImages;
            console.log("Parsed Prompt Images:", this.allImages);
            this.sortAndDisplayImages();
            
            // Use setTimeout to ensure DOM is updated before setting up drag and drop
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
            innerHTML: "After downloading a package simply extract it to your promptImages folder in your Input directory. (If it doesn't exist just create it, obviously.)",
            style: {
                fontSize: "18px",
                color: "#856404",
                marginBottom: "10px"
            }
        });
    
        const dismissButton = $el("button", {
            textContent: "Dismiss",
            onclick: () => {
                localStorage.setItem('noFilesWarningDismissed', 'true');
                messageContainer.remove();
                this.update(); // Re-run update to display categories
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
        const response = await fetch(`${this.baseUrl}/prompt_gallery/yaml?filename=${filename}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch YAML file ${filename}: ${response.statusText}`);
        }
        return await response.text();
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
                
                // Remove the ignored key from the path
                // Only apply the ignoreKey logic if ignoreKey is not null
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
                const imageUrl = `${this.baseUrl}/prompt_gallery/image?filename=${imageFilename}&subfolder=${path}`;
                const tags = nextLine.trim().substring(1).trim();
                
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
        
        // Always add 1 to the count for the Custom category to include the "Add" button
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
                display: isOpen ? "grid" : "none",
                gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                gap: "10px",
                padding: "10px",
                backgroundColor: "#1a1a1a",
                borderRadius: "4px"
            }
        });

        header.onclick = () => {
            if (content.style.display === "none") {
                content.style.display = "grid";
                indicator.textContent = "-";
                this.sectionStates[type] = true;
            } else {
                content.style.display = "none";
                indicator.textContent = "+";
                this.sectionStates[type] = false;
            }
            this.saveSectionStates();
        };

        if (type === "Custom") {
            const addButton = this.createAddCustomImageButton();
            content.appendChild(addButton);

            // Add custom images after the buttons
            images.forEach(image => {
                const imgElement = this.createImageElement(image);
                content.appendChild(imgElement);
            });
        } else {
            images.forEach(image => {
                const imgElement = this.createImageElement(image);
                content.appendChild(imgElement);
            });
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
                width: "100px",  // Set a fixed width
                height: "140px", // Set a fixed height to accommodate image and text
                overflow: "hidden" // Hide overflow
            },
            onclick: () => this.copyToClipboard(image.name, image.tags)
        });
    
        const img = $el("img", {
            src: image.path,
            alt: image.name,
            style: {
                width: "100px",
                height: "100px",
                objectFit: "cover",
                borderRadius: "5px"
            },
            onerror: () => {
                img.src = this.placeholderImageUrl;
                img.onerror = () => {
                    console.error("Failed to load both original and placeholder images for:", image.name);
                    img.style.display = 'none';
                };
            }
        });
    
        const label = $el("span", {
            textContent: image.name,
            style: {
                marginTop: "5px",
                fontSize: "12px",
                textAlign: "center",
                width: "100%", // Ensure the label takes full width
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                "-webkit-line-clamp": "2", // Limit to 2 lines
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