export default function customTransformImports() {
  const primeVueMap = {
    'config': 'Config',

    'button': 'Button',
    'dialog': 'Dialog',
    'dropdown': 'Dropdown',
    'datatable': 'DataTable',
    'inputtext': 'InputText',
    'calendar': 'Calendar',
    'checkbox': 'Checkbox',
    'radiobutton': 'RadioButton',
    'textarea': 'Textarea',
    'toast': 'Toast',
    'panel': 'Panel',
    'menu': 'Menu',
    'tabview': 'TabView',
    'tabpanel': 'TabPanel',
    'accordion': 'Accordion',
    'accordiontab': 'AccordionTab',
    'card': 'Card',
    'chart': 'Chart',
    'confirmdialog': 'ConfirmDialog',
    'toolbar': 'Toolbar',
    'paginator': 'Paginator',
    'fieldset': 'Fieldset',
    'splitter': 'Splitter',
    'splitterpanel': 'SplitterPanel',
    'slider': 'Slider',
    'message': 'Message',
    'avatar': 'Avatar',
    'badge': 'Badge',
    'chip': 'Chip',
    'divider': 'Divider',
    'progressbar': 'ProgressBar',
    'progressspinner': 'ProgressSpinner',
    'tag': 'Tag',
    'skeleton': 'Skeleton',
    'contextmenu': 'ContextMenu',

    'toastservice': 'ToastService',
    'confirmationservice': 'ConfirmationService',
    'dialogservice': 'DialogService',

    'styleclass': 'StyleClass',
    'ripple': 'Ripple',
    'tooltip': 'Tooltip',
  };

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function parseNamedImportItems(importItemsStr) {
    if (!importItemsStr) return '';
    return importItemsStr
      .split(',')
      .map(item => {
        item = item.trim();
        if (item.includes(' as ')) {
          const [original, alias] = item.split(' as ').map(s => s.trim());
          return `${original}: ${alias}`;
        }
        return item;
      })
      .join(', ');
  }

  return {
    name: 'custom-transform-imports',
    enforce: 'post',
    renderChunk(code) {
      let transformedCode = code;

      transformedCode = transformedCode.replace(
        /import\s*{\s*([\s\S]*?)\s*}\s*from\s*["']vue["'];?/g,
        (match, importItems) => {
          const processedItems = parseNamedImportItems(importItems);
          return `const { ${processedItems} } = window.Vue;`;
        }
      );

      transformedCode = transformedCode.replace(
        /import\s+([A-Za-z0-9$_]+)\s+from\s*["']vue["'];?/g,
        (match, defaultImportName) => {
          if (match.includes('{') && match.indexOf('{') < match.indexOf('from')) return match;
          return `const ${defaultImportName} = window.Vue;`;
        }
      );

      transformedCode = transformedCode.replace(
        /import\s+([A-Za-z0-9$_]+)\s*,\s*{\s*([\s\S]*?)\s*}\s*from\s*["']primevue\/config["'];?/g,
        (match, defaultConfigImport, namedConfigImports) => {
          const itemsStr = parseNamedImportItems(namedConfigImports);
          const itemsArray = itemsStr.split(',').map(s => s.trim());

          const fromConfig = [];
          const fromRoot = [];

          itemsArray.forEach(item => {
            const originalName = item.includes(':') ? item.split(':')[0].trim() : item;
            if (originalName === 'usePrimeVue') {
              fromRoot.push(item);
            } else {
              fromConfig.push(item);
            }
          });

          let result = '';
          if (fromRoot.length > 0) {
            result += `const { ${fromRoot.join(', ')} } = window.PrimeVue;\n`;
          }
          if (fromConfig.length > 0) {
            result += `const { ${fromConfig.join(', ')} } = window.PrimeVue.Config;\n`;
          }
          result += `const ${defaultConfigImport} = window.PrimeVue.Config;`;
          return result;
        }
      );

      transformedCode = transformedCode.replace(
        /import\s*{\s*([\s\S]*?)\s*}\s*from\s*["']primevue\/config["'];?/g,
        (match, importItems) => {
          if (match.trim().startsWith('import PrimeVue,')) return match;

          const itemsStr = parseNamedImportItems(importItems);
          const itemsArray = itemsStr.split(',').map(s => s.trim());

          const fromConfig = [];
          const fromRoot = [];

          itemsArray.forEach(item => {
            const originalName = item.includes(':') ? item.split(':')[0].trim() : item;
            if (originalName === 'usePrimeVue') {
              fromRoot.push(item);
            } else {
              fromConfig.push(item);
            }
          });

          let result = '';
          if (fromRoot.length > 0) {
            result += `const { ${fromRoot.join(', ')} } = window.PrimeVue;\n`;
          }
          if (fromConfig.length > 0) {
            result += `const { ${fromConfig.join(', ')} } = window.PrimeVue.Config;\n`;
          }
          return result.trim();
        }
      );

      transformedCode = transformedCode.replace(
        /import\s+([A-Za-z0-9$_]+)\s+from\s*["']primevue\/config["'];?/g,
        (match, defaultImportName) => {
          if (match.includes('{') && match.indexOf('{') < match.indexOf('from')) return match;
          return `const ${defaultImportName} = window.PrimeVue.Config;`;
        }
      );

      transformedCode = transformedCode.replace(
        /import\s+(?:{\s*([\s\S]*?)\s*}|([A-Za-z0-9$_]+))\s+from\s*["']primevue\/([^"']+)["'];?/g,
        (match, namedImportItems, defaultImportName, path) => {
          const pathKey = path.toLowerCase();

          if (pathKey === 'config') return match;

          if (namedImportItems) {
            const processedItems = parseNamedImportItems(namedImportItems);

            if (pathKey.startsWith('use')) {
              return `const { ${processedItems} } = window.PrimeVue;`;
            }
            else {
              const globalNameSuffix = primeVueMap[pathKey] || capitalize(pathKey);
              return `const { ${processedItems} } = window.PrimeVue.${globalNameSuffix};`;
            }
          }
          else if (defaultImportName) {
            const globalNameSuffix = primeVueMap[pathKey] || capitalize(pathKey);

            return `const ${defaultImportName} = window.PrimeVue.${globalNameSuffix};`;
          }
          return match;
        }
      );

      transformedCode = transformedCode.replace(
        /import\s+([A-Za-z0-9$_]+)\s*,\s*{\s*([\s\S]*?)\s*}\s*from\s*["']primevue["'];?/g,
        (match, defaultImport, namedImports) => {
          const processedNamed = parseNamedImportItems(namedImports);

          return `const { ${processedNamed} } = window.PrimeVue;\nconst ${defaultImport} = window.PrimeVue;`;
        }
      );

      transformedCode = transformedCode.replace(
        /import\s*{\s*([\s\S]*?)\s*}\s*from\s*["']primevue["'](?!.*\/);?/g,
        (match, importItems) => {
          const processedItems = parseNamedImportItems(importItems);
          return `const { ${processedItems} } = window.PrimeVue;`;
        }
      );

      transformedCode = transformedCode.replace(
        /import\s+([A-Za-z0-9$_]+)\s+from\s*["']primevue["'](?!.*\/);?/g,
        (match, defaultImportName) => {
          if (match.includes('{') && match.indexOf('{') < match.indexOf('from')) return match;

          return `const ${defaultImportName} = window.PrimeVue;`;
        }
      );

      transformedCode = transformedCode.replace(
        /import\s*{\s*([\s\S]*?)\s*}\s*from\s*["']vue-i18n["'];?/g,
        (match, importItems) => {
          const processedItems = parseNamedImportItems(importItems);
          return `const { ${processedItems} } = window.VueI18n;`;
        }
      );

      transformedCode = transformedCode.replace(
        /import\s+([A-Za-z0-9$_]+)\s+from\s*["']vue-i18n["'];?/g,
        (match, defaultImportName) => {
          if (match.includes('{') && match.indexOf('{') < match.indexOf('from')) return match;
          return `const ${defaultImportName} = window.VueI18n;`;
        }
      );

      return transformedCode;
    }
  };
}