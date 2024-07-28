import os
import glob
import hashlib

import torch
from PIL import Image, ImageOps, ImageSequence
import numpy as np
from aiohttp import web

import node_helpers
import folder_paths
from server import PromptServer


class ImageLoader:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "subfolder": ("STRING", {"default": ""}),
                "image": ([], {"image_upload": True})
            }
        }

    CATEGORY = "image"

    RETURN_TYPES = ("IMAGE", "MASK")
    FUNCTION = "load_image"

    def load_image(self, image, subfolder):
        image_path = os.path.join(folder_paths.get_input_directory(), subfolder, image)

        img = node_helpers.pillow(Image.open, image_path)

        output_images = []
        output_masks = []
        w, h = None, None

        excluded_formats = ['MPO']

        for i in ImageSequence.Iterator(img):
            i = node_helpers.pillow(ImageOps.exif_transpose, i)

            if i.mode == 'I':
                i = i.point(lambda i: i * (1 / 255))
            image = i.convert("RGB")

            if len(output_images) == 0:
                w = image.size[0]
                h = image.size[1]

            if image.size[0] != w or image.size[1] != h:
                continue

            image = np.array(image).astype(np.float32) / 255.0
            image = torch.from_numpy(image)[None,]
            if 'A' in i.getbands():
                mask = np.array(i.getchannel('A')).astype(np.float32) / 255.0
                mask = 1. - torch.from_numpy(mask)
            else:
                mask = torch.zeros((64,64), dtype=torch.float32, device="cpu")
            output_images.append(image)
            output_masks.append(mask.unsqueeze(0))

        if len(output_images) > 1 and img.format not in excluded_formats:
            output_image = torch.cat(output_images, dim=0)
            output_mask = torch.cat(output_masks, dim=0)
        else:
            output_image = output_images[0]
            output_mask = output_masks[0]

        return (output_image, output_mask)

    @classmethod
    def IS_CHANGED(s, image, subfolder):
        image_path = os.path.join(folder_paths.get_input_directory(), subfolder, image)
        m = hashlib.sha256()
        with open(image_path, 'rb') as f:
            m.update(f.read())
        return m.digest().hex()

    @classmethod
    def VALIDATE_INPUTS(s, image, subfolder):
        image_path = os.path.join(folder_paths.get_input_directory(), subfolder, image)
        if not os.path.exists(image_path):
            return "Invalid image file: {}".format(image)

        return True


@PromptServer.instance.routes.post("/images_in_directory")
async def images_in_directory(request):
    json_data =  await request.json()

    filetype = json_data.get('filetype', 'input')
    if filetype == 'input':
        base_dir = folder_paths.get_input_directory()
    elif filetype == 'output':
        base_dir = folder_paths.get_output_directory()
    elif filetype == 'temp':
        base_dir = folder_paths.get_temp_directory()
    else:
        raise Exception(f'wrong filetype: {filetype}, only input, output and temp are supported!')

    subfolder = json_data.get('subfolder', '')
    folder = os.path.join(base_dir, subfolder)

    imgs = []
    if os.path.exists(folder):
        suffix = json_data.get('suffix', ['jpg', 'jpeg', 'png', 'webp'])
        if isinstance(suffix, str):
            suffix = [suffix]
        assert isinstance(suffix, list)

        for s in suffix:
            imgs += [os.path.basename(p) for p in glob.glob(f'{folder}/*.{s}')]

    return web.json_response({'images': imgs})
