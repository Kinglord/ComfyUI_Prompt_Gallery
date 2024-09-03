# ComfyUI Prompt Gallery

## What is this?
A custom node that adds a UI element to the sidebar that allows for quick and easy navigation of images to aid in building prompts.

![image](https://github.com/user-attachments/assets/0f5f2f25-6c4a-4ab5-bae0-4ce4d2b58836)

## Features
- Snazzy sidebar menu that holds images and metadata for prompt building
- Built in support for all of [Navimixu's Wildcard Files](https://civitai.com/models/615967/ponyxl-wildcards-vault)
  - If you get all these you've got access to ~750 goodies!
- Easily add your own images to the Custom category
- Search and Sort functions
- Automatic metadata extraction for prompt tags (only works with default ComfyUI nodes ATM)
- Drag and drop images with embedded workflows to load it on the canvas (similar to how the new queue works)

## Installation
- `gitclone` this repo into your ComfyUI custom nodes folder
  - There are other ways to do this since it's just a js file but if I ever do add nodes better safe than sorry
- Copy the `promptImages` folder into your ComfyUI **INPUT** folder (yes I know it's not great but I can't use user directories yet)
- Download any or all (or none if you're gonna be like that) of [Navimixu's archives](https://civitai.com/models/615967/ponyxl-wildcards-vault) and extract them into the `promptImages` folder. If you do it right your folder should look like this with all the images in various subfolders under `thumbnails`.

  ![image](https://github.com/user-attachments/assets/32a77786-0cb1-42c5-83f0-303aa29bd980)

## Requirements
- ComfyUI 0.1.3+
- There's no real requirements here since it's just a js file, enjoy!

## Usage
- Click on any image in the gallery to copy its prompt tags to the clipboard to paste into your workflow.
- Add some images to the sidebar yourself via the Custom category.
- With some editing can support other YAML files, if you're cool like that.

## Limitations
- Uses the Input directory for image storage. (boo)
- Uses local storage for setting and metadata, not terrible but a bummer if you change browsers or computers.
- Doesn't do well getting metadata from complex workflows or prompts in non-core nodes

## Roadmap
- [x] Learn new FE
- [ ] Prompt stacking? (built a prompt by clicking on various pictures)
- [ ] Better prompt handling and QoL enhanvements
- [ ] Whatever bugs you fine / features you submit

## Why
![image](https://media1.tenor.com/m/jGgmfDOxmuMAAAAC/ryan-reynolds-but-why.gif)

I got excited by the new front end and wanted to do something solely based in that if I could. It was also fun to just work in FE for a bit. If you're looking for a simple example of something that leverages the new sidebar, toasts, and the new png metadata scraper, this could be just what you're after!

I aslo thought it would be cool to let people play with something that's not LoRA based. Many checkpoints now have a lot of built in knowledge ast this point, and whenever you don't need a Lora, the better in my book!

## Credits
[**Navimixu**](https://civitai.com/user/navimixu)
- [Pony Wildcards](https://civitai.com/models/615967/ponyxl-wildcards-vault)
- [A1111 Exntesion](https://github.com/navimixu/wildcard-gallery/tree/main)
- I also totally yoinked one of their placeholder images 💖

**Comfy Org (Duh)**

https://github.com/comfyanonymous/ComfyUI

### Compatability
Tested on ComfyUI 0.2.0
Should work on any version 0.1.3+
