/*
 * Test snippets, to test the logic works correctly in your environment.
 * Use this to test all cases, such as presence of cameras, nfs and cifs shares
 * network connections, folder paths, escape sequences etc. 
 * For the environment, and in the environment that you
 * will deploy this code.
 */
var assert = require('assert');
var SampleApp = require('./sampleApp.js');
const onvif = require('node-onvif');
var async = require('async');
var OnvifHelper = require('./onvif.js');
const fs = require('fs');

var networkCams = [];

var TestSnippets = function() {
	var self = this;

    //To catch issues if you change config inadvertantly
    self.TestLoadConfig = function() {
    	var zapp = SampleApp.GetNewInstance();
    	zapp.LoadConfig();

		assert(zapp.config.remoteSocketIO.server == "http://nightfoxsecurity.com:8443");
		assert(zapp.config.remoteSocketIO.secretKey == "asdfoubaosdfasdflasjdflkenrwseae");
        assert(zapp.config.remoteSocketIO.enabled == true);

		assert(zapp.config.localCifsMount.enabled == true);
		assert(zapp.config.localCifsMount.server == "\\\\192.168.1.151\\Air-Disk\\");
		assert(zapp.config.localCifsMount.username == "Vikrama");
		assert(zapp.config.localCifsMount.password == "Reddy");
		assert(zapp.config.localCifsMount.command == "sudo mount -t cifs //192.168.1.151/AirDisk-A CIFS/ -o user=AirDisk,sec=ntlm,vers=1.0");
        assert(zapp.config.localCifsMount.folderPath == "CIFS");

		assert(zapp.config.localNFSMount.enabled == true);
		assert(zapp.config.localNFSMount.server == "\\\\192.168.1.151\\Air-Disk\\");
		assert(zapp.config.localNFSMount.username == "Vikrama");
		assert(zapp.config.localNFSMount.password == "Reddy");
		assert(zapp.config.localNFSMount.command == "sudo mount -f etc");
        assert(zapp.config.localNFSMount.folderPath == "NFS");

        assert(zapp.config.chokidar.enabled == true);
        assert(zapp.config.chokidar.watchedFolder == "FTP2\\");
        assert(zapp.config.chokidar.deleteAfterTransfer == true);
        assert(zapp.config.chokidar.shouldCopyToCifsShare == false);
        assert(zapp.config.chokidar.shouldCopyToNFSShare == false);

        //todo assert for environment settings.
    }

    self.TestCIFSMounting = function() {
    	var zapp = SampleApp.GetNewInstance();
    	zapp.LoadConfig();
    	if (zapp.config.localCifsMount.enabled && zapp.config.environmentSettings.os == "unix") {
    		console.log("self.cifsCommand :" + zapp.config.localCifsMount.command);
    		const { exec } = require('child_process');
    		exec(zapp.config.localCifsMount.command);
    		//Check folder is empty, or assert.
    		//Mount the folder
    		//Check folder is not empty, else assert.
    		//Unmount the folder
    	}
    }

    self.TestScanNetwork = function() {
		console.log('Start the discovery process.');
		// Find the ONVIF network cameras.
		// It will take about 3 seconds.
		onvif.startProbe().then((device_info_list) => {
		    console.log(device_info_list.length + ' devices were found.');
		    console.log("Testing devices that actually support snapshot feature. jpg images will be created for devices that support this feature");
		    // Show the device name and the URL of the end point.
		    device_info_list.forEach((info) => {
		        console.log('- ' + info.urn);
		        console.log('  - ' + info.name);
		        console.log('  - ' + info.xaddrs[0]);
		        networkCams.push(info.xaddrs[0]);

		        var idx1 = info.xaddrs[0].toString().indexOf("://");
		        var idx2 = info.xaddrs[0].toString().lastIndexOf(":");
		        var ipAddr = info.xaddrs[0].toString().substring(parseInt(idx1) + 3, parseInt(idx2));
		        OnvifHelper.ipCamSnapShot(info.xaddrs[0], "TEMP/PIC" + ipAddr + ".jpg",
		        		1280, 720, function(fileName, buffer) {

		        		});
		    });
		    console.log("Found cameras:" + JSON.stringify(networkCams));
		}).catch((error) => {
		  
		});            		
    }

    self.TestSocketIOConnection = function() {
    	var zapp = SampleApp.GetNewInstance();
    	zapp.LoadConfig();
    	zapp.connectToSocketIOServer();
    	zapp.disconnectFromSocketIOServer(5000, function(status) {
    		console.log("disconnect test status : " + status);
    	});
    }

    self.TestInternetConnection = function() {
    	var zapp = SampleApp.GetNewInstance();
    	zapp.isConnected(function(result) {
    		if (result == false) 
    			assert(!"Internet connection has failed. Please check your network");
    	});
    }

    self.TestChokidar = function() {
    	var zapp = SampleApp.GetNewInstance();
    	zapp.LoadConfig();
    	var fileCreated = 0;
    	zapp.setupChokidar("testSnippets", function(newFilePath) {
    		if (newFilePath == "FTP2\\test.dat") {
    			fileCreated = 1;
    		}
    	});

		fs.appendFile('FTP2\\test.dat', 'Dummy content!', function (err) {
			if (err) assert(!"Could not create a file for TestChokidar");
		});

    	//xxx todo create the file here.
        setTimeout(function() {
        	assert(fileCreated == 1);
        	zapp.disableChokidar();
			fs.unlink('FTP2\\test.dat', function (err) {
			  if (err) assert(!"Failed to delete file create for TestChokidar");
			});
        }, 5000);
    }

    self.TestLoadAllIPCameraList = function() {
		OnvifHelper.LoadAllIPCameraList();
    }

    self.TestLoadCamerasForGroup = function() {
    	OnvifHelper.LoadAllIPCameraList();
    	OnvifHelper.LoadCamerasForGroup("/cams/snapshot/all");
    	assert(OnvifHelper.CurrentCamListSize() == 9);
		OnvifHelper.LoadCamerasForGroup("/cams/snapshot/bell");
    	assert(OnvifHelper.CurrentCamListSize() == 1);
    	OnvifHelper.LoadCamerasForGroup("/cams/snapshot/door");
    	assert(OnvifHelper.CurrentCamListSize() == 1);
    	OnvifHelper.LoadCamerasForGroup("/cams/snapshot/gate");
    	assert(OnvifHelper.CurrentCamListSize() == 2);
    	OnvifHelper.LoadCamerasForGroup("/cams/snapshot/parking");
    	assert(OnvifHelper.CurrentCamListSize() == 2);
    	OnvifHelper.LoadCamerasForGroup("/cams/snapshot/site");
    	assert(OnvifHelper.CurrentCamListSize() == 4);
    	OnvifHelper.LoadCamerasForGroup("/cams/snapshot/back");
    	assert(OnvifHelper.CurrentCamListSize() == 3);
    }

    self.TestForwardSnapshotsOverSocketIO = function() {
    	OnvifHelper.LoadAllIPCameraList();
    	OnvifHelper.LoadCamerasForGroup("/cams/snapshot/all");
    	assert(OnvifHelper.CurrentCamListSize() == 9);
    	var zapp = SampleApp.GetNewInstance();
    	zapp.LoadConfig();
    	zapp.connectToSocketIOServer();
        setTimeout(function() {
	    	var socketBase = zapp.GetSocketObject();
	    	OnvifHelper.ForwardSnapshotsOverSocketIO(socketBase, true, function(flist) {
	    		assert(OnvifHelper.CurrentCamListSize() == flist.length);
		    	zapp.disconnectFromSocketIOServer(60000, function(status) {
		    		console.log("disconnect test status : " + status);
		    	});
	    	});
        }, 3000);
    }

    self.TestSendMotionCaptureImagesNoSocket = function() {
        var zapp = SampleApp.GetNewInstance();
        zapp.LoadConfig();
        zapp.sendMotionCaptureImages("TESTDATA/1.jpg");   
    }

    self.TestSendMotionCaptureImagesWithSocket = function() {
        var zapp = SampleApp.GetNewInstance();
        zapp.LoadConfig();
        zapp.connectToSocketIOServer();        
        zapp.sendMotionCaptureImages("TESTDATA/1.jpg");
        zapp.disconnectFromSocketIOServer(15000, function(status) {
            console.log("disconnect test status : " + status);
        });
    }
};

var testsnippets = new TestSnippets();

testsnippets.TestInternetConnection();
testsnippets.TestLoadConfig();
testsnippets.TestCIFSMounting();
testsnippets.TestScanNetwork();

testsnippets.TestSocketIOConnection();

testsnippets.TestChokidar();
testsnippets.TestLoadAllIPCameraList();
testsnippets.TestLoadCamerasForGroup();
testsnippets.TestForwardSnapshotsOverSocketIO();
testsnippets.TestSendMotionCaptureImagesNoSocket();
testsnippets.TestSendMotionCaptureImagesWithSocket();


//Note: Program wont exit after the tests are complete. Look at the logs and manually terminate "testSnippets.js"