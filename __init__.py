from server import PromptServer
import os
from aiohttp import web
from io import BytesIO
import shutil
import json
import mimetypes
import shutil

datapath = os.path.join(os.path.dirname(__file__), 'promptImages')


def update_libraries_file():
    lib_path = os.path.join(datapath, "promptGallery_libraries.json")
    txt_folder = os.path.join(datapath, "txt")
    yaml_folder = os.path.join(datapath, "yaml")
    # Load libraries JSON
    with open(lib_path, 'r') as f:
        lib = json.load(f)
    libraries = lib.get("libraries", [])

    # Get all txt files in txt folder
    txt_files = [f for f in os.listdir(txt_folder) if os.path.isfile(os.path.join(txt_folder, f))]
    # Get all yaml files in yaml folder
    yaml_files = []
    if os.path.exists(yaml_folder):
        yaml_files = [f for f in os.listdir(yaml_folder) if os.path.isfile(os.path.join(yaml_folder, f)) and f.lower().endswith('.yaml')]

    # Get set of existing library names for quick lookup (now without extension)
    existing_names = set(library.get("name") for library in libraries)

    updated = False
    for txt_file in txt_files:
        name_without_ext = os.path.splitext(txt_file)[0]
        if name_without_ext not in existing_names:
            new_library = {
                "name": name_without_ext,
                "filetype": "csv",
                "type": name_without_ext,
                "skipLevels": 0,
                "sections": ""
            }
            libraries.append(new_library)
            updated = True

    for yaml_file in yaml_files:
        name_without_ext = os.path.splitext(yaml_file)[0]
        if name_without_ext not in existing_names:
            new_library = {
                "name": name_without_ext,
                "filetype": "yaml",
                "type": name_without_ext,
                "skipLevels": 0,
                "sections": ""
            }
            libraries.append(new_library)
            updated = True

    # Optionally, keep the original hardcoded entry if needed
    # new_library = {
    #     "name": "PonyXl-f-body.yaml",
    #     "filetype": "yaml",
    #     "type": "Female Body",
    #     "skipLevels": 0,
    #     "sections": ""
    # }
    # if new_library["name"] not in existing_names:
    #     libraries.append(new_library)
    #     updated = True

    if updated:
        lib["libraries"] = libraries
        with open(lib_path, 'w') as f:
            json.dump(lib, f, indent=2)
    

def convert_txts_to_csv():
    for filename in os.listdir(os.path.join(datapath,'txt')):
        # print(filename)
    
        lines = []
        source = os.path.join(datapath,'txt', f"{filename}")
        dest = os.path.join(datapath,'csv', f"{filename}")
        dest = dest[:-4] + ".csv"

        if not os.path.exists(dest):
            with open(source,'r') as f:
                lines = f.readlines()
                # for l in f.readlines():
                #     lines.append(l)
                # lines.append(f.readline())
            
            shutil.copy(source,dest)
            
            with open(dest,'w') as f:
                for line in lines:
                    split = line.split(',')
                    if len(split) > 1:
                        f.write(f"{split[0]}|{line}")
                    else:
                        f.write(f"{line}|{line}")
            

@PromptServer.instance.routes.get("/prompt_gallery/image")
async def view_image(request):
    if "filename" in request.rel_url.query:
        filename = request.rel_url.query["filename"]
        subfolder = request.rel_url.query.get("subfolder", "")

        # validation for security: prevent accessing arbitrary path
        if '..' in filename or '..' in subfolder:
            return web.Response(status=400)

        if subfolder == "custom":
            # For custom images, look directly in the 'custom' folder
            base_path = os.path.join(datapath, "custom")
        else:
            # For package thumbnails, look in the 'thumbnails' folder
            base_path = os.path.join(datapath, "thumbnails", subfolder)

        # Try different extensions
        for ext in ['', '.jpeg', '.jpg', '.png', '.webp']:
            fullpath = os.path.join(base_path, filename + ext)
            if os.path.exists(fullpath):
                with open(fullpath, 'rb') as f:
                    content = f.read()

                content_type, _ = mimetypes.guess_type(fullpath)
                if not content_type:
                    content_type = 'application/octet-stream'

                return web.Response(body=content, content_type=content_type,
                                    headers={"Content-Disposition": f"filename=\"{filename}{ext}\""})

        # print(f"[Prompt Gallery] Image not found: {os.path.join(base_path, filename)}") - turned off for spam reasons
        return web.Response(status=404)

    return web.Response(status=400)


@PromptServer.instance.routes.get("/prompt_gallery/update-json")
async def get_promptgallery_file(request):
    convert_txts_to_csv()
    update_libraries_file()

@PromptServer.instance.routes.post("/prompt_gallery/upload")
async def upload_image(request):
    try:
        post = await request.post()
        image = post.get("image")

        if image and image.file:
            filename = image.filename
            if not filename:
                return web.json_response({"error": "No filename provided"}, status=400)

            subfolder = post.get("subfolder", "")
            upload_path = os.path.join(datapath, os.path.normpath(subfolder))
            fullpath = os.path.join(upload_path, filename)

            # validation for security: prevent accessing arbitrary path
            if subfolder[0] == '/' or '..' in fullpath or '..' in filename:
                return web.json_response({"error": "Invalid file path"}, status=400)

            if not os.path.exists(upload_path):
                os.makedirs(upload_path)

            # Save the file directly without processing
            with open(fullpath, "wb") as f:
                shutil.copyfileobj(image.file, f)

            relative_path = os.path.join(subfolder, filename)
            return web.json_response({"name": relative_path})
        else:
            return web.json_response({"error": "No image file provided"}, status=400)

    except Exception as e:
        print(f"Error in upload_image: {str(e)}")
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.get("/prompt_gallery/get-file")
async def get_promptgallery_file(request):
    url_vars = request.rel_url.query
    datapath_get_file = datapath
    if "filename" in url_vars:
        filename = url_vars["filename"]
        
        if "filetype" in url_vars:
            datapath_get_file = os.path.join(datapath, url_vars["filetype"])

        if 'subfolder' in url_vars:
            subfolder = url_vars["subfolder"]
            filename = os.path.join(filename, subfolder)
        else:
            subfolder = ""

        # validation for security: prevent accessing arbitrary path
        for key, value in url_vars.items():
            if '..' in value:
                print(f"{key}: {value}")
                return web.Response(status=400)
        # if '..' in filename or '..' in subfolder:
        #     return web.Response(status=400)

        fullpath = os.path.join(datapath_get_file, filename)

        try:
            with open(fullpath) as yaml:
                text = yaml.read()
                return web.Response(text=text, content_type='text/html')
        except FileNotFoundError:
            # print(f"YAML file not found: {fullpath}") cut down on needless noise
            return web.Response(text="", status=404)
        except Exception as e:
            print(f"Error reading file {fullpath}: {str(e)}")
            return web.Response(text="", status=500)

    return web.Response(status=400)

# @PromptServer.instance.routes.post("/prompt_gallery/update_libraries")
# async def update_libraries(request):
#     try:
#         data = await request.json()
#         filename = "promptGallery_libraries.json"
#         fullpath = os.path.join(datapath, filename)

#         with open(fullpath, 'w') as f:
#             json.dump(data, f, indent=2)

#         return web.Response(status=200)
#     except Exception as e:
#         print(f"Error updating libraries file: {str(e)}")
#         return web.Response(status=500, text=str(e))



NODE_CLASS_MAPPINGS = {

}

NODE_DISPLAY_NAME_MAPPINGS = {

}

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]