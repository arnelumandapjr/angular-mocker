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
}

export interface MockService extends Mock {
  extends?: string;
  methods: string[];
  provideAsClass: boolean;
}
export interface Mocks {
  components: Mock[];
  directives: Mock[];
  pipes: Mock[];
  services: MockService[];
}
