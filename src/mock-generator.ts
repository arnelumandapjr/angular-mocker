import * as ts from 'typescript';
import * as fs from 'fs';
import * as minimist from 'minimist';
import * as path from 'path';
import * as readdir from 'fs-readdir-recursive';

import { Logger, LogLevel } from './logger';
import { Barrel } from './barrel';
import { Content } from './content';
import { Util } from './util';
import { Mocks, Mock, MockService } from './models';

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

    Logger.log(`\n`, LogLevel.Report);

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
        Logger.warn(`No class declaration found in ${this.util.shortenPath(sourceFile.fileName)}.`, LogLevel.Verbose);
      }
    });
    this.processMockServicesWithBaseClass();
    this.createBarrels();
    this.logExecutionSummary();
  }

  private visitNode(node: ts.Node) {

    if (!(ts.isClassDeclaration(node) && node.name)) {
      return;
    }

    this.classDeclarationFound = true;

    try {
      let mock: Mock;
      mock = this.createMock(node);
  
      if (!mock.skipped) {
        fs.writeFileSync(mock.path, mock.content);
        Logger.success(`${mock.mockClassName} is successfully ${mock.saveMode}d.`, LogLevel.Report);
      }
      this.mocksGenerated[mock.type + 's'].push(mock);

    } catch (e) {
      Logger.error(e.message);
    }
  }



  private createMock(node: ts.Node): Mock {
    const mock = {} as Mock;
    mock.className = (<ts.ClassDeclaration>node).name.getText();
    mock.mockClassName = `Mock${mock.className}`;
    mock.path = node.getSourceFile().fileName.replace('.ts', '.mock.ts');
    mock.type = this.util.resolveMockType(mock.path);
    mock.saveMode = 'create';

    if (this.util.isDirective(mock) || this.util.isComponent(mock)) {
      mock.selector = this.content.extractSelector(node.getText(), node.getSourceFile().fileName);
    } else if (this.util.isPipe(mock)) {
      mock.pipeName = this.content.extractPipeName(node.getText(), node.getSourceFile().fileName);
    } else if (this.util.isService(mock)) {
      this.setMockServiceData(mock, node);
      // mock service with base class needs to be processed separately in processMockServicesWithBaseClass() method call
      // wherein its base class mock data are already generated/collected
      mock.skipped = !!(mock.extends && this.options.appDir);
      if (mock.skipped) {
        return mock;
      }
    }

    const { isMockInExistingContent, existingContent, existingMockExportType } = this.checkExistingContent(mock);

    if (isMockInExistingContent && !this.options.force && !this.util.isService(mock)) {
      mock.skipped = true;
      Logger.warn(`Skipped creating ${mock.mockClassName}. Mock already exists.`, LogLevel.Verbose);
      return mock;
    }

    if (existingContent) {
      mock.content = this.handleExistingContent(mock, isMockInExistingContent, existingContent);  
      if (this.util.isService(mock)) {
        mock.provideAsClass = existingMockExportType === 'class';
      }
    } else {
      mock.content = this.createMockContent(mock);
    }

    return mock;
  }

  private checkExistingContent(mock: Mock) {
    let matches: RegExpExecArray = null,
        existingContent = '';

    if (fs.existsSync(mock.path)) {
      const isInContentRegexp = new RegExp(`(?<!//.*)(?<!/\\*[^\\*/]*)export\\s+(const|class)\\s+${mock.mockClassName}\\s+`, 'm');
      existingContent = fs.readFileSync(mock.path, 'utf8');
      matches = isInContentRegexp.exec(existingContent);
    }

    return {
      existingContent: existingContent,
      isMockInExistingContent: !!matches,
      existingMockExportType: matches ? matches[1] : ''
    };
  }

  private handleExistingContent(mock: Mock, isMockInExistingContent: boolean, existingContent: string) {
    if (this.util.isService(mock) && isMockInExistingContent && !this.options.force) {
      return this.appendNewMethods(mock, existingContent);
    } else if (isMockInExistingContent && this.options.force) {
      return this.combineMockContentsOfSamePath(mock);
    } else if (!isMockInExistingContent) {
      return existingContent + '\n' + this.createMockContent(mock);
    } else {
      Logger.error(`Unhandled existing content scenario. \nisMockINExistingContent: ${isMockInExistingContent}\nMock: ${JSON.stringify(mock, null, 4)}`);
    }
  }

  private combineMockContentsOfSamePath(mock: Mock) {
    return this.mocksGenerated[`${mock.type}s`]
                  .filter(m => m.path === mock.path)
                  .reduce((allContent, curMock) => {
                    const content = this.createMockContent(curMock)
                    if (curMock.content) {
                      allContent += `${content}\n`;
                    }
                    return allContent;
                  }, '');
  }

  private appendNewMethods(mock: MockService, existingContent: string) {
    const insertPos = this.util.getMatchIndex(existingContent, new RegExp('(?<=export\\s+const\\s+' + mock.mockClassName + '\\s+=\\s+jasmine\\.createSpyObj\\(\'' + mock.mockClassName + '\',\\s+\\[)\\s+[\'"]{1}\\w+[\'"]{1},'));
    const newMethods = mock.methods.filter(method => !existingContent.includes(method));

    if (insertPos === -1 || newMethods.length === 0) {
      mock.skipped = true;
      Logger.warn(`Skipped creating ${mock.mockClassName}. Mock already exists.`, LogLevel.Verbose);
      return '';
    } else {
      mock.saveMode = 'update';
      const strNewMethods = `\n  '${newMethods.join(`',\n  '`)}',`;
      return this.util.strInsert(existingContent, strNewMethods, insertPos);
    }

  }

  private setMockServiceData(mock: MockService, node: ts.Node) {
    const methods = [];
    ts.forEachChild(node, n => {
      if (ts.isHeritageClause(n) &&  n.getText().search('extends ') >= 0) {
        mock.extends = 'Mock' +  n.getText().replace('extends ', '');
        if (!this.options.appDir) {
          // for now, if mock is not generated in app wide mode using --app-dir option, base classes for service is not supported
          Logger.warn(`${this.util.shortenPath(mock.path)} won't have methods from it's baseClass.
\tYou have to mock it using --app-dir to get it's parent's methods.`);
        }
      }
      ts.isMethodDeclaration(n) && methods.push(n.name.getText());
    });
    mock.methods = methods;
    // will only be true, if mock service is found in existing file and it is exported as a class
    mock.provideAsClass = false;
  }

  private createMockContent(mock: Mock): string {
    if (this.util.isComponent(mock)) {
      return this.content.forComponent(mock.mockClassName, mock.selector);
    } else if (this.util.isDirective(mock)) {
      return this.content.forDirective(mock.mockClassName, mock.selector);
    } else if (this.util.isPipe(mock)) {
      return this.content.forPipe(mock.mockClassName, mock.pipeName);
    } else if (this.util.isService(mock)) {
      return this.content.forService(mock.mockClassName, mock.methods);
    } else {
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
        if (stat.isFile() && !supportedExts.some(ext => file.includes(ext))) {
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

  private processMockServicesWithBaseClass() {
    // only applicable if generating for the whole application
    if (!this.options.appDir) {
      return;
    }

    const mocksWithExtends = this.mocksGenerated.services.filter(mock => !!mock.extends);
    mocksWithExtends.forEach(mock => {

      const { isMockInExistingContent, existingContent, existingMockExportType } = this.checkExistingContent(mock);
      
      const methods = this.mergeMethodWithParent(mock, mock.methods);
      // de-dup methods
      methods.filter((value, index, self) => {
        return self.indexOf(value) === index;
      });
      mock.methods = methods;
      mock.provideAsClass = existingMockExportType === 'class';
      mock.skipped = false;

      if (existingContent) {
        mock.content = this.handleExistingContent(mock, isMockInExistingContent, existingContent)
      } else {
        mock.content = this.createMockContent(mock);
      }

      if (!mock.skipped) {
        fs.writeFileSync(mock.path, mock.content);
        Logger.success(`${mock.mockClassName} is successfully created.`, LogLevel.Report);  
      }
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

    components.skips = this.mocksGenerated.components.filter(mock => mock.skipped).length,
    directives.skips = this.mocksGenerated.directives.filter(mock => mock.skipped).length,
    services.skips = this.mocksGenerated.services.filter(mock => mock.skipped).length,
    pipes.skips = this.mocksGenerated.pipes.filter(mock => mock.skipped).length,
    components.mocked = this.mocksGenerated.components.length - components.skips;
    directives.mocked = this.mocksGenerated.directives.length - directives.skips;
    services.mocked = this.mocksGenerated.services.length - services.skips;
    pipes.mocked = this.mocksGenerated.pipes.length - pipes.skips;

    Logger.log(`\n****** Execution Summary ******\n`, LogLevel.Report);

    components.skips && Logger.warn(`${components.skips} component(s) is/are skip due to already existing mocks.`, LogLevel.Report);
    directives.skips && Logger.warn(`${directives.skips} directives(s) is/are skip due to already existing mocks.`, LogLevel.Report);
    services.skips && Logger.warn(`${services.skips} services(s) is/are skip due to already existing mocks.`, LogLevel.Report);
    pipes.skips && Logger.warn(`${pipes.skips} pipes(s) is/are skip due to already existing mocks.`, LogLevel.Report);

    Logger.log(`\n`, LogLevel.Report);

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
