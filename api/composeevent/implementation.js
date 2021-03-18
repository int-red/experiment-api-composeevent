
var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { MailUtils } = Components.utils.import("resource:///modules/MailUtils.jsm");

const EXTENSION_ID = 'testextension@example.com';


var composeevent = class extends ExtensionCommon.ExtensionAPI {
    getAPI(context) {
        return {
            composeevent: {
                onAfterSend: new ExtensionCommon.EventManager({
                    context,
                    name: "composeevent.onAfterSend",
                    register(fire) {
                        function callback(messageId) {
                            return fire.async(messageId);
                        }

                        sendEmailListener.add(callback, context);
                        return function () {
                            sendEmailListener.remove(callback);
                        };
                    },
                }).api(),
            }
        }
    }
}

// A helpful class for listening to windows opening and closing.
// (This file had a lowercase E in Thunderbird 65 and earlier.)
var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");

// This object is just what we're using to listen for toolbar clicks. The implementation isn't
// what this example is about, but you might be interested as it's a common pattern. We count the
// number of callbacks waiting for events so that we're only listening if we need to be.
var sendEmailListener = new class extends ExtensionCommon.EventEmitter {
    constructor() {
        super(); // calls the parent constructor.
        this.callbackCount = 0;
    }

    add(callback, context) {
        this.callbackCount++;

        if (this.callbackCount == 1) {
            ExtensionSupport.registerWindowListener(EXTENSION_ID, {
                chromeURLs: [
                    "chrome://messenger/content/messengercompose/messengercompose.xhtml",
                    "chrome://messenger/content/messengercompose/messengercompose.xul",
                ],
                onLoadWindow: function (window) {

                    //can not set gMsgCompose.addMsgSendListener here, because gMsgCompose is still null
                    //we have to wait for event "compose-window-init" and set gMsgCompose.addMsgSendListener there

                    console.log("messengercompose onLoadWindow", window);
                    sendListener.context = context;
                    sendListener.window = window;
                    sendListener.callback = callback;
                    window.addEventListener("compose-window-init", sendListener.composeWindowOnWindowInit, true);
                },
            });
        }
    }

    remove(callback) {
        this.callbackCount--;

        if (this.callbackCount == 0) {
            for (let window of ExtensionSupport.openWindows) {
                if ([
                    "chrome://messenger/content/messengercompose/messengercompose.xhtml",
                    "chrome://messenger/content/messengercompose/messengercompose.xul",
                ].includes(window.location.href)) {
                    //let toolbox = window.document.getElementById("mail-toolbox");
                    //toolbox.removeEventListener("click", this.handleEvent);
                }
            }
            ExtensionSupport.unregisterWindowListener(EXTENSION_ID);
        }
    }


};

//This function gets the Webextention API MessageHeader from a Message-ID, for example: <950124.162336@example.com>
async function GetMessageHeader(aMessageID, aFolderURI, context) {
    console.log("GetMessageHeader: function (aMessageID, aFolderURI, context):", aMessageID, aFolderURI, context);

    //get nsIMsgFolder from a Folder URI
    let folder = MailUtils.getExistingFolder(aFolderURI);
    console.log("folder:", folder);

    //nsIMsgSendListener onStopSending(aMsgID,..
    //has the Message-ID in brackets <> but getMsgHdrForMessageID needs the Message-ID without brackets <>
    // pattern: remove brackets
    let aMessageID_stripped = aMessageID.replace(/^<|>$/g, "");
    console.log("aMessageID_stripped:", aMessageID_stripped);

    return new Promise((resolve, reject) => {
        //https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIDBChangeListener
        let msgDatabaseListener = { //nsIDBChangeListener 
            onHdrFlagsChanged: function (aHdrChanged, aOldFlags, aNewFlags, aInstigator) { },
            onHdrDeleted: function (aHdrChanged, aParentKey, aFlags, aInstigator) { },
            onHdrAdded: function (aHdrChanged, aParentKey, aFlags, aInstigator) {
                //console.log("onHdrAdded:", aHdrChanged, aParentKey, aFlags, aInstigator);

                //get nsIMsgDBHdr from a Message-ID
                let msgHdr = folder.msgDatabase.getMsgHdrForMessageID(aMessageID_stripped);
                //console.log("nsIMsgDBHdr:", msgHdr);
                if ((msgHdr == null) || (msgHdr == undefined)) {
                    reject(msgHdr);
                }

                //msgHdr was found - remove event listener
                folder.msgDatabase.RemoveListener(this);
                console.log("GetMessageHeader - RemoveListener(this)");

                console.log("GetMessageHeader - nsIMsgDBHdr:", msgHdr);

                //get the Webextention API MessageHeader from a nsIMsgDBHdr
                let messageHeader = context.extension.messageManager.convert(msgHdr);
                if ((messageHeader == null) || (messageHeader == undefined)) {
                    reject(messageHeader);
                }
                console.log("GetMessageHeader - Webextention API MessageHeader:", messageHeader);

                resolve(messageHeader);

            },
            onParentChanged: function (aKeyChanged, oldParent, newParent, aInstigator) { },
            onAnnouncerGoingAway: function (aInstigator) { },
            onReadChanged: function (aInstigator) { },
            onJunkScoreChanged: function (aInstigator) { },
            onHdrPropertyChanged: function (aHdrToChange, aPreChange, aStatus, aInstigator) { },
            onEvent: function (aDB, aEvent) { console.log("onEvent:", aDB, aEvent); },

            QueryInterface: function (aIID) {
                if (!aIID.equals(Components.interfaces.nsIDBChangeListener) &&
                    !aIID.equals(Components.interfaces.nsISupports))
                    throw Components.results.NS_ERROR_NO_INTERFACE;
                return this;
            }
        };

        //add listener to get notified when the new mail is available in the msgDatabase of the Sent-folder
        folder.msgDatabase.AddListener(msgDatabaseListener);
        console.log("GetMessageHeader - AddListener(msgDatabaseListener)");
    });


}


