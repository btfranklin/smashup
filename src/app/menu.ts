import {
  CAR_PRESETS,
  SESSION_UPGRADES,
  WRECK_AWARD_DEFINITIONS,
  getModifierSummary,
} from "../game/content";
import {
  CAR_PRESET_IDS,
  isCarPresetId,
  isSessionUpgradeId,
  type CarPresetId,
  type SessionUpgradeId,
  type WreckAwardId,
} from "../game/contentIds";
import {
  buildCareerStandings,
  CAREER_ROUND_COUNT,
} from "../game/career";
import { getActiveCars } from "../game/selectors";
import type {
  GameState,
  Mode,
} from "../game/types";

export type MenuActions = {
  beginCarSelect: () => void;
  chooseStarterCar: (presetId: CarPresetId) => void;
  advanceAfterRound: () => void;
  applySessionUpgrade: (upgradeId: SessionUpgradeId) => void;
  skipSpectatingRound: () => void;
  restart: () => void;
};

export type MenuPresenter = {
  sync: (force?: boolean) => void;
  setSpectatorSkipActive: (active: boolean) => void;
  destroy: () => void;
};

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

export function createMenuPresenter(
  menu: HTMLElement,
  state: GameState,
  actions: MenuActions,
): MenuPresenter {
  const orderedCarPresets = CAR_PRESET_IDS.map((id) => CAR_PRESETS[id]);
  let spectatorSkipActive = false;
  let lastRemainingCount: number | null = null;
  let destroyed = false;
  let actionListenerDisposers: Array<() => void> = [];

  function clearActionListeners(): void {
    for (const dispose of actionListenerDisposers) {
      dispose();
    }
    actionListenerDisposers = [];
  }

  function listenForAction(
    element: HTMLElement | null,
    action: () => void,
  ): void {
    if (!element) {
      return;
    }
    const handleAction = () => {
      if (!destroyed) {
        action();
      }
    };
    element.addEventListener("click", handleAction);
    actionListenerDisposers.push(() =>
      element.removeEventListener("click", handleAction),
    );
  }

  function renderMainMenu(): void {
    menu.innerHTML = `
      <h1>Smashup<br />Derby</h1>
      <h2>${CAREER_ROUND_COUNT} rounds. One long night. Eight cars chasing the crown.</h2>
      <p>Choose a derby car, survive an escalating Career Night, and fight for every point in the final standings.</p>
      <button class="primary-button" id="start-btn" type="button">Start Career Night</button>
      <p class="hint">Press Enter to begin, W/A/S/D or arrows to drive, F for fullscreen.</p>
    `;
    listenForAction(
      menu.querySelector<HTMLButtonElement>("#start-btn"),
      actions.beginCarSelect,
    );
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
      <h2>Pick a derby identity for the full ${CAREER_ROUND_COUNT}-round run.</h2>
      <div class="choice-grid">${cards}</div>
      <p class="hint">Heavier cars take punishment. Faster cars escape better. Backstab hits hardest in reverse.</p>
    `;
    menu
      .querySelectorAll<HTMLButtonElement>("[data-preset-id]")
      .forEach((button) => {
        listenForAction(button, () => {
          const presetId = button.dataset.presetId;
          if (!isCarPresetId(presetId)) {
            throw new Error(`Invalid car preset button id "${presetId}".`);
          }
          actions.chooseStarterCar(presetId);
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
    const totalRounds = state.session.roundPlans.length;
    const isFinalRound = state.session.roundIndex >= totalRounds - 1;
    const roundNumber = summary?.roundNumber ?? state.session.roundIndex + 1;
    menu.innerHTML = `
      <div class="result-heading">
        <div>
          <span class="eyebrow">Round ${roundNumber} complete</span>
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
    listenForAction(
      menu.querySelector<HTMLButtonElement>("#advance-btn"),
      actions.advanceAfterRound,
    );
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
      <p>Round ${state.session.roundIndex + 2} of ${state.session.roundPlans.length}. ${nextPlan ? getModifierSummary(nextPlan.modifier) : ""}.</p>
      <div class="choice-grid">${cards}</div>
      <p class="hint">One choice only. Damage carries forward, but the pit crew gives a small baseline repair either way.</p>
    `;
    menu
      .querySelectorAll<HTMLButtonElement>("[data-upgrade-id]")
      .forEach((button) => {
        listenForAction(button, () => {
          const upgradeId = button.dataset.upgradeId;
          if (!isSessionUpgradeId(upgradeId)) {
            throw new Error(`Invalid session upgrade button id "${upgradeId}".`);
          }
          actions.applySessionUpgrade(upgradeId);
        });
      });
  }

  function renderSpectatingMenu(): void {
    const remaining = getActiveCars(state).length;
    lastRemainingCount = remaining;
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
    listenForAction(
      menu.querySelector<HTMLButtonElement>("#skip-btn"),
      actions.skipSpectatingRound,
    );
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
    const totalRounds = state.session.roundPlans.length;
    const roundHeaders = Array.from(
      { length: totalRounds },
      (_, index) => `<th scope="col">R${index + 1}</th>`,
    ).join("");
    const standingRows = standings
      .map((standing) => {
        const rounds = Array.from({ length: totalRounds }, (_, index) => {
          const place = standing.roundPlacements[index];
          return `<td>${place ? formatPlace(place) : "—"}</td>`;
        }).join("");
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
    listenForAction(
      menu.querySelector<HTMLButtonElement>("#start-btn"),
      actions.restart,
    );
  }

  function renderMenuContent(force = false): void {
    if (destroyed) {
      return;
    }
    if (state.mode === "car_preview") {
      clearActionListeners();
      menu.dataset.mode = state.mode;
      menu.innerHTML = "";
      return;
    }

    if (!force && menu.dataset.mode === state.mode) {
      return;
    }
    clearActionListeners();
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

  function sync(force = false): void {
    if (destroyed) {
      return;
    }
    menu.hidden = shouldHideMenu(state.mode);
    renderMenuContent(force);
    if (state.mode !== "spectating") {
      lastRemainingCount = null;
      return;
    }

    const remaining = getActiveCars(state).length;
    if (remaining === lastRemainingCount) {
      return;
    }
    lastRemainingCount = remaining;
    const count = menu.querySelector<HTMLElement>("[data-remaining-count]");
    const label = menu.querySelector<HTMLElement>("[data-remaining-label]");
    if (count) {
      count.textContent = String(remaining);
    }
    if (label) {
      label.textContent = remaining === 1 ? "driver is" : "drivers are";
    }
  }

  return {
    sync,
    setSpectatorSkipActive(active: boolean) {
      if (destroyed) {
        return;
      }
      if (spectatorSkipActive === active) {
        return;
      }
      spectatorSkipActive = active;
      if (state.mode === "spectating") {
        renderMenuContent(true);
      }
    },
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      clearActionListeners();
      lastRemainingCount = null;
    },
  };
}
