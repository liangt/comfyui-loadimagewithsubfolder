from .image_loader import ImageLoader


WEB_DIRECTORY = "./js"

NODE_CLASS_MAPPINGS = {
    "LoadImageWithSubfolder": ImageLoader
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LoadImageWithSubfolder": "Load Image (With Subfolder)",
}


__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
