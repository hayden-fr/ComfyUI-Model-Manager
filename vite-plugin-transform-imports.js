import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const parsePrimeVueMap = () => {
  const root = process.cwd()
  const primevueFilePath = resolve(root, 'node_modules/primevue/index.mjs')
  const primevue = readFileSync(primevueFilePath, 'utf-8')
  const nameExportRegex =
    /export\s*{\s*default\s*as\s*(?<name>\w+)\s*}\s*from\s*['"](?<subpackage>primevue\/\S*)['"];?/g
  const matches = primevue.matchAll(nameExportRegex)
  const map = {}
  for (const match of matches) {
    map[match.groups.subpackage] = match.groups.name
  }
  return map
}

/**
 *
 * @returns {import('vite').Plugin}
 */
export default function customTransformImports() {
  const externals = [
    {
      pattern: 'vue',
      global: 'Vue',
      subpackageMap: {},
    },
    {
      pattern: /^primevue\/?.*$/,
      global: 'PrimeVue',
      subpackageMap: parsePrimeVueMap(),
    },
    {
      pattern: 'vue-i18n',
      global: 'VueI18n',
      subpackageMap: {},
    },
  ]

  return {
    name: 'custom-transform-imports',
    enforce: 'post',
    config() {
      return {
        build: {
          rollupOptions: {
            external: externals.map((o) => o.pattern),
          },
        },
      }
    },
    renderChunk(code) {
      let transformedCode = code

      const toString = (value) => {
        if (value instanceof RegExp) {
          return value.source.replace(/^\^|\$$/g, '')
        }
        return value
      }

      for (const external of externals) {
        const { pattern, global, subpackageMap } = external

        const importRegexp = new RegExp(
          `import\\s+([^;]*?)\\s+from\\s+["'](${toString(pattern)})["'];?`,
          'gi',
        )
        transformedCode = transformedCode.replace(
          importRegexp,
          (_, importedContent, packageName) => {
            const result = []

            const namedImportRegexp = /,?\s*(?<named>{[^;]*?})/g
            const namedImports = importedContent.matchAll(namedImportRegexp)
            for (const m of namedImports) {
              const named = m.groups.named
              const aliasNamed = named.replace(/\s+as\s+/g, ': ')
              result.push(`const ${aliasNamed} = window.${global};`)
            }

            const defaultImport = importedContent
              .replace(namedImportRegexp, '')
              .trim()

            if (defaultImport) {
              const subpackageName = subpackageMap[packageName]
              if (subpackageName) {
                result.push(
                  `const ${defaultImport} = window.${global}.${subpackageName};`,
                )
              } else {
                result.push(`const ${defaultImport} = window.${global};`)
              }
            }

            return result.join('\n')
          },
        )
      }

      return transformedCode
    },
  }
}
