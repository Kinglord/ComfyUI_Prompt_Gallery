import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { $el } from "../../../scripts/ui.js";
import * as pngMetadata from "../../../scripts/metadata/png.js";

class PromptGallery {
    constructor(app) {
        this.app = app;
        this.maxThumbnailSize = app.ui.settings.getSettingValue("Prompt Gallery._General.maxThumbnailSize", 100);
        this.displayLabels = app.ui.settings.getSettingValue("Prompt Gallery._General.displayLabels", true);
        this.autoUpdate = app.ui.settings.getSettingValue("Prompt Gallery._General.autoUpdate", true);
        this.allImages = [];
        this.filteredImages = [];
        this.sortAscending = true;
        this.searchInput = this.createSearchInput();
        this.sortToggle = this.createSortToggle();
        this.targetNodeDropdown = this.createTargetNodeDropdown();
        this.useSelectedNodeCheckbox = this.createUseSelectedNodeCheckbox();
        this.randomPromptButton = this.createRandomPromptButton();
        this.categoryCheckboxes = new Map();
        this.accordion = $el("div.prompt-accordion");
        this.baseUrl = `${window.location.protocol}//${window.location.host}`;
        this.librariesFile = "promptGallery_libraries.json";
        this.yamlFiles = []; // This will be populated from the libraries file
        this.loadLibraries().catch(error => console.error("Failed to load libraries:", error));
        //TODO
        this.categories = this.yamlFiles.map(file => file.type);  // Derive categories from yamlFiles
        this.placeholderImageUrl = `${this.baseUrl}/prompt_gallery/image?filename=SKIP.jpeg`;
        this.customImages = [];
        this.sectionStates = {};
        this.isSearchActive = false;
        this.debouncedSaveState = this.debounce(this.savePluginData.bind(this), 600000); // 10 minute delay
        this.resetButton = this.createResetCustomImagesButton();
        this.missingFiles = new Set();
        this.librariesLoadPromise = null;
        this.isDebugMode = false;
        this.toastEnabled = this.createEnableToastsCheckbox();
        this.csvFiles = [];


        // Initialize category order from YAML files
        // this.yamlFiles.forEach(file => {
        //     const settingId = `Prompt Gallery.Category Order.${file.type.replace(/\s+/g, '')}`;
        //     const currentValue = this.app.ui.settings.getSettingValue(settingId, null);
        //     if (currentValue === null) {
        //         this.app.ui.settings.setSettingValue(settingId, file.order);
        //     }
        // });

        // // TODO
        // this.csvFiles.forEach(file => {
        //     const settingId = `Prompt Gallery.Category Order.${file.type.replace(/\s+/g, '')}`;
        //     const currentValue = this.app.ui.settings.getSettingValue(settingId, null);
        //     if (currentValue === null) {
        //         this.app.ui.settings.setSettingValue(settingId, file.order);
        //     }
        // });

        // Initialize Female Body sub-categories
        // const femaleBodyFile = this.yamlFiles.find(file => file.type === "Female Body");
        // if (femaleBodyFile && femaleBodyFile.sections) {
        //     Object.values(femaleBodyFile.sections).forEach((subCategory, index) => {
        //         const settingId = `Prompt Gallery.Category Order.FemaleBody_${subCategory}`;
        //         const currentValue = this.app.ui.settings.getSettingValue(settingId, null);
        //         if (currentValue === null) {
        //             this.app.ui.settings.setSettingValue(settingId, femaleBodyFile.order + index + 1);
        //         }
        //     });
        // }

        this.updateCategoryOrder();
    
        const dropdownContainer = $el("div", {
            style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
                flexWrap: "nowrap"
            }
        }, [
            $el("div", { 
                style: { 
                    flexGrow: 1, 
                    flexBasis: "80%", 
                    marginRight: "10px" 
                } 
            }, [this.targetNodeDropdown]),
            this.useSelectedNodeCheckbox,
            this.toastEnabled
        ]);
    
