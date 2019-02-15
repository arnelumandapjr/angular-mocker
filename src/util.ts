import { MockTypes, Mock, MockService } from "./models";

export class Util {

  shortenPath(path: string) {
    if (path.length > 52) {
      path = `..${path.slice(-50)}`;
    }
    return path;
  }

  isService(mock: Mock): mock is MockService {
    return mock.type === MockTypes.Service;
  }
}