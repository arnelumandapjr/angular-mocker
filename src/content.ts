import { Logger } from './logger';
import { Util } from './util';

export class Content {
  private util: Util;

  constructor() {
    this.util = new Util();
  }

  forComponent(mockClassName: string, selector: string) {
    return (
        `import { Component } from '@angular/core';\n\n` +
        `@Component({\n` +
        (selector ? `  selector: '${selector}',\n` : '') +
        `  template: '<div>${mockClassName}</div>'\n` +
        `})\n` +
        `export class ${mockClassName} {}\n`
    );
  }

  forDirective(mockClassName: string, selector: string) {
    return (
      `import { Directive } from '@angular/core';\n\n` +
      `@Directive({\n` +
      (selector ? `  selector: '${selector}',\n` : '') +
      `})\n` +
      `export class ${mockClassName} {}\n`
    );
  }

  forPipe(mockClassName: string, pipeName: string) {
    return (
      `import { Pipe, PipeTransform } from '@angular/core';\n\n` +
      `@Pipe({\n` +
      (pipeName ? `  name: '${pipeName}',\n` : '') +
      `})\n` +
      `export class ${mockClassName} implements PipeTransform {\n\n` +
      `  transform(val: any) {\n` +
      `    return val;\n` +
      `  }\n` +
      `}\n`
    );
  }

  forService(mockClassName: string, methods: string[]) {
    if (methods.length === 0) {
      return `export const ${mockClassName} = {};\n`;
    }
    return (
      `export const ${mockClassName} = jasmine.createSpyObj('${mockClassName}', [\n` +
      `  '${methods.join(`',\n  '`)}'\n` +
      `]);\n`
    );
  }

  extractSelector(text: string, fileName: string) {
    const selectorRegexp = /selector:\s*['|"](.*)['|"]/;
    const selectorMatch = selectorRegexp.exec(text);
    const selector = selectorMatch && selectorMatch[1];
    if (!selector) {
      Logger.warn(`No selector found in ${this.util.shortenPath(fileName)}`);
    }
    return selector;
  }

  extractPipeName(text: string, fileName: string) {
    const pipeNameRegexp = /name:\s*['|"](.*)['|"]/;
    const pipeNameMatch = pipeNameRegexp.exec(text);
    const pipeName = pipeNameMatch && pipeNameMatch[1];
    if (!pipeName) {
      Logger.warn(`No pipe name found in ${this.util.shortenPath(fileName)}`);
    }
    return pipeName;
  }

}
