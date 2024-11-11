import { BaseModel } from 'types/typings'

const loader = {
  checkpoints: 'CheckpointLoaderSimple',
  loras: 'LoraLoader',
  vae: 'VAELoader',
  clip: 'CLIPLoader',
  diffusion_models: 'UNETLoader',
  unet: 'UNETLoader',
  clip_vision: 'CLIPVisionLoader',
  style_models: 'StyleModelLoader',
  embeddings: undefined,
  diffusers: 'DiffusersLoader',
  vae_approx: undefined,
  controlnet: 'ControlNetLoader',
  gligen: 'GLIGENLoader',
  upscale_models: 'UpscaleModelLoader',
  hypernetworks: 'HypernetworkLoader',
  photomaker: 'PhotoMakerLoader',
  classifiers: undefined,
}

export const resolveModelTypeLoader = (type: string) => {
  return loader[type]
}

export const genModelKey = (model: BaseModel) => {
  return `${model.type}:${model.pathIndex}:${model.fullname}`
}
