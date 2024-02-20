# comfyui-model-manager

Download, browse and delete models in ComfyUI.

<div>
  <img src="demo-tab-download.png" alt="Model Manager Demo Screenshot" width="45%"/>
  <img src="demo-tab-models.png" alt="Model Manager Demo Screenshot" width="45%"/>
</div>

## About this fork

I made this fork because the original repo was inactive and missing many things I needed to make ComfyUI more usable. Also, many other custom nodes bundle unrelated features together or search the internet in the background.

## Fork Improvements

### Download Tab

- View multiple models associated to a url.
- Select download directory.
- Optionally download default or custom preview image.
- Civitai and HuggingFace API token configurable in `server_settings.yaml`.

### Models Tab

- Search bar in models tab.
- Advanced keyword search using `"multiple words in quotes"` or a minus sign to `-exclude`.
- Search `/`subdirectories of model directories based on your file structure (for example, `/0/1.5/styles/clothing`).
  - Add `/` at the start of the search bar to see auto-complete suggestions.
- Include models listed in ComfyUI's `extra_model_paths.yaml` or added in `ComfyUI/models`.
- Sort for models (Date Created, Date Modified, Name).

### Model Info

- View model metadata, including training tags and bucket resolutions.
- Delete or move a model.
- Read, edit and save notes in a `.txt` file beside the model.

### ComfyUI Node Graph

- Button to copy a model to the ComfyUI clipboard or embedding to system clipboard. (Embedding copying requires secure http connection.)
- Button to add model to ComfyUI graph or embedding to selected nodes. (For small screens/low resolution.)
- Right, left, top and bottom toggleable sidebar modes.
- Drag a model onto the graph to add a new node.
- Drag a model onto an existing node to set the model field.
- Drag an embedding onto a text area to add it to the end.

### Settings Tab

- Change colors using ComfyUI's theme colors.
- Settings tab saved in `ui_settings.yaml`.
  - Hide/Show 'add' and 'copy-to-clipboard' buttons.
  - Text to always search.
  - Show/Hide add embedding extension.

## TODO

### Code

- Javascript cleanup.
  - Seperate into classes per tab?
  - HTML generation all inside main class?
  - More server driven, HTMX-like HTML generation? (Avoid x2 states)

### Model Copying

- Copy model path?

### Model info window/panel (server load/send on demand)

- Set preview image.
- Optional (re)download `📥︎` model info from the internet and cache the text file locally. (requires checksum?)
  - Radio buttons to swap between downloaded and server view.

### Settings

- Exclude hidden folders with a `.` prefix.
- Enable optional checksum to detect if a model is already downloaded.
- Sidebar width/height.

### Search filtering and sort

- Real-time search
  - Check search code is optimized to avoid recalculation on every minor input change
- Directory dropdown
  - Use always filter to filter directory content auto-suggest dropdown
- Filters dropdown
  - Stable Diffusion model version/Clip/Upscale/?
  - Favorites
- Sort-by dropdown
  - Recently used (ascending/decending)
  - Frequently used (ascending/decending)
- `or` vs `and` type of keyword search (currently `and`)

### Image preview

- Support multiple preview images. (swipe?)
- Show preview images for videos.
  - If ffmpeg or cv2 available, extract the first frame of the video and use as image preview.
  - Play preview video?

### Accessibility

- Proper naming and labeling.
- Tool tips?

### Sidebar

- Drag sidebar width/height dynamically.
