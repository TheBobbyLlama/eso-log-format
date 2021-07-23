var inputArea = document.getElementById("pastedText");
var outputArea = document.getElementById("result");
var resultScroller = document.getElementById("resultScroller");
var timestampOption = document.getElementById("omitTimestamps");
var guildChatOption = document.getElementById("guildChatGM");
var characterGMOption = document.getElementById("characterGM");
var exportButton = document.getElementById("exportFile");

var personaeList = document.getElementById("dramatisPersonae");

var dramatisPersonae;
var logData = [];
var scrollLockout = 0;

function displayFormattedLog() {
	var fileOutput = "";
	outputArea.innerHTML = "";

	for (var i = 0; i < logData.length; i++) {
		var curMarkup = "<p>";

		if (logData[i].message) {
			var curSender = logData[i].sender;
			var curChannel = logData[i].channel;

			if (((curChannel == "guild") && (guildChatOption.checked)) || ((characterGMOption.selectedIndex > 0) && (curSender == characterGMOption.value))){
				curSender = "NARRATOR";
				curChannel = "gmPost";
			}

			// Timestamp
			if ((logData[i].timestamp) && (!timestampOption.checked)) {
				curMarkup += "<span class='timestamp'>" + logData[i].timestamp + "</span> ";
				fileOutput += logData[i].timestamp + " ";
			}

			if (curChannel == "whisper") {
				curMarkup += "<span class='aside'>(privately) </span>";
				fileOutput += "(privately) ";
			}

			// Character name
			if (curSender) {
				curMarkup += "<span class='persona" + dramatisPersonae.indexOf(curSender) + "'>" + curSender + "</span>";
				fileOutput += curSender;
			}

			switch (curChannel) {
				case "emote":
					if ((!logData[i].message.startsWith("'s ")) && (!logData[i].message.startsWith(", "))) {
						curMarkup += " ";
						fileOutput += " ";
					}
					break;
				default:
					curMarkup += ": ";
					fileOutput += ": ";
			}

			// Message
			curMarkup += "<span class='" + curChannel + "'>" + logData[i].message + "</span>";
			fileOutput += logData[i].message;
		}

		outputArea.innerHTML += curMarkup + "</p>";
		fileOutput += "\n";
	}

	if (fileOutput) {
		var today = new Date();
		var year = today.getFullYear().toString();
		var month = (today.getMonth() + 1).toString();
		var day = today.getDate().toString();

		while (month.length < 2) { month = "0" + month; }
		while (day.length < 2) { day = "0" + day; }

		exportButton.setAttribute("href", URL.createObjectURL(new Blob([ fileOutput ], { type: "text/plain" })));
		exportButton.setAttribute("download", year + month + day + "-RP.txt");
		exportButton.className = "button";
	} else {
		exportButton.setAttribute("href", "#");
		exportButton.removeAttribute("download");
		exportButton.className = "button disabled";
	}
}

