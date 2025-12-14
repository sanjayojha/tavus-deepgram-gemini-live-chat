let audioChunksBuffer = []; // Buffer to store audio chunks
let deepgramSocketConnection = null;
let keepAliveInterval = null;

import { appendUserTranscriptText, getUserTranscriptText } from "./ui-handler.js";

const fetchDeepgramAuthToken = async () => {
    try {
        console.log("Fetching new Deepgram auth token...");
        const response = await fetch("backend/php/get-deepgram-token.php", {
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.success) {
            return { key: data.response.access_token, expiry: data.response.expires_in };
        } else {
            let error = data.error || "Unknown error";
            console.error("Server error:", error);
            if (data.response) {
                console.error("Server response:", data.response);
            }
            throw new Error("Failed to get Deepgram auth token");
        }
    } catch (error) {
        console.error("Error fetching Deepgram auth token:", error);
        return null;
    }
};

export const initializeDeepgram = async (conversationLoop, fullyLoadedCallback = null) => {
    try {
        const tokenData = await fetchDeepgramAuthToken();
        if (!tokenData) {
            throw new Error("Failed to initialize Deepgram due to token fetch failure");
        }
        const authToken = tokenData.key;
        const queryParams = new URLSearchParams({
            model: "nova-3",
            smart_format: "true",
            punctuate: "true",
            language: "en",
            encoding: "linear16",
            sample_rate: "16000",
            channels: "1",
        });
        const socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${queryParams.toString()}`, ["bearer", authToken]);

        socket.onopen = async () => {
            console.log("Connected to Deepgram WebSocket");

            deepgramSocketConnection = socket;
            // Start keep-alive messages every 2 seconds
            keepAliveInterval = setInterval(sendKeepAlive, 2000);
            if (fullyLoadedCallback) {
                fullyLoadedCallback();
            }
        };
        socket.onerror = (error) => {
            console.error("Deepgram webSocket error:", error);
        };
        socket.onclose = (event) => {
            console.log("Deepgram webSocket connection closed:", event);
            deepgramSocketConnection = null;
            if (keepAliveInterval) {
                clearInterval(keepAliveInterval);
                keepAliveInterval = null;
            }
        };
        socket.onmessage = (message) => {
            console.log("Deepgram message received:", message);
            //console.log("Deepgram message data:", message.data);
            try {
                const data = JSON.parse(message.data);
                console.log("Deepgram message received:", data);

                // Handle transcription results
                if (data.type === "Results" && data.channel?.alternatives?.length > 0) {
                    let transcript = data.channel.alternatives[0].transcript;
                    const isFinal = data.is_final;
                    const fromFinalize = data.from_finalize;

                    if (transcript && transcript.trim() !== "") {
                        console.log(`Transcript (${isFinal ? "final" : "interim"}):`, transcript);
                        transcript = fromFinalize ? transcript.trim() : transcript.trim() + " ";
                        appendUserTranscriptText(transcript);
                    }

                    if (fromFinalize) {
                        // get transcript text to send to AI.
                        const finalTranscript = getUserTranscriptText();
                        if (conversationLoop) {
                            conversationLoop(finalTranscript);
                        }
                    }
                }

                // Handle metadata and other message types
                if (data.type === "Metadata") {
                    console.log("Deepgram metadata:", data);
                }
            } catch (error) {
                console.error("Error parsing Deepgram message:", error);
            }
        };
    } catch (error) {
        console.error("Error initializing Deepgram:", error);
    }
};

// Convert base64 to ArrayBuffer for sending to Deepgram
const base64ToArrayBuffer = (base64) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

// deepgram does not need base64 encoded data. It can accept binary data over WebSocket.
export const bufferAudioChunk = async (arrayBuffer) => {
    try {
        if (!deepgramSocketConnection || deepgramSocketConnection.readyState !== WebSocket.OPEN) {
            throw new Error("Deepgram WebSocket is not open");
        }

        // Send binary data to Deepgram
        deepgramSocketConnection.send(arrayBuffer);
        console.log(`Sent audio chunk to Deepgram (${arrayBuffer.byteLength} bytes)`);
    } catch (error) {
        console.error("Error buffering audio chunk:", error);
    }
};

// Use this if expected audio data is base64-encoded (like in gemini and openAI)
// export const bufferAudioChunk = async (base64Audio) => {
//     try {
//         if (!deepgramSocketConnection || deepgramSocketConnection.readyState !== WebSocket.OPEN) {
//             throw new Error("Deepgram WebSocket is not open");
//         }
//         // Convert base64 back to binary (ArrayBuffer) (needed for Deepgram)
//         const audioBuffer = base64ToArrayBuffer(base64Audio);

//         // Send binary data to Deepgram
//         deepgramSocketConnection.send(audioBuffer);
//         console.log(`Sent audio chunk to Deepgram (${audioBuffer.byteLength} bytes)`);
//     } catch (error) {
//         console.error("Error buffering audio chunk:", error);
//     }
// };

// export const bufferAudioChunk = async (base64Audio) => {
//     try {
//         // Convert base64 back to binary (ArrayBuffer) (needed for Deepgram)
//         const audioBuffer = base64ToArrayBuffer(base64Audio);
//         audioChunksBuffer.push(new Uint8Array(audioBuffer));
//     } catch (error) {
//         console.error("Error buffering audio chunk:", error);
//     }
// };

// Not in use
const combineAudioChunks = (chunks) => {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
    }
    return combined.buffer;
};

export const clearAudioBuffer = async () => {
    try {
        audioChunksBuffer = []; // Clear the local buffer
        console.log("Cleared audio buffer");
    } catch (error) {
        console.error("Error clearing audio buffer:", error);
    }
};

export const sendKeepAlive = () => {
    if (deepgramSocketConnection && deepgramSocketConnection.readyState === WebSocket.OPEN) {
        deepgramSocketConnection.send(JSON.stringify({ type: "KeepAlive" }));
    }
};

export const finalizeTranscription = async () => {
    if (deepgramSocketConnection && deepgramSocketConnection.readyState === WebSocket.OPEN) {
        deepgramSocketConnection.send(JSON.stringify({ type: "Finalize" }));
        console.log("Sent Finalize message to Deepgram");
    }
};

export const closeDeepgram = async () => {
    if (deepgramSocketConnection) {
        // Send final message to finalize transcription
        if (deepgramSocketConnection.readyState === WebSocket.OPEN) {
            deepgramSocketConnection.send(JSON.stringify({ type: "CloseStream" }));
        }
        deepgramSocketConnection.close();
        deepgramSocketConnection = null;
        //onTranscriptCallback = null;
    }
};
