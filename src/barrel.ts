import * as fs from 'fs';
import * as path from 'path';

import { Mocks, Mock, MockService } from './models';
import { Logger, LogLevel } from './logger';
import { Util } from './util';

export class Barrel {

  constructor(
    private mocksGenerated: Mocks,
    private options: any,
    private util = new Util()
  ) {}

  create() {
    if (!this.options.appDir) {
      // mock barrel creation is applicable for mocking full app files
      return;
    }
    const barrelBasePath = path.join(this.options.sourcePath, 'mocks');
    if (!fs.existsSync(barrelBasePath)) {
      fs.mkdirSync(barrelBasePath);
    }

    let indexContent = '';
    if (this.mocksGenerated.components.length > 0) {
      this.writeBarrel(
        this.mocksGenerated.components,
        barrelBasePath,
        'components.mock.ts',
        'MockComponents'
      );
      indexContent += `export * from './components.mock';\n`;
    }
    if (this.mocksGenerated.directives.length > 0) {
      this.writeBarrel(
        this.mocksGenerated.directives,
        barrelBasePath,
        'directives.mock.ts',
        'MockDirectives'
      );
      indexContent += `export * from './directives.mock';\n`;
    }
    if (this.mocksGenerated.pipes.length > 0) {
      this.writeBarrel(
        this.mocksGenerated.pipes,
        barrelBasePath,
        'pipes.mock.ts',
        'MockPipes'
      );
      indexContent += `export * from './pipes.mock';\n`;
    }
    if (this.mocksGenerated.services.length > 0) {
      this.writeBarrel(
        this.mocksGenerated.services,
        barrelBasePath,
        'services.mock.ts',
        'MockServices'
      );
      indexContent += `export * from './services.mock';\n`;
      this.writeServiceProviders(
        this.mocksGenerated.services,
        barrelBasePath
      );
      indexContent += `export * from './service-providers.mock';\n`;
    }
    const indexPath = path.join(barrelBasePath, 'index.ts');
    fs.writeFileSync(indexPath, indexContent);
    Logger.success(`${this.util.shortenPath(indexPath)} is successfully created.`);
  }

  writeBarrel(mocks: Mock[], basePath: string, barrelFileName: string, constName) {
    const barrelPath = path.join(basePath, barrelFileName);
    const arrClass: string[] = [];
    let strImports = '', strExports = '',
        strClass = `export const ${constName} = [\n`;

    mocks.forEach(mock => {
      if (arrClass.indexOf(mock.mockClassName) > 0) {
        // skip duplicate mocks
        return;
      }
      let mockPath = path.relative(basePath, mock.path);
      mockPath = mockPath.replace('.ts', '');
      strImports += `import { ${mock.mockClassName} } from '${mockPath}';\n`;
      strExports += `export * from '${mockPath}';\n`;
      arrClass.push(mock.mockClassName);
    });
    strClass += `  ${arrClass.join(`,\n  `)}\n];`;

    const barrelContent = `${strImports}\n\n${strClass}\n\n${strExports}`;

    fs.writeFileSync(barrelPath, barrelContent);
    Logger.success(`${this.util.shortenPath(barrelPath)} is successfully created.`);
  }

  writeServiceProviders(mocks: MockService[], basePath: string) {
    const barrelPath = path.join(basePath, 'service-providers.mock.ts');
    const arrClass: string[] = [];
    let strImports = '', strImports2 = '',
        strClass = `export const MockServiceProviders = [\n`;

    mocks.forEach(mock => {
      if (arrClass.indexOf(mock.mockClassName) > 0) {
        // skip duplicate mocks
        return;
      }
      let mockPath = path.relative(basePath, mock.path);
      mockPath = mockPath.replace('.ts', '');
      const classPath = mockPath.replace('.mock', '');
      const provideAs = mock.provideAsClass ? 'useClass' : 'useValue';
      strImports += `import { ${mock.mockClassName} } from '${mockPath}';\n`;
      strImports2 += `import { ${mock.className} } from '${classPath}';\n`;
      arrClass.push(`{ provide: ${mock.className}, ${provideAs}: ${mock.mockClassName} }`);
    });
    strClass += `  ${arrClass.join(`,\n  `)}\n];`;

    const barrelContent = `${strImports2}\n${strImports}\n\n${strClass}\n`;

    fs.writeFileSync(barrelPath, barrelContent);
    Logger.success(`${this.util.shortenPath(barrelPath)} is successfully created.`, LogLevel.Report);
  }
}
