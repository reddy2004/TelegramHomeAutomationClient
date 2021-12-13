/*
 * Very specific to my modem. Please feel free to remove this code
 */
var notifier;

var internetAvailable = require("internet-available");

var login_cmd = "curl \"http://192.168.1.3/login.cgi\"   -H \"Connection: keep-alive\"   -H \"Cache-Control: max-age=0\"   -H \"Upgrade-Insecure-Requests: 1\"   -H \"Origin: http://192.168.1.3\"   -H \"Content-Type: application/x-www-form-urlencoded\"   -H \"User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36\"   -H \"Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9\"   -H \"Referer: http://192.168.1.3/login.htm\"   -H \"Accept-Language: en-US,en;q=0.9\"   -H \"Cookie: SessionID=\"   --data \"username=Admin&password=&submit.htm%3Flogin.htm=Send\" --insecure";
var set_repeater_cmd = "curl \"http://192.168.1.3/form2RepeaterSetup.cgi\"   -H \"Connection: keep-alive\"   -H \"Cache-Control: max-age=0\"   -H \"Upgrade-Insecure-Requests: 1\"   -H \"Origin: http://192.168.1.3\"   -H \"Content-Type: application/x-www-form-urlencoded\"   -H \"User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36\"   -H \"Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9\"   -H \"Referer: http://192.168.1.3/wlrepeater.htm\"   -H \"Accept-Language: en-US,en;q=0.9\"   -H \"Cookie: SessionID=\"   --data \"RepeaterMode=on&RepeaterSSID=ABCJIO&WifiSecurity=&startScanUplinkAp=0&save=Apply&submit.htm%3Fwlrepeater.htm=Send\" --insecure";
var isReverseTunnelSetup = false;
var reverseSSHCommandForVNC = "ssh -i id_rsa -N -R 5901:localhost:6200 root@<yourpublicip>";
var init = function () {
    console.log("Init cron jobs 2");
}

var isConnected = function(callback) {
	internetAvailable({
	    timeout: 5000,
	    retries: 5
	}).then(() => {
	    callback(true);
	}).catch(() => {
	    callback(false);
	});
}

var connectModemIfNoInternet = function () {
    setTimeout(function (s) {
        return function () {
	    	isConnected(function(result) {
	    		if (result == false) {
	    			console.log("Internet is *NOT* working!");
	    			const { exec } = require('child_process');
	    			console.log(login_cmd);
					exec(login_cmd, (err, stdout, stderr) => {
						console.log(`stdout: ${stdout}`);
						if (err) {
						    console.log("Failed to do login to router");
						} else {
							console.log(set_repeater_cmd);
							exec(set_repeater_cmd, (err, stdout1, stderr1) => {
								//dont care, modem will restart.
								console.log(`stdout: ${stdout1}`);
								if (err) {
									console.log("Failed to set repeater on router");
								}
							});
						}
					});
	    		} else {
	    			console.log("Internet is working!");
	    		}
	    	});
            notifier.emit('cron-to-main-thread', "internetCheck done! connected!");
            connectModemIfNoInternet(s);
        }
    }(), 3600000);    
}


var heartBeat = function () {
    setTimeout(function (s) {
        return function () {
            //Emit a message
            notifier.emit('cron-to-main-thread', "Sending 60 min heartbeat");
            heartBeat(s);
        }
    }(), 3600000);    
}

/*
 * A reverse SSH tunnel allows you to forward a port on your public server (public facing ip) to a local device
 * on your network (ex. a raspberry pi where you are running this code).
 * With a reverse SSH then you could connect to your raspberry pi via your public server. All connects to the 
 * configured port on your public server will be forwarded to a local port on your raspberry pi.
 */
var autoSSHReverseTunnel = function() {
	//TODO - cmmand requires password for id_rsa on windows
	if (isReverseTunnelSetup == true) {
		//Check if tunnel is present or not and set flag accordingly
	} else {
		const { exec } = require('child_process');
		exec(reverseSSHCommandForVNC, (err, stdout, stderr) => {
			console.log(`stdout: ${stdout}`);
			if (err) {
			    console.log("Failed to setup reverseSSHCommandForVNC");
			    notifier.emit('cron-to-main-thread', "FAILED: " + reverseSSHCommandForVNC);
			} else {
				notifier.emit('cron-to-main-thread', "Setup reverse ssh " + reverseSSHCommandForVNC);
			}
		});
		isReverseTunnelSetup = true;
	}
}

var start_jobs = function () {
    heartBeat();
    //connectModemIfNoInternet();
    autoSSHReverseTunnel();
}

var set_notification_handlers = function (crossMessageNotifier) {
    notifier = crossMessageNotifier;
    notifier.emit('cron-to-main-thread', "Starting local cron jobs");
}

/* Use simple setTimeouts to get work done! */
module.exports.init = init;
module.exports.start_cron_jobs = start_jobs;
module.exports.set_notification_handlers = set_notification_handlers;