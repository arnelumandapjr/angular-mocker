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
  saveMode: 'create' | 'update';
}

export interface MockDirective extends Mock {
  selector?: string;
}

export interface MockComponent extends MockDirective {}

export interface MockPipe extends Mock {
  pipeName?: string;
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
