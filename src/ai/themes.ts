import { BehaviorSubject } from "rxjs";

export interface Theme {
  id: string;
  label: string;
  isCustom?: boolean;
}

export const PREDEFINED_THEMES: Theme[] = [
  { id: "black-friday", label: "Black Friday Sale" },
  { id: "disaster-relief", label: "Disaster Relief Donation" },
  { id: "back-to-school", label: "Back to School" },
];

export const selectedTheme$ = new BehaviorSubject<string>(PREDEFINED_THEMES[0].label);

export function setSelectedTheme(theme: string): void {
  selectedTheme$.next(theme);
}

export function getSelectedTheme(): string {
  return selectedTheme$.value;
}
