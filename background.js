

// We defined this event in our schema.
messenger.composeevent.onAfterSend.addListener(async function (messageId) {
	// do something interesting here with messageId.

	if (messageId == -1) 
		return;

	messenger.messages.get(messageId).then((messageheader) => {

		if (messageheader == null) {
			console.error("messenger.messages.get(messageId) returned messageheader: null! This should not happen!");
			//seems to be a bug in Thunderbird
			//this happens for example while Thunderbird is busy synchronizing an IMAP folder with the server
			//or when the Sent folder is selected in Mailview

			//TODO Fehlermeldung an den Benuzter
			return;
        }

		//so something with messageheader

	});


});

