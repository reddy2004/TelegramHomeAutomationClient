/*
 Main Bot Client for Raspberry pi. Communicates with a socketio.server and local network devices
 This can act as aggregator or hub for local home devices.

 The current code does only the following:
 a. Connects to a telegram server in polling mode and you are able to send commands to this program via telegram
 b. The telegram commands are of the form of /ifttt/hall_on (for example). These urls need not be typed on
    the telegram chat as you can have a set of buttons do it. Please see config for that. (inline keyboard options)
 c. I use this for multiple devices, however this is a stripped down version that has only the telegram functionality
    and functionality to get onvif images from your ip cameras in your home network.
 d. You may enchance this to your needs by adding to the inline keyboard in the telegram bot and implimenting the routines
    for those commands here. For ex. You could use telegram to trigger a wifi-relay in your house. Please see my other 
    github projects for starter code.
*/

const fs = require('fs');
var chokidar = require('chokidar');
var homesocketio = require('socket.io-client');
var onvif = require('./onvif.js');
var localShellCommands = require('./localShellCommands.js');
var async = require('async');
var internetAvailable = require("internet-available");
var request = require("request");
var cron = require('./cronjobs.js');
var EventEmitter = require('events')
var crossMessageNotifier = new EventEmitter();
var assert = require('assert');
var TelegramBot = require('./telegramBot.js');

var vikramsTelegramId = 0;