        this.element = $el("div.prompt-gallery-popup", [
            $el("h3", "Prompt Image Gallery"),
            $el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } }, [
                this.searchInput,
                this.sortToggle
            ]),
            dropdownContainer,
            this.randomPromptButton,
            this.accordion
        ]);

        this.categoryStates = {}; // To store checkbox states
    
        // Load plugin data and update
        this.loadPluginData().then(() => {
            this.updateDownloadButtonVisibility();
        });
        
        window.addEventListener('beforeunload', () => {
            this.savePluginData();
        });
    }

    // logging flag
    log(...args) {
        if (this.isDebugMode) {
            console.log(...args);
        }
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

    createUseSelectedNodeCheckbox() {
        const container = $el("div", {
            style: {
                display: "flex",
                alignItems: "center",
                marginLeft: "10px",
                whiteSpace: "nowrap"
            },
            title: "Ignore dropdown setting and use the currently selected node as the target for prompt insertion."
        });
    
        const checkbox = $el("input", {
            type: "checkbox",
            id: "use-selected-node",
            style: {
                marginRight: "5px"
            }
        });
    
        const label = $el("div", {
            style: {
                fontSize: "12px",
                lineHeight: "1",
                textAlign: "center"
            }
        });
    
        label.innerHTML = "Active<br>Selection";
    
        container.appendChild(checkbox);
        container.appendChild(label);
    
        return container;
    }

    createEnableToastsCheckbox() {
        const container = $el("div", {
            style: {
                display: "flex",
                alignItems: "center",
                marginLeft: "10px",
                whiteSpace: "nowrap"
            },
            title: "Enable or disable Toasts."
        });
    
        const checkbox = $el("input", {
            type: "checkbox",
            id: "enable-toasts",
            style: {
                marginRight: "5px"
            }
        });
    
        const label = $el("div", {
            style: {
                fontSize: "12px",
                lineHeight: "1",
                textAlign: "center"
            }
        });
    
        label.innerHTML = "Enable<br>Toasts";
    
        container.appendChild(checkbox);
        container.appendChild(label);
    
        return container;
    }

    createRandomPromptButton() {
        return $el("button", {
            className: "random-prompt-button",
            textContent: "🎲 Random Prompt",
            onclick: () => this.generateRandomPrompt(),
            style: {
                padding: "8px 12px",
                backgroundColor: "#FF6A00",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "10px",
                width: "100%"
            }
        });
    }
    
    async resetCustomImages() {
        if (confirm("Are you sure you want to reset all custom images? This action cannot be undone!")) {
            this.customImages = [];
            await this.savePluginData();
            this.update();
            this.log("Custom images have been reset.");
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
            categoryStates: this.categoryStates,
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
            this.log('Plugin data saved successfully:', pluginData);
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
                this.categoryStates = data.categoryStates || {};
                this.sortAscending = data.sortAscending !== undefined ? data.sortAscending : true;
                this.noFilesWarningDismissed = data.noFilesWarningDismissed || false;
                this.downloadLinkDismissed = data.downloadLinkDismissed || false;
                // Always set allYamlFilesPresent to false on startup
                this.allYamlFilesPresent = false;
    
                this.log('Plugin data loaded successfully:', data);
            } else if (response.status === 404) {
                this.log('No plugin data found. Starting with default values.');
                this.customImages = [];
                this.sectionStates = {};
                this.categoryStates = {};
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
            this.categoryStates = {};
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

    ///NEW DATA STRUCTURE STUFF
    async loadLibraries() {
        if (!this.librariesLoadPromise) {
            this.librariesLoadPromise = this._loadLibrariesInternal();
        }
        return this.librariesLoadPromise;
    }

    async _loadLibrariesInternal() {
        try {
            const localLibraries = await this.getLocalLibraries();
            console.log(localLibraries)
            // const remoteLibraries = await this.getRemoteLibraries();

            // if (this.autoUpdate && this.shouldUpdateLibraries(localLibraries, remoteLibraries)) {
            //     this.log("Version Update available, auto update enabled");
            //     await this.updateLocalLibraries(remoteLibraries);
            //     this.yamlFiles = remoteLibraries.libraries;
            // } else {
            //     this.log("No Version Update available, or auto update disabled");
            // }
            localLibraries.libraries.forEach(element => {
                switch (element.filetype) {
                    case "yaml":
                        this.yamlFiles.push(element)
                        break;
                    case "csv":
                        this.csvFiles.push(element)
                        break;
                    default:
                        console.log(`WRONG FILETYPE IN ${element}.`);
                }
            });

            // this.yamlFiles = localLibraries.libraries;
            // //TODO
            // this.csvFiles = localLibraries.csv_libraries;

            //TODO
            this.categories = localLibraries.libraries.map(file => file.type);
            // this.categories = this.yamlFiles.map(file => file.type);
            console.log(this.categories);
            this.log("Categories set:", this.categories);
            this.log("Loaded YAML Files:", JSON.stringify(this.yamlFiles, null, 2));

            return this.yamlFiles;
        } catch (error) {
            console.error('Error loading prompt gallery libraries:', error);
            throw error; // Rethrow to allow error handling in calling code
        }
    }

    
    async getLocalLibraries() {
        this.log("getLocalLibraries called, this.librariesFile:", this.librariesFile);
        
        if (!this.librariesFile) {
            console.error("this.librariesFile is not set");
            throw new Error('librariesFile is not initialized');
        }
    
        try {
            const url = `${this.baseUrl}/prompt_gallery/get-file?filename=${this.librariesFile}`;
            this.log(`Attempting to fetch: ${url}`);
            const response = await fetch(url);
            this.log('Response status:', response.status);
            
            if (response.status === 404) {
                this.log(`File not found: ${this.librariesFile}`);
                this.missingFiles.add(this.librariesFile);
                return null;
            }
            
            if (response.ok) {
                const data = await response.json();
                this.log('File content:', data);
                return data;
            }
            
            console.error('Failed to load file:', response.statusText);
        } catch (error) {
            console.error('Error loading file:', error);
        }
        throw new Error('Failed to load local prompt gallery libraries');
    }

    // async getRemoteLibraries() {
    //     // Replace this URL with the actual URL of your remote libraries file
    //     const response = await fetch(`https://raw.githubusercontent.com/Kinglord/ComfyUI_Prompt_Gallery/main/promptImages/${this.librariesFile}`);
    //     if (response.ok) {
    //         return await response.json();
    //     }
    //     throw new Error('Failed to load remote prompt gallery libraries');
    // }

    // shouldUpdateLibraries(localLibraries, remoteLibraries) {
    //     return localLibraries.version !== remoteLibraries.version;
    // }

    // async updateLocalLibraries(remoteLibraries) {
    //     try {
    //         const response = await api.fetchApi('/prompt_gallery/update_libraries', {
    //             method: 'POST',
    //             body: JSON.stringify(remoteLibraries),
    //             headers: {
    //                 'Content-Type': 'application/json'
    //             }
    //         });
    //         if (!response.ok) {
    //             throw new Error(`Failed to update local libraries: ${response.statusText}`);
    //         }
    //         this.log('Local libraries updated successfully');
    //     } catch (error) {
    //         console.error('Error updating local libraries:', error);
    //         throw error; // Re-throw the error so it can be caught by the caller
    //     }
    // }
    ///////
    
    async checkYamlFiles() {
        await this.loadLibraries();  // This will use the cached promise if libraries are already loaded
    
        for (const file of this.yamlFiles) {
            try {
                const response = await fetch(`${this.baseUrl}/prompt_gallery/get-file?filetype=yaml&filename=${file.name}`);
                if (!response.ok) {
                    this.log(`YAML file not found: ${file.name}`);
                    return false;
                }
            } catch (error) {
                console.error(`Error checking YAML file ${file.name}:`, error);
                return false;
            }
        }
        this.log('All YAML files present');
        return true;
    }
    
    
    updateDownloadButtonVisibility() {
        if (this.lastButtonState === `${this.allYamlFilesPresent}-${this.downloadLinkDismissed}`) return;
        this.log("Updating download button visibility");
        this.log("allYamlFilesPresent:", this.allYamlFilesPresent);
        this.log("downloadLinkDismissed:", this.downloadLinkDismissed);
    
        const existingButton = this.element.querySelector('.download-image-sets-button');
        this.log("Existing button:", existingButton);
    
        if (!this.allYamlFilesPresent && !this.downloadLinkDismissed) {
            this.log("Conditions met to show button");
            if (!existingButton) {
                this.log("Creating new button");
                const button = this.createDownloadImageSetsButton();
                this.element.insertBefore(button, this.element.children[1]);
            }
        } else {
            this.log("Conditions met to hide button");
            if (existingButton) {
                this.log("Removing existing button");
                existingButton.remove();
            }
        }

        this.lastButtonState = `${this.allYamlFilesPresent}-${this.downloadLinkDismissed}`;
    }

    createAddCustomImageButton() {
        const button = $el("div", {
            style: {
                width: `${this.maxThumbnailSize}px`,
                height: `${this.maxThumbnailSize}px`,
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
                fontSize: `${Math.max(20, this.maxThumbnailSize / 3)}px`,
                lineHeight: "1",
                color: "#ccc"
            }
        });
    
        const addText = $el("div", {
            textContent: "Add",
            style: {
                marginTop: "5px",
                fontSize: `${Math.max(12, this.maxThumbnailSize / 8)}px`,
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
            href: "https://civitai.com/models/615967",
            target: "_blank",
            textContent: "New Image Sets to Download!",
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

    createTargetNodeDropdown() {
        const dropdown = $el("select", {
            id: "target-node-dropdown",
            style: {
                width: "100%",
                padding: "8px",
                marginBottom: "10px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                backgroundColor: "#2a2a2a",
                color: "white",
                textOverflow: "ellipsis"
            },
            title: "Select where the prompt will be inserted. Use Clipboard if you want to paste it yourself."
        });

        // to make the dropdown options use the full width
        dropdown.style.textOverflow = "ellipsis";
    
        // Add the "None (Use Clipboard)" option
        dropdown.appendChild($el("option", {
            value: "clipboard",
            textContent: "None (Use Clipboard)"
        }));
    
        // Add a separator
        dropdown.appendChild($el("option", {
            disabled: true,
            style: {
                borderTop: "1px solid #ccc",
                backgroundColor: "#1a1a1a"
            }
        }));
    
        const updateDropdownOptions = () => {
            // Remove all options except the first two (default and separator)
            while (dropdown.children.length > 2) {
                dropdown.removeChild(dropdown.lastChild);
            }
    
            const nodeOptions = [];
    
            app.graph._nodes.forEach(node => {
                if (node.widgets) {
                    node.widgets.forEach((widget, index) => {
                        if (widget.type === "string" || widget.type === "text" || widget.type === "customtext") {
                            nodeOptions.push({
                                node: node,
                                widget: widget,
                                index: index
                            });
                        }
                    });
                }
            });
    
            // Sort the options based on the specified criteria
            nodeOptions.sort((a, b) => {
                const aName = a.node.title.toLowerCase();
                const bName = b.node.title.toLowerCase();
                const aType = a.widget.type;
                const bType = b.widget.type;
    
                // Helper function to check if a name contains specific words
                const containsWords = (name, words) => words.some(word => name.includes(word));
    
                // Sorting based on the specified rules
                if (containsWords(aName, ['positive', 'prompt']) && !containsWords(bName, ['positive', 'prompt'])) return -1;
                if (containsWords(bName, ['positive', 'prompt']) && !containsWords(aName, ['positive', 'prompt'])) return 1;
                if (aName.includes('positive') && !bName.includes('positive')) return -1;
                if (bName.includes('positive') && !aName.includes('positive')) return 1;
                if (aName.includes('prompt') && !bName.includes('prompt')) return -1;
                if (bName.includes('prompt') && !aName.includes('prompt')) return 1;
                if (aType === 'customtext' && bType !== 'customtext') return -1;
                if (bType === 'customtext' && aType !== 'customtext') return 1;
                if (aType === 'text' && bType !== 'text') return -1;
                if (bType === 'text' && aType !== 'text') return 1;
                if (aName.includes('negative') && !bName.includes('negative')) return 1;
                if (bName.includes('negative') && !aName.includes('negative')) return -1;
                return aName.localeCompare(bName);  // Alphabetical order for remaining items
            });
    
            // Add sorted options to the dropdown
            nodeOptions.forEach(option => {
                const optionElement = $el("option", {
                    value: `${option.node.id}:widget:${option.index}`,
                    textContent: `${option.node.title} - ${option.widget.name}`
                });
                dropdown.appendChild(optionElement);
            });
        };
    
        // Initial population of dropdown
        updateDropdownOptions();
    
        // Update options when the graph changes
        app.graph.onNodeAdded = app.graph.onNodeRemoved = updateDropdownOptions;
    
        return dropdown;
    }

    setupDragAndDrop() {
        this.log("Setting up drag and drop");
    
        const customSection = this.accordion.querySelector('.custom-section');
        this.log("Custom section found:", customSection);
        if (!customSection) {
            console.error("Custom section not found in the DOM");
            return;
        }
    
        const dropZone = customSection.querySelector('.accordion-content');
        this.log("Drop zone found:", dropZone);
        if (!dropZone) {
            console.error("Drop zone not found in the custom section");
            return;
        }
    
        // Check if we've already set up this specific drop zone
        if (dropZone.hasAttribute('data-drag-drop-setup')) {
            return;
        }
    
        dropZone.setAttribute('data-drag-drop-setup', 'true');
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
                this.log("Drag enter/over");
                addHighlight();
            }, false);
        });
    
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                this.log("Drag leave/drop");
                removeHighlight();
            }, false);
        });
    
        dropZone.addEventListener('drop', (e) => {
            this.log("File dropped");
            let dt = e.dataTransfer;
            let files = dt.files;
            this.handleFiles(files);
        }, false);
    }
    
    handleFiles(files) {
        this.log("Handling files:", files);
        //[...files].forEach(file => this.uploadAndProcessFile(file));
        [...new Set(files)].forEach(file => this.uploadAndProcessFile(file));
    }

    updateLabelDisplay(display) {
        this.displayLabels = display;
        this.update();
    }

    updateAutoUpdate(newUpdate) {
        this.autoUpdate = newUpdate;
        this.update();
    }

    updateThumbnailSize(newSize) {
        this.maxThumbnailSize = newSize;
        this.update(); // Trigger a re-render of the gallery
    }

    updateCategorySortOrder(newOrder) {
        this.categorySortOrder = newOrder;
        this.update();
    }

    updateCategoryOrder() {
        const orderMap = new Map();
        //TODO
        this.yamlFiles.forEach(file => {
            const settingId = `Prompt Gallery.Category Order.${file.type.replace(/\s+/g, '')}`;
            const userOrder = this.app.ui.settings.getSettingValue(settingId, file.order);
            orderMap.set(file.type, userOrder);
    
            if (file.sections) {
                Object.values(file.sections).forEach(subCategory => {
                    const subSettingId = `Prompt Gallery.Category Order.${file.type.replace(/\s+/g, '')}_${subCategory}`;
                    const subUserOrder = this.app.ui.settings.getSettingValue(subSettingId, userOrder);
                    orderMap.set(`${file.type} - ${subCategory}`, subUserOrder);
                });
            }
        });
    
        this.categorySortOrder = Array.from(orderMap.entries())
            .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
            .map(([name]) => name);
    
        this.update();
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
                this.log(`Image ${imagePath} already exists in custom images. Updating metadata.`);
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
        const maxAttempts = 1;
        const delayMs = 500;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await fetch(`${this.baseUrl}/prompt_gallery/image?filename=${encodeURIComponent(filename)}&subfolder=custom`, {method: 'HEAD'});
                if (response.ok) {
                    this.log(`File ${filename} exists after ${attempt + 1} attempts`);
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
        
        this.log(`Attempting to fetch metadata from: ${fullImagePath}`);
        
        try {
            const response = await fetch(fullImagePath);
            if (!response.ok) {
                console.error(`Failed to fetch image. Status: ${response.status}, StatusText: ${response.statusText}`);
                throw new Error(`Failed to fetch image: ${response.statusText}`);
            }
            
            this.log(`Successfully fetched image from: ${fullImagePath}`);
            
            const arrayBuffer = await response.arrayBuffer();
            this.log(`ArrayBuffer size: ${arrayBuffer.byteLength} bytes`);
            
            this.log('About to extract metadata...');
            const metadata = await pngMetadata.getFromPngBuffer(new Uint8Array(arrayBuffer));
            this.log(`Extracted metadata:`, metadata);
            
            return metadata;
        } catch (error) {
            console.error(`Error in fetchImageMetadata: ${error.message}`);
            throw error;
        }
    }

    extractPromptFromMetadata(metadata) {
        this.log('Extracting prompt from metadata:', metadata);
        if (!metadata || !metadata.prompt) {
            this.log('No prompt found in metadata');
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
            this.log(`Image ${newImage.name} already exists in custom images. Updating metadata.`);
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

        //this.log("Starting sortAndDisplayImages");
        //this.log("Grouped Images:", groupedImages);
        //this.log("Current categorySortOrder:", this.categorySortOrder);
    
        const categories = Object.keys(groupedImages).sort((a, b) => {
            if (a === "Custom") return 1;
            if (b === "Custom") return -1;
        
            // If dealing with subcategories of "Female Body", prepend "Female Body - " to the subcategory names
            const normalizedA = a === "Build" || a === "Race" ? `Female Body - ${a}` : a;
            const normalizedB = b === "Build" || b === "Race" ? `Female Body - ${b}` : b;
        
            const indexA = this.categorySortOrder.indexOf(normalizedA);
            const indexB = this.categorySortOrder.indexOf(normalizedB);
        
            //this.log(`Order index for ${a} (normalized: ${normalizedA}): ${indexA}`);
            //this.log(`Order index for ${b} (normalized: ${normalizedB}): ${indexB}`);
        
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);  // Default alphabetical order if both are not found
            if (indexA === -1) return 1;  // If A is not found, B goes first
            if (indexB === -1) return -1; // If B is not found, A goes first
            return indexA - indexB;       // Sort by the index in the categorySortOrder
        });
    
        //this.log("Sorted Categories:", categories);
    
        for (const category of categories) {
            //this.log(`Processing category: ${category}`);
            const images = groupedImages[category];
            const sortedImages = [...images].sort((a, b) => {
                return this.sortAscending 
                    ? a.name.localeCompare(b.name)
                    : b.name.localeCompare(a.name);
            });
            const accordionSection = this.createAccordionSection(category, sortedImages);
            this.accordion.appendChild(accordionSection);
        }
    
        //this.log("Finished sortAndDisplayImages");
    
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
            (image && image.name && image.name.toLowerCase().includes(searchTerm)) ||
            (image && image.subcategory && image.subcategory.toLowerCase().includes(searchTerm))
        );
        // Filter custom images
        this.filteredCustomImages = this.customImages.filter(image => 
            (image && image.name && image.name.toLowerCase().includes(searchTerm)) ||
            (image && image.subcategory && image.subcategory.toLowerCase().includes(searchTerm))
        );
        this.sortAndDisplayImages();
    }