var sendListener = {
    sentMsgID: null,
    //reference to event callback function
    callback: null,
    //reference to extension context
    context: null,
    //reference to compose window
    window: null,
    //This is called when the var gMsgCompose is init.
    composeWindowOnWindowInit: function (e) {

        if (this.window != null) {
            //Event "compose-window-init" was called - remove event listener
            this.window.removeEventListener("compose-window-init", this.composeWindowOnWindowInit);

            if (this.window.gMsgCompose != null) {
                this.window.gMsgCompose.addMsgSendListener(sendListener);
                console.log("composeWindowOnWindowInit - addMsgSendListener(sendListener)");
            }
            else
                console.error("composeWindowOnWindowInit - failed to add sendListener, this.window.gMsgCompose is null: ", this.window.gMsgCompose);
        }
        else
            console.error("composeWindowOnWindowInit - failed to add sendListener, this.window is null: ", this.window);
    },

    // nsIMsgSendListener
    onStartSending(aMsgID, aMsgSize) {  // Parameters are always empty!
    },
    onProgress(aMsgID, aProgress, aProgressMax) {  // onProgress function never gets called!
    },
    onStatus(aMsgID, aMsg) {  // onStatus function never gets called!
    },
    //The OnStopSending interface is called when the sending operation has completed.
    //This will be called in the case of both success and failure.
    onStopSending(aMsgID, aStatus, aMsg, aReturnFile) {
        console.log("onStopSending:", aMsgID, aStatus, aMsg, aReturnFile);

        if (aStatus == 0) { //success
            this.sentMsgID = aMsgID;
        }
        else {
            this.sentMsgID = null;

            console.error("Sending eMail failed (onStopSending)! MessageID: ", aMsgID);

			//callback failure
            this.callback(-1);
        }
    },
    // onGetDraftFolderURI gets called after onStopSending. aFolderURI has the Sent-Folder URI where the sent mail got copied to.
    onGetDraftFolderURI(aFolderURI) {
        console.log("onGetDraftFolderURI:", aFolderURI);

        if ((this.sentMsgID == null) || (this.sentMsgID == undefined)) {
            console.error("Sending eMail failed (onGetDraftFolderURI)! MessageID: ", this.sentMsgID);
			//callback failure
            this.callback(-1);
        }

        if (this.context == null) {
            console.error("Sending eMail failed (onGetDraftFolderURI)! context: ", this.context);
			//callback failure
            this.callback(-1);
        }

        // get the Webextention API MessageHeader from a MsgID:
        GetMessageHeader(this.sentMsgID, aFolderURI, this.context)
            .then((response) => {

                console.log("MessageHeader from MsgID:", response);

                //callback success
                this.callback(response.id);

            });

    },
    onSendNotPerformed(aMsgID, aStatus) {
        console.log("bad send! send failed or was cancelled. MessageID: ", aMsgID);

        //callback failure
        this.callback(-1);
    },
};
