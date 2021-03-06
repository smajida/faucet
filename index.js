#!/usr/bin/env node

"use strict";

var fs = require("fs");
var join = require("path").join;
var express = require("express");
var BigNumber = require("bignumber.js");
var augur = require("augur.js");
var abi = require("augur-abi");

var FREEBIE = new BigNumber("2.5");
var ETHER = new BigNumber(10).toPower(new BigNumber(18));
var DATADIR = join(process.env.HOME, ".ethereum");

var app = express();

var connectInfo = {
    http: "http://127.0.0.1:8545",
    ws: "ws://127.0.0.1:8546",
    ipc: process.env.GETH_IPC || join(DATADIR, "geth.ipc")
};
augur.connect(connectInfo);
augur.rpc.debug.broadcast = true;
augur.rpc.retryDroppedTxs = true;

app.get("/", function (req, res) {
    res.end("How about a free lunch?");
});

app.get("/faucet", function (req, res) {
    res.end("How about a free lunch?");
});

app.get("/faucet/:address", function (req, res) {
    var address = abi.format_address(req.params.address);
    if (!augur.rpc.ipcpath) augur.connect(connectInfo);
    augur.rpc.balance(address, function (balance) {
        balance = new BigNumber(balance).dividedBy(ETHER);
        var etherToSend = FREEBIE.minus(balance);
        if (etherToSend.gt(new BigNumber(0))) {
            augur.rpc.personal("unlockAccount", [
                augur.coinbase,
                fs.readFileSync(join(DATADIR, ".password")).toString("utf8")
            ], function (unlocked) {
                if (unlocked && unlocked.error) return res.end("Couldn't unlock Ethereum node.");
                augur.rpc.sendEther({
                    to: address,
                    value: etherToSend.toFixed(),
                    from: augur.coinbase,
                    onSent: function (r) {
                        console.log("sendEther sent:", r);
                        augur.rpc.personal("lockAccount", [augur.coinbase], function (locked) {
                            if (locked && locked.error) {
                                console.error("lockAccount failed:", locked);
                                augur.connect(connectInfo);
                            }
                        });
                    },
                    onSuccess: function (r) {
                        console.log("sendEther succeeded:", r);
                        res.end("Sent " + etherToSend.toFixed() + " ether to " + address + ".");
                    },
                    onFailed: function (e) {
                        console.error("sendEther failed:", e);
                        res.end("Couldn't send ether to " + address + ".");
                        augur.connect(connectInfo);
                        augur.rpc.balance(augur.coinbase, function (balance) {
                            balance = new BigNumber(balance, 16).dividedBy(ETHER);
                            console.log("Coinbase", augur.coinbase, "balance:", balance.toFixed());
                            console.log("Nodes:", JSON.stringify(augur.rpc.nodes));
                            console.log("IPC: ipcpath=" + augur.rpc.ipcpath, "ipcStatus=" + augur.rpc.ipcStatus);
                            console.log("WS: wsUrl=" + augur.rpc.wsUrl, "wsStatus=" + augur.rpc.wsStatus);
                            augur.rpc.personal("lockAccount", [augur.coinbase], function (locked) {
                                if (locked && locked.error) {
                                    console.log("lockAccount failed:", locked);
                                    augur.connect(connectInfo);
                                }
                            });
                        });
                    }
                });
            });
        } else {
            res.end("Hey, you're not broke!");
        }
    });
});

var server = app.listen(process.env.FAUCET_PORT || 8888, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log("Listening on %s:%s", host, port);
});
