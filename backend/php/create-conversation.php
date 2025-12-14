<?php
// CORS headers for frontend access
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Handle preflight request
    http_response_code(200);
    exit();
}

// Your API key
$apiKey = getenv('TAVUS_API_KEY');
if (!$apiKey) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'TAVUS_API_KEY environment variable not set.'
    ]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $input = json_decode(file_get_contents('php://input'), true);

    $persona_id = $input['persona_id'] ?? '';
    if (empty($persona_id)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'persona_id is required.'
        ]);
        exit();
    }
    // Documenation to save cost (https://docs.tavus.io/sections/conversational-video-interface/conversation/customizations/call-duration-and-timeout)
    // for API reference (https://docs.tavus.io/api-reference/conversations/create-conversation) 
    $options = [
        "persona_id" => $persona_id,
        "conversation_name" => "Demo Conversation",
        // Add other options as needed
        "properties" => [
            "max_call_duration" => 305, // 5 minutes (keeping it short for demo otherwise tavus bill increase.) (5 second buffer for cleanup)
            "participant_absent_timeout" => 60 // 1 minute (maximize cost savings)
        ]
    ];

    $result = createConversation($apiKey, $options);

    http_response_code($result['success'] ? 200 : 500);
    echo json_encode($result);
} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed. Use POST.'
    ]);
}

function createConversation($apiKey, $options)
{
    $url = 'https://tavusapi.com/v2/conversations';

    $payload = json_encode($options);

    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-api-key: ' . $apiKey
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT => 60
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return [
            'success' => false,
            'error' => 'cURL error: ' . $error
        ];
    }

    $data = json_decode($response, true);

    if ($httpCode !== 200) {
        return [
            'success' => false,
            'error' => 'API error',
            'httpCode' => $httpCode,
            'response' => $data
        ];
    }

    // for client
    //     {
    //   "conversation_id": "c123456",
    //   "conversation_name": "A Meeting with Hassaan",
    //   "status": "active",
    //   "conversation_url": "https://tavus.daily.co/c123456",
    //   "replica_id": "r79e1c033f",
    //   "persona_id": "p5317866",
    //   "created_at": "<string>"
    // }
    if (isset($data['conversation_id'])) {
        return [
            'success' => true,
            'data' => $data
        ];
    }

    return [
        'success' => false,
        'error' => 'Invalid response format',
        'response' => $data
    ];
}
