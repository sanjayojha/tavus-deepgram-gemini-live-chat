let isFreshSession = true;
export const chatCompletionWithGemini = async (userMessage) => {
    if (userMessage.trim() === "") {
        console.warn("Empty user message. Skipping Gemini request.");
        return null;
    }

    try {
        let bodyData = {
            message: userMessage,
            is_fresh_session: isFreshSession,
        };

        const response = await fetch("backend/php/gemini-response.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify(bodyData),
        });
        if (!response.ok) {
            throw new Error(`Error while calling gemini API: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (data.success) {
            isFreshSession = false;
            return data.response;
        } else {
            let error = data.error || "Unknown error";
            console.error("Gemini api error:", error);
            if (data.response) {
                console.error("Gemini api response error:", data.response);
            }
            throw new Error("Gemini api error occurred");
        }
    } catch (error) {
        console.error("Error in chatCompletionWithGemini:", error);
        return null;
    }
};
