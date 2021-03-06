var Wind = require("./wind/wind-all"),
    app = require('express').createServer();

app.getAsync = function (path, handler) {
    app.get(path, function (req, res) {
        handler(req, res).on("failure", function () {
            var message = this.error.message;
            var stack = this.error.stack;
        
            var html = "<pre>" + message + "\n" + stack + "</pre>";
            res.send(html);
        }).start();
    });
}

var format = function (output) {
    return "<pre>" + JSON.stringify(output, null, 4) + "</pre>";
};

var db = {
    getKeys: function (n, callback) {
        setTimeout(function () {
            var keys = [];
            for (var i = 0; i < n; i++) {
                keys.push(i);
            }
            callback(keys);
        }, 200);
    },

    getItem: function (key, callback) {
        setTimeout(function () {
            callback("value_" + key);
        }, 50);
    }
};

var cache = {
    get: function (key, callback) {
        setTimeout(function () {
            callback(null);
        }, 10);
    }
}

db.getKeysAsync = Wind.Async.Binding.fromCallback(db.getKeys);
db.getItemAsync = Wind.Async.Binding.fromCallback(db.getItem);
cache.getAsync = Wind.Async.Binding.fromCallback(cache.get);

app.get("/:n", function (req, res) {
    var time = new Date();
    var n = parseInt(req.params.n, 10);

    var getItems = function (keys, i, items) {
        if (i < keys.length) {
            cache.get(keys[i], function (res) {
                if (res) {
                    items.push(res);
                    getItems(keys, i + 1, items);
                } else {
                    db.getItem(keys[i], function (res) {
                        items.push(res);
                        getItems(keys, i + 1, items);
                    });
                }
            });
        } else {
            var timePassed = (new Date()) - time;
            var output = { timePassed: timePassed + "ms", items: items };
            res.send(format(output, null, 4));
        }
    };

    db.getKeys(n, function (keys) {
        getItems(keys, 0, []);
    });
});

app.getAsync("/wind/:n", eval(Wind.compile("async", function (req, res) {
    var time = new Date();

    var n = parseInt(req.params.n, 10);
    var keys = $await(db.getKeysAsync(n));

    var items = [];
    for (var i = 0; i < keys.length; i++) {
        var res = $await(cache.getAsync(keys[i]));
        if (!res) {
            res = $await(db.getItemAsync(keys[i]));
        }
        
        items.push(res);
    }

    var timePassed = (new Date()) - time;
    var output = { timePassed: timePassed + "ms", items: items };
    res.send(format(output));
})));

var getItemAsync = eval(Wind.compile("async", function (key) {
    var res = $await(cache.getAsync(key));
    if (res) {
        return res;
    }
    
    return $await(db.getItemAsync(key));
}));

app.getAsync("/wind/:n/parallel", eval(Wind.compile("async", function (req, res) {
    var time = new Date();

    var n = parseInt(req.params.n, 10);
    var keys = $await(db.getKeysAsync(n));

    var tasks = [];
    for (var i = 0; i < keys.length; i++) {
        tasks.push(getItemAsync(keys[i]));
    }

    var items = $await(Wind.Async.Task.whenAll(tasks));
    var timePassed = (new Date()) - time;
    var output = { timePassed: timePassed + "ms", items: items };
    res.send(format(output));
})));

app.listen(3000);