/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Kit Object. Dependency Manager
//
// Author: Jamie Hollowell
//

class Kit {
  constructor() {
    this.services = {};
    this.routes = {};
  }

  add_service(name, obj) {
    return (this.services[name] = obj);
  }

  new_service(name, constructor, args) {
    const _t = this;
    console.log({ args });

    // const Obj = function() {
    //   const c_args = [_t];
    //   for (let arg of Array.from(args != null ? args : [])) {
    //     c_args.push(arg);
    //   }
    //   return c.apply(this, c_args);
    // };

    // Obj.prototype = c.prototype;
    return (this.services[name] = new constructor(_t));
  }

  add_route_service(name, obj) {
    return (this.routes[name] = obj);
  }

  new_route_service(name, constructor, args) {
    const _t = this;
    const Obj = function() {
      const c_args = [_t];
      for (let arg of Array.from(args != null ? args : [])) {
        c_args.push(arg);
      }
      return constructor.apply(this, c_args);
    };

    Obj.prototype = constructor.prototype;
    return (this.routes[name] = new Obj());
  }
}

exports.Kit = Kit;
