import * as fs from 'fs';
import * as path from 'path';

import { Mocks, Mock, MockService } from './models';
import { Logger, LogLevel } from './logger';
import { Util } from './util';

export class Barrel {
  private barrelBasePath: string;

  constructor(
    private mocksGenerated: Mocks,
    private options: any,
    private util = new Util()
  ) {
    this.barrelBasePath = path.join(options.sourcePath, 'mocks');
  }

  create() {
    if (!this.options.appDir) {
      // mock barrel creation is applicable for mocking full app files
      return;
    }
    if (!fs.existsSync(this.barrelBasePath)) {
      fs.mkdirSync(this.barrelBasePath);
    }

    let indexExports = [];
    if (this.mocksGenerated.components.length > 0) {
      this.writeBarrel(this.mocksGenerated.components, 'components.mock.ts', 'MockComponents');
      indexExports.push(`export * from './components.mock';\n`);
    }
    if (this.mocksGenerated.directives.length > 0) {
      this.writeBarrel(this.mocksGenerated.directives, 'directives.mock.ts', 'MockDirectives');
      indexExports.push(`export * from './directives.mock';\n`);
    }
    if (this.mocksGenerated.pipes.length > 0) {
      this.writeBarrel(this.mocksGenerated.pipes, 'pipes.mock.ts', 'MockPipes');
      indexExports.push(`export * from './pipes.mock';\n`);
    }
    if (this.mocksGenerated.services.length > 0) {
      this.writeBarrel(this.mocksGenerated.services, 'services.mock.ts', 'MockServices');
      this.writeServiceProviders(this.mocksGenerated.services);
      indexExports.push(`export * from './services.mock';\n`);
      indexExports.push(`export * from './service-providers.mock';\n`);
    }

    const indexPath = path.join(this.barrelBasePath, 'index.ts');
    let indexContent: string;
    if (fs.existsSync(indexPath) && !this.options.refreshBarrel) {
      indexContent = fs.readFileSync(indexPath, 'utf8');
      indexExports = indexExports.filter(strExport => !indexContent.includes(strExport));
      if (indexExports.length === 0) {
        Logger.debug(`${this.util.shortenPath(indexPath)} is up to date.`, LogLevel.Verbose);
      } else {
        indexContent = indexExports.join('') + indexContent;
        fs.writeFileSync(indexPath, indexContent);
        Logger.success(`${this.util.shortenPath(indexPath)} is successfully updated.`);
      }
    } else {
      indexContent = indexExports.join('');
      fs.writeFileSync(indexPath, indexContent);
      Logger.success(`${this.util.shortenPath(indexPath)} is successfully created.`);
    }
  }

  writeBarrel(mocks: Mock[], barrelFileName: string, mockArrayName: string) {
    const barrelPath = path.join(this.barrelBasePath, barrelFileName);
    if (fs.existsSync(barrelPath) && !this.options.refreshBarrel) {
      this.updateBarrel(mocks, barrelPath, mockArrayName);
      return;
    }

    const barrelContent = this.constructBarrelParts(mocks, mockArrayName).join(`\n\n`) + `\n`;

    fs.writeFileSync(barrelPath, barrelContent);
    Logger.success(`${this.util.shortenPath(barrelPath)} is successfully created.`);
  }

