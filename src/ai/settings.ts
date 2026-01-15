import { BehaviorSubject } from "rxjs";

const API_KEY_STORAGE_KEY = "googleAiStudioApiKey";

export const apiKey$ = new BehaviorSubject<string>(localStorage.getItem(API_KEY_STORAGE_KEY) ?? "");

export function initSettings() {
  const apiKeyInput = document.getElementById("apiKeyInput") as HTMLInputElement | null;
  const saveBtn = document.getElementById("saveApiKey") as HTMLButtonElement | null;
  const clearBtn = document.getElementById("clearApiKey") as HTMLButtonElement | null;
  const settingsMenu = document.getElementById("settingsMenu") as HTMLDialogElement | null;

  if (apiKeyInput) {
    apiKeyInput.value = apiKey$.value;
  }

  if (saveBtn && apiKeyInput && settingsMenu) {
    saveBtn.addEventListener("click", () => {
      apiKey$.next(apiKeyInput.value.trim());
      settingsMenu.close();
    });
  }

  if (clearBtn && apiKeyInput) {
    clearBtn.addEventListener("click", () => {
      apiKeyInput.value = "";
      apiKey$.next("");
    });
  }

  apiKey$.subscribe((key) => {
    if (apiKeyInput && apiKeyInput.value !== key) {
      apiKeyInput.value = key;
    }

    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  });
}