/*     flattenAllImages() {
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
    } */

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
                            const yamlContent = await this.fetchContent(file.name, 'yaml');
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

                //TODO
                for(const file of this.csvFiles) {
                    if (!this.missingFiles.has(file.name)) {
                        try {
                            const csvContent = await this.fetchContent(file.name, 'csv');
                            if (csvContent) {
                                let folderName = file.name.replace('.csv', '')
                                const parsedContent = this.parseCSVForImages(
                                    csvContent,
                                    file.type,
                                    folderName,
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

            // Show/hide the Random Prompt button based on available categories
            const hasNonCustomCategories = this.allImages.some(category => category.type !== "Custom");
            this.randomPromptButton.style.display = hasNonCustomCategories ? "block" : "none";
            
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
            href: "https://civitai.com/models/615967",
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

    async fetchContent(filename, filetype) {
        if (this.missingFiles.has(filename)) {
            return null;
        }
        const response = await fetch(`${this.baseUrl}/prompt_gallery/get-file?filetype=${filetype}&filename=${filename}`);
        if (response.status === 404) {
            this.missingFiles.add(filename);
            return null;
        }
        if (!response.ok) {
            console.warn(`Failed to fetch file ${filename}: ${response.statusText}`);
            return null;
        }
        const content = await response.text();
        return content.trim() === "" ? null : content;
    }
    
    /**
     * 
     * @param {*} yamlContent 
     * @param {*} type Section title
     * @param {*} skipLevels Skip folder in thumbnails
     * @param {*} sections 
     * @param {*} pathAdjustment 
     * @param {*} ignoreKey 
     */
    parseYAMLToJson(yamlContent, type, skipLevels, sections = null, pathAdjustment = null, ignoreKey = null) {
        
    }

    parseYamlForImages(yamlContent, type, skipLevels, sections = null, pathAdjustment = null, ignoreKey = null) {
        console.log('-----')
        // console.log(type + ' ' + sections)

        const lines = yamlContent.split('\n');
        // const baseFolder = lines[0].slice(0, -1);
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
                // console.log(path)
                // path = path.replace(/^ponyxl\//, '');   // Remove any duplicate 'ponyxl' in the path
                
                
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
                // const subfolderPath = `${baseFolder}/${path}`;
                // const subfolderPath = path;
                const imageUrl = `${this.baseUrl}/prompt_gallery/image?filename=${encodeURIComponent(imageFilename)}&subfolder=${encodeURIComponent(path)}`;
                
                // Get the immediate parent category (one level up)
                const pathParts = path.split('/');
                // console.log(pathParts)
                const immediateParent = pathParts[pathParts.length - 1];
    
                const image = { name: key, path: imageUrl, tags: tags, type: type, subcategory: immediateParent };
                
                // console.log(sections[pathParts[pathParts.length - 1]])
                if (sections) {
                    image.section = sections[pathParts[pathParts.length - 1]];
                    // console.log(sections)
                    // for (const [sectionKey, sectionName] of Object.entries(sections)) {
                    //     console.log(sectionKey + ' ' + sectionName)
                    //     if (path.includes(sectionKey)) {
                    //         image.section = sectionName;
                    //         console.log(sectionKey + ' ' + sectionName + ' ' + path)
                    //         break;
                    //     }
                    // }
                }
    
                // Special handling for generate_random items in Stereotypes (other_persona.yaml)
                // if (type === "Stereotypes") {
                //     const fullPath = stack.map(item => item.key).join('/');
                //     if (fullPath.includes('generate_random')) {
                //         image.section = 'Random';
                //         image.tags = tags.replace(/^"(.*)"$/, '$1');
                //     }
                // }
                
                images.push(image);
            }
        });
    
        return images;
    }

    parseCSVForImages(content, type, filename, skipLevels, sections = null, pathAdjustment = null, ignoreKey = null){
        const images = [];
        content.split('\n').forEach(line => {
            let seperated = line.split('|')
            let imageUrl = `${this.baseUrl}/prompt_gallery/image?filename=${encodeURIComponent(seperated[0])}&subfolder=${encodeURIComponent(filename)}`;
            let image = { name: seperated[0], path: imageUrl, tags: seperated[1], type: type, subcategory: null };
            images.push(image)
        });
        return images           
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
                alignItems: "center",
            }
        });
    
        if (type !== "Custom") {
            const checkboxWrapper = $el("div", {
                style: {
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    marginRight: "10px"
                }
            });
    
            const checkbox = $el("input", {
                type: "checkbox",
                title: "Include in Random Prompts",
                style: {
                    width: "21px",
                    height: "21px",
                    cursor: "pointer"
                }
            });
    
            checkbox.checked = this.categoryStates[type] || false;
    
            checkbox.addEventListener("change", (e) => {
                e.stopPropagation(); // Prevent event from bubbling up to header
                this.categoryStates[type] = e.target.checked;
                this.savePluginData();
    
                // Handle mutual exclusivity
                if ((type === "Game Characters" || type === "Show Characters") && e.target.checked) {
                    const otherType = type === "Game Characters" ? "Show Characters" : "Game Characters";
                    const otherCheckbox = this.categoryCheckboxes.get(otherType);
                    if (otherCheckbox) {
                        otherCheckbox.checked = false;
                        this.categoryStates[otherType] = false;
                        this.savePluginData();
                    }
                }
            });
    
            checkboxWrapper.appendChild(checkbox);
            header.appendChild(checkboxWrapper);
            this.categoryCheckboxes.set(type, checkbox);
        }
    
        const headerText = $el("span", { textContent: `${type} (${images.length})` });
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
                display: this.sectionStates[type] ? "flex" : "none",
                flexDirection: "column",
                gap: "10px",
                padding: "10px",
                backgroundColor: "#1a1a1a",
                borderRadius: "4px"
            }
        });
    
        header.addEventListener("click", (e) => {
            if (e.target.type !== "checkbox") {
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
            }
        });
    
        const imageGrid = $el("div", {
            style: {
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                width: "100%"
            }
        });
    
        if (type === "Custom") {
            const addButton = this.createAddCustomImageButton();
            imageGrid.appendChild(addButton);
        }
    
        images.forEach(image => {
            const imgElement = this.createImageElement(image);
            imageGrid.appendChild(imgElement);
        });
    
        content.appendChild(imageGrid);
    
        if (type === "Custom" && images.length > 0) {
            const resetButton = this.createResetCustomImagesButton();
            resetButton.style.marginTop = "10px";
            content.appendChild(resetButton);
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
                width: `${this.maxThumbnailSize}px`,
                height: this.displayLabels ? `${this.maxThumbnailSize + 40}px` : `${this.maxThumbnailSize}px`,
                overflow: "hidden"
            },
            onclick: () => this.copyToClipboard(image.name, image.tags)
        });
    
        const img = $el("img", {
            src: this.missingFiles.has(image.path) ? this.placeholderImageUrl : image.path,
            alt: image.name,
            style: {
                width: `${this.maxThumbnailSize}px`,
                height: `${this.maxThumbnailSize}px`,
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
    
        imgContainer.appendChild(img);

        if (this.displayLabels) {
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
            imgContainer.appendChild(label);
        }
    
        return imgContainer;
    }

    combineTexts(existing, newText) {
        if (!existing) return newText;
        
        // If existing text ends with a period, don't add a comma
        // if (existing.endsWith('.')) {
        //     return existing + ' ' + newText;
        // }

        //if the last character isnt a comma, add one
        if(newText.slice(-1) != ',')
            return existing + newText + ',';

        return existing + newText
    }

    generateRandomPrompt() {
        let randomPrompt = "";

        const selectedCategories = Array.from(this.categoryCheckboxes.entries())
            .filter(([_, checkbox]) => {
                this.log(`Category: ${_}, Checked: ${checkbox.checked}`);
                return checkbox.checked;
            })
            .map(([type, _]) => type);

        if (selectedCategories.length === 0) {
            this.log("No categories selected");
            this.showToast('warning', 'No Categories Selected', 'Please select at least one category for random prompts.');
            return;
        }

        for (const category of selectedCategories) {
            this.log(`Processing category: ${category}`);
            const categoryImages = this.allImages.filter(img => img.type === category);
            this.log(`Found ${categoryImages.length} images for category: ${category}`);

            if (categoryImages.length > 0) {
                const randomImage = categoryImages[Math.floor(Math.random() * categoryImages.length)];
                this.log("Random image selected:", randomImage);

                randomPrompt = this.combineTexts(randomPrompt, randomImage.tags);
                this.log("Current random prompt:", randomPrompt);
            } else {
                this.log(`No images found for category: ${category}`);
            }
        }

        if (randomPrompt) {
            this.log("Final random prompt:", randomPrompt);
            this.copyToClipboard("Random Prompt", randomPrompt);
        } else {
            this.log("No random prompt generated");
            this.showToast('error', 'No Images Found', 'No images were found in the selected categories. Please try selecting different categories.');
        }
    }

    copyToClipboard(imageName, tags) {
        let textToCopy = tags;
       
        if (typeof tags === 'object') {
            textToCopy = JSON.stringify(tags);
        }
    
        textToCopy = String(textToCopy).trim();
    
        const useSelectedNode = document.getElementById("use-selected-node").checked;
        const targetNodeDropdown = document.getElementById("target-node-dropdown");
        const selectedValue = targetNodeDropdown.value;
  
        let targetNode = null;
        let targetWidget = null;
    
        if (useSelectedNode) {
            
            // Check if there are any selected nodes
            const selectedNodesKeys = Object.keys(app.canvas.selected_nodes);
            if (selectedNodesKeys.length > 0) {
                // Get the first selected node
                targetNode = app.canvas.selected_nodes[selectedNodesKeys[0]];
                
                if (targetNode.widgets) {
                    targetWidget = targetNode.widgets.find(w => ['string', 'text', 'customtext'].includes(w.type));
                } else {
                    this.log("Debug: No widgets found in the selected node");
                }
            } else {
                this.log("Debug: No node is currently selected on the canvas");
            }
        } else if (selectedValue && selectedValue !== "clipboard") {
            const [nodeId, type, index] = selectedValue.split(':');
            targetNode = app.graph.getNodeById(parseInt(nodeId));
            if (targetNode && type === "widget") {
                targetWidget = targetNode.widgets[parseInt(index)];
            }
        }
    
        if (targetNode && targetWidget) {
            let newValue = ''
            let replacedExistingText = false
            if(targetWidget.value.includes(textToCopy))
                {
                // If the clicked wildcard prompt is already in the textbox, remove it instead of adding it a 2nd time
                newValue = targetWidget.value.replace(textToCopy,'').replace(',,',', ').replace(', ,',', ')
                replacedExistingText = true
            }
            else {
                // Combine existing text with new text
                newValue = this.combineTexts(targetWidget.value || "", textToCopy);
            }
            targetWidget.value = newValue;
            
            
            if (targetNode.onWidgetChanged) {
                this.log("Debug: Calling onWidgetChanged");
                targetNode.onWidgetChanged(targetWidget.name, targetWidget.value);
            }
            
            // Mark the canvas as dirty to trigger a redraw
            app.graph.setDirtyCanvas(true, true);
            
            if(replacedExistingText)
                this.showToast('success', 'Removed Tags!', `Tags for "${imageName}" removed from ${targetNode.title} - ${targetWidget.name}`);
            else
                this.showToast('success', 'Tags Sent!', `Tags for "${imageName}" sent to ${targetNode.title} - ${targetWidget.name}`);
        } else {
            // Fallback to clipboard
            navigator.clipboard.writeText(textToCopy).then(() => {
                this.log('Tags copied to clipboard');
                this.showToast('success', 'Tags Copied!', `Tags for "${imageName}" copied to clipboard`);
            }).catch(err => {
                console.error('Failed to copy tags: ', err);
                this.showToast('error', 'Copy Failed', `Failed to copy tags for "${imageName}"`);
            });
        }
    }

    showToast(severity, summary, detail) {
        const toastsEnabled = document.getElementById("enable-toasts").checked;

        if (toastsEnabled)
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
        app.ui.settings.addSetting({
            id: "Prompt Gallery._General.maxThumbnailSize",
            name: "Max Thumbnail Size",
            type: "slider",
            attrs: { min: 50, max: 250, step: 25 },
            defaultValue: 100,
            onChange: (newVal, oldVal) => {
                if (app.promptGallery) {
                    app.promptGallery.updateThumbnailSize(newVal);
                }
            },
        });

        app.ui.settings.addSetting({
            id: "Prompt Gallery._General.displayLabels",
            name: "Display Image Labels",
            type: "boolean",
            defaultValue: true,
            onChange: (newVal, oldVal) => {
                if (app.promptGallery) {
                    app.promptGallery.updateLabelDisplay(newVal);
                }
            },
        });

        app.ui.settings.addSetting({
            id: "Prompt Gallery._General.autoUpdate",
            name: "Auto Update Library Data",
            type: "boolean",
            defaultValue: true,
            onChange: (newVal, oldVal) => {
                if (app.promptGallery) {
                    app.promptGallery.updateAutoUpdate(newVal);
                }
            },
        });

        const gallery = new PromptGallery(app);
        app.promptGallery = gallery;
        // Wait for YAML files to be loaded
        await gallery.loadLibraries();

        // Sort yamlFiles by type for alphabetical order
        //TODO
        const sortedYamlFiles = [...gallery.yamlFiles].sort((b, a) => a.type.localeCompare(b.type));
        let i = 0
        sortedYamlFiles.forEach((file) => {
            i += 1
            if (!file.sections) {
                const settingId = `Prompt Gallery.Category Order.${file.type.replace(/\s+/g, '')}`;
                app.ui.settings.addSetting({
                    id: i,
                    // id: settingId,
                    name: `${file.type}`,
                    type: "number",
                    defaultValue: file.order,
                    min: 0,
                    step: 1,
                    onChange: (newVal, oldVal) => {
                        if (app.promptGallery) {
                            app.promptGallery.updateCategoryOrder();
                        }
                    },
                });
            }

            // Handle subcategories (sections) if they exist
            if (file.sections) {
                Object.entries(file.sections).forEach(([key, subCategory]) => {
                    const subSettingId = `Prompt Gallery.Category Order.${file.type.replace(/\s+/g, '')}_${subCategory}`;
                    console.log(subSettingId)
                    app.ui.settings.addSetting({
                        id: file.name,
                        // id: subSettingId,
                        name: `${file.type} - ${subCategory}`,
                        type: "number",
                        defaultValue: file.order,
                        min: 0,
                        step: 1,
                        onChange: (newVal, oldVal) => {
                            if (app.promptGallery) {
                                app.promptGallery.updateCategoryOrder();
                            }
                        },
                    });
                });
            }
        });

        gallery.csvFiles.forEach(file => {
            i += 1
            app.ui.settings.addSetting({
                id: i,
                name: `${file.type}`,
                type: "number",
                defaultValue: file.order,
                min: 0,
                step: 1,
                onChange: (newVal, oldVal) => {
                    if (app.promptGallery) {
                        app.promptGallery.updateCategoryOrder();
                    }
                },
            });
        });

        // Registering the sidebar tab
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