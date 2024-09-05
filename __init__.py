from server import PromptServer
import os
from aiohttp import web
from io import BytesIO
from PIL import Image


datapath = os.path.join(os.path.dirname(__file__), 'promptImages')


@PromptServer.instance.routes.get("/prompt_gallery/image")
async def view_image(request):
    if "filename" in request.rel_url.query:
        filename = request.rel_url.query["filename"]

        if 'subfolder' in request.rel_url.query:
            subfolder = request.rel_url.query["subfolder"]
            filename = os.path.join(subfolder, filename)
        else:
            subfolder = ''

        # validation for security: prevent accessing arbitrary path
        if '..' in filename or '..' in subfolder:
            return web.Response(status=400)

        fullpath = os.path.join(datapath, 'thumbnails', filename)

        if os.path.exists(os.path.join(fullpath+'.jpg')):
            fullpath += '.jpg'
        elif os.path.exists(os.path.join(fullpath+'.jpeg')):
            fullpath += '.jpeg'
        elif os.path.exists(os.path.join(fullpath+'.png')):
            fullpath += '.png'
        elif os.path.exists(os.path.join(fullpath+'.webp')):
            fullpath += '.webp'
        else:
            print(f"[Prompt Gallery] Thumbnail not found: {filename}")
            return web.Response(status=400)

        with Image.open(fullpath) as img:
            if img.mode == "RGBA":
                r, g, b, a = img.split()
                new_img = Image.merge('RGB', (r, g, b))
            else:
                new_img = img.convert("RGB")

            buffer = BytesIO()
            new_img.save(buffer, format='PNG')
            buffer.seek(0)

            return web.Response(body=buffer.read(), content_type='image/png',
                                headers={"Content-Disposition": f"filename=\"{filename}\""})

    return web.Response(status=400)

@PromptServer.instance.routes.post("/api/prompt_gallery/upload")
async def upload_image(request):
    post = await request.post()
    image = post.get("image")

    if image and image.file:
        filename = image.filename
        if not filename:
            return web.Response(status=400)

        subfolder = post.get("subfolder", "")
        upload_path = os.path.join(datapath, os.path.normpath(subfolder))
        fullpath = os.path.join(upload_path, filename)

        # validation for security: prevent accessing arbitrary path
        if subfolder[0] == '/' or '..' in fullpath or '..' in filename:
            return web.Response(status=400)

        if not os.path.exists(upload_path):
            os.makedirs(upload_path)

        with open(fullpath, "wb") as f:
            f.write(image.file.read())

        return web.Response(status=200)
    else:
        return web.Response(status=400)

@PromptServer.instance.routes.get("/prompt_gallery/yaml")
async def view_yaml(request):
    if "filename" in request.rel_url.query:
        filename = request.rel_url.query["filename"]

        if 'subfolder' in request.rel_url.query:
            subfolder = request.rel_url.query["subfolder"]
            filename = os.path.join(filename, subfolder)
        else:
            subfolder = ""

        # validation for security: prevent accessing arbitrary path
        if '..' in filename or '..' in subfolder:
            return web.Response(status=400)

        fullpath = os.path.join(datapath, filename)

        with open(fullpath) as yaml:
            text = yaml.read()
            return web.Response(text=text, content_type='text/html')

    return web.Response(status=400)


NODE_CLASS_MAPPINGS = {

}

NODE_DISPLAY_NAME_MAPPINGS = {

}

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]