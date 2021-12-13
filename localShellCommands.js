
var async = require('async');
const fs = require('fs');
var HashMap = require('hashmap');

//This will forward traffic going on remoteHost:remotePort to localHost:localPort
//localHost could be defined as 127.0.0.1 or localhost dependening on your setup.
//Select a port from 6000-7000 randomly and redirect to local port 22
//var setupReverseSSH = function(remotePort, localHost, localPort, remoteHost) {
var setupReverseSSH = function(command, callback) {
	const { exec } = require('child_process');
	exec(command, (err, stdout, stderr) => {
		console.log(`stdout: ${stdout}`);
		if (err) {
		    console.log("Failed to setup reverseSSHCommandForVNC");
		    callback("FAILED: reverse ssh command");
		} else {
			callback(`Res:  ${stdout}`);
		}
	});
}

var psMinusEF = function(command, callback) {
	const { exec } = require('child_process');
	exec(command, (err, stdout, stderr) => {
		console.log(`stdout: ${stdout}`);
		if (err) {
		    console.log("Failed to check ps -ef");
		    callback("FAILED: dir command");
		} else {
			callback(`Res:  ${stdout}`);
		}
	});
}

module.exports.setupReverseSSH = setupReverseSSH;
module.exports.psMinusEF = psMinusEF;
