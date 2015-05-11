"use strict";

var https = require("https"),
    url = require("url");

var AWS = require("aws-sdk");

var agent = new https.Agent({
  maxSockets: 100
});

AWS.config.update({
  httpOptions: {
    agent: agent
  },
  region: process.env.AWS_DEFAULT_REGION || "us-east-1"
});

var lambda = new AWS.Lambda();

module.exports = function(tilelive) {
  var Source = function(uri, callback) {
    if (typeof uri === "string") {
      uri = url.parse(uri, true);
    }

    this.functionName = uri.host;
    this.scale = uri.query.scale;
    this.tileSize = uri.query.tileSize;

    return callback(null, this);
  };

  Source.prototype.getTile = function(z, x, y, callback) {
    var functionName = this.functionName,
        scale = this.scale,
        tileSize = this.tileSize;

    return lambda.invoke({
      FunctionName: functionName,
      Payload: JSON.stringify({
        z: z,
        x: x,
        y: y,
        scale: scale,
        tileSize: tileSize
      })
    }, function(err, data) {
      if (err) {
        return callback(err);
      }

      if (data.FunctionError) {
        return callback(new Error(data.FunctionError));
      }

      var payload = JSON.parse(data.Payload);

      return callback(null, new Buffer(payload.data, "base64"), payload.headers);
    });
  };

  Source.prototype.getInfo = function(callback) {
    return callback(null, {
      format: "png",
      bounds: [-180, -85.0511, 180, 85.0511],
      minzoom: 0,
      maxzoom: Infinity,
      autoscale: true
    });
  };

  Source.prototype.close = function(callback) {
    callback = callback || function() {};

    return callback();
  };

  Source.registerProtocols = function(_tilelive) {
    _tilelive.protocols["lambda:"] = Source;
  };

  Source.registerProtocols(tilelive);

  return Source;
};
