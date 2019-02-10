export enum MockTypes {
  Component = 'component',
  Directive = 'directive',
  Pipe = 'pipe',
  Service = 'service'
}

export interface Mock {
  type: MockTypes;
  path: string;
  content: string;
  className: string;
  mockClassName: string;
  skipped: boolean;
  extends?: string;
  methods?: string[];
}

export interface Mocks {
  components: Mock[];
  directives: Mock[];
  pipes: Mock[];
  services: Mock[];
}
