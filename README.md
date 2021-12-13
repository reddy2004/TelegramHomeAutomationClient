# TelegramHomeAutomationClient

Use telegram for home automation.

![alt text](https://github.com/reddy2004/TelegramHomeAutomationClient/blob/main/screenshot/telegram.jpeg)

I use this code to control devices on my home network. Mostly relays controlling lights, water pumps and to fetch screen shots of IP cameras when certain activity is detected. Ex When someone rings a bell or the IP Camera detects motion.

I have stripped off all the code that is actually used in my network as it wouldnt make much sense elsewhere. I have left only the IP Cameras screenshot fetching and the code required to create an inline keyboard in telegram.

You can use this code as a scaffolding and impliment additional features as you wish.


Telegram runs in poll mode as my network is behind NAT. You can also run in webhook mode. Please see the config.json file.
