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

    $conversation_id = $input['conversation_id'] ?? '';
    if (empty($conversation_id)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'conversation_id is required.'
        ]);
        exit();
    }

    $result = deleteConversation($apiKey, $conversation_id);

    http_response_code($result['success'] ? 200 : 500);
    echo json_encode($result);
} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed. Use POST.'
    ]);
}

function deleteConversation($apiKey, $conversation_id)
{
    $url = 'https://tavusapi.com/v2/conversations/' . urlencode($conversation_id);

    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'DELETE',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
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

    if ($httpCode >= 400) {
        return [
            'success' => false,
            'error' => 'API error',
            'httpCode' => $httpCode,
            'response' => $data
        ];
    }

    // for successful response body is empty

    return [
        'success' => true,
        'response' => "Conversation ended successfully."
    ];
}