  updateBarrel(mocks: Mock[], barrelPath: string, mockArrayName: string) {
    let barrelContent: string = fs.readFileSync(barrelPath, 'utf8');
    
    mocks = mocks.filter(mock => !barrelContent.includes(mock.mockClassName));
    if (mocks.length === 0) {
      Logger.debug(`${this.util.shortenPath(barrelPath)} is up to date.`, LogLevel.Verbose);
      return;
    }

    const [ strImports, _, strExports ] = this.constructBarrelParts(mocks, mockArrayName);

    // finds the first import { ... } statement in existing barrel content and add new imports to barrelContent on that position
    const importInsertPos = this.util.getMatchIndex(barrelContent, /import(?:["'\s]*([\w*{}\n\r\t, ]+)from\s*)?["'\s].*([@\w_-]+)["'\s].*;$/m);
    barrelContent = this.util.strInsert(barrelContent, strImports, importInsertPos);

    // construct new elements for mock array const
    const strMockArrayConst = `\n  ` + mocks.map(mock => mock.mockClassName).join(`,\n  `) + `,`;
    // finds the first element of mock array const, insert the new elements in that position
    const mockArrayConstInsertPos = this.util.getMatchIndex(barrelContent, new RegExp('(?<=export\\s+const\\s+' + mockArrayName + '\\s+=\\s+\\[)[\\s\\w]+,'));
    barrelContent = this.util.strInsert(barrelContent,  strMockArrayConst, mockArrayConstInsertPos);

    // finds the first export { ... } statement in existing barrel content and add new exports to barrelContent on that position
    const exportInsertPos = this.util.getMatchIndex(barrelContent, /export(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["'\s]+.*(?:[@\w_-]+)["'\s]+.*;$/m);
    barrelContent = this.util.strInsert(barrelContent,  strExports, exportInsertPos);

    fs.writeFileSync(barrelPath, barrelContent);
    Logger.success(`${this.util.shortenPath(barrelPath)} is successfully updated.`);
  }

  constructBarrelParts(mocks: Mock[], mockArrayName: string) {
    const mockClasses: string[] = [];
    let strImports = '', strExports = '',
        strMockArray = `export const ${mockArrayName} = [\n`;

    mocks.forEach(mock => {
      if (mockClasses.includes(mock.mockClassName)) {
        // skip duplicate mocks
        return;
      }
      let mockPath = path.relative(this.barrelBasePath, mock.path).replace('.ts', '');
      strImports += `import { ${mock.mockClassName} } from '${mockPath}';\n`;
      strExports += `export * from '${mockPath}';\n`;
      mockClasses.push(mock.mockClassName);
    });
    strMockArray += `  ${mockClasses.join(",\n  ")}\n];`;

    return [strImports, strMockArray, strExports];
  }

  writeServiceProviders(mocks: MockService[]) {
    const barrelPath = path.join(this.barrelBasePath, 'service-providers.mock.ts');
    if (fs.existsSync(barrelPath)) {
      this.updateServicdProviders(mocks);
      return;
    }
    const [ strImports, strImports2, strMockProviders ] = this.constructServiceProviderParts(mocks);
    const barrelContent = `${strImports2}\n${strImports}\n\n${strMockProviders}\n`;

    fs.writeFileSync(barrelPath, barrelContent);
    Logger.success(`${this.util.shortenPath(barrelPath)} is successfully created.`, LogLevel.Report);
  }

  updateServicdProviders(mocks: MockService[]) {
    const barrelPath = path.join(this.barrelBasePath, 'service-providers.mock.ts');
    const mockArrayName = 'MockServiceProviders';
    let barrelContent: string = fs.readFileSync(barrelPath, 'utf8');
    
    mocks = mocks.filter(mock => !barrelContent.includes(mock.mockClassName));
    if (mocks.length === 0) {
      Logger.debug(`${this.util.shortenPath(barrelPath)} is up to date.`, LogLevel.Verbose);
      return;
    }

    const [ strImports, strImports2, _] = this.constructServiceProviderParts(mocks);

    // finds the first import { Mock... } statement in existing barrel content and add new imports { Mock... } to barrelContent on that position
    const importInsertPos = this.util.getMatchIndex(barrelContent, /import\s+{\s+Mock/);
    barrelContent = this.util.strInsert(barrelContent, strImports, importInsertPos);

    // construct service providers
    const mockProviders = mocks.map(mock => {
      const provideAs = mock.provideAsClass ? 'useClass' : 'useValue';
      return `{ provide: ${mock.className}, ${provideAs}: ${mock.mockClassName} }`;
    });
    const strMockArrayConst = `\n  ` + mockProviders.join(`,\n  `) + `,`;
    // find the first provider object in existing barrel content, insert the new providers in that position 
    const mockArrayConstInsertPos = this.util.getMatchIndex(barrelContent, new RegExp('(?<=export\\s+const\\s+' + mockArrayName + '\\s+=\\s+\\[)\\s+{\\s*provide:'));
    barrelContent = this.util.strInsert(barrelContent,  strMockArrayConst, mockArrayConstInsertPos);

    // finds the first import { ... } statement in existing barrel content and add new imports to barrelContent on that position
    const import2InsertPos = this.util.getMatchIndex(barrelContent, /import(?:["'\s]*([\w*{}\n\r\t, ]+)from\s*)?["'\s].*([@\w_-]+)["'\s].*;$/m);
    barrelContent = this.util.strInsert(barrelContent, strImports2, import2InsertPos);

    fs.writeFileSync(barrelPath, barrelContent);
    Logger.success(`${this.util.shortenPath(barrelPath)} is successfully updated.`, LogLevel.Report);
  }

  constructServiceProviderParts(mocks: MockService[]) {
    const mockProviders: string[] = [];
    let strImports = '', strImports2 = '',
        strMockProviders = `export const MockServiceProviders = [\n`;

    mocks.forEach(mock => {
      if (mockProviders.indexOf(mock.mockClassName) > 0) {
        // skip duplicate mocks
        return;
      }
      let mockPath = path.relative(this.barrelBasePath, mock.path).replace('.ts', '');
      const classPath = mockPath.replace('.mock', '');
      const provideAs = mock.provideAsClass ? 'useClass' : 'useValue';
      strImports += `import { ${mock.mockClassName} } from '${mockPath}';\n`;
      strImports2 += `import { ${mock.className} } from '${classPath}';\n`;
      mockProviders.push(`{ provide: ${mock.className}, ${provideAs}: ${mock.mockClassName} }`);
    });
    strMockProviders += `  ${mockProviders.join(`,\n  `)}\n];`;

    return [ strImports, strImports2, strMockProviders ];

  }
}
