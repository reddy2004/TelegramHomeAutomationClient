const onvif = require('node-onvif');
var async = require('async');
const fs = require('fs');
var HashMap = require('hashmap');
var jimp = require('jimp');
var self = this;
var static_cam_map = new HashMap();
var static_map = new HashMap();

var LoadAllIPCameraList = function() {
	var jsonFile = fs.readFileSync('ipcams.json').toString();
    var array = JSON.parse(jsonFile).list;
    var mapper = JSON.parse(jsonFile).mapper;

	for (let key in array) {
	   if (array.hasOwnProperty(key)) {
	       static_cam_map.set(array[key]["alias"], array[key]);
	       console.log("Cam [ " + array[key].alias + "] " + array[key].ip);
	   }
	}

	for (let key in mapper) {
	   if (mapper.hasOwnProperty(key)) {
	       console.log("MAP [ " + mapper[key].length + "]" + key);
	       static_map.set(key, mapper[key]);
	   }
	}
}

var CurrentCamListSize = function() {
	console.log("CurrentCamListSize = " + curr_cam_list.length);
	return curr_cam_list.length;
}

var LoadCamerasForGroup = function(whichcameras) {
	curr_cam_list = [];
	//var whichCams = whichcameras.substring(1, whichcameras.length);
	console.log("LoadCamerasForGroup : " + whichcameras);
	var aliases = static_map.get(whichcameras);
	console.log(aliases);
	if (aliases != undefined) {
		aliases.forEach(function (item, index) {
		  	curr_cam_list.push(static_cam_map.get(item))
		});
	}
}

var ForwardSnapshotsOverSocketIO = function(socketBase, saveToFile, sCallback) {
	console.log("Entering ForwardSnapshotsOverSocketIO : " + curr_cam_list);
    async.reduce(["dump_snapshots"], {error : 'SUCCESS'}, 
        function(memo, item, callback) {
			if (item == "dump_snapshots") {
				var i = 1;
				async.map(curr_cam_list,
					function(url, callback_i)
					{
						var filePathLocal = 'images/' + i + '.jpg';
						console.log("filePathLocal = " + filePathLocal);
						var pxaddr = 'http://' + url.ip + ':' + url.port + '/onvif/device_service';
						console.log(pxaddr);
						if (socketBase != null) {
							socketBase.emit('bot-forward-text', "Fetching [" +saveToFile+ "] " + pxaddr);
						}

						self.ipCamSnapShot(pxaddr, (saveToFile == true) ? filePathLocal : null, 
								url.xscale, url.yscale, function(fileName, buffer) {
							if (socketBase != null) {
								if (fileName != filePathLocal) {
									socketBase.emit('bot-forward-text', "Error " + pxaddr + "," + fileName);
								} else {
									socketBase.emit('bot-raw-forward-snapshot', buffer);
								}
							}
							callback_i(null, filePathLocal);
						});
						
						i++;
					},
					function(err, results) {
						console.log(results);
						filepathlist =  (saveToFile == true)? results : [];
						callback(null,  {error : 'SUCCESS'});
					}
				);   				
            } else {
                callback(null, {error : 'FAILED'});
            }
        }, function(err, result) {
            //Return sucess cos we dont know how to handle error
            console.log("Async function is done!");
            sCallback(filepathlist);
    	});
}

/*
 * to be called from main 'thread'
 */
var StartCapture = function(whichcam, socketBase, sCallback) {
	self.LoadAllIPCameraList();
	self.LoadCamerasForGroup(whichcam);
	self.ForwardSnapshotsOverSocketIO(socketBase, true, sCallback);
}

var fileToImageBuffer = function(filepath, callback) {
	jimp.read(filepath, (err, lenna) => {
	  if (err) throw err;
	  lenna.getBuffer(jimp.MIME_PNG, (err, buffer) => {
	  		if (err) {
	  			callback("", null);
	  		} else {
				callback(filepath, buffer);
			}
		});
	});	
}

/*
 * Dumps asynchronously, callback is called after completion
 */
var ipCamSnapShot = function(deviceAddr, fileName, xscale, yscale, callback) {
    // Create an OnvifDevice object
    let device = new onvif.OnvifDevice({
        xaddr: deviceAddr,
        user : 'admin',
        pass : ''
    });

	device.init().then(() => {
		console.log("trying > " + fileName);
	  return device.fetchSnapshot();
	}).then((res) => {
		jimp.read(res.body).then (img => {
			console.log("ipCamSnapShot > " + fileName);
			img.resize(xscale, yscale).writeAsync(fileName);
			img.getBuffer(jimp.MIME_PNG, (err, buffer) => {
				callback(fileName, buffer);
			});
			if (fileName != null) {
				img.write(fileName, function() {});
			}
  		});
	}).catch((error) => {
		console.log("failed > " + deviceAddr +  " " + error);
		callback(null, "<empty>");
	});
}

module.exports.StartCapture = StartCapture;
module.exports.ipCamSnapShot = ipCamSnapShot;
module.exports.LoadAllIPCameraList = LoadAllIPCameraList;
module.exports.LoadCamerasForGroup = LoadCamerasForGroup;
module.exports.CurrentCamListSize = CurrentCamListSize;
module.exports.ForwardSnapshotsOverSocketIO = ForwardSnapshotsOverSocketIO;
module.exports.fileToImageBuffer = fileToImageBuffer;