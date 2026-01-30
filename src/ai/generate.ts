import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable, switchMap, toArray } from "rxjs";
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
    const abortController = new AbortController();

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
          model: "gemini-3-flash-preview",
          config: {
            abortSignal: abortController.signal,
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

    return () => abortController.abort();
  });
}

export interface Interaction {
  itemOneName: string;
  itemTwoName: string;
  resultName?: string;
  resultEmoji?: string;
  /* Dramatic Onomatopoeia such as "Boom" and Ideophones such as "Yum" */
  speechBubbleWord: string;
}

export interface LevelContent {
  interactions: Interaction[];
}

export function simulateInteractions$(items$: Observable<GeneratedItem>, interactionCount?: number): Observable<Interaction> {
  return items$.pipe(
    toArray(),
    switchMap((items) => {
      return new Observable<Interaction>((subscriber) => {
        if (items.length === 0) {
          subscriber.complete();
          return;
        }

        const abortController = new AbortController();
        const count = interactionCount ?? (items.length || 5);
        const ai = new GoogleGenAI({ apiKey: apiKey$.value });

        const schema = {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              itemOneName: { type: Type.STRING },
              itemTwoName: { type: Type.STRING },
              resultName: { type: Type.STRING },
              resultEmoji: { type: Type.STRING },
              speechBubbleWord: { type: Type.STRING },
            },
            required: ["itemOneName", "itemTwoName", "resultName", "resultEmoji", "speechBubbleWord"],
          },
        };

        const parser = new JSONParser();

        // Emit values to the subscriber as they are parsed
        parser.onValue = ({ value, key }) => {
          // Ensure we are parsing an item inside the array (key is an index)
          if (typeof key === "number" && value && typeof value === "object") {
            subscriber.next(value as unknown as Interaction);
          }
        };

        (async () => {
          try {
            const itemDescriptions = items.map((i) => `${i.name} ${i.emoji}`).join(", ");
            const response = await ai.models.generateContentStream({
              model: "gemini-3-flash-preview",
              config: {
                abortSignal: abortController.signal,
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
                      text: `Given the following list of items: ${itemDescriptions}.
Generate a list of negative dramatic interactions between these items.
For example, a dog eats the bone with a "Yum!" speech bubble. Water shorts the laptop with a "Zap!" speech bubble.
Try to provide at least ${count} interesting interactions.
Each interaction must have:
- itemOneName: Name of the first ingredient.
- itemTwoName: Name of the second ingredient.
- resultName: Name of the resulting item.
- resultEmoji: A single emoji for the result.
- speechBubbleWord: A short, dramatic onomatopoeia or ideophone (e.g., "Yum!", "Poof!").`,
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

        return () => {
          abortController.abort();
        };
      });
    })
  );
}
