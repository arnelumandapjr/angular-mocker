export class Util {

  shortenPath(path: string) {
    if (path.length > 75) {
      path = `${path.slice(0, 30)}../..${path.slice(-40)}`;
    }
    return path;
  }
}