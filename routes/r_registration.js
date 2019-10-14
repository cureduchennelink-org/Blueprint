// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Registration Routes
//

const Promise = require("bluebird");
const moment = require('moment');

class Registration {
  static initClass() {
    this.deps = {
      services: ["error", "config", "ses", "auth", "tripMgr", "template"],
      mysql: ["auth", "user"],
      config: "ses.options,api.ident_id"
    };
  }
  constructor(kit) {
    this._signup = this._signup.bind(this);
    this._read_signup = this._read_signup.bind(this);
    this._register_signup = this._register_signup.bind(this);
    this.E = kit.services.E;
    this.config = kit.services.config;
    this.sdb = kit.services.db.psql;
    this.ses = kit.services.ses;
    this.auth = kit.services.auth;
    this.tripMgr = kit.services.tripMgr;
    this.template = kit.services.template;

    // Registration endpoints
    this.endpoints = {
      signup: {
        verb: "post",
        route: "/Signup",
        sql_conn: true,
        sql_tx: true,
        auth_required: false,
        use: true,
        wrap: "default_wrap",
        version: { any: this._signup }
      },
      read_signup: {
        verb: "get",
        route: "/Signup/:token",
        use: true,
        wrap: "default_wrap",
        version: { any: this._read_signup },
        sql_conn: true,
        auth_required: false
      }
    };
  }
  //Implemented on TIB project
  //register_signup:
  //	verb: 'post', route: '/Signup/:token/register'
  //	use: true, wrap: 'default_wrap', version: any: @_register_signup
  //	sql_conn: true, sql_tx: true, auth_required: false

  // Create Table for email template
  make_tbl(recipient, token, options) {
    return {
      Trip: [{ token }],
      Recipient: [recipient],
      Opt: [options]
    };
  }

  // Private Logic
  _signup(ctx, pre_loaded) {
    const use_doc = {
      params: {
        fnm: "r:S",
        lnm: "r:S",
        eml: "r:S",
        role: "r:S [vendor | executive]"
      },
      response: { success: "bool" }
    };
    if (ctx === "use") {
      return use_doc;
    }
    const { p } = ctx;
    let recipient = false;
    let success = false;

    const f = "Registration:_signup:";

    // Validate a few Params
    if (!p.eml) {
      throw new this.E.MissingArg("eml");
    }
    if (!p.fnm) {
      throw new this.E.MissingArg("fnm");
    }
    if (!p.lnm) {
      throw new this.E.MissingArg("lnm");
    }
    if (!p.role) {
      throw new this.E.MissingArg("role");
    }

    return Promise.resolve()
      .bind(this)
      .then(function() {
        // Verify email doesn't already exist
        return this.sdb.auth.GetByCredName(ctx, p.eml);
      })
      .then(function(db_rows) {
        ctx.log.debug("got ident with eml:", db_rows);
        if (db_rows.length !== 0) {
          throw new this.E.AccessDenied("REGISTER:SIGNUP:EMAIL_EXISTS");
        }

        // Create Trip and store email, fnm, lnm in json info. Never Expires (null).
        const expires = 3; //expires in three days
        const expireDate = moment()
          .add(expires, "days")
          .format();
        return this.tripMgr.planTrip(
          ctx,
          this.config.api.ident_id,
          { eml: p.eml, fnm: p.fnm, lnm: p.lnm, role: p.role },
          expireDate,
          "signup"
        );
      })
      .then(function(new_trip) {
        ctx.log.debug(f, "got signup round trip:", new_trip);
        const trip = new_trip;

        // Send Signup email
        recipient = { eml: p.eml, fnm: p.fnm, lnm: p.lnm };
        return this.ses.send(
          "verify_signup",
          this.make_tbl(recipient, trip.token, this.config.ses.options)
        );
      })
      .then(function() {
        success = true;

        // Send back to Client
        return { send: { success, recipient } };
      });
  }

  _read_signup(ctx, pre_loaded) {
    const use_doc = {
      params: {},
      response: { success: "bool", signup: "JSON" }
    };
    if (ctx === "use") {
      return use_doc;
    }
    const { p } = ctx;
    let trip = false;
    let success = false;

    const f = "Registration:_read_signup:";

    return Promise.resolve()
      .bind(this)
      .then(function() {
        // Retrieve trip info from Trip Manager
        return this.tripMgr.getTripFromToken(ctx, p.token);
      })
      .then(function(trip_info) {
        ctx.log.debug(f, "got round trip:", trip_info);
        trip = trip_info;
        const bad_token =
          trip_info.status === "unknown" || trip_info.status !== "valid";
        if (bad_token) {
          throw new this.E.AccessDenied("REGISTER:READ_SIGNUP:BAD_TOKEN");
        }
        trip.json = JSON.parse(trip.json);

        // Verify email doesn't already exist
        return this.sdb.auth.GetByCredName(ctx, trip.json.eml);
      })
      .then(function(db_rows) {
        ctx.log.debug("got ident with eml:", db_rows);
        if (db_rows.length !== 0) {
          throw new this.E.AccessDenied("REGISTER:READ_SIGNUP:EMAIL_EXISTS");
        }
        success = true;

        // Return trip json info
        return { send: { success, signup: trip.json } };
      });
  }

