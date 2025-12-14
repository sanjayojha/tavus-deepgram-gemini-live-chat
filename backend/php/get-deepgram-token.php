<?php

declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Handle preflight request
    http_response_code(200);
    exit();
}

$apiKey = getenv('DEEPGRAM_API_KEY');
if (!$apiKey) {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'error' => 'Deepgram api key environment variable not set.'
    ]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed. Use GET.'
    ]);
    exit();
}

$curlUrl = 'https://api.deepgram.com/v1/auth/grant';
$ch = curl_init($curlUrl);
$payload = json_encode([
    'ttl_seconds' => 50
]);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Token ' . $apiKey
    ],
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_TIMEOUT => 60
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'cURL error: ' . $error
    ]);
    exit();
}
$response = trim($response);
$data = json_decode($response, true);

if ($httpCode !== 200) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'API error',
        'httpCode' => $httpCode,
        'response' => $data
    ]);
    exit();
}

http_response_code(200);
echo json_encode([
    'success' => true,
    'response' => $data
]);
exit;