var SampleApp = function() {

    var self = this;
    var ticker = 1;
    var socketBase = null;
    var log_enabled = true;
    var log_level = 10;
    var isSocketConnectedAndInitialized = 0;
    var watcher;

    self.LOG = function(msg, level) {
        if (log_enabled && level <= log_level) {
            console.log(msg);
        }
    }

    var config = "";
    self.LoadConfig = function() {
    	console.log("Loading config");
        var fs = require('fs');
        var array = fs.readFileSync('config.json').toString();
        
        self.config = JSON.parse(array);
        console.log(self.config);

        vikramsTelegramId = self.config.telegram.personalTelegramId;
    }

    /*
     * We use chokidar to detect changes in the filesystem (FTP folder).
     * If any of our motion sensor camera triggers and writes an image to this folder,
     * we will simply copy it and send it to our server over socketio..
     */
    self.sendMotionCaptureImages = function(newfilepath) {
    	console.log("sendMotionCaptureImages " + newfilepath);
	    async.reduce(["uploadFiles","moveFilesToNetworkShare"], {error : 'SUCCESS', data: newfilepath}, 
	        function(prevErr, item, callback) {
	        	//Fail fast.
				if (prevErr.error == 'FAILED') {
					callback(null, prevErr);
					return;
				}

				if (item == "uploadFiles") {
					//todo = send files over socketbase.
		        	console.log('MD async uploadFiles got ' + prevErr.data);
					
					if (self.socketBase != null) {
						//todo - read from file and send it.
						onvif.fileToImageBuffer(newfilepath, function(filename, buffer) {
							if (filename == newfilepath) {
								self.socketBase.emit('bot-forward-text', "Motion capture " + filename);
								self.socketBase.emit('bot-raw-forward-snapshot', buffer);
								callback(null, {error: 'SUCCESS', data: prevErr.data});							
							} else {
								callback(null, {error: 'FAILED', data: prevErr.data});
							}
						});

						
					} else {
						callback(null, {error: 'FAILED'});
					}
						              	
	            } else if (item == "moveFilesToNetworkShare") {
	            	if (self.socketBase != null) {
						self.createAndMoveToNFSAndOrCIFSFolders("MC", newfilepath, function(result) {
							callback(null,  {error : 'SUCCESS'});
						});
					} else {
						callback(null,  {error : 'SUCCESS'});
					}
	            } else {
	                 callback(null, {error : 'FAILED'});
	            }
	        }, function(err, result) {
	            console.log("MD Async function - sendMotionCaptureImages - is done!" + result);
	        });    
    }

    self.createAndMoveToNFSAndOrCIFSFolders = function(type, newfile, scallback) {

    	var yourDate = new Date();
    	var timefolder = yourDate.getHours() + '-' + yourDate.getMinutes() + '-' + yourDate.getSeconds();
    	var folder = self.config.localNFSMount.folderPath + "\\" + yourDate.toISOString().split('T')[0] + '\\' + timefolder + "." + type;

	    async.reduce(["moveToNFSFolder","moveToCIFSFolder", "cleanUp"], {error : 'SUCCESS'}, 
	        function(prevErr, item, callback) {
	        	//Fail fast.
				if (prevErr.error == 'FAILED') {
					callback(null, prevErr);
					return;
				}
				if (item == "moveToNFSFolder") {
			    	if (self.config.localNFSMount.enabled) {
			    		//todo, is it motion capture folder.
			    		var move_command = "";
			    		if (newfile == null && type == "ALARM") {
			    			move_command = self.config.environmentSettings.move + " images\\*.jpg " + folder;
			    		} else if (type == "MC") {
			    			move_command = self.config.environmentSettings.move + " " + newfile + " " + folder;
			    		} else {
			    			 callback(null, {error : 'SUCCESS'});
			    			 return;
			    		}

						const { exec } = require('child_process');
						var createFolderCommand = self.config.environmentSettings.newfolder + ' ' + folder;

						exec(createFolderCommand, (err, stdout, stderr) => {
							if (err) {
							    console.log("failed to do mkdir -p for nfs folder " + createFolderCommand);
							    callback(null, {error: 'FAILED'});
							    return;
							} else {
								console.log("nfs mv command:" + move_command);
								exec(move_command, (err, stdout, stderr) => {
								  if (err) {
								    console.log("failed to move files to nfs");
								    callback(null, {error: 'FAILED'});
								    return;
								  }
								  // the *entire* stdout and stderr (buffered)
								  console.log(`stdout: ${stdout}`);
								  console.log(`stderr: ${stderr}`);
								  callback(null, {error : 'SUCCESS'});
								});	 
							}
						});	 	
			    	} else {
			    		callback(null, {error : 'SUCCESS'});
			    	}
		        } else if (item == "moveToCIFSFolder") {
			    	if (self.config.localCifsMount.enabled) {
			    		var move_command = "";
			    		//todo, is it motion capture folder.
			    		if (newfile == null && type == "ALARM") {
			    			move_command = self.config.environmentSettings.move + " images\\*.jpg " + folder;
			    		} else if (type == "MC") {
			    			move_command = self.config.environmentSettings.move + " " + newfile + " " + folder;
			    		} else {
			    			 callback(null, {error : 'SUCCESS'});
			    			 return;
			    		}


						const { exec } = require('child_process');
						var createFolderCommand = self.config.environmentSettings.newfolder + ' ' + folder;

						exec(createFolderCommand, (err, stdout, stderr) => {
							if (err) {
								console.log("failed to move files to cifs");
								callback(null, {error: 'FAILED'});
								return;
							} else {
								console.log("cifs mv command:" + move_command);
								exec(move_command, (err, stdout, stderr) => {
								  if (err) {
								    console.log("failed to move files to cifs");
								    callback(null, {error: 'FAILED'});
								    return;
								  }
								  // the *entire* stdout and stderr (buffered)
								  console.log(`stdout: ${stdout}`);
								  console.log(`stderr: ${stderr}`);
								  callback(null, {error : 'SUCCESS'});
								});	
							}
						});	            	
			    	} else if (item == "cleanUp") {
						const { exec } = require('child_process');
						var removeFilesCommand = "";
			    		if (newfile == null && type == "ALARM") {
			    			removeFilesCommand = self.config.environmentSettings.delete + " images\\*.jpg";
			    		} else if (type == "MC") {
			    			removeFilesCommand = self.config.environmentSettings.delete + " " + newfile;
			    		} else {
			    			 callback(null, {error : 'SUCCESS'});
			    			 return;
			    		}
						exec(removeFilesCommand, (err, stdout, stderr) => {
							if (err) {
							    console.log("failed to do remove files " + removeFilesCommand);
							}
							callback(null, {error : 'SUCCESS'});
						});	 	
			    		
			    	} else {
			    		callback(null, {error : 'SUCCESS'});
			    	}
	            } else {
	                 callback(null, {error : 'FAILED'});
	            }
	        }, function(err, result) {
	            console.log("Async function - createAndMoveToNFSAndOrCIFSFolders - is done!" + result);
	            scallback(folder);
	        });
    }

    self.handleRequest = function(chatid, whichcam, scallback) {
    	var filepathlist1 = [];
	    async.eachSeries(["captureSnapshots", "sendViaTelegram", "moveFilesToNetworkShare"], 
	        function(item, callback) {

		        if (item == "captureSnapshots") {
			        onvif.StartCapture(whichcam, self.socketBase, function(filepathlist) {
			        	console.log("Capture done,, printing filenames");
			        	console.log(filepathlist);
			        	filepathlist1 = filepathlist;
			        	callback(null,  {error : 'SUCCESS', data: filepathlist});
			        });     	        	
		        	
		        } else if (item == "moveFilesToNetworkShare") {
					self.createAndMoveToNFSAndOrCIFSFolders("ALARM", null, function(result) {
						callback(null,  {error : 'SUCCESS', data: filepathlist});
					});
	            } else if (item == "sendViaTelegram") {
	            	//console.log("sendViaTelegram = " + JSON.stringify(prevErr));
	            	crossMessageNotifier.emit('main-to-telegram-cams', chatid, filepathlist1);
	            } else {
	            	crossMessageNotifier
	                 callback(null, {error : 'FAILED'});
	            }
	        }, function(err, result) {
	            console.log("Async function - handleRequest - is done!" + result);
	            scallback(result);
	        });    
    }

    self.disconnectFromSocketIOServer = function(timeout, callback) {
    	if (self.isSocketConnectedAndInitialized == 0) {
    		//Wait for connection for 5 seconds atleast, to avoid races.
	        setTimeout(function() {
	        	if (self.isSocketConnectedAndInitialized == 1) {
		    		self.socketBase.disconnect();
		    		self.socketBase = null;
		    		console.log("Disconnected from socketIOServer (timeout)");
		    		self.isSocketConnectedAndInitialized = 0;
		    		callback(true);	        		
	        	} else {
	        		callback(false);
	        	}
	        }, timeout);
    	} else {
    		setTimeout(function() {
	    		self.socketBase.disconnect();
	    		self.socketBase = null;
	    		self.isSocketConnectedAndInitialized = 0;
	    		console.log("Disconnected from socketIOServer (timout value)" + timeout);
	    		callback(true);
    		}, timeout);
    	}
    }

    self.GetSocketObject = function() {
    	return self.socketBase;
    }
    /*
    *	Connect to the socket IO server and setup required handlers. You could use the
    *	socket-io server running on a cloud host to send commands to this code.
    *	This kind of setup is useful, if you have a machine on the cloud and you have
    *	multiple raspberry pi's running this home-client. And you have other mechanisms
    *   of automation without using the telegram example provided in this code.
    */
    self.connectToSocketIOServer = function() {
    	console.log("Socketio Attempting " + self.config.remoteSocketIO.server);
		self.socketBase = homesocketio.connect(self.config.remoteSocketIO.server,
		{'reconnection limit' : 1000, 'max reconnection attempts' : 'Infinity', transports: ['websocket']});
		self.isSocketConnectedAndInitialized = 0;
		self.socketBase.on('connect', function () {
			self.socketBase.emit('register', {
									username: self.config.remoteSocketIO.username, 
									password: self.config.remoteSocketIO.password, 
									key : self.config.remoteSocketIO.secretKey}, 
									function (data) {
				console.log("Registration result from " + self.config.remoteSocketIO.server);
				console.log(data);
				if (data.authenticated == false) {
					assert(!"No valid credentials for this connection!");
				}
		        setTimeout(function() {
		        	self.isSocketConnectedAndInitialized = 1;
		        }, 1000);				
			});
		});

		self.socketBase.on('bot-request-snapshot', function (data) { 
			self.socketBase.emit('bot-forward-text', "It will take 40 seconds to get the images [" + data + "]");
			console.log(data);
			self.handleRequest(0, data, function(data2) {
				console.log("got error code for bot-request-snapshot " + JSON.stringify(data2));
			});
		});

		self.socketBase.on('disconnect', function () {
			console.log("Disconnected from Master!");
		});

		self.socketBase.on('bot-run-command', function(data) {
			if (data.indexOf("/socketio/status") == 0) {
				self.socketBase.emit('bot-forward-text', "Status is fine! dont worry!@");
			} else if (data.indexOf("/exec/ps-ef") == 0) {
				localShellCommands.psMinusEF(self.config.environmentSettings.listFolder,
					function(result) {
						self.socketBase.emit('bot-forward-text', result);
					});
			} else if (data.indexOf("/exec/reversessh") == 0) {
				localShellCommands.setupReverseSSH(self.config.environmentSettings.reverseSSHCommand, 
						function(result) {
							self.socketBase.emit('bot-forward-text', result);
						});
			} else {
				self.socketBase.emit('bot-forward-text', "Invalid command given " + data);
			}
		});
    }

    /*
     * Set all the notifications that can come from, say the telegram api.
     * The only options that works in this piece of code is the IP Camera image fetching.
     * I have left the configs of telegram inline keyboard as is and you can remove/add/adapt them
     * to your requirements.
     */ 
    self.initThreadNotifiers = function() {
		crossMessageNotifier.on('telegram-to-main-cams', function(data, chatid) {
			console.log("telegram-to-main-cams = " + data + " from " + chatid);

			self.handleRequest(chatid, data, function(data2) {
				console.log("DATA2 >> " + JSON.stringify(data2));
			});
		});

		/* examples
		crossMessageNotifier.on('telegram-to-main-local-relays' ...... );
		crossMessageNotifier.on('telegram-to-main-sensors-1' ...... );
		crossMessageNotifier.on('telegram-to-main-home-bell' ...... ); ETC
    	*/
    }

    self.disableChokidar = function() {
    	self.watcher.close().then(() => console.log('chokidar watcher closed'));
    }

    self.setupChokidar = function(caller, onAddCallback) {
    	//Delete all the files in the target directory

		const { exec } = require('child_process');
		exec('rm -rf ' + self.config.chokidar.watchedFolder, (err, stdout, stderr) => {
			  if (err) {
			    console.log("Couldnt delete chokidar folder: " + self.config.chokidar.watchedFolder);
			    return;
			  }
			  var createFolderCmd = "mkdir -p " + self.config.chokidar.watchedFolder;
			  exec(createFolderCmd, (err, stdout, stderr) => {
			  		if (err) {
			  			console.log("Couldnt create chokidar folder");
			  			return;
			  		}
			  });
		});      	
		// Initialize watcher.
		self.watcher = chokidar.watch('file, dir, glob, or array', {
		  ignored: /(^|[\/\\])\../,
		  persistent: true
		});

		// Something to use when events are received.
		var log = console.log.bind(console);

		// More possible events.
		self.watcher
		  .on('addDir', path => log(`Directory ${path} has been added`))
		  .on('unlinkDir', path => log(`Directory ${path} has been removed`))
		  .on('error', error => log(`Watcher error: ${error}`))
		  .on('ready', () => log('Initial scan complete. Ready for changes(' + caller + ')'))
		  .on('raw', (event, path, details) => {
		    log('Raw event info:', event, path, details);
		  });

		// 'add', 'addDir' and 'change' events also receive stat() results as second
		// argument when available: http://nodejs.org/api/fs.html#fs_class_fs_stats

		self.watcher.on('change', (path, stats) => {
		  if (stats) console.log(`File ${path} changed size to ${stats.size}`);
		});

		self.watcher.on('add', (path) => {
			log(`File ${path} has been added`);
			if (onAddCallback) {
				onAddCallback(path);
			}
			if (self.socketBase != null && self.isSocketConnectedAndInitialized == 1) {
				self.socketBase.emit('bot-forward-text', `File ${path} has been added`);
				self.sendMotionCaptureImages(path);
			}
		});

		self.watcher.on('unlink', (path) => {
		  log(`File ${path} has been removed`);
		});

		// Watch new files.
		self.watcher.add(self.config.chokidar.watchedFolder);
    }

    self.initialize = function() {
    	self.LoadConfig();
    	self.connectToSocketIOServer();
    	if (self.config.chokidar.enabled) {
	    	self.setupChokidar('sampleApp', function(result) {

	    	});
    	}

    	self.initThreadNotifiers();

		crossMessageNotifier.on('cron-to-main-thread', function(data) {
			console.log("cron-to-main-thread = " + data);
			if (self.socketBase != null) {
				self.socketBase.emit('bot-forward-text', data);
			}
		});
		

		cron.init();
		cron.set_notification_handlers(crossMessageNotifier);
		cron.start_cron_jobs();

		TelegramBot.init();
		TelegramBot.set_notification_handlers(crossMessageNotifier);
    }

    self.isConnected = function(callback) {
		internetAvailable({
		    timeout: 5000,
		    retries: 5
		}).then(() => {
		    callback(true);
		}).catch(() => {
		    callback(false);
		});
    }

    self.go_figure = function(rC)
    {
        ticker++;
        rC(ticker);
      
        setTimeout(function(s) {
                return function () {
                   self.go_figure(s);
                }
        }(rC), 120000);    
    }

    self.figure_loop = function()
    {
        self.go_figure(function(count) {
            /* Every one hour */
            if (count % 30 == 0) {

            }
        });                
    }
};

var GetNewInstance = function () {
	return new SampleApp();
}

module.exports.GetNewInstance = GetNewInstance;
