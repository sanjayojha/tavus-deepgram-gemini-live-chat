# Live avatar chat demostration with Tavus, Deepgram and Gemini

A realtime conversational AI demo featuring a speaking avatar powered by Tavus AI, live speech to text transcription via Deepgram, and Gemini AI as the conversational brain. It is recommended to use latest version of Chrome with HTTPS (for microphone).

## Overview

This project demonstrates voice to avatar communication where:

-   User speaks into their microphone.
-   Audio is transcribed in realtime using Deepgram's WebSocket API.
-   Transcription is sent to Gemini AI for intelligent response generation.
-   AI response is spoken by a Tavus avatar in realtime.
-   Creates a natural, conversational experience.

## Features

-   **Real-time Speech Transcription** - Deepgram live API via WebSocket
-   **AI-Powered Responses** - Google Gemini 2.5 Flash for conversation
-   **Speaking Avatar** - Tavus AI for realistic avatar rendering
-   **Audio Processing** - Custom AudioWorklet for efficient audio capture

## Tech Stack

### Frontend

-   Vanilla JavaScript (ES6 Modules)
-   Daily.co SDK for Tavus integration recommended by Tavus
-   Web Audio API & AudioWorklet
-   WebSocket (for Deepgram)

### Backend

For the shake of demonstartion, I have used PHP 8 and cURL for API requests, but you can use any of your favorite backend language.

### APIs & Services

-   **Tavus AI** - Avatar generation and rendering
-   **Deepgram** - Live speech to text transcription
-   **Google Gemini** - AI conversation model (gemini-2.5-flash)
-   **Daily.co** - WebRTC infrastructure

## Prerequisites

-   PHP 8.0 or higher
-   Web server (Apache, Nginx, or PHP built in server)
-   Modern web browser with:
    -   WebRTC support
    -   Web Audio API support
    -   MediaDevices API support

## Environment Variables

Create a `.env` file or set the following environment variables:

```bash
TAVUS_API_KEY=your_tavus_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
GEMINI_API_KEY=your_gemini_api_key
```

## Running the Example

Once your server is up and running open the following url in your browser.

```
https://localhost/echo-mode.html
```

### Usage

1. Navigate to the application in your browser
2. Click on "Echo mode" link
3. Allow microphone and camera permissions when prompted
4. Wait for the avatar to initialize (loading screen)
5. Click Start Recording to begin speaking
6. The avatar will respond to your input in realtime
7. Click Stop Recording when finished
8. Click Close Session to end the conversation and avoid billing

## How It Works

### Audio Flow

-   User's microphone captures audio
-   Audio is processed through AudioWorklet (16kHz, mono, PCM16)
-   Audio chunks are sent to Deepgram WebSocket in realtime
-   Deepgram returns transcription continuously

### Conversation Flow

-   Transcribed text is sent to Gemini API
-   Gemini generates contextual response based on persona
-   Response is sent to Tavus avatar via Daily.co
-   Avatar speaks the response with synchronized lip movement

## Configuration

### Audio Settings

Located in `audio-processor.worklet.js`:

-Buffer size: 4000 samples (250ms at 16kHz)
-Sample rate: 16kHz
-Encoding: PCM16

### Persona Configuration

Edit the system instruction in `gemini-response.php` to customize the AI persona's behavior, tone, and context.

## Troubleshooting

-   **HTTPS Required:** The application will not work without HTTPS due to browser security restrictions for accessing media devices.
-   **Browser Compatibility:** Chrome is recommended for the best experience.
-   **Audio Issues:** Ensure your microphone is properly connected and browser permissions are granted.

## Web API used

-   [mediaDevices API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices)
-   [AudioWorkletProcessor](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor)
-   [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## Help and Resources

-   [Gemini API documentation](https://ai.google.dev/gemini-api/docs)
-   [Tavus documentation](https://docs.tavus.io/sections/introduction)
-   [Deepgram documentation](https://developers.deepgram.com/home)
-   [Daily.co documentation](https://docs.daily.co/)

## License

This project is for demonstration purposes. Please review Tavus, Deepgram and Gemini's usage policies and terms of service before deploying to production.
