import os
from .py import config
from .py import utils

extension_uri = utils.normalize_path(os.path.dirname(__file__))

# Install requirements
requirements_path = utils.join_path(extension_uri, "requirements.txt")

with open(requirements_path, "r", encoding="utf-8") as f:
    requirements = f.readlines()

requirements = [x.strip() for x in requirements]
requirements = [x for x in requirements if not x.startswith("#")]

uninstalled_package = [p for p in requirements if not utils.is_installed(p)]

if len(uninstalled_package) > 0:
    utils.print_info(f"Install dependencies...")
    for p in uninstalled_package:
        utils.pip_install(p)


# Init config settings
config.extension_uri = extension_uri

# Try to download web distribution
version = utils.get_current_version()
utils.download_web_distribution(version)


# Add api routes
from .py import manager
from .py import download
from .py import information

routes = config.routes

manager.ModelManager().add_routes(routes)
download.ModelDownload().add_routes(routes)
information.Information().add_routes(routes)


WEB_DIRECTORY = "web"
NODE_CLASS_MAPPINGS = {}
__all__ = ["WEB_DIRECTORY", "NODE_CLASS_MAPPINGS"]
