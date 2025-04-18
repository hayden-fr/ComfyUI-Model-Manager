import { app } from 'scripts/comfyAPI'
import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    model: 'Model',
    modelManager: 'Model Manager',
    openModelManager: 'Open Model Manager',
    searchModels: 'Search models',
    modelCopied: 'Model Copied',
    download: 'Download',
    downloadList: 'Download List',
    downloadTask: 'Download Task',
    createDownloadTask: 'Create Download Task',
    parseModelUrl: 'Parse Model URL',
    pleaseInputModelUrl: 'Input a URL from civitai.com or huggingface.co',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    deleteAsk: 'Confirm delete this {0}?',
    modelType: 'Model Type',
    default: 'Default',
    network: 'Network',
    local: 'Local',
    none: 'None',
    uploadFile: 'Upload File',
    tapToChange: 'Tap description to change content',
    name: 'Name',
    width: 'Width',
    height: 'Height',
    reset: 'Reset',
    back: 'Back',
    next: 'Next',
    batchScanModelInformation: 'Batch scan model information',
    modelInformationScanning: 'Scanning model information',
    selectModelType: 'Select model type',
    selectSubdirectory: 'Select subdirectory',
    scanModelInformation: 'Scan model information',
    selectedAllPaths: 'Selected all model paths',
    selectedSpecialPath: 'Selected special path',
    scanMissInformation: 'Download missing information',
    scanFullInformation: 'Override full information',
    noModelsInCurrentPath: 'There are no models available in the current path',
    sort: {
      name: 'Name',
      size: 'Largest',
      created: 'Latest created',
      modified: 'Latest modified',
    },
    size: {
      extraLarge: 'Extra Large Icons',
      large: 'Large Icons',
      medium: 'Medium Icons',
      small: 'Small Icons',
      custom: 'Custom Size',
      customTip: 'Set in `Settings > Model Manager > UI`',
    },
    info: {
      type: 'Model Type',
      pathIndex: 'Directory',
      basename: 'File Name',
      sizeBytes: 'File Size',
      createdAt: 'Created At',
      updatedAt: 'Updated At',
    },
    setting: {
      apiKey: 'API Key',
      cardHeight: 'Card Height',
      cardWidth: 'Card Width',
      scan: 'Scan',
      scanMissing: 'Download missing information or preview',
      scanAll: "Override all models' information and preview",
      includeHiddenFiles: 'Include hidden files(start with .)',
      excludeScanTypes: 'Exclude scan types (separate with commas)',
      ui: 'UI',
      cardSize: 'Card Size',
      useFlatUI: 'Flat Layout',
    },
  },
  zh: {
    model: '模型',
    modelManager: '模型管理器',
    openModelManager: '打开模型管理器',
    searchModels: '搜索模型',
    modelCopied: '模型节点已拷贝',
    download: '下载',
    downloadList: '下载列表',
    downloadTask: '下载任务',
    createDownloadTask: '创建下载任务',
    parseModelUrl: '解析模型URL',
    pleaseInputModelUrl: '输入 civitai.com 或 huggingface.co 的 URL',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    deleteAsk: '确定要删除此{0}？',
    modelType: '模型类型',
    default: '默认',
    network: '网络',
    local: '本地',
    none: '无',
    uploadFile: '上传文件',
    tapToChange: '点击描述可更改内容',
    name: '名称',
    width: '宽度',
    height: '高度',
    reset: '重置',
    back: '返回',
    next: '下一步',
    batchScanModelInformation: '批量扫描模型信息',
    modelInformationScanning: '扫描模型信息',
    selectModelType: '选择模型类型',
    selectSubdirectory: '选择子目录',
    scanModelInformation: '扫描模型信息',
    selectedAllPaths: '已选所有模型路径',
    selectedSpecialPath: '已选指定路径',
    scanMissInformation: '下载缺失信息',
    scanFullInformation: '覆盖所有信息',
    noModelsInCurrentPath: '当前路径中没有可用的模型',
    sort: {
      name: '名称',
      size: '最大',
      created: '最新创建',
      modified: '最新修改',
    },
    size: {
      extraLarge: '超大图标',
      large: '大图标',
      medium: '中等图标',
      small: '小图标',
      custom: '自定义尺寸',
      customTip: '在 `设置 > 模型管理器 > 外观` 中设置',
    },
    info: {
      type: '类型',
      pathIndex: '目录',
      basename: '文件名',
      sizeBytes: '文件大小',
      createdAt: '创建时间',
      updatedAt: '更新时间',
    },
    setting: {
      apiKey: '密钥',
      cardHeight: '卡片高度',
      cardWidth: '卡片宽度',
      scan: '扫描',
      scanMissing: '下载缺失的信息或预览图片',
      scanAll: '覆盖所有模型信息和预览图片',
      includeHiddenFiles: '包含隐藏文件(以 . 开头的文件或文件夹)',
      excludeScanTypes: '排除扫描类型(使用英文逗号隔开)',
      ui: '外观',
      cardSize: '卡片尺寸',
      useFlatUI: '展平布局',
    },
  },
}

const getLocalLanguage = () => {
  const local =
    app.ui?.settings.getSettingValue<string>('Comfy.Locale') ||
    navigator.language.split('-')[0] ||
    'en'

  return local
}

export const i18n = createI18n({
  legacy: false,
  locale: getLocalLanguage(),
  fallbackLocale: 'en',
  messages,
})
