// Generated by CoffeeScript 1.4.0
var Poll,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

Poll = (function() {

  function Poll(endpoint, cb) {
    var f;
    this.endpoint = endpoint;
    this.cb = cb;
    this.Start = __bind(this.Start, this);

    this.Listen = __bind(this.Listen, this);

    f = 'Poll::constructor';
    this.rest = window.rest_v1;
    this.resource = 'Poll';
    this.retry = 500;
    this.retry_max = 30000;
    this.xhr = false;
    this.pending = false;
    this.abort = false;
    this.auth_req = window.EpicMvc.Extras.options.poll.auth_req;
    this.state = {};
    this.listen = {};
  }

  Poll.prototype.Listen = function(name, push_handle) {
    _log2('Poll:Listen:', name, push_handle, (this.xhr !== false ? 'running' : 'not-running'));
    if (push_handle === false) {
      delete this.listen[name];
    } else {
      this.listen[name] = push_handle;
    }
    if (this.xhr !== false) {
      this.xhr.abort();
      this.xhr = false;
    }
    this.abort = false;
    return this.Start();
  };

  Poll.prototype.Stop = function(preserve_state) {
    var f;
    f = 'E:Poll:Stop:';
    _log2(f, {
      pending: this.pending
    }, (this.xhr !== false ? 'running' : 'not-running'));
    this.abort = true;
    if (this.pending !== false) {
      clearTimeout(this.pending);
      this.pending = false;
    }
    if (this.xhr !== false) {
      this.xhr.abort();
      this.xhr = false;
    }
    this.state = {};
    if (preserve_state !== true) {
      return this.listen = {};
    }
  };

  Poll.prototype.Start = function(delay) {
    var f, options,
      _this = this;
    f = 'Poll::Start';
    _log2(f, delay || 'no-delay', this.cursor || 'no@cursor', (this.xhr ? 'running' : 'not-running'), this.pending ? 'pending' : 'not-pending');
    if (delay === true) {
      this.abort = false;
      delay = this.retry;
    }
    if (this.pending !== false || this.xhr !== false || this.abort === true) {
      return;
    }
    if (delay == null) {
      delay = this.retry;
    }
    if (delay > this.retry_max) {
      delay = this.retry_max;
    }
    options = {
      cache: false,
      async: true,
      timeout: 0,
      type: 'post',
      dataType: 'json',
      url: this.endpoint + this.resource,
      success: function(data) {
        var again;
        _this.xhr = false;
        if (_this.abort === true) {
          return;
        }
        again = _this.cb(data);
        if (data.state != null) {
          _this.state = data.state;
        }
        if (data.listen != null) {
          _this.listen = data.listen;
        }
        if (again) {
          _this.Start();
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        _this.xhr = false;
        _log2(f, ' AJAX ERROR', {
          jq: jqXHR,
          ts: textStatus,
          et: errorThrown
        });
        if (_this.abort === true) {
          return;
        }
        if (errorThrown === 'Unauthorized') {
          _this.rest.DoToken();
        }
        _this.Start(delay * 2);
      }
    };
    this.pending = setTimeout(function() {
      var token;
      _this.pending = false;
      if (_this.abort === true) {
        return;
      }
      token = _this.rest.CurrentToken();
      if (_this.auth_req) {
        if (token === false) {
          return;
        }
        options.url += '?auth_token=' + encodeURIComponent("" + token.access_token);
      }
      options.data = {
        JSON: JSON.stringify({
          state: _this.state,
          listen: _this.listen
        })
      };
      return _this.xhr = $.ajax(options);
    }, delay);
  };

  return Poll;

})();

window.EpicMvc.Extras.Poll = Poll;