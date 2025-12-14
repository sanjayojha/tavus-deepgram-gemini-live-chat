// Global variables
let mediaStream = null;
let mediaRecorder = null;
let audioProcessor = null;

import { getMediaStream, createMediaRecorder, stopMediaRecorder, unmuteAudioTrack, muteAudioTrack, closeSession, createAudioProcessor, stopAudioProcessor } from "./mediaStream.js";
import { initializeTranscriptUI, clearTranscript, appendTranscriptText } from "./ui-handler.js";
import { bufferAudioChunk, clearAudioBuffer, initializeDeepgram, finalizeTranscription, closeDeepgram } from "./deepgram.js";
import { chatCompletionWithGemini } from "./gemini.js";

import { tavusManager } from "./tavus.js";

const startRecording = async () => {
    mediaRecorder = await createMediaRecorder(mediaStream, {
        mimeType: "video/webm;codecs=opus",
        onStop: (blob) => {
            // Handle the recorded video blob here
            console.log("Video recording complete:", blob);
            //createResponse(); // TODO
        },
    });

    // start audio processing with AudioWorklet
    audioProcessor = await createAudioProcessor(mediaStream, (audioBinaryData) => {
        //this can be PCM16 ArrayBuffer or base64 encoded audio depending on implementation in mediaStream.js and deepgram.js
        bufferAudioChunk(audioBinaryData);
    });
};

const stopRecording = async () => {
    await finalizeTranscription();
    await stopMediaRecorder(mediaRecorder);

    await stopAudioProcessor(audioProcessor);
};

const conversationLoop = async (userMessage) => {
    const aiResponse = await chatCompletionWithGemini(userMessage);
    if (aiResponse) {
        appendTranscriptText(aiResponse);
        await tavusManager.sendMessage(aiResponse); // send AI response to Tavus to speak
    }
};

window.addEventListener("load", async () => {
    document.getElementById("loadingOverlay").style.display = "flex";

    mediaStream = await getMediaStream();
    muteAudioTrack(mediaStream);
    document.getElementById("userVideo").srcObject = mediaStream;

    const startRecordingButton = document.getElementById("startRecording");
    const stopRecordingButton = document.getElementById("stopRecording");
    const aiTranscriptArea = document.getElementById("aiTranscript");
    const userTranscriptArea = document.getElementById("userTranscript");

    if (aiTranscriptArea) {
        initializeTranscriptUI(aiTranscriptArea, userTranscriptArea);
    }

    // Initialize Tavus
    const videoElement = document.getElementById("aiVideo");
    try {
        await tavusManager.initialize(videoElement);
        //Listen for Tavus events
        tavusManager.on("ai:ready", async () => {
            console.log("Tavus AI is fully ready");
            // Now initialize Deepgram
            await initializeDeepgram(conversationLoop, () => {
                startRecordingButton.disabled = false;
                document.getElementById("loadingOverlay").style.display = "none";
            });
        });

        tavusManager.on("ai:stopped-speaking", () => {
            console.log("AI stopped speaking, enable user recording");
            document.getElementById("startRecording").disabled = false;
        });

        tavusManager.on("ai:utterance", (data) => {
            console.log("AI said (utterance):", data.speech);
        });

        tavusManager.on("ai:error", (errorData) => {
            console.error("Tavus error event:", errorData);
        });
    } catch (error) {
        console.error("Failed to initialize Tavus:", error);
        //document.getElementById("loadingOverlay").style.display = "none";
        //alert("Failed to connect to Tavus AI. Please refresh and try again.");
    }

    if (startRecordingButton) {
        //startRecordingButton.disabled = true; // disabled start button until media stream is ready

        startRecordingButton.addEventListener("click", async () => {
            clearTranscript(); // Clear previous transcript
            clearAudioBuffer(); // Clear previous audio buffer
            unmuteAudioTrack(mediaStream); // Unmute audio when starting recording

            await startRecording();

            // disable start button to prevent multiple clicks
            startRecordingButton.disabled = true;
            // enable stop button
            if (stopRecordingButton) {
                stopRecordingButton.disabled = false;
            }
        });
    }

    if (stopRecordingButton) {
        stopRecordingButton.addEventListener("click", async () => {
            await stopRecording();
            muteAudioTrack(mediaStream);

            // disable stop button
            stopRecordingButton.disabled = true;
        });
    }

    const closeSessionButton = document.getElementById("closeSessionButton");
    if (closeSessionButton) {
        closeSessionButton.addEventListener("click", async () => {
            await closeAllConnections();
        });
    }
});

const closeAllConnections = async () => {
    await closeSession(mediaStream, mediaRecorder, audioProcessor);
    await tavusManager.closeConnection();
    await closeDeepgram();
    clearTranscript();
    // disable buttons
    document.getElementById("startRecording").disabled = true;
    document.getElementById("stopRecording").disabled = true;
    // hide close button
    document.getElementById("closeSessionButton").style.display = "none";
    const connMsg = document.getElementById("connectionMessage");
    if (connMsg) {
        connMsg.classList.remove("text-danger");
        connMsg.classList.add("text-success");
        connMsg.textContent = "Session closed successfully!.";
    }
};

// Cleanup on page unload
window.addEventListener("beforeunload", async () => {
    await closeAllConnections();
});