function processLog(e) {
	var workingList;

	dramatisPersonae = [];
	logData = [];
	personaeList.innerHTML = "";
	characterGMOption.setAttribute("disabled", "disabled");
	characterGMOption.innerHTML = "";

	if (e.target.value) {
		var lines = e.target.value.split("\n");

		// First pass - Try to extract character names from normal /say text.
		lines.forEach(element => {
			var matchMe = element.match(/(\[.*?\] )([\w].+?)(@|:| 's)/);
			
			if ((matchMe) && (matchMe.length == 4) && (matchMe[2].length <= 25) &&  (matchMe[2].indexOf("->") < 0) && (!dramatisPersonae.find(item => item == matchMe[2]))) {
				dramatisPersonae.push(matchMe[2]);
			}
		});

		// Second pass - Try to skim names from emotes.
		workingList = [];
		lines.forEach(element => {
			if (element.length > 8) {
				var curLine = element.substr((element[0] == "[") ? 8 : 0, 26); // Max ESO name length is 25 characters.

				// Starts with "[" - Guild chat.  Starts with "->" - Whisper.
				if ((curLine[0] != "[") && (!curLine.startsWith("->")) && (!dramatisPersonae.find(item => curLine.startsWith(item)))) {
					var found = false;
					
					if (workingList.length) {
						

						for (var i = 0; i < workingList.length; i++) {
							// Spin through the matches.
							for (var x = 0; (x < workingList[i].length) && (curLine[x] != "\"") && (curLine[x] == workingList[i][x]); x++) {}

							if ((x >= 3) && (x < workingList[i].length)) {
									while ((x > 0) && (workingList[i][x] != " ")) { x--; }

									workingList[i] = curLine.substr(0, x).trimEnd();
									found = true;
									break;
							}
						}
					}

					if (!found) {
						workingList.push(curLine);
					}
				}
			}
		});

		// Insert any found names into the main list.
		workingList.forEach(element => {
			if ((element.length < 26) && (!dramatisPersonae.find(item => item == element))) {
				dramatisPersonae.push(element);
			}
		});

		// Sort names, then display to user.
		dramatisPersonae = dramatisPersonae.sort().filter(element => !element.toLowerCase().startsWith("gm") && element.toLowerCase() != "narrator");

		if (dramatisPersonae.length > 0) {
			characterGMOption.removeAttribute("disabled");
			characterGMOption.innerHTML = "<option>-- Nobody --</option>";
		}

		for (var i = 0; i < dramatisPersonae.length; i++) {
			personaeList.innerHTML += "<li class='persona" + i + "'>" + dramatisPersonae[i] + "</li>";
			characterGMOption.innerHTML += "<option>" + dramatisPersonae[i] + "</option>";
		}

		// MAIN PASS - Turn lines into objects.
		lines.forEach(element => {
			var curData = {};

			if (element.length > 10) {
				var matchTimestamp = element.match(/(^\[\d{2}:\d{2}\]) /);
				var timestamp = (matchTimestamp) ? matchTimestamp[0] : "";
				var curLine = element.substr(timestamp.length).split(": ");

				if (timestamp.length) {
					curData.timestamp = timestamp.trimEnd();
				}

				switch(curLine.length) {
					case 0:
						console.log("Invalid chat line!", element);
						break;
					case 1:
						for (var i = 0; i < dramatisPersonae.length; i++) {
							if (curLine[0].startsWith(dramatisPersonae[i])) {
								curData.sender = dramatisPersonae[i];
								curData.message = curLine[0].substr(dramatisPersonae[i].length + 1);
							}
						}

						if (!curData.sender) {
							curData.message = curLine[0];
						}

						curData.channel = (curData.message[0] == "\"") ? "say" : "emote";
						break;
					default:
						curData.sender = curLine.splice(0, 1)[0];
						curData.message = curLine.join(": "); // If we got multiple breakpoints, reassemble the text.

						if ((curData.sender.toLowerCase().startsWith("gm")) || (curData.sender.toLowerCase() == "narrator")) {
							curData.channel = "gmPost";
						} else if (curData.sender.startsWith("[")) {
							curData.channel = "guild";
						} else if (curData.sender.startsWith("->")) {
							curData.channel = "whisper";
						} else {
							curData.channel = "say";
						}

						for (var i = 0; i < dramatisPersonae.length; i++) {
							if (curData.sender.indexOf(dramatisPersonae[i]) > -1) {
								curData.sender = dramatisPersonae[i];
								break;
							}
						}
				}
			}

			logData.push(curData);
		});

		//console.log(logData);
	}

	displayFormattedLog();
}

function clearLockout() {
	scrollLockout = 0;
}

function scrollInput() {
	if (!scrollLockout) {
		scrollLockout = setTimeout(clearLockout, 50);

		var inputHeight = Math.max(inputArea.scrollHeight, inputArea.offsetHeight, inputArea.scrollHeight);
		var outputHeight = Math.max(resultScroller.scrollHeight, resultScroller.offsetHeight, resultScroller.scrollHeight);
		var ratio = inputArea.scrollTop / inputHeight;
		resultScroller.scrollTop = ratio * outputHeight;
	}
}

function scrollOutput() {
	if (!scrollLockout) {
		scrollLockout = setTimeout(clearLockout, 50);

		var inputHeight = Math.max(inputArea.scrollHeight, inputArea.offsetHeight, inputArea.scrollHeight);
		var outputHeight = Math.max(resultScroller.scrollHeight, resultScroller.offsetHeight, resultScroller.scrollHeight);
		var ratio = resultScroller.scrollTop / outputHeight;
		inputArea.scrollTop = ratio * inputHeight;
	}
}

timestampOption.addEventListener("change", displayFormattedLog);
guildChatOption.addEventListener("change", displayFormattedLog);
characterGMOption.addEventListener("change", displayFormattedLog);
exportButton.addEventListener("click", (e) => {
	if (exportButton.className.indexOf("disabled") > -1) {
		e.preventDefault();
	}
});
inputArea.addEventListener("change", processLog);
inputArea.addEventListener("scroll", scrollInput);
resultScroller.addEventListener("scroll", scrollOutput);