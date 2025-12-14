// tavus.js - Pure Tavus management, emits events
import { EventEmitter } from "./event-emitter.js"; // Simple custom EventEmitter

class TavusManager extends EventEmitter {
    constructor() {
        super();
        this.callObject = null;
        this.conversationId = null;
        this.audioTrackReady = false;
        this.videoTrackReady = false;
    }

    async initialize(videoElement) {
        if (!videoElement) {
            throw new Error("TavusManager.initialize: 'videoElement' is required");
        }
        try {
            // const personaResponse = await this.createPersona("echo");
            // if (!personaResponse || !personaResponse.personaId) {
            //     throw new Error("Failed to create persona");
            // }
            // console.log("Persona ID:", personaResponse.personaId);
            const personaId = "p379c87ee058";
            const conversationResponse = await this.createConversation(personaId);
            if (!conversationResponse) {
                throw new Error("Failed to create conversation");
            }

            this.conversationId = conversationResponse.conversationId;
            await this.joinRoom(conversationResponse.conversationId, videoElement);
        } catch (error) {
            // Log and re-throw with context
            console.error("TavusManager initialization failed:", error);
            throw new Error(`TavusManager: Initialization failed - ${error.message}`);
        }
    }

    async joinRoom(conversationId, videoElement) {
        this.callObject = Daily.createCallObject();

        // Listen to Daily events and emit our own events
        this.callObject.on("app-message", (event) => {
            if (event.data?.event_type === "conversation.replica.stopped_speaking") {
                this.emit("ai:stopped-speaking");
            }
            if (event.data?.event_type === "conversation.utterance") {
                this.emit("ai:utterance", event.data.properties);
            }
            if (event.data?.event_type === "conversation.replica.started_speaking") {
                this.emit("ai:started-speaking");
            }
        });

        // Ensure mic and camera are always disabled
        this.callObject.on("joined-meeting", (event) => {
            console.log("joined-meeting event received = ", event);
            this.callObject.setLocalAudio(false);
            this.callObject.setLocalVideo(false);
        });
        // participants events
        this.callObject.on("participant-joined", (event) => {
            // Tavus AI joined
            console.log("participant-joined event received = ", event);
        });

        this.callObject.on("track-stopped", (event) => {
            console.log("track-stopped event received = ", event);
        });

        this.callObject.on("participant-left", (event) => {
            console.log("participant-left event received = ", event);
        });

        this.callObject.on("error", (event) => {
            console.log("Tavus error event received = ", event);
        });

        this.callObject.on("left-meeting", (event) => {
            console.log("left-meeting event received = ", event);
        });

        this.callObject.on("track-started", (event) => {
            if (event.participant.local) return;

            if (event.type === "audio") {
                const audioStream = new MediaStream([event.track]);
                const audio = new Audio();
                audio.srcObject = audioStream;
                audio.autoplay = true;
                this.audioTrackReady = true;
            }

            if (event.type === "video") {
                videoElement.srcObject = new MediaStream([event.track]);
                this.videoTrackReady = true;
            }

            if (this.audioTrackReady && this.videoTrackReady) {
                this.emit("ai:ready"); // Emit when fully ready
            }
        });
        this.callObject.on("participant-updated", (event) => {
            console.log("participant-updated event received = ", event);
            // const participant = event.participant;
            // if (participant.local) return;

            // if (participant.tracks.audio.state === "playable") {
            //     const audioStream = new MediaStream([participant.tracks.audio.persistentTrack]);
            //     const audio = new Audio();
            //     audio.srcObject = audioStream;
            //     audio.autoplay = true;
            //     this.audioTrackReady = true;
            //     console.log("Audio track set for participant.");
            // }

            // if (participant.tracks.video.state === "playable") {
            //     videoElement.srcObject = new MediaStream([participant.tracks.video.persistentTrack]);
            //     this.videoTrackReady = true;
            //     console.log("Video track set for participant.");
            // }

            // if (this.audioTrackReady && this.videoTrackReady) {
            //     this.emit("ai:ready"); // Emit when fully ready
            // }
        });

        await this.callObject.join({
            url: `https://tavus.daily.co/${conversationId}`,
            userName: "Guest",
            startVideoOff: true,
            startAudioOff: true,
        });
    }

    async sendMessage(message) {
        if (!this.callObject) {
            this.emit("ai:error", {
                type: "send-message-error",
                message: "TavusManager.sendMessage: callObject is not initialized",
            });
            throw new Error("TavusManager.sendMessage: callObject is not initialized");
        }

        try {
            this.callObject.sendAppMessage({
                message_type: "conversation",
                event_type: "conversation.echo",
                conversation_id: this.conversationId,
                properties: { text: message },
            });
        } catch (err) {
            console.error("Failed to send tavus app message:", err);
            this.emit("error", {
                type: "send-message-error",
                message: err.message,
                original: err,
            });
            throw err;
        }
    }

    async closeConnection() {
        if (this.callObject) {
            try {
                await this.callObject.leave();
                await this.endConversation(this.conversationId);
                await this.deleteConversation(this.conversationId);
                this.callObject = null;
                this.conversationId = null;
                this.audioTrackReady = false;
                this.videoTrackReady = false;
                console.log("Tavus connection closed successfully.");
            } catch (error) {
                console.error("Error closing Tavus connection:", error);
            }
        }
    }

    async createConversation(personaId) {
        try {
            if (!personaId) {
                throw new Error("Persona ID is required to create a conversation");
            }
            const response = await fetch(`/backend/php/create-conversation.php`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: JSON.stringify({ persona_id: personaId }),
            });

            if (!response.ok) {
                throw new Error(`Failed to create conversation: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                console.log("Conversation created with data:", data.data);
                return { conversationId: data.data.conversation_id, conversationUrl: data.data.conversation_url, active: data.data.status };
            } else {
                let error = data.error || "Unknown error";
                console.error("Server error:", error);
                if (data.response) {
                    console.error("Server response:", data.response);
                }
                throw new Error("Failed to get conversation details");
            }
        } catch (error) {
            console.error("Error creating conversation:", error);
            return null;
        }
    }

    async createPersona(mode = "echo") {
        try {
            const response = await fetch(`/backend/php/create-persona.php`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: JSON.stringify({ mode }),
            });

            if (!response.ok) {
                throw new Error(`Failed to create persona: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                console.log("Persona created with data:", data.data);
                return { personaId: data.data.persona_id };
            } else {
                let error = data.error || "Unknown error";
                console.error("Server error:", error);
                if (data.response) {
                    console.error("Server response:", data.response);
                }
                throw new Error("Failed to get session token");
            }
        } catch (error) {
            console.error("Error creating persona:", error);
            return null;
        }
    }
    // end conversation
    async endConversation(conversationId) {
        try {
            if (!conversationId) {
                throw new Error("Conversation ID is required to end a conversation");
            }
            const response = await fetch(`/backend/php/end-conversation.php`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: JSON.stringify({ conversation_id: conversationId }),
            });

            if (!response.ok) {
                throw new Error(`Failed to end conversation: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                console.log("Conversation ended successfully.");
                return true;
            } else {
                let error = data.error || "Unknown error";
                console.error("Server error:", error);
                if (data.response) {
                    console.error("Server response:", data.response);
                }
                throw new Error("Failed to end conversation");
            }
        } catch (error) {
            console.error("Error ending conversation:", error);
            return false;
        }
    }
    // delete conversation
    async deleteConversation(conversationId) {
        try {
            if (!conversationId) {
                throw new Error("Conversation ID is required to delete a conversation");
            }
            const response = await fetch(`/backend/php/delete-conversation.php`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: JSON.stringify({ conversation_id: conversationId }),
            });

            if (!response.ok) {
                throw new Error(`Failed to delete conversation: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                console.log("Conversation deleted successfully.");
                return true;
            } else {
                let error = data.error || "Unknown error";
                console.error("Server error:", error);
                if (data.response) {
                    console.error("Server response:", data.response);
                }
                throw new Error("Failed to delete conversation");
            }
        } catch (error) {
            console.error("Error deleting conversation:", error);
            return false;
        }
    }
}

export const tavusManager = new TavusManager();
