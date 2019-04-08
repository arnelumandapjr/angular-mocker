import { MockTypes, Mock, MockService, MockDirective, MockComponent, MockPipe } from "./models";

export class Util {

  /**
   * Shorten path to 52 character maxlength
   * @param path 
   */
  shortenPath(path: string) {
    if (path.length > 52) {
      path = `..${path.slice(-50)}`;
    }
    return path;
  }
  
  /**
   * Gets the first regexp match index position
   * 
   * @param regexp 
   * @param str 
   */
  getMatchIndex(str: string, regexp: RegExp) {
    const matches = regexp.exec(str);
    return matches ? matches.index : -1;
  }

  /**
   * Insert newstr to str at specified pos 
   * 
   * @param str main string
   * @param newStr string to be inserted
   * @param pos index where to insert
   */
  strInsert(str: string, newStr: string, pos: number) {
    return str.slice(0, pos) + newStr + str.slice(pos);
  }

  resolveMockType(mockPath): MockTypes {
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

  isDirective(mock: Mock): mock is MockDirective {
    return mock.type === MockTypes.Directive;
  }

  isComponent(mock: Mock): mock is MockComponent {
    return mock.type === MockTypes.Component;
  }

  isPipe(mock: Mock): mock is MockPipe {
    return mock.type === MockTypes.Pipe;
  }
  
  isService(mock: Mock): mock is MockService {
    return mock.type === MockTypes.Service;
  }
}