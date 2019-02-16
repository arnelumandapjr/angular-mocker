
# Angular Mocker

a command line tool that generates mocks for your angular pipes, services, directives and components.

## Setup and Installation

1. Install the tool globally

    ```bash
    npm install -g angular-mocker
    ```

2. Exclude mock files for app build using `exclude` option in  tsconfig.app.json

    ```js
    "exclude": [
      ...
      "**/mocks/**",
      "**/*.mock.ts",
    ]
    ```

3. Include mock files in `include` option in tsconfig.spec.json.

    ```js
    "include": [
      ...
      "**/mocks/**",
      "**/*.mock.ts",
    ]
    ```

4. Generate mock files for the whole application. This will also create barrels for each type of mocks: `components.mock.ts`, `pipes.mock.ts`, `services.mock.ts`, `directives.mock.ts`, `service-providers.mock.ts` and `index.ts`.

    ```bash
    mocker --app-dir  ./
    ```

## Generating mock for single file

This will create mock file for the specified file. Depending on the type of file, corresponding mock content will be generated.

```bash
mocker  app.component.ts
```

## Mock Contents

### I.  Component Mock

 ```js
import  {  Component  }  from  '@angular/core';

@Component({
  selector: 'componentselector',
  template: '<div>MockComponent</div>'
})
export  class  MockComponent  {}
```

### II.  Pipe Mock

 ```js
import  {  Pipe,  PipeTransform  }  from  '@angular/core';

@Pipe({
  name: 'pipename',
})
export  class  MockPipeNamePipe  implements  PipeTransform  {
  transform(val:  any)  {
    return  val;
  }
}
```

### III.  Directive Mock

```js
import  {  Directive  }  from  '@angular/core';
@Directive({
  selector: 'directiveselector',
})
export  class  MockDirectiveNameDirective  {}
```

### IV.  Service  Mock

```js
export  const  MockServiceNameService = jasmine.createSpyObj('MockServiceNameService', [
  'ServiceMethods1',
  'ServiceMethods2',
  ...
]);
```

## Command Options

|Option| Default | Description|
|--|--|--|
|--app-dir / --appDir | undefined | If specified, mocker will run in app-wide mode, meaning it will generate mocks for every file with extensions: `.component.ts`, `.pipe.ts`, `.directive.ts` and `.services.ts`. It will also generate barrel files by default such as `mocks/components.mock.ts`, `mocks/pipes.mock.ts`, `mocks/services.mock.ts`, `mocks/service-providers.mock.ts` and `mocks/index.ts` |
|--src-dir / --srcDir | src | Points to directory where the app contains its source files. Normally it will be the `src` folder. |
| --force / -f | false | If set to true, it will overwrite content of the path mock file is to be generated. If false it will not overwrite any contents, but if the mock is not yet in the content of existing file, it will append the mock to it.|
|--verbose|false|If set to true, it will show warn/error logs that might be helpful for debugging|
|--skip-barrel / --skipBarrel|false|If set to true, it will skip creating / overwriting existing barrel files|