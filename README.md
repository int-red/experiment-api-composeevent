# experiment-api-composeevent
 
The Thunderbird Webextension API "compose" already has an event "onBeforeSend"
https://thunderbird-webextensions.readthedocs.io/en/78/compose.html#onbeforesend-tab-details

This Experiment API adds an event "onAfterSend" that is called when the sending of an email from the compose window was completed.
It returns the messageId of the sent email in the Sent folder.
The messageId then can be used to further process the sent email.
