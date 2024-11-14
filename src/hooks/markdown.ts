import MarkdownIt from 'markdown-it'
import metadata_block from 'markdown-it-metadata-block'
import yaml from 'yaml'

interface MarkdownOptions {
  metadata?: Record<string, any>
}

export const useMarkdown = (opts?: MarkdownOptions) => {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  })

  md.use(metadata_block, {
    parseMetadata: yaml.parse,
    meta: opts?.metadata ?? {},
  })

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const aIndex = tokens[idx].attrIndex('target')

    if (aIndex < 0) {
      tokens[idx].attrPush(['target', '_blank'])
    } else {
      tokens[idx].attrs![aIndex][1] = '_blank'
    }

    return self.renderToken(tokens, idx, options)
  }

  return { render: md.render.bind(md) }
}

export type MarkdownTool = ReturnType<typeof useMarkdown>
