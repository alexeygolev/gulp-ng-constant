'use strict';

var fs = require('fs');
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');

var _ = require('lodash');

var TEMPLATE_PATH = path.join(__dirname, 'tpls', 'constant.tpl.ejs');
var DEFAULT_WRAP_PATH = path.join(__dirname, 'tpls', 'default-wrapper.tpl.ejs');
var AMD_WRAP_PATH = path.join(__dirname, 'tpls', 'amd-wrapper.tpl.ejs');
var COMMONJS_WRAP_PATH = path.join(__dirname, 'tpls', 'commonjs-wrapper.tpl.ejs');
var defaultWrapper, amdWrapper, commonjsWrapper;

var defaults = {
    space: '\t',
    deps: [],
    wrap: false,
    template: undefined,
    templatePath: TEMPLATE_PATH
};

function ngConstantPlugin(opts) {

    var options = _.merge({}, defaults, opts);
    var template = options.template || readFile(options.templatePath);

    return through.obj(objectStream);

    function objectStream(file, enc, cb) {
        /* jshint validthis: true */

        var _this = this;
        
        if (file.isStream()) {
            _this.emit('error', pluginError('Streaming not supported'));
            return cb();
        }

        try {
            var data = file.isNull() ? {} : JSON.parse(file.contents);

            // Create the module string
            var result = _.template(template, {
                moduleName: options.name || data.name,
                deps:       data.deps || options.deps,
                constants:  getConstants(data, options)
            });

            // Handle wrapping
            if (!options.wrap) { options.wrap = data.wrap; }
            result = wrap(result, options);

            file.path = gutil.replaceExtension(file.path, '.js');
            file.contents = new Buffer(result);
            _this.push(file);
        } catch (err) {
            err.fileName = file.path;
            _this.emit('error', pluginError(err));
        }

        cb();
    }
}

function getConstants(data, options) {
    var opts = options || {};
    if (typeof opts.constants === 'string') {
        opts.constants = JSON.parse(opts.constants);
    }

    var dataCnst = data.constants || data;
    var input = _.extend({}, dataCnst, opts.constants);
    var constants =  _.map(input, function (value, name) {
        return {
            name: name,
            value: stringify(value, opts.space)
        };
    });

    return constants;
}

function pluginError(msg) {
    return new gutil.PluginError('gulp-tslint-log', msg);
}

function wrap(input, options) {
    var wrapper = options.wrap || '<%= __ngModule %>';
    if (wrapper === true) {
        if (!defaultWrapper) { defaultWrapper = readFile(DEFAULT_WRAP_PATH); }
        wrapper = defaultWrapper;
    } else if (wrapper === 'amd') {
        if (!amdWrapper) { amdWrapper = readFile(AMD_WRAP_PATH); }
        wrapper = amdWrapper;
    } else if (wrapper === 'commonjs') {
        if (!commonjsWrapper) { commonjsWrapper = readFile(COMMONJS_WRAP_PATH); }
        wrapper = commonjsWrapper;
    }
    return _.template(wrapper, _.merge({ '__ngModule': input }, options));
}

function readFile(filepath) {
    return fs.readFileSync(filepath, 'utf8');
}

function stringify(value, space) {
    return _.isUndefined(value) ? 'undefined' : JSON.stringify(value, null, space);
}

_.extend(ngConstantPlugin, {
    getConstants: getConstants,
    wrap: wrap
});

module.exports = ngConstantPlugin;
