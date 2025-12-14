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

    $mode = $input['mode'] ?? 'echo'; //currently 'full' and 'echo' modes are supported
    $options = [
        "persona_name" => "Demo Persona from API",
        "pipeline_mode" => $mode,
        "default_replica_id" => "r6ca16dbe104" // Mary (this can also be set explicitly while creating the conversation)
        // Add other options as needed
    ];
    if ($mode === 'full') { // not in use in this demo
        $options["system_prompt"] = "You are a skilled event manager. Your task is to assist users in planning and organizing events and parties effectively. Use concise and clear language.";
    }

    $result = createPersona($apiKey, $options);

    http_response_code($result['success'] ? 200 : 500);
    echo json_encode($result);
} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed. Use POST.'
    ]);
}

function createPersona($apiKey, $options)
{
    $url = 'https://tavusapi.com/v2/personas';

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

    $response = trim($response);

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
    //   "persona_id": "p5317866",
    //   "persona_name": "Life Coach",
    //   "created_at": "<string>"
    // }
    if (isset($data['persona_id'])) {
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
