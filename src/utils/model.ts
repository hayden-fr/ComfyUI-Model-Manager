const loader = {
  checkpoints: 'CheckpointLoaderSimple',
  clip: 'CLIPLoader',
  clip_vision: 'CLIPVisionLoader',
  controlnet: 'ControlNetLoader',
  diffusers: 'DiffusersLoader',
  diffusion_models: 'DiffusersLoader',
  embeddings: 'Embedding',
  gligen: 'GLIGENLoader',
  hypernetworks: 'HypernetworkLoader',
  photomaker: 'PhotoMakerLoader',
  loras: 'LoraLoader',
  style_models: 'StyleModelLoader',
  unet: 'UNETLoader',
  upscale_models: 'UpscaleModelLoader',
  vae: 'VAELoader',
  vae_approx: undefined,
}

const display = {
  all: 'ALL',
  checkpoints: 'Checkpoint',
  clip: 'Clip',
  clip_vision: 'Clip Vision',
  controlnet: 'Controlnet',
  diffusers: 'Diffusers',
  diffusion_models: 'Diffusers',
  embeddings: 'embedding',
  gligen: 'Gligen',
  hypernetworks: 'Hypernetwork',
  photomaker: 'Photomaker',
  loras: 'LoRA',
  style_models: 'Style Model',
  unet: 'Unet',
  upscale_models: 'Upscale Model',
  vae: 'VAE',
  vae_approx: 'VAE approx',
}

export const resolveModelType = (type: string) => {
  return {
    display: display[type],
    loader: loader[type],
  }
}
