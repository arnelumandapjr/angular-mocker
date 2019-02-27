import { MockTypes, Mock, MockService } from "./models";

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
    return regexp.exec(str).index;
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

  isService(mock: Mock): mock is MockService {
    return mock.type === MockTypes.Service;
  }
}