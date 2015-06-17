/// <reference path="../typings/tsd.d.ts" />
var docopt = require('docopt');
var prettystream = require('bunyan-debug-stream');
import Promise = require('bluebird');
import bunyan = require('bunyan');
import path = require('path');
var child_process : any = Promise.promisifyAll(require('child_process'));
var xml = require('xml');
var yaml = require('js-yaml');
var temp : any = Promise.promisifyAll(require('temp').track());
var fs : any = Promise.promisifyAll(require('fs'));
var util = require('util');
import readline = require('readline');
import stream = require('stream');
var chalk = require('chalk');
var rp = require('request-promise').defaults({transform: function (body, response) {
    try {
        return JSON.parse(body);
    }
    catch (e) {
        return body;
    }
}
});


var invokedas : string = path.basename(process.argv[1]);

class rlstream extends stream.Writable
{
    rl : any;

    constructor() {
        super();
        this.on('error', function(e) {
            console.log(e);
            });
        this._write = function(chunk, encoding, callback) : any
        {
            if (this.rl != null) {
                var t = Math.ceil((this.rl.line.length + 3) / (<any>process.stdout).columns);
                var text = chunk.toString();
                this.rl.output.write("\n\x1B[" + t + "A\x1B[0J");
                this.rl.output.write(text);
                this.rl.output.write(Array(t).join("\n\x1B[E"));
                if (this.rl != null)
                {
                    this.rl._refreshLine();
                }
            }
            callback();
        };
    }
}

var ostream = new rlstream();
console.log = function() { ostream.write(util.format.apply(console, arguments) + "\n"); };
var log : bunyan.Logger;
var mlog : bunyan.Logger;
var opts;

initialize(opts).then(function () {
    return checkPrereqs(opts)
            .catch(function(e){
                log.fatal("Prerequisite not met: " + e);
                throw("Failed to start due to unmet prerequisite.");
                }).then(function() {});
})
.catch(function(e) {
    log.fatal("Failed to initialize: ", e);
});

interface command
{
    name: string;
    shorthelp: string;
    handler(string): void;
};

var instance = null;

function getControlURL(s: string) : string
{
    return s.replace(/\/corfu$/, "/control");
}

var commands : command[] = [
    {
        name: "help",
        shorthelp: "print this help message",
        handler: function (s: string) {
            console.log(chalk.underline.yellow("Help"));
            console.log("The following commands are available:");
            commands.forEach(function (itm, idx, array) {
                console.log(`${chalk.white(itm.name)} - ${itm.shorthelp}`)
            });
        }
    },
    {
        name: "quit",
        shorthelp: "exit the shell",
        handler: function (s: string) {
            console.log(chalk.red("Goodbye!"));
            process.exit(1);
        }
    },
    {
        name: "resetall",
        shorthelp: "request a full reset from the configuration master",
        handler: function (s: string) {
            if (instance == null)
            {
                console.log("Must be connected to a configuration master! (use connect)");
            }
            else
            {
                log.info("Issuing resetall request to configuration master");
                rp({
                    uri: getControlURL(instance),
                    method: 'POST',
                    json: {
                        method: 'reset',
                        id: 0,
                        params: {},
                        jsonrpc: "2.0"
                    }
                    }).then(function(r) {
                        if (r.result)
                        {
                            console.log("Configuration master resetall successful.");
                        }
                        else
                        {
                            log.error("Error calling resetall", r);
                            console.log("Error calling resetall on configuration master.");
                        }
                    })
                    .catch(function(e) {
                        log.error("Failed to call resetall on configuration master", e);
                        });
            }
        }
    },
    {
        name: "connect",
        shorthelp: "connect to a configuration master",
        handler: function (s: string) {
            if (s == null)
            {
                s = "http://localhost:8002/corfu"
            }
            log.info("Connecting to configuration master at " + s);
            rp(s).then(function(jsonView) {
                log.debug("Current view is ",  jsonView);
                instance = s;
                console.log(`Succesfully connected to configuration master at ${chalk.white(s)}.`)
            })
            .catch(function (e)
            {
                log.error("Failed to connect to configuration master!", e);
            })
        }
    },
    {
        name: "view",
        shorthelp: "get the current view",
        handler: function (s: string) {
            if (instance == null)
            {
                console.log("Must be connected to a configuration master! (use connect)");
            }
            else
            {
                log.info("Retrieving view from configuration master...");
                rp(instance).then(function(jsonView) {
                    console.log(`${chalk.yellow.underline("Current View")}`);
                    console.log(`${JSON.stringify(jsonView, null, 2)}`);
                })
                .catch(function (e)
                {
                    log.error("Failed to connect to configuration master!", e);
                })
            }
        }
    },
    {
        name: "level",
        shorthelp: "set the global message level",
        handler: function (s: string) {
                var change : boolean = true;
                switch (s)
                {
                    case "trace":
                    case "debug":
                    case "info":
                    case "warn":
                    case "fatal":
                        mlog.level(s);
                        break;
                    default:
                        console.log("usage: level (trace|debug|info|warn|fatal)");
                        change = false;
                }
                console.log(`${change ? "Set the global message level to " : "The global message level is currently at "}${chalk.white((<any>bunyan).nameFromLevel[(<any>mlog).level()])}.`);
            }
    },


]

function executeCommand(line: string)
{
    var cmd = line.split(" ")[0];
    var c : command = commands.filter(function (i : command) {
        return i.name == cmd;
        })[0];
    if (c == null)
    {
        console.log(`${ chalk.red("Unknown command") } ${ chalk.white(cmd) }`);
        return;
    }
    c.handler(line.indexOf(' ') != -1 ? line.substr(line.indexOf(' ') + 1) : null);
}

function completeCommand(line: string)
{
    var completions = commands.map(function(itm, idx, array)
    {
        return itm.name;
    });
    var hits = completions.filter(function(itm, idx, array) {
        return itm.indexOf(line) == 0;
    });
    return [hits.length ? hits : completions, line];
}

function initialize(opts : any) : Promise<any>
{
    ostream.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer: completeCommand
    });
    ostream.rl.setPrompt("corfuDB> ", 2);
    ostream.rl.on("line", function (line) {
        if (line != "")
        {
            executeCommand(line);
        }
        ostream.rl.prompt();
    });
    ostream.rl.on("close", function() {
        return process.exit(1);
    });
    ostream.rl.on("SIGINT", function() {
        ostream.rl.clearLine();
        });
    ostream.rl.prompt();

     mlog = bunyan.createLogger({
        name: ' ',
        streams: [{
            level: 'trace',
            stream: prettystream({
                out: ostream,
                showPid: false,
                basepath: __dirname,
                prefixers: {
                    source: function(s) { return s; }
                },
                    colors: {
                        'trace': 'white'
                    },
                }),
            type: 'raw',
        }]
    })

    log = mlog.child({source: 'tool'});
    log.debug("Verbose logging enabled, options were:", opts);
    log.trace("Trace logging enabled (warning: this is very verbose!)");
    return new Promise(function (fulfill, reject){
        fulfill(null);
    });
}

function checkPrereqs(opts: any) : Promise<any>
{
    return new Promise<any>(function(f,r){f(null);});
}

