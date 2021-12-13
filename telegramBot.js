/**
 * This example demonstrates setting up a webook, using a
 * self-signed certificate.
 */
var https = require('https');
var fs = require('fs');
var async = require('async');
var EventEmitter = require('events')
var vikramsTelegramId = 0;
var notifier;
var HashMap = require('hashmap');

const TOKEN = '<your bot token>';
const TelegramBot = require('node-telegram-bot-api');

var array = fs.readFileSync('config.json').toString();
var inlineKeyboards = JSON.parse(array).telegram.inlineKeyboards;

var notifier = null;
const port = 8443;
const isPollingType = true;

const options = {
    webHook: {
        port: 8443,
        key: 'key.pem', // Path to file with PEM private key
        cert: 'cert.pem' // Path to file with PEM certificate
    }
};
// This URL must route to the port set above (i.e. 8443) when we want a webhook
const url = 'https://nightfoxsecurity.com:8443';
var bot = null;

//Returns a hashmap of code to value
//Ex {NFOX} -> Nightfox_10001 etc
var codingComparator = function (coded, passed) {
    var counter = 0;
    var coding = new HashMap();
    for (var i = 0; i < coded.length; i++) {
        if (coded[i].indexOf("{") == 0 && coded[i].indexOf("}") == coded[i].length - 1) {
            coding.set(coded[i], passed[i]);
            console.log("SET :" + coded[i] + " -> " + passed[i]);
            counter++
        } else if (coded[i].indexOf(passed[i]) == 0) {
            counter++;
        } else {

        }
    }
    if (counter == coded.length && coding.size > 0) return coding;
    else return null;
}

var replaceAll = function(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

var transformDisplay = function (displayString, coding) {
    console.log("Entering transform display: " + displayString);
    var finalString = displayString;
    for (var entry of coding.entries()) {
        finalString = finalString.replace(entry[0], entry[1]);
        //finalString = replaceAll(finalString, entry[0], entry[1]);
        console.log(finalString + "(" + entry[0] + " -> " + entry[1] + ")");
    }
    console.log("Leaving transform display:" + finalString);
    return finalString;
}
var transformKeyboard = function (origKB, coding) {
    console.log("Entering transformKeyboard: " + JSON.stringify(origKB));
    //Deep copy
    var currentKB = JSON.parse(JSON.stringify(origKB));
    for (var i = 0; i < currentKB.length; i++) {
        var singleKB = currentKB[i];
        for (var j = 0; j < singleKB.length; j++) {
            var currString = singleKB[j].callback_data; 
            for (var entry of coding.entries()) {
                console.log(currString);
                currString = currString.replace(entry[0], entry[1]);
               // currString = replaceAll(currString, entry[0], entry[1]);
            }
            currentKB[i][j].callback_data = currString;
        }
    }
    console.log("Leaving transformKeyboard: " + JSON.stringify(currentKB));
    return currentKB;
}

var sendInlineKeyboard = function (kbCode, chatid, bot) {
    console.log("Searching for keyboard");
    for (var entry of inlineKeyboards.entries()) {
        var kboption = entry[1];
        console.log(kboption.code + " with " + kbCode + " enc:" + kboption.encoded + " compr:" + kboption.code.indexOf(kbCode));

        if (kboption.encoded) {
            console.log("Dropping in if for " + kbCode);
            var coded = kboption.code.split("/");
            var passed = kbCode.split("/");
            console.log(coded);
            console.log(passed);
            if (coded.length == passed.length) {
                var coding = codingComparator(coded, passed);

                if (coding != null) {
                    var transformedDisplay = transformDisplay(kboption.display, coding);
                    var transformedKeyboard = transformKeyboard(kboption.keyboard, coding);
                    bot.sendMessage(chatid, transformedDisplay, {
                        "reply_markup": {
                            "inline_keyboard": transformedKeyboard
                        }
                    });
                } else {
                    return false; //asumming end of tree
                }
                return true;
            }
        } else {
            console.log("Dropping to else for " + kbCode);
            if (kboption.code.indexOf(String(kbCode)) == 0) {
                console.log(kboption.keyboard);
                bot.sendMessage(chatid, kboption.display, {
                    "reply_markup": {
                        "inline_keyboard": kboption.keyboard
                    }
                });
                return true;
            }
        }
    }
    return false;
}

var init = function () {

    console.log("Loading config");
    var fs = require('fs');
    var array = fs.readFileSync('config.json').toString();
    
    var config = JSON.parse(array);
    vikramsTelegramId = config.telegram.personalTelegramId;

    console.log("config = " + JSON.stringify(inlineKeyboards));
    if (isPollingType == true) {
        bot = new TelegramBot(TOKEN, { polling: true });
        bot.sendMessage(vikramsTelegramId, "Started [Polling] Telegram Bot @HomeClient");
    } else {
        bot = new TelegramBot(TOKEN, options);
        // This informs the Telegram servers of the new webhook.
        bot.setWebHook(`${url}/bot${TOKEN}`, {
            certificate: options.webHook.cert,
        });

        bot.sendMessage(vikramsTelegramId, "Started [Webhook] Telegram Bot @HomeClient");
    }

    bot.on('message', msg => {
        console.log(msg);
    });

    bot.on("polling_error", msg => {
        console.log(msg);
    });

    bot.on("callback_query", function onCallbackQuery(callbackQuery) {
        console.log("query: ", callbackQuery);
        if (!sendInlineKeyboard(callbackQuery.data, callbackQuery.message.chat.id, bot)) {
            //We have understood the command now. Pass it on to main.
            console.log("... We have to process command...." + callbackQuery.data);
            if (callbackQuery.data.indexOf("/cams/snapshot/") == 0) {
                bot.sendMessage(callbackQuery.message.chat.id, "Processing..");
                notifier.emit('telegram-to-main-cams', callbackQuery.data, callbackQuery.message.chat.id);
            } else {
                bot.sendMessage(callbackQuery.message.chat.id, "Command: " + callbackQuery.data + " not known");
            }
        } else {
            //We have sent the keyboard options to the chat. Dont do anything here
        }
    });

    bot.onText(/\/start/, (msg) => {
        bot.sendMessage(msg.chat.id, "Sending 1st level options");
        sendInlineKeyboard("/start", msg.chat.id, bot);
    });
}

var send_message = function(messageText) {
    bot.sendMessage(vikramsTelegramId, messageText);
}

var set_notification_handlers = function (eventsObject) {
    notifier = eventsObject;
    notifier.on('main-to-telegram', function (data) {
        console.log("main-to-telegram" + JSON.stringify(data));
        bot.sendMessage(vikramsTelegramId, JSON.stringify(data));
    });

    notifier.on('main-to-telegram-cams', function (chatid, urlList) {
        if (chatid == 0) {
            //This was not initiated from a telegram rquest.
            return;
        }
        async.mapSeries(urlList,
            function(url, callback_i)
            {
                console.log("Sending image via telegram " + url + " to chatid " + chatid);
                if (fs.existsSync( url )) {
                    bot.sendPhoto(chatid, url).then(function(){
                        fs.unlink(url, function(){});
                    });
                    callback_i(null, url);
                } else {
                    callback_i(null, url);
                }
            },
            function(err, results) {

            }
        );   
    });
}


/* Telegram Bot powered by node-telegram-bot-api */
module.exports.init = init;
module.exports.send_message = send_message;
module.exports.set_notification_handlers = set_notification_handlers;