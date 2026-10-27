import { describe, expect, test } from "vitest";

import type { TrustStat } from "@/content/home";
import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../messages/en.json";

import { sceneAttribute } from "./scroll-scene-attributes";
import { StatTile } from "./stat-tile";

const vehicles: TrustStat = { id: "vehicles", value: 5000, decimals: 0, counts: true };
const rating: TrustStat = { id: "rating", value: 4.8, decimals: 1, counts: true };
const warranty: TrustStat = { id: "warranty", value: 6, decimals: 0, counts: false };

/** A stat inside the <dl> it belongs in, and its parts. */
function renderStat(stat: TrustStat, sample = false) {
  const { container } = renderWithIntl(
    <dl>
      <StatTile stat={stat} sample={sample} />
    </dl>,
  );
  const value = container.querySelector("dd")!;
  const [copy, animated] = [...value.children] as HTMLElement[];
  return { container, label: container.querySelector("dt")!, value, copy, animated };
}

describe("StatTile", () => {
  test("a label and its value: 5,000+ vehicles serviced, grouped the Indian way", () => {
    const { label, copy } = renderStat(vehicles);
    expect(label.textContent).toBe(messages.HomePage.stats.vehicles.label);
    expect(copy.textContent).toBe("5,000+");
  });

  test("two copies of the value in one cell: screen readers read one, the other is the one that counts", () => {
    const { value, copy, animated } = renderStat(vehicles);
    expect(value.children).toHaveLength(2);
    // The copy screen readers read: the final value, never hidden from them.
    expect(copy.getAttribute("aria-hidden")).toBeNull();
    expect(copy.textContent).toBe("5,000+");
    // The copy the effects count up: hidden from screen readers, so nothing is
    // announced while it changes.
    expect(animated.getAttribute("aria-hidden")).toBe("true");
    expect(animated.textContent).toBe("5,000+");
  });

  test("only the digits count; the words around them stay put", () => {
    const { animated } = renderStat(vehicles);
    const digits = animated.querySelector(`[${sceneAttribute.count}]`)!;
    expect(digits.textContent).toBe("5,000");
    expect(digits.getAttribute(sceneAttribute.count)).toBe("5000");
    expect(digits.hasAttribute(sceneAttribute.countDecimals)).toBe(false);
  });

  test("no live region: counting is never announced", () => {
    const { container } = renderStat(vehicles);
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  test("the rating counts with one decimal: 4.8/5", () => {
    const { copy, animated } = renderStat(rating);
    expect(copy.textContent).toBe("4.8/5");
    const digits = animated.querySelector(`[${sceneAttribute.count}]`)!;
    expect(digits.getAttribute(sceneAttribute.count)).toBe("4.8");
    expect(digits.getAttribute(sceneAttribute.countDecimals)).toBe("1");
  });

  test("the warranty is shown, not counted", () => {
    const { container, copy } = renderStat(warranty);
    expect(copy.textContent).toBe("6 months");
    expect(container.querySelector(`[${sceneAttribute.count}]`)).toBeNull();
  });

  test("a sample shows the Sample badge and is marked data-sample; a real stat neither", () => {
    const sample = renderStat(vehicles, true);
    expect(sample.container.querySelector("[data-sample]")).not.toBeNull();
    expect(sample.label.textContent).toContain(messages.HomePage.sample);
    sample.container.remove();

    const real = renderStat(vehicles);
    expect(real.container.querySelector("[data-sample]")).toBeNull();
    expect(real.container.textContent).not.toContain(messages.HomePage.sample);
  });
});
