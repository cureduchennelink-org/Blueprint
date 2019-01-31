class Kit {
  services: object;
  routes: object;
  constructor() {
    this.services = {};
    this.routes = {};
  }

  add_service(name: string, obj: object): void {
    this.services[name] = obj;
  }
}

export default Kit;
