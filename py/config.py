extension_uri: str = None
model_base_paths: dict[str, list[str]] = {}


setting_key = {
    "api_key": {
        "civitai": "ModelManager.APIKey.Civitai",
        "huggingface": "ModelManager.APIKey.HuggingFace",
    },
    "download": {
        "max_task_count": "ModelManager.Download.MaxTaskCount",
    },
}

user_agent = "Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"


from server import PromptServer

serverInstance = PromptServer.instance
routes = serverInstance.routes


class FakeRequest:
    def __init__(self):
        self.headers = {}


class CustomException(BaseException):
    def __init__(self, type: str, message: str = None) -> None:
        self.type = type
        self.message = message
        super().__init__(message)
