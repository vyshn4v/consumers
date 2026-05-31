/**
 * Executes a Gemini AI prompt with fallback mechanisms across multiple models.
 *
 * @param {Object} aiClient The @google/genai client instance
 * @param {string} prompt The text prompt
 * @param {Object} responseSchema The JSON schema object to enforce output
 * @param {Object} zodSchema (Optional) Zod schema to validate the final output
 * @returns {Object} Validated JSON result
 */
async function generateWithFallback(aiClient, prompt, responseSchema, zodSchema) {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

  for (const model of models) {
    try {
      const response = await aiClient.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const raw = response.text;
      const cleaned = raw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);

      if (zodSchema) {
        return zodSchema.parse(parsed);
      }
      return parsed;
    } catch (err) {
      console.error(`Gemini model failed: ${model}`, err.message || err);
    }
  }

  throw new Error("All Gemini models failed to generate a valid summary");
}

module.exports = {
  generateWithFallback,
};
