import type { EventMessage, GameState } from "./types";

export function pushEvent(
  state: GameState,
  text: string,
  kind: EventMessage["kind"],
  emphasis = 0.6,
  ttl = 2.2,
): void {
  state.events.push({
    id: state.nextEventId++,
    text,
    kind,
    ttl,
    emphasis,
  });
  state.events = state.events.slice(-8);
}
