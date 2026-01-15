# Streaming Structured Data Generation with Gemini

```ts
import { GoogleGenAI, SchemaType } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable } from "rxjs";

// Define the shape of our data
interface Person {
  name: string;
}

function generatePeopleStream(): Observable<Person> {
  return new Observable((subscriber) => {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const schema = {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
        },
        required: ["name"],
      },
    };

    const parser = new JSONParser();

    // Emit values to the subscriber as they are parsed
    parser.onValue = ({ value, key }) => {
      // Ensure we are parsing an item inside the array (key is an index)
      if (typeof key === "number" && value && typeof value === "object") {
        subscriber.next(value as Person);
      }
    };

    // Start the async generation process
    (async () => {
      try {
        const response = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
          },
          contents: [
            {
              role: "user",
              parts: [{ text: "Generate a list of 5 fictional people." }],
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

// Usage Example
async function main() {
  const people$ = generatePeopleStream();

  console.log("Subscribing to stream...");

  people$.subscribe({
    next: (person) => console.log("Received person:", person),
    error: (err) => console.error("Stream error:", err),
    complete: () => console.log("Stream completed."),
  });
}

main();
```
