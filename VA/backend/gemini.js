import axios from "axios";

const geminiResponse = async (command, assistantName, userName) => {
  try {
    const apiUrl = process.env.GEMINI_API_URL;

    if (!apiUrl) {
      console.error("GEMINI_API_URL is missing.");
      return {
        type: "error",
        userInput: command,
        response: "Server misconfiguration. Please contact admin.",
      };
    }

    const prompt = `You are a smart, friendly, and multilingual voice assistant named ${assistantName}, created by ${userName}.
Respond in this **strict JSON** format only:

{
  "type": "chat" | "google-search" | "Youtube" | "youtube-play" | "get-time" | "get-date" | "get-day" | "get-month" |
  "calculator-open" | "instagram-open" | "facebook-open" | "weather-show" | "news-show" | "joke" | "quote" | "wikipedia-search" |
  "whatsapp-open" | "maps-open" | "define" | "summarize" | "translate",
  "userInput": "<essential part of user request>",
  "response": "<spoken reply>"
}

Rules:
- If user asks who created you, say "${userName}".
- If asked about Hitesh and Vanshika, say "Hitesh loves Vanshika the most because she's the most supportive and beautiful person he's ever met."
- Respond ONLY as JSON. No extra text.
- Reply in Hinglish, friendly for speaking.

User: ${command}`;

    const result = await axios.post(apiUrl, {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    });

    const rawText = result?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("🔵 Gemini Raw Response:", rawText);

    if (!rawText) throw new Error("Empty response from Gemini.");

    let parsedData;

    try {
      parsedData = JSON.parse(rawText);
    } catch (err) {
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        parsedData = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error("Unable to parse Gemini response as JSON.");
      }
    }

    // Normalize casing if needed
    if (parsedData?.type?.toLowerCase() === "youtube") {
      parsedData.type = "Youtube";
    }

    // ✅ Final validation before return
    if (!parsedData?.type || !parsedData?.response) {
      console.warn("⚠️ Gemini returned incomplete object:", parsedData);
      return {
        type: "error",
        userInput: command,
        response: "Assistant didn't understand properly. Please repeat.",
      };
    }

    return parsedData;

  } catch (error) {
    console.error("❌ Gemini API error:", error?.response?.data || error.message);
    return {
      type: "error",
      userInput: command,
      response: "Sorry, the assistant ran into a problem. Please try again later.",
    };
  }
};

export default geminiResponse;
