# ComfyUI Prompt Gallery

## What is this?
A custom node that adds a UI element to the sidebar that allows for quick and easy navigation of images to aid in building prompts. Download all the supported image packs to have instant access to over 100 trillion wildcard combinations for your renders, or upload your own custom images for quick and easy reference. 

*(Note: All packs are tailored for Pony. Art Styles won't apply well elsewhere, but other packs should be fine.)*

![image](https://github.com/user-attachments/assets/060cafa4-c387-4530-bd77-fd224946806c)

## Features
- Snazzy sidebar menu that holds images you can use for prompt building - click and go!
- Built in support for all of [Navimixu's Wildcard Files](https://civitai.com/models/615967/ponyxl-wildcards-vault)
  - If you get all these you've got access to ~800 options and ~ 140 trillion combinations 😲
- "Smart" Search and Sort functions (Search works by both name and theme, so you can search for things like "cute")
- Easily add your own images to the Custom category
- Automatic metadata extraction for prompt tags on custom images (only works with default ComfyUI nodes ATM, works well with FLUX though!)
- Drag and drop images with embedded workflows to load it on the canvas (similar to how the new queue works)

## Updates
- Finished all core elements on the roadmap and ready to call this "v1.0" and pushing it to the official registry.

## Installation
### Registry
- Registry coming soon, will update once it's live, if you want it before then you can do the manual steps below.
- Download any or all (or none if you're gonna be like that) of [Navimixu's archives](https://civitai.com/models/615967/ponyxl-wildcards-vault) and extract them into the `promptImages` folder (located inside this custom node directory). If you do it right your folder should look like this with all the images in various subfolders under `thumbnails` - done properly the folder will look something like this (you don't have to keep the zip files):

![image](https://github.com/user-attachments/assets/811a1c7e-cd09-4f3d-8053-41989fb9f170)
  
### Manual
- `git clone` this repo into your ComfyUI custom nodes folder
  - There are other ways to do this since it's just a js file but if I ever do add nodes better safe than sorry. The repo is tiny enough you can just download it and stick it in there, I won't tell.
- Follow the same download instructions as above ^.

**NOTE** - If you were a SUPER EARLY adopter of this then you need to move the contents of the promptImages folder in INPUT to the folder within the custom node. Once done you can nuke the old folder. (If you had custom images setup you'll need to re-add them via the menu.)

## Usage
- Click on any image in the gallery to copy its prompt tags to the node of your choice or to the clipboard for easy pasting.
  - You can also select any node in your WF you want to send the text to it "automagically" for super easy prompt building!
![image](https://github.com/user-attachments/assets/b6988be9-e904-47a6-b6bf-e3b1b447d8b3)
- Choose from any assortment of categories to build your very own complete "wildcard" style prompts. 🎲
- Add some images to the sidebar yourself via the Custom category.
- Drag and drop custom images with embedded workflows onto the canvas to load their workflow.
- Customize the look and feel of the UI via the integrated Settings options!
- **NOTE** - If you use Pony in particular the Art Style category makes it super easy to see what various tags can do!

## Limitations
- Doesn't do well getting metadata from complex workflows or prompts in non-core nodes. (You can help make this better if you find something it fails with and let me know.)
- The category order also controls the order of the prompt tags during random prompt generation, it lets you control the ordering at least.

## Requirements
- ComfyUI 0.1.3+
- There's no real requirements here since it's just a js file, enjoy!

## Roadmap
- [ ] Easier support for additional "wildcard" packages - On Demand / TBD (If you want packs supported just msg me, I don't think I'll add anymore unless requested)
- [ ] Maybe some more options around prompt handling
- [ ] Whatever bugs you find / features you submit

## Why
![image](https://media1.tenor.com/m/jGgmfDOxmuMAAAAC/ryan-reynolds-but-why.gif)

I got excited by the new front end and wanted to do something solely based in that if I could. It was also fun to just work in FE for a bit. If you're looking for a simple example of something that leverages the new sidebar, toasts, png metadata scraper, user data storage, and settings options - this could be just what you're after!

I aslo thought it would be cool to let people play with something that's not LoRA based. Many checkpoints now have a lot of built in knowledge at this point, and whenever you don't need a Lora, the better in my book!

## Credits
[**Navimixu**](https://civitai.com/user/navimixu)
- [Pony Wildcards](https://civitai.com/models/615967/ponyxl-wildcards-vault)
- [A1111 Exntesion](https://github.com/navimixu/wildcard-gallery/tree/main)
- I also totally yoinked one of their placeholder images 💖

**Comfy Org (Duh)**
- Special shoutout to ltdrdata for helping me get things out of the Input folder 💙
  
https://github.com/comfyanonymous/ComfyUI

### Compatability
Tested on ComfyUI 0.2.0
Should work on any version 0.1.3+