  _register_signup(ctx, pre_loaded) {
    const use_doc = {
      params: { fnm: "r:S", lnm: "r:S", eml: "r:S", pwd: "r:S" },
      response: { success: "bool", eml_change: "bool" }
    };
    if (ctx === "use") {
      return use_doc;
    }
    const f = "Registration:_register_signup:";
    const { p } = ctx;
    let trip = false;
    let change_trip = false;
    const { eml } = p;
    let eml_change = false;
    let new_ident_id = false;
    let new_pwd = "";
    let success = false;

    // Validate a few params
    if (!p.eml) {
      throw new this.E.MissingArg("eml");
    }
    if (!p.pwd) {
      throw new this.E.MissingArg("pwd");
    }
    if (!p.fnm) {
      throw new this.E.MissingArg("fnm");
    }
    if (!p.lnm) {
      throw new this.E.MissingArg("lnm");
    }

    return Promise.resolve()
      .bind(this)
      .then(function() {
        // Retrieve trip info from Trip Manager
        return this.tripMgr.getTripFromToken(ctx, p.token);
      })
      .then(function(trip_info) {
        ctx.log.debug(f, "got round trip:", trip_info);
        trip = trip_info;
        const bad_token =
          trip_info.status === "unknown" || trip_info.status !== "valid";
        if (bad_token) {
          throw new this.E.AccessDenied("REGISTER:REGISTER_SIGNUP:BAD_TOKEN");
        }
        trip.json = JSON.parse(trip.json);
        eml_change = eml !== trip.json.eml;

        // Verify email doesn't already exist
        return this.sdb.auth.GetByCredName(ctx, eml);
      })
      .then(function(db_rows) {
        ctx.log.debug(f, "got ident with eml:", db_rows);
        if (db_rows.length !== 0) {
          throw new this.E.AccessDenied(
            "REGISTER:REGISTER_SIGNUP:EMAIL_EXISTS"
          );
        }
        success = true;

        // Encrypt the new password
        return this.auth.EncryptPassword(p.pwd);
      })
      .then(function(pwd_hash) {
        new_pwd = pwd_hash;

        // Insert Ident Record
        const new_ident = { eml: trip.json.eml, pwd: new_pwd };
        return this.sdb.auth.Create(ctx, new_ident);
      })
      .then(function(db_result) {
        if (db_result.affectedRows !== 1) {
          throw new this.E.DbError("REGISTER:REGISTER_SIGNUP:CREATE_IDENT");
        }
        new_ident_id = db_result.insertId;

        // TODO: FRAMEWORK: HOW TO HOOK IN TO THE EXTENDED PROFILE TABLE?
        // Insert User/Profile Record
        const new_profile = { ident_id: new_ident_id, fnm: p.fnm, lnm: p.lnm };
        return this.sdb.user.Create(ctx, new_profile);
      })
      .then(function(db_result) {
        if (db_result.affectedRows !== 1) {
          throw new this.E.DbError("REGISTER:REGISTER_SIGNUP:CREATE_PROFILE");
        }

        // Return the Trip to the Trip Manager
        return this.tripMgr.returnFromTrip(ctx, trip.id, new_ident_id);
      })
      .then(function() {
        // Send Signup Complete Email
        if (eml_change) {
          return false;
        }
        const recipient = { email: p.eml, fnm: p.fnm, lnm: p.lnm };
        return this.ses.send("signup_complete", this.make_tbl(recipient));
      })
      .then(function() {
        // Create Trip and store email in json info
        if (!eml_change) {
          return false;
        }
        return this.tripMgr.planTrip(
          ctx,
          new_ident_id,
          { eml },
          null,
          "update_email"
        );
      })
      .then(function(new_trip) {
        ctx.log.debug(f, "got round trip:", new_trip);
        if (new_trip !== false) {
          change_trip = new_trip;
        }

        // Send 'Verify Email' email
        // TODO: Make a 'ReRegister' Endpoint so that we can send a 'Signup Complete' email on eml_change
        if (!eml_change) {
          return false;
        }
        const recipient = { email: eml };
        return this.ses.send(
          'verify_email_change',
          this.make_tbl(recipient, change_trip.token)
        );
      })
      .then(function() {
        success = true;

        // Return success
        return { send: { success, eml_change } };
      });
  }
}
Registration.initClass();

exports.Registration = Registration;
