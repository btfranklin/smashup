import {
  CAR_PRESET_IDS,
  CAR_PRESETS,
  SESSION_UPGRADES,
  WRECK_AWARD_DEFINITIONS,
  getModifierSummary,
} from "../game/content";
import { AudioManager } from "../game/audio";
import { buildCareerStandings } from "../game/career";
import { renderGameToText } from "../game/debug";
import { parseCarPreviewRequest } from "../game/preview";
import { renderGame } from "../game/render";
import {
  advanceAfterRound,
  applySessionUpgrade,
  beginCarSelect,
  chooseStarterCar,
  createCarPreviewState,
  createInitialState,
  restartState,
} from "../game/session";
import {
  advanceState,
  applyPlayerControls,
  finishSpectatingRound,
} from "../game/runtime";
import { getActiveCars } from "../game/selectors";
import type {
  CarPresetId,
  GameState,
  Mode,
  SessionUpgradeId,
  WreckAwardId,
} from "../game/types";

type AppWindow = Window &
  typeof globalThis & {
    advanceTime?: (ms: number) => void;
    render_game_to_text?: () => string;
  };

export type InputState = {
  left: boolean;
  right: boolean;
  forward: boolean;
  reverse: boolean;
};

export type AudioDriver = Pick<AudioManager, "ensureStarted" | "update" | "destroy">;

export type AppController = {
  state: GameState;
  frame: HTMLDivElement;
  canvas: HTMLCanvasElement;
  menu: HTMLElement;
  input: InputState;
  tick: (dt: number) => void;
  present: () => void;
  syncMenu: () => void;
  resizeCanvas: () => void;
  advanceTime: (ms: number) => void;
  destroy: () => Promise<void>;
};

export type BootstrapOptions = {
  appRoot: HTMLDivElement;
  doc?: Document;
  win?: AppWindow;
  nav?: Navigator;
  createAudio?: () => AudioDriver;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  performanceNow?: () => number;
};

export function renderStartupError(
  appRoot: HTMLElement,
  message: string,
  doc = appRoot.ownerDocument,
): void {
  const container = doc.createElement("section");
  container.className = "startup-error";
  container.dataset.startupError = "true";

  const title = doc.createElement("h1");
  title.textContent = "Startup Error";

  const copy = doc.createElement("p");
  copy.textContent = message;

  container.append(title, copy);
  appRoot.replaceChildren(container);
}

export function createStateForSearch(search: string): GameState {
  const previewRequest = parseCarPreviewRequest(search);
  return previewRequest
    ? createCarPreviewState(previewRequest.presetId, previewRequest.scenario)
    : createInitialState();
}

export function setInputKeyState(
  input: InputState,
  code: string,
  active: boolean,
): boolean {
  switch (code) {
    case "ArrowLeft":
    case "KeyA":
      input.left = active;
      return true;
    case "ArrowRight":
    case "KeyD":
      input.right = active;
      return true;
    case "ArrowUp":
    case "KeyW":
      input.forward = active;
      return true;
    case "ArrowDown":
    case "KeyS":
      input.reverse = active;
      return true;
    default:
      return false;
  }
}

export function computeCanvasDisplaySize(
  arenaWidth: number,
  arenaHeight: number,
  containerWidth: number,
  containerHeight: number,
): { width: number; height: number } {
  const ratio = arenaWidth / arenaHeight;
  let width = containerWidth;
  let height = width / ratio;
  if (height > containerHeight) {
    height = containerHeight;
    width = height * ratio;
  }
  return { width, height };
}

function formatPlace(place: number): string {
  const tens = place % 100;
  if (tens >= 11 && tens <= 13) {
    return `${place}th`;
  }
  switch (place % 10) {
    case 1:
      return `${place}st`;
    case 2:
      return `${place}nd`;
    case 3:
      return `${place}rd`;
    default:
      return `${place}th`;
  }
}

export function shouldHideMenu(mode: Mode): boolean {
  return mode === "running" || mode === "intro" || mode === "car_preview";
}

