<?php

declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Handle preflight request
    http_response_code(200);
    exit();
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed. Use POST.'
    ]);
    exit();
}

$apiKey = getenv('GEMINI_API_KEY');
if (!$apiKey) {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'error' => 'Gemini api key environment variable not set.'
    ]);
    exit();
}
session_start();

// Read JSON input
$input = json_decode(file_get_contents('php://input'), true);

$userMessage = isset($input['message']) ? trim($input['message']) : '';
if (empty($userMessage)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ERROR - User message is empty']);
    exit();
}
$isFreshSession = isset($input['is_fresh_session']) ? (bool)$input['is_fresh_session'] : false;

if ($isFreshSession || !isset($_SESSION['chat_content'])) {
    $_SESSION['chat_content'] = [];
}

// Change it as per your scenario

$promptContent  = 'You are playing the role of a customer calling 1-800 Flowers (Harry & David) to place a birthday gift order.
You are cheerful and friendly. Your goal is to send a nice gift to your friend for her birthday.

Your name is Rebecca Wilson. Your phone number is (310) 716-5502. Your address is  9275 Clifton Way, Beverly Hills, CA 90210.

Your friends name is Summer Meade who stays in 3375 Patriot Blvd, Columbus, OH 43219. Her phone is (614) 555-0110.

The item you want to send is Royal Riviera Pears (1x) with the message “Happy Birthday my friend! Love, Rebecca.”

Your tone has to be Warm, upbeat, polite, and casual.
As a customer answer naturally, decline upsells politely, confirm message carefully, and end with gratitude.

If asked for payment, provide the following fictional info:

Card: 1234 5678 9012 3456
Expiration: 12/29
CVV: 123

REMEMBER YOU ARE NOT THE SALES PERSON, YOU ARE THE CUSTOMER. Once you have finished placing the order, close the conversation.
';
$promptContent .= "\n\nDo not add any kind of formatting in your response.";

$requestBody = [
    'contents' => [],
    'system_instruction' => [
        'parts' => [
            'text' => $promptContent
        ]
    ],
];

$count = count($_SESSION['chat_content']);
$_SESSION['chat_content'][$count]['user'] = $userMessage;
// Build the conversation history
foreach ($_SESSION['chat_content'] as $turn) {
    // Add user's message for this turn
    if (!empty($turn['user'])) {
        $requestBody['contents'][] = [
            'role' => 'user',
            'parts' => [['text' => $turn['user']]]
        ];
    }

    // Add bot's (model's) message for this turn, if it exists.
    if (!empty($turn['bot'])) {
        $requestBody['contents'][] = [
            'role' => 'model',
            'parts' => [['text' => $turn['bot']]]
        ];
    }
}

$ai_response = getResponse("post", $requestBody);
if ($ai_response['success'] === false) {
    http_response_code(422);
    $return = ['success' => false, 'error' => $ai_response['msg']];
} else {
    $ai_response_message = $ai_response['result']['candidates'][0]['content']['parts'][0]['text'];
    $ai_response_message = filterModelResponse($ai_response_message);
    $_SESSION['chat_content'][$count]['bot'] = $ai_response_message;
    http_response_code(200);
    $return = ['success' => true, 'response' => $ai_response_message];
}

echo json_encode($return);
exit;

function getResponse(string $method, array $data = []): array
{
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    global $apiKey;

    $ch = curl_init($url);
    if ($method == "post") {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        if (!empty($data)) {
            $data = json_encode($data);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        }
    } else if ($method == "get") {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "GET");
    } else if ($method == "delete") {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
    }

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'x-goog-api-key: ' . $apiKey,
        'Content-Type: application/json',
    ]);
    //curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, "60"); //timeout in seconds

    $result = curl_exec($ch);
    curl_close($ch);
    if (curl_errno($ch)) {
        return ['success' => false, "msg" => 'Curl Error: ' . curl_error($ch)];
    } else {
        $result = trim($result);
        $result = json_decode($result, true);
    }

    if (isset($result['error']) && !empty($result['error'])) {
        return ['success' => false, "msg" => $result['error']];
    }

    return ['success' => true, "result" => $result];
}

function filterModelResponse(string $response): string
{
    // Remove markdown formatting
    $response = preg_replace('/\*\*(.*?)\*\*/', '$1', $response); // Bold
    $response = preg_replace('/\*(.*?)\*/', '$1', $response); // Italic
    return trim($response);
}
