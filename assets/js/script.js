const inputArea = document.getElementById("pastedText");
const outputArea = document.getElementById("result");
const resultScroller = document.getElementById("resultScroller");
const timestampOption = document.getElementById("omitTimestamps");
const guildChatOption = document.getElementById("guildChatGM");
const characterGMOption = document.getElementById("characterGM");
const sessionName = document.getElementById("sessionName");
const exportButton = document.getElementById("exportFile");

const personaeList = document.getElementById("dramatisPersonae");

let dramatisPersonae;
let narrator = null;
let logData = [];
let scrollLockout = 0;

// Keys must match element ids
const formatOptions = {
	correctQuotes: true,
}

function setSessionName() {
	const today = new Date();
	const year = today.getFullYear().toString();
	let month = (today.getMonth() + 1).toString();
	let day = today.getDate().toString();

	while (month.length < 2) { month = "0" + month; }
	while (day.length < 2) { day = "0" + day; }

	exportButton.setAttribute("download", year + month + day + "-" + ((sessionName.value) ? sessionName.value : "RP") + ".txt");
}

function displayFormattedLog() {
	let fileOutput = "";
	outputArea.innerHTML = "";

	for (let i = 0; i < logData.length; i++) {
		let curMarkup = "<p>";

		if (logData[i].message) {
			let curSender = logData[i].sender;
			let curChannel = logData[i].channel;
			let curMessage = logData[i].message;

			if ((curChannel == "gmPost") || ((guildChatOption.checked) && (curChannel == "guild")) || ((narrator) && (curSender == narrator))) {
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

			// Double single quote converted to regular double quote.
			if (formatOptions.correctQuotes) {
				curMessage = curMessage.replace(/''/g, "\"");
			}

			switch (curChannel) {
				case "emote":
					if ((curSender) && (!curMessage.startsWith("'s ")) && (!curMessage.startsWith(", "))) {
						curMarkup += " ";
						fileOutput += " ";
					}

					break;
				case "say":
					if (formatOptions.correctQuotes) {
						// Change single quote wrapper to double quote.
						curMessage = curMessage.replace(/^'|'$/g, "\"");

						// If there are no double quotes, wrap the message with them.
						if (!curMessage.match(/"/g)) {
							curMessage = `"${curMessage}"`;
						}
					}
				default:
					curMarkup += ": ";
					fileOutput += ": ";
			}

			// Autocapitalize first letter if it's a quote.
			if ((formatOptions.correctQuotes) && (curMessage[0] === "\"")) {
				curMessage = curMessage.substr(0, 1) + curMessage[1].toUpperCase() + curMessage.substr(2);
			}

			// Message
			curMarkup += "<span class='" + curChannel + "'>" + curMessage + "</span>";
			fileOutput += curMessage;
		}

		outputArea.innerHTML += curMarkup + "</p>";
		fileOutput += "\n\n";
	}

	if (fileOutput) {
		fileOutput = fileOutput.trim();

		exportButton.setAttribute("href", URL.createObjectURL(new Blob([ fileOutput ], { type: "text/plain" })));
		exportButton.className = "button";

		setSessionName();
	} else {
		exportButton.setAttribute("href", "#");
		exportButton.removeAttribute("download");
		exportButton.className = "button disabled";
	}
}

function processLog(e) {
	let workingList;
	let gmMarkup = "";

	dramatisPersonae = [];
	logData = [];
	personaeList.innerHTML = "";
	characterGMOption.setAttribute("disabled", "disabled");
	characterGMOption.innerHTML = "";

	if (e.target.value) {
		const lines = e.target.value.split("\n");

		// First pass - Try to extract character names from normal /say text.
		lines.forEach(element => {
			const matchMe = element.match(/(\[.*?\] (?:@.+\/)?)([\w].+?)(@|:| 's)/);
			
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
			gmMarkup = "<option>-- Nobody --</option>";
		}

		for (var i = 0; i < dramatisPersonae.length; i++) {
			personaeList.innerHTML += "<li class='persona" + i + "'>" + dramatisPersonae[i] + "</li>";
			gmMarkup += "<option"

			if (dramatisPersonae[i] == narrator) {
				gmMarkup += " selected='true'"
			}

			gmMarkup += ">" + dramatisPersonae[i] + "</option>";
		}

		characterGMOption.innerHTML = gmMarkup;

		// MAIN PASS - Turn lines into objects.
		lines.forEach(element => {
			let matchGMPost;
			const curData = {};

			if (element.length > 10) {
				const matchTimestamp = element.match(/(^\[\d{2}:\d{2}\]) /);
				const timestamp = (matchTimestamp) ? matchTimestamp[0] : "";
				const curLine = element.substr(timestamp.length).split(": ");

				if (timestamp.length) {
					curData.timestamp = timestamp.trimEnd();
				}

				switch(curLine.length) {
					case 0:
						console.log("Invalid chat line!", element);
						break;
					case 1:
						for (let i = 0; i < dramatisPersonae.length; i++) {
							if (curLine[0].startsWith(dramatisPersonae[i])) {
								curData.sender = dramatisPersonae[i];
								curData.message = curLine[0].substr(dramatisPersonae[i].length + 1).trim();
							}
						}

						if (!curData.sender) {
							curData.message = curLine[0];
						}

						matchGMPost = curData.message.match(/^(GM:\s*|GM Post:\s*|\[GM\]\s*|\(GM\)\s*|NARRATOR:\s*|\[NARRATOR\]\s*|\|+\s*)(.+)/);

						if ((matchGMPost) && (matchGMPost.length > 2)) {
							curData.channel = "gmPost";
							curData.message = matchGMPost[2];
						} else {
							curData.channel = (curData.message[0] == "\"") ? "say" : "emote";
						}

						break;
					default:
						curData.sender = curLine.splice(0, 1)[0];
						curData.message = curLine.join(": ").trim(); // If we got multiple breakpoints, reassemble the text.

						matchGMPost = curData.message.match(/^(GM:\s*|GM Post:\s*|\[GM\]\s*|\(GM\)\s*|NARRATOR:\s*|\[NARRATOR\]\s*|\|+\s*)(.+)/);

						if ((matchGMPost) && (matchGMPost.length > 2)) {
							curData.channel = "gmPost";
							curData.message = matchGMPost[2];
						} else if ((curData.sender.toLowerCase().startsWith("gm")) || (curData.sender.toLowerCase() == "narrator")) {
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

		const inputHeight = Math.max(inputArea.scrollHeight, inputArea.offsetHeight, inputArea.scrollHeight);
		const outputHeight = Math.max(resultScroller.scrollHeight, resultScroller.offsetHeight, resultScroller.scrollHeight);
		const ratio = inputArea.scrollTop / inputHeight;
		resultScroller.scrollTop = ratio * outputHeight;
	}
}

function scrollOutput() {
	if (!scrollLockout) {
		scrollLockout = setTimeout(clearLockout, 50);

		const inputHeight = Math.max(inputArea.scrollHeight, inputArea.offsetHeight, inputArea.scrollHeight);
		const outputHeight = Math.max(resultScroller.scrollHeight, resultScroller.offsetHeight, resultScroller.scrollHeight);
		const ratio = resultScroller.scrollTop / outputHeight;
		inputArea.scrollTop = ratio * inputHeight;
	}
}

Object.keys(formatOptions).forEach(key => {
	document.getElementById(key).addEventListener("change", () => {
		formatOptions[key] = !formatOptions[key];
		displayFormattedLog();
	})
});

timestampOption.addEventListener("change", displayFormattedLog);
guildChatOption.addEventListener("change", displayFormattedLog);
characterGMOption.addEventListener("change", () => {
	if (characterGMOption.selectedIndex > 0) {
		narrator = dramatisPersonae[characterGMOption.selectedIndex - 1];
	} else {
		narrator = null;
	}

	displayFormattedLog();
});
sessionName.addEventListener("change", setSessionName);
exportButton.addEventListener("click", (e) => {
	if (exportButton.className.indexOf("disabled") > -1) {
		e.preventDefault();
	}
});
inputArea.addEventListener("change", processLog);
inputArea.addEventListener("scroll", scrollInput);
resultScroller.addEventListener("scroll", scrollOutput);