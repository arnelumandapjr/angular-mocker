import * as ts from 'typescript';
import * as fs from 'fs';
import * as minimist from 'minimist';
import * as path from 'path';
import readdir = require('fs-readdir-recursive');

import { Logger, LogLevel } from './logger';
import { Barrel } from './barrel';
import { Content } from './content';
import { Util } from './util';
import { Mocks, MockTypes, Mock } from './models';

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES5,
  module: ts.ModuleKind.CommonJS,
  noResolve: true
};

export class MockGenerator {
  private sourceFiles: ReadonlyArray<ts.SourceFile> = [];
  private classDeclarationFound: boolean;
  private mocksGenerated: Mocks;
  private sourcePath: string;
  private content: Content;
  private util: Util;

  constructor(
    private fileNames: string[],
    private options: minimist.ParsedArgs
  ) {

    if (options.verbose) {
      Logger.logLevel = LogLevel.Verbose;
    }

    if (options.appDir) {
      this.fileNames = this.getMockableFiles();
    }

    // Build a program using the set of root file names in fileNames
    const program = ts.createProgram(this.fileNames, compilerOptions);
    // somehow this line of code adds additional data in node object
    program.getTypeChecker();

    this.sourceFiles = program.getSourceFiles();
    this.mocksGenerated = { components: [], directives: [], pipes: [], services: [] };
    this.content = new Content();
    this.util = new Util();
  }

  run(): void {

    if (!this.fileNames || this.fileNames.length <= 0) {
      Logger.error(
        `Cannot find files to mock.
\tMake sure to specify file paths or set --app-dir (and --src-dir to specify custom src folder location)
\tto generate mocks for all pipes, directives, components and services inside the app.`
      );
      return;
    }

    this.sourceFiles.forEach(sourceFile => {
      if (sourceFile.isDeclarationFile) {
        return;
      }
      this.classDeclarationFound = false;
      ts.forEachChild(sourceFile, this.visitNode.bind(this));
      if (!this.classDeclarationFound) {
        Logger.error(`No class declaration found in ${this.util.shortenPath(sourceFile.fileName)}.`);
      }
    });
    this.processMocksWithExtensions();
    this.logExecutionSummary();
    this.createBarrels();
  }

  private visitNode(node: ts.Node) {

    if (!(ts.isClassDeclaration(node) && node.name)) {
      return;
    }

    this.classDeclarationFound = true;

    let mock: Mock;
    try {
      mock = this.createMock(node);
    } catch (e) {
      Logger.error(e.message);
    }
    if (mock) {
      let skipIt = false;
      let accumulatedContent = '';
      // skip when mock extends something, this will be handle separately in this.processMocksWithExtensions() method
      if (mock.extends) {
        if (this.options.appDir) {
          skipIt = true;
        } else {
          // handling of extends for mocking per file is not yet supported
          Logger.warn(`${this.util.shortenPath(mock.path)} won't have methods from it's baseClass.
\tYou have to mock it using --app-dir to get it's parent's methods.`);
        }
      }

      if (!skipIt) {
        const result: any = this.mockFileExistCheck(mock);
        skipIt = result.skipIt;
        accumulatedContent = result.accumulatedContent;
      }

      if (!skipIt) {
        fs.writeFileSync(mock.path, accumulatedContent || mock.content);
        Logger.success(`${mock.mockClassName} is successfully created.`, LogLevel.Verbose);
      }
      mock.skipped = skipIt;
      this.mocksGenerated[mock.type + 's'].push(mock);
    }
  }

  private mockFileExistCheck(mock: Mock) {
    let skipIt = false;
    let accumulatedContent = '';
    if (fs.existsSync(mock.path)) {
      const existingContent = fs.readFileSync(mock.path, 'utf8');
      const isInContent = new RegExp(`export(\\s)+(const|class)(\\s)+${mock.mockClassName}(\\s)+`, 'm').test(existingContent);

      if (!isInContent) {
        accumulatedContent = existingContent + '\n' + mock.content;
      }

      if (isInContent && this.options.force) {
        accumulatedContent = this.mocksGenerated[`${mock.type}s`]
          .filter(m => m.path === mock.path)
          .reduce((allContent, curMock) => {
            if (curMock.content) {
              allContent += `${curMock.content}\n`;
            }
            return allContent;
          }, '');
      }

      if (isInContent && !this.options.force) {
        skipIt = true;
        Logger.warn(`Skipped creating ${mock.mockClassName}. Mock already exists.`, LogLevel.Verbose);
      }

    }
    return {
      skipIt: skipIt,
      accumulatedContent: accumulatedContent
    };
  }

  private createMock(node: ts.Node): Mock {
    const mock = {} as Mock;
    mock.className = (<ts.ClassDeclaration>node).name.getText();
    mock.mockClassName = `Mock${mock.className}`;
    mock.path = node.getSourceFile().fileName.replace('.ts', '.mock.ts');
    mock.type = this.getMockType(mock.path);

    const methods = [];
    if (mock.type === MockTypes.Service) {
      ts.forEachChild(node, n => {
        if (ts.isHeritageClause(n) &&  n.getText().search('extends ') >= 0) {
          mock.extends = 'Mock' +  n.getText().replace('extends ', '');
        }
        ts.isMethodDeclaration(n) && methods.push(n.name.getText());
      });
      mock.methods = methods;
    }
    mock.content = this.createMockContent(mock, node, methods);

    return mock;
  }

  private getMockType(mockPath): MockTypes {
    if (/.*component\.mock\.ts$/.test(mockPath)) {
      return MockTypes.Component;
    } else if (/.*directive\.mock\.ts$/.test(mockPath)) {
      return MockTypes.Directive;
    } else if (/.*pipe\.mock\.ts$/.test(mockPath)) {
      return MockTypes.Pipe;
    } else if (/.*service\.mock\.ts$/.test(mockPath)) {
      return MockTypes.Service;
    }
  }

  private createMockContent(mock: Mock, node?: ts.Node, methods?: string[]): string {
    switch (mock.type) {
      case MockTypes.Component:
        return this.content.forComponent(mock.mockClassName, this.content.extractSelector(node.getText(), node.getSourceFile().fileName));
      case MockTypes.Directive:
        return this.content.forDirective(mock.mockClassName, this.content.extractSelector(node.getText(), node.getSourceFile().fileName));
      case MockTypes.Pipe:
        return this.content.forPipe(mock.mockClassName, this.content.extractPipeName(node.getText(), node.getSourceFile().fileName));
      case MockTypes.Service:
        return this.content.forService(mock.mockClassName, methods);
      default:
        throw new Error(
          `Unknown file extension. Make sure the file to mock is a pipe, component, directive or service.
\tAlso make sure that you follow angular style guide for filenames i.e. *.component.ts | *.directives.ts | *.pipe.ts | *.service.ts`
        );
    }
  }

  private getMockableFiles(): string[] {
    this.sourcePath = path.join(this.options.appDir, this.options.srcDir || 'src');
    let fileNames = readdir(this.sourcePath, (file, _, dir) => {
      const ignoredFolders = ['node_modules', /^\..*/];
      const supportedExts = ['.component.ts', '.directive.ts', '.pipe.ts', '.service.ts'];
      if (ignoredFolders.some(ignored => file.search(ignored) >= 0)) {
        return false;
      }
      try {
        const stat: fs.Stats = fs.statSync(`${dir}/${file}`);
        if (stat.isFile() && !supportedExts.some(ext => file.search(ext) >= 0)) {
          return false;
        }
        return true;
      } catch (e) {
        Logger.error(e.message);
        return false;
        // ignore it, some files throws ENOENT error on fs.statSync() because they are hidden by the OS
      }
    });

    fileNames = fileNames.map(file => path.join(this.sourcePath, file));
    return fileNames;
  }

  private processMocksWithExtensions() {
    if (!this.options.appDir) {
      // only applicable if generating for the whole application
      return;
    }
    const mocksWithExtends = this.mocksGenerated.services.filter(mock => !!mock.extends);
    mocksWithExtends.forEach(mock => {
      const methods = this.mergeMethodWithParent(mock, mock.methods);
      // de-dup methods
      methods.filter((value, index, self) => {
        return self.indexOf(value) === index;
      });

      mock.methods = methods;
      mock.content = this.createMockContent(mock, undefined, mock.methods);

      const { skipIt, accumulatedContent} = this.mockFileExistCheck(mock);
      if (!skipIt) {
        fs.writeFileSync(mock.path, accumulatedContent || mock.content);
        Logger.success(`${mock.mockClassName} is successfully created.`, LogLevel.Verbose);
      }
      mock.skipped = skipIt;
    });
  }

  mergeMethodWithParent(mock, methods) {
    const parentMock = this.mocksGenerated.services.filter(m => m.mockClassName === mock.extends)[0];
    if (!parentMock) {
      Logger.warn(
        `Cannot find parent class of ${this.util.shortenPath(mock.className)}. Methods from parent class will not be included in mock.`,
        LogLevel.Report
      );
      return methods;
    }
    if (!!parentMock.extends) {
      return this.mergeMethodWithParent(parentMock, methods.concat(parentMock.methods));
    } else {
      return methods.concat(parentMock.methods);
    }
  }

  private logExecutionSummary() {
    if (!this.options.appDir) {
      // only applicable if generating for the whole application
      return;
    }
    const components: any = {}, directives: any = {}, services: any =  {}, pipes: any = {};

    Logger.log(`\n****** Execution Summary ******\n`, LogLevel.Report);

    components.skipped = this.mocksGenerated.components.filter(mock => mock.skipped).length,
    directives.skipped = this.mocksGenerated.directives.filter(mock => mock.skipped).length,
    services.skipped = this.mocksGenerated.services.filter(mock => mock.skipped).length,
    pipes.skipped = this.mocksGenerated.pipes.filter(mock => mock.skipped).length,
    components.mocked = this.mocksGenerated.components.length - components.skipped;
    directives.mocked = this.mocksGenerated.directives.length - directives.skipped;
    services.mocked = this.mocksGenerated.services.length - services.skipped;
    pipes.mocked = this.mocksGenerated.pipes.length - pipes.skipped;

    components.skipped && Logger.warn(`${components.skipped} component(s) is/are skipped due to already existing mocks.`, LogLevel.Report);
    directives.skipped && Logger.warn(`${directives.skipped} directives(s) is/are skipped due to already existing mocks.`, LogLevel.Report);
    services.skipped && Logger.warn(`${services.skipped} services(s) is/are skipped due to already existing mocks.`, LogLevel.Report);
    pipes.skipped && Logger.warn(`${pipes.skipped} pipes(s) is/are skipped due to already existing mocks.`, LogLevel.Report);
    components.mocked && Logger.success(`${components.mocked} component(s) is/are mocked.`, LogLevel.Report);
    directives.mocked && Logger.success(`${directives.mocked} directives(s) is/are mocked.`, LogLevel.Report);
    services.mocked && Logger.success(`${services.mocked} services(s) is/are mocked.`, LogLevel.Report);
    pipes.mocked && Logger.success(`${pipes.mocked} pipes(s) is/are mocked.`, LogLevel.Report);
  }

  createBarrels() {
    if (this.options.skipBarrel) {
      return;
    }
    new Barrel(this.mocksGenerated, { ...this.options, sourcePath: this.sourcePath }).create();
  }
}