export function installBrowserHooks(
  win: AppWindow,
  hooks: {
    advanceTime: (ms: number) => void;
    renderGameToText: () => string;
  },
): void {
  win.advanceTime = hooks.advanceTime;
  win.render_game_to_text = hooks.renderGameToText;
}

export function createAppController({
  appRoot,
  doc = appRoot.ownerDocument,
  win = doc.defaultView as AppWindow,
  nav = win.navigator,
  createAudio = () => new AudioManager(),
  requestAnimationFrame = (callback) => win.requestAnimationFrame(callback),
  performanceNow = () => win.performance.now(),
}: BootstrapOptions): AppController {
  const state = createStateForSearch(win.location.search);
  const orderedCarPresets = CAR_PRESET_IDS.map((id) => CAR_PRESETS[id]);
  const audio = createAudio();
  const frame = doc.createElement("div");
  frame.className = "frame";

  const canvas = doc.createElement("canvas");
  canvas.width = state.arena.width;
  canvas.height = state.arena.height;
  canvas.setAttribute("aria-label", "Smashup Derby arena");

  const menu = doc.createElement("section");
  menu.className = "menu";

  frame.append(canvas, menu);
  appRoot.replaceChildren(frame);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable.");
  }
  const renderContext: CanvasRenderingContext2D = ctx;

  const input: InputState = {
    left: false,
    right: false,
    forward: false,
    reverse: false,
  };
  const automatedStepping = Boolean(nav.webdriver);
  const teardown: Array<() => void> = [];
  let destroyed = false;
  let spectatorSkipActive = false;

  function renderMainMenu(): void {
    menu.innerHTML = `
      <h1>Smashup<br />Derby</h1>
      <h2>Five rounds. One long night. Eight cars chasing the crown.</h2>
      <p>Choose a derby car, survive an escalating Career Night, and fight for every point in the final standings.</p>
      <button class="primary-button" id="start-btn" type="button">Start Career Night</button>
      <p class="hint">Press Enter to begin, W/A/S/D or arrows to drive, F for fullscreen.</p>
    `;
    menu
      .querySelector<HTMLButtonElement>("#start-btn")
      ?.addEventListener("click", () => {
        beginCarSelect(state);
        syncMenu();
      });
  }

  function renderCarSelectMenu(): void {
    const cards = orderedCarPresets
      .map(
        (preset, index) => `
          <button class="choice-card" data-preset-id="${preset.id}" ${index === 0 ? 'id="recommended-preset"' : ""} type="button">
            <span class="choice-kicker">${preset.subtitle}</span>
            <strong>${preset.title}</strong>
            <span>${preset.description}</span>
            <span>Mass ${preset.mass} | Reverse ${preset.reverseMaxSpeed} | Top ${preset.forwardMaxSpeed}</span>
          </button>
        `,
      )
      .join("");
    menu.innerHTML = `
      <h1>Choose<br />Your Ride</h1>
      <h2>Pick a derby identity for the full five-round run.</h2>
      <div class="choice-grid">${cards}</div>
      <p class="hint">Heavier cars take punishment. Faster cars escape better. Backstab hits hardest in reverse.</p>
    `;
    menu
      .querySelectorAll<HTMLButtonElement>("[data-preset-id]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          chooseStarterCar(state, button.dataset.presetId as CarPresetId);
          syncMenu();
        });
      });
  }

  function renderRoundResultsMenu(): void {
    const summary = state.session.lastRoundSummary;
    const playerPlacement = summary?.placements.find(
      (placement) => placement.isPlayer,
    );
    const awardCards = (summary?.awardIds ?? [])
      .map((awardId) => {
        const award = WRECK_AWARD_DEFINITIONS[awardId];
        return `
          <article class="award-card" data-award-category="${award.category}">
            <span>${award.category}</span>
            <strong>${award.title}</strong>
            <p>${award.description}</p>
          </article>
        `;
      })
      .join("");
    const isFinalRound =
      state.session.roundIndex >= state.session.totalRounds - 1;
    menu.innerHTML = `
      <div class="result-heading">
        <div>
          <span class="eyebrow">Round ${summary?.roundIndex ?? state.session.roundIndex + 1} complete</span>
          <h1>${summary?.playerWon ? "Round<br />Winner" : `${formatPlace(playerPlacement?.place ?? 8)}<br />Place`}</h1>
        </div>
        <div class="points-stamp">
          <strong>+${playerPlacement?.points ?? 0}</strong>
          <span>Career points</span>
        </div>
      </div>
      <h2>${summary?.playerWon ? "You took the checkered flag." : `${summary?.winnerLabel ?? "The field"} owns this round.`}</h2>
      <div class="result-facts">
        <p>${summary?.knockoutReason ? `Wrecked by ${summary.eliminatedByLabel ?? "the field"}: ${summary.knockoutReason}` : `Biggest hit: ${summary?.biggestHitLabel ?? "None"} (${Math.round((summary?.biggestHitSeverity ?? 0) * 100)}%)`}</p>
        <p>${summary?.playerKnockouts.length ? `Knockouts: ${summary.playerKnockouts.join(", ")}` : "Knockouts: none credited"}</p>
        <p>Survival time: ${summary?.survivalTime ?? 0}s</p>
      </div>
      ${awardCards ? `<section class="award-section" aria-labelledby="award-heading"><h3 id="award-heading">Wreck Awards</h3><div class="award-grid">${awardCards}</div></section>` : ""}
      <button class="primary-button" id="advance-btn" type="button">${isFinalRound ? "Final Standings" : "Pit Stop"}</button>
      <p class="hint">${isFinalRound ? "The full Career Night table is ready." : "The crew can tow a wreck back to runnable condition, but body damage still carries forward."}</p>
    `;
    menu
      .querySelector<HTMLButtonElement>("#advance-btn")
      ?.addEventListener("click", () => {
        advanceAfterRound(state);
        syncMenu();
      });
  }

  function renderUpgradeMenu(): void {
    const nextPlan = state.session.roundPlans[state.session.roundIndex + 1];
    const cards = Object.values(SESSION_UPGRADES)
      .map(
        (upgrade, index) => `
          <button class="choice-card" data-upgrade-id="${upgrade.id}" ${index === 0 ? 'id="recommended-upgrade"' : ""} type="button">
            <span class="choice-kicker">Pit Choice</span>
            <strong>${upgrade.title}</strong>
            <span>${upgrade.description}</span>
          </button>
        `,
      )
      .join("");
    menu.innerHTML = `
      <h1>Pit<br />Choice</h1>
      <h2>Next up: ${nextPlan?.title ?? "Final Heat"}</h2>
      <p>Round ${state.session.roundIndex + 2} of ${state.session.totalRounds}. ${nextPlan ? getModifierSummary(nextPlan.modifier) : ""}.</p>
      <div class="choice-grid">${cards}</div>
      <p class="hint">One choice only. Damage carries forward, but the pit crew gives a small baseline repair either way.</p>
    `;
    menu
      .querySelectorAll<HTMLButtonElement>("[data-upgrade-id]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          applySessionUpgrade(
            state,
            button.dataset.upgradeId as SessionUpgradeId,
          );
          syncMenu();
        });
      });
  }

  function renderSpectatingMenu(): void {
    const remaining = getActiveCars(state).length;
    menu.innerHTML = `
      <span class="eyebrow">Round ${state.session.roundIndex + 1} still live</span>
      <h1>Wrecked</h1>
      <h2><span data-remaining-count>${remaining}</span> <span data-remaining-label>${remaining === 1 ? "driver is" : "drivers are"}</span> still fighting.</h2>
      <p>Your car stays where it died. Watch the field finish the round or jump to the official result.</p>
      <button class="primary-button" id="skip-btn" type="button" ${spectatorSkipActive ? "disabled" : ""}>
        ${spectatorSkipActive ? "Finishing Round…" : "Skip to Results"}
      </button>
      <p class="hint" aria-live="polite">${spectatorSkipActive ? "Running the same derby simulation at high speed." : "Press Enter to skip."}</p>
    `;
    menu
      .querySelector<HTMLButtonElement>("#skip-btn")
      ?.addEventListener("click", skipSpectatingRound);
  }

  function renderCareerOverMenu(): void {
    const standings = buildCareerStandings(state.session.completedRounds);
    const champion = standings[0] ?? null;
    const playerStanding =
      standings.find((standing) => standing.isPlayer) ?? null;
    const playerChampion = champion?.isPlayer ?? false;
    const podiumOrder = [standings[1], standings[0], standings[2]].filter(
      (standing) => standing !== undefined,
    );
    const podium = podiumOrder
      .map(
        (standing) => `
          <li class="podium-place podium-place-${standing.rank}" data-rank="${standing.rank}">
            <span class="podium-rank">${standing.rank}</span>
            <strong>${standing.label}</strong>
            <span>${standing.points} pts</span>
          </li>
        `,
      )
      .join("");
    const roundHeaders = Array.from(
      { length: state.session.totalRounds },
      (_, index) => `<th scope="col">R${index + 1}</th>`,
    ).join("");
    const standingRows = standings
      .map((standing) => {
        const rounds = Array.from(
          { length: state.session.totalRounds },
          (_, index) => {
            const place = standing.roundPlacements[index];
            return `<td>${place ? formatPlace(place) : "—"}</td>`;
          },
        ).join("");
        return `
          <tr class="${standing.isPlayer ? "player-standing" : ""}">
            <th scope="row"><span>${standing.rank}</span> ${standing.label}${standing.isPlayer ? " (You)" : ""}</th>
            ${rounds}
            <td>${standing.wins}</td>
            <td><strong>${standing.points}</strong></td>
          </tr>
        `;
      })
      .join("");
    const awardCounts = new Map<WreckAwardId, number>();
    for (const round of state.session.completedRounds) {
      for (const awardId of round.awardIds) {
        awardCounts.set(awardId, (awardCounts.get(awardId) ?? 0) + 1);
      }
    }
    const awardRecap = [...awardCounts]
      .map(([awardId, count]) => {
        const award = WRECK_AWARD_DEFINITIONS[awardId];
        return `<li><strong>${award.title}</strong><span>${count > 1 ? `×${count}` : "Earned"}</span></li>`;
      })
      .join("");
    const celebration = playerChampion
      ? `<div class="champion-sparks" aria-hidden="true">${Array.from({ length: 18 }, (_, index) => `<span style="--spark-left: ${2 + index * 5.55}%; --spark-delay: ${index * -0.17}s; --spark-angle: ${index * 19}deg"></span>`).join("")}</div>`
      : "";

    menu.innerHTML = `
      <section class="career-finale ${playerChampion ? "player-champion" : "field-champion"}">
        ${celebration}
        <header class="finale-header">
          <span class="eyebrow">Career Night complete</span>
          <h1>${playerChampion ? "Career Night<br />Champion" : `${champion?.label ?? "Career Night"}<br />Owns the Night`}</h1>
          <h2>${playerChampion ? "You own the night." : `You finished ${formatPlace(playerStanding?.rank ?? 8)} with ${playerStanding?.points ?? 0} points.`}</h2>
        </header>
        <ol class="podium" aria-label="Top three finishers">${podium}</ol>
        <div class="standings-wrap">
          <table class="standings-table">
            <caption>Final standings</caption>
            <thead>
              <tr><th scope="col">Driver</th>${roundHeaders}<th scope="col">Wins</th><th scope="col">Points</th></tr>
            </thead>
            <tbody>${standingRows}</tbody>
          </table>
        </div>
        ${
          awardRecap
            ? `<section class="award-recap" aria-labelledby="award-recap-title"><h3 id="award-recap-title">Your Wreck Awards</h3><ul>${awardRecap}</ul></section>`
            : ""
        }
        <button class="primary-button" id="start-btn" type="button">Run Another Career Night</button>
        <p class="hint">Press R or click to return to the garage.</p>
      </section>
    `;
    menu
      .querySelector<HTMLButtonElement>("#start-btn")
      ?.addEventListener("click", () => {
        restartState(state);
        renderMenuContent(true);
      });
  }

  function renderMenuContent(force = false): void {
    if (state.mode === "car_preview") {
      menu.dataset.mode = state.mode;
      menu.innerHTML = "";
      return;
    }

    if (!force && menu.dataset.mode === state.mode) {
      return;
    }
    menu.dataset.mode = state.mode;

    if (state.mode === "menu") {
      renderMainMenu();
    } else if (state.mode === "car_select") {
      renderCarSelectMenu();
    } else if (state.mode === "spectating") {
      renderSpectatingMenu();
    } else if (state.mode === "round_results") {
      renderRoundResultsMenu();
    } else if (state.mode === "upgrade") {
      renderUpgradeMenu();
    } else if (state.mode === "career_over") {
      renderCareerOverMenu();
    }
  }

  function syncMenu(): void {
    menu.hidden = shouldHideMenu(state.mode);
    renderMenuContent();
    if (state.mode === "spectating") {
      const remaining = getActiveCars(state).length;
      const count = menu.querySelector<HTMLElement>("[data-remaining-count]");
      const label = menu.querySelector<HTMLElement>("[data-remaining-label]");
      if (count) {
        count.textContent = String(remaining);
      }
      if (label) {
        label.textContent = remaining === 1 ? "driver is" : "drivers are";
      }
    }
  }

  function resizeCanvas(): void {
    const container = frame.getBoundingClientRect();
    const size = computeCanvasDisplaySize(
      state.arena.width,
      state.arena.height,
      container.width,
      container.height,
    );
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
  }

  function activateAudio(): void {
    void audio.ensureStarted().catch((error: unknown) => {
      console.error("Unable to start audio.", error);
    });
  }

  function toggleFullscreen(): void {
    if (!doc.fullscreenElement) {
      void frame.requestFullscreen?.();
    } else {
      void doc.exitFullscreen?.();
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    activateAudio();
    if (event.repeat) {
      return;
    }
    if (setInputKeyState(input, event.code, true)) {
      event.preventDefault();
    }
    if (event.code === "Enter") {
      if (state.mode === "menu") {
        beginCarSelect(state);
        syncMenu();
      } else if (state.mode === "round_results") {
        advanceAfterRound(state);
        syncMenu();
      } else if (state.mode === "spectating") {
        skipSpectatingRound();
      } else if (state.mode === "career_over") {
        restartState(state);
        renderMenuContent(true);
      }
    }
    if (event.code === "KeyF") {
      toggleFullscreen();
    }
    const presetShortcut = /^Digit([1-9])$/.exec(event.code);
    const preset = presetShortcut
      ? orderedCarPresets[Number(presetShortcut[1]) - 1]
      : null;
    if (preset && state.mode === "car_select") {
      chooseStarterCar(state, preset.id);
      syncMenu();
    }
    if (
      event.code === "KeyR" &&
      state.mode !== "running" &&
      state.mode !== "intro" &&
      state.mode !== "spectating"
    ) {
      restartState(state);
      renderMenuContent(true);
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (setInputKeyState(input, event.code, false)) {
      event.preventDefault();
    }
  };

  const handlePointerDown = () => {
    activateAudio();
  };

  doc.addEventListener("keydown", handleKeyDown);
  doc.addEventListener("keyup", handleKeyUp);
  doc.addEventListener("pointerdown", handlePointerDown, { passive: true });
  win.addEventListener("resize", resizeCanvas);
  doc.addEventListener("fullscreenchange", resizeCanvas);

  teardown.push(() => doc.removeEventListener("keydown", handleKeyDown));
  teardown.push(() => doc.removeEventListener("keyup", handleKeyUp));
  teardown.push(() => doc.removeEventListener("pointerdown", handlePointerDown));
  teardown.push(() => win.removeEventListener("resize", resizeCanvas));
  teardown.push(() => doc.removeEventListener("fullscreenchange", resizeCanvas));

  function tick(dt: number): void {
    if (state.mode === "running") {
      applyPlayerControls(state, input);
    }
    advanceState(state, dt);
    audio.update(state);
  }

  function present(): void {
    renderGame(renderContext, state);
    syncMenu();
  }

  let lastTime = performanceNow();
  let accumulator = 0;
  const fixedStep = 1 / 60;
  let skipNextFrameCatchup = false;

  function skipSpectatingRound(): void {
    if (state.mode !== "spectating" || spectatorSkipActive || destroyed) {
      return;
    }

    spectatorSkipActive = true;
    renderMenuContent(true);
    let remainingSteps = 90 * 60;

    const runBatch = () => {
      if (destroyed || state.mode !== "spectating") {
        spectatorSkipActive = false;
        return;
      }

      const batchSize = Math.min(60, remainingSteps);
      let completedSteps = 0;
      while (
        completedSteps < batchSize &&
        state.mode === "spectating"
      ) {
        advanceState(state, fixedStep);
        completedSteps += 1;
      }
      remainingSteps -= completedSteps;

      if (state.mode === "spectating" && remainingSteps <= 0) {
        finishSpectatingRound(state);
      }
      audio.update(state);

      if (state.mode === "spectating") {
        present();
        requestAnimationFrame(runBatch);
        return;
      }

      spectatorSkipActive = false;
      present();
    };

    requestAnimationFrame(runBatch);
  }

  function advanceTime(ms: number): void {
    if (destroyed) {
      return;
    }
    accumulator = 0;
    lastTime = performanceNow();
    skipNextFrameCatchup = true;
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) {
      tick(fixedStep);
    }
    present();
  }

  function scheduleNextFrame(): void {
    if (!destroyed) {
      requestAnimationFrame(frameLoop);
    }
  }

  function frameLoop(now: number): void {
    if (destroyed) {
      return;
    }
    if (spectatorSkipActive) {
      lastTime = now;
      accumulator = 0;
      scheduleNextFrame();
      return;
    }
    if (automatedStepping) {
      lastTime = now;
      accumulator = 0;
      present();
      scheduleNextFrame();
      return;
    }
    if (skipNextFrameCatchup) {
      lastTime = now;
      accumulator = 0;
      skipNextFrameCatchup = false;
      present();
      scheduleNextFrame();
      return;
    }
    const delta = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    accumulator += delta;
    while (accumulator >= fixedStep) {
      tick(fixedStep);
      accumulator -= fixedStep;
    }
    present();
    scheduleNextFrame();
  }

  const renderGameToTextHook = () => renderGameToText(state);
  installBrowserHooks(win, {
    advanceTime,
    renderGameToText: renderGameToTextHook,
  });

  resizeCanvas();
  renderMenuContent(true);
  present();
  scheduleNextFrame();

  return {
    state,
    frame,
    canvas,
    menu,
    input,
    tick,
    present,
    syncMenu,
    resizeCanvas,
    advanceTime,
    destroy: async () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      teardown.forEach((cleanup) => cleanup());
      if (win.advanceTime === advanceTime) {
        delete win.advanceTime;
      }
      if (win.render_game_to_text === renderGameToTextHook) {
        delete win.render_game_to_text;
      }
      await audio.destroy();
    },
  };
}

export function bootstrapApp(options: BootstrapOptions): AppController | null {
  try {
    return createAppController(options);
  } catch (error) {
    console.error(error);
    renderStartupError(
      options.appRoot,
      error instanceof Error ? error.message : "Smashup Derby failed to start.",
      options.doc ?? options.appRoot.ownerDocument,
    );
    return null;
  }
}
