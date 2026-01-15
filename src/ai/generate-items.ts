import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable } from "rxjs";
import { apiKey$ } from "./settings";

export interface ItemStreamProps {
  theme: string;
  count: number;
}

export interface GeneratedItem {
  name: string;
  emoji: string;
}

export function createItemStream$(props: ItemStreamProps): Observable<GeneratedItem> {
  return new Observable((subscriber) => {
    const ai = new GoogleGenAI({ apiKey: apiKey$.value });

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          emoji: { type: Type.STRING },
        },
        required: ["name", "emoji"],
      },
    };

    const parser = new JSONParser();

    // Emit values to the subscriber as they are parsed
    parser.onValue = ({ value, key }) => {
      // Ensure we are parsing an item inside the array (key is an index)
      if (typeof key === "number" && value && typeof value === "object") {
        subscriber.next(value as unknown as GeneratedItem);
      }
    };

    // Start the async generation process
    (async () => {
      try {
        const response = await ai.models.generateContentStream({
          model: "gemini-2-flash-preview",
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MINIMAL,
            },
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Generate a list of ${props.count} items that people typically buy during "${props.theme}". Each item should have a short name and a single emoji that best represents it. Examples of themes: Black Friday sales, Christmas holiday, hurricane preparation, back to school, summer vacation.`,
                },
              ],
            },
          ],
        });

        for await (const chunk of response) {
          const textPart = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textPart) {
            parser.write(textPart);
          }
        }

        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
