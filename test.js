process.stdout.write("\x1Bc");

var readline = require('readline'),
    util = require('util');

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: completer
});

rl.setPrompt("> ", 2);
rl.on("line", function(line) {
    if (line == "help") { console.log("no command.") }
    rl.prompt();
});
rl.on('close', function() {
    return process.exit(1);
});
rl.on("SIGINT", function() {
    rl.clearLine();
    rl.question("Confirm exit : ", function(answer) {
        return (answer.match(/^o(ui)?$/i) || answer.match(/^y(es)?$/i)) ? process.exit(1) : rl.output.write("> ");
    });
});
rl.prompt();

var fu = function(type, args) {
    var t = Math.ceil((rl.line.length + 3) / process.stdout.columns);
    var text = util.format.apply(console, args);
    rl.output.write("\n\x1B[" + t + "A\x1B[0J");
    rl.output.write(text + "\n");
    rl.output.write(Array(t).join("\n\x1B[E"));
    rl._refreshLine();
};

console.log = function() {
    fu("log", arguments);
};
console.warn = function() {
    fu("warn", arguments);
};
console.info = function() {
    fu("info", arguments);
};
console.error = function() {
    fu("error", arguments);
};

console.log(">> Readline : Ok.");

function completer(line) {
    var completions = ["help", "command1", "command2", "login", "check", "ping"];
    var hits = completions.filter(function(c) {
        return c.indexOf(line) == 0;
    });

    if (hits.length == 1) {
        return [hits, line];
    } else {
        console.log("Suggest :");
        var list = "",
            l = 0,
            c = "",
            t = hits.length ? hits : completions;
        for (var i = 0; i < t.length; i++) {
            c = t[i].replace(/(\s*)$/g, "")
            if (list != "") {
                list += ", ";
            }
            if (((list + c).length + 4 - l) > process.stdout.columns) {
                list += "\n";
                l = list.length;
            }
            list += c;
        }
        console.log(list + "\n");
        return [hits, line];
    }
}

//-----------------------------

function main() {
    var ___i=0;
    setInterval(function () {
        var num = function () { return Math.floor(Math.random() * 255) + 1; };
        console.log(num()+"."+num()+"."+num()+" user connected.");
    }, 1000);
    //your code.
}

setTimeout(function () {
    main();
}, 10);
