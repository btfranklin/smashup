// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
  createMenuPresenter,
  type MenuActions,
} from "../src/app/menu";
import {
  chooseStarterCar,
  createInitialState,
} from "../src/game/session";

function createActions(): MenuActions {
  return {
    beginCarSelect: vi.fn(),
    chooseStarterCar: vi.fn(),
    advanceAfterRound: vi.fn(),
    applySessionUpgrade: vi.fn(),
    skipSpectatingRound: vi.fn(),
    restart: vi.fn(),
  };
}

describe("menu presenter lifecycle", () => {
  it("disposes retained actions and ignores all work after destroy", () => {
    const menu = document.createElement("section");
    const actions = createActions();
    const presenter = createMenuPresenter(
      menu,
      createInitialState(),
      actions,
    );
    presenter.sync(true);
    const retainedButton =
      menu.querySelector<HTMLButtonElement>("#start-btn");
    if (!retainedButton) {
      throw new Error("Start button missing.");
    }

    presenter.destroy();
    presenter.destroy();
    presenter.sync(true);
    presenter.setSpectatorSkipActive(true);
    retainedButton.click();

    expect(actions.beginCarSelect).not.toHaveBeenCalled();
    expect(menu.dataset.mode).toBe("menu");
  });

  it("updates the live spectator count without rebuilding the menu", () => {
    const menu = document.createElement("section");
    const state = createInitialState();
    chooseStarterCar(state, "bulldozer", 42);
    state.mode = "spectating";
    state.cars.slice(2).forEach((car) => {
      car.disabled = true;
    });
    const presenter = createMenuPresenter(menu, state, createActions());
    presenter.sync(true);
    const renderedButton = menu.querySelector("#skip-btn");
    expect(menu.textContent).toContain("2 drivers are");

    state.cars[1].disabled = true;
    presenter.sync();
    presenter.setSpectatorSkipActive(false);
    presenter.setSpectatorSkipActive(true);

    expect(menu.textContent).toContain("1 driver is");
    expect(menu.querySelector("#skip-btn")).not.toBe(renderedButton);
    expect(
      menu.querySelector<HTMLButtonElement>("#skip-btn")?.disabled,
    ).toBe(true);
  });
});
