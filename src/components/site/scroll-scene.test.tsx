import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { motionAllowed, motionReduced } from "@/lib/motion";

// ScrollScene loads its effects (and with them GSAP) only in the browser,
// only once the page has loaded, and only for visitors who allow motion
// (plan KTD2). jsdom can't run the animations themselves; the browser tests
// do that. Here the effects module is a stand-in that records when it's
// loaded and when it mounts and unmounts.
const effects = { loaded: vi.fn(), mounted: vi.fn(), unmounted: vi.fn() };

// The App Router build swaps next/dynamic for its own version, React.lazy
// underneath (node_modules/next/dist/build/create-compiler-aliases.js maps it
// to next/dist/api/app-dynamic). Vitest would load the Pages Router version,
// which swallows a failed load by itself, so these tests use the real one.
vi.mock("next/dynamic", async () => {
  const appDynamic = await import("next/dist/shared/lib/app-dynamic");
  // A CommonJS file whose exports are the function itself.
  return { default: appDynamic.default ?? appDynamic };
});

/**
 * Swaps scroll-scene-effects.tsx for the stand-in. vi.doMock (not vi.mock)
 * in beforeEach, with vi.resetModules(): each test then gets fresh modules,
 * and the factory runs again the first time a test imports the effects, so
 * `loaded` really means "this test downloaded the effects chunk".
 */
function mockEffects() {
  vi.doMock("./scroll-scene-effects", async () => {
    effects.loaded();
    const { useEffect } = await import("react");
    return {
      ScrollSceneEffects: function StandIn({ scope }: { scope: HTMLElement }) {
        useEffect(() => {
          effects.mounted(scope);
          return () => effects.unmounted(scope);
        }, [scope]);
        return null;
      },
    };
  });
}

/** A stand-in for the browser's motion setting, with a way to change it mid-visit. */
function stubMotionSetting(initial: "allow" | "reduce") {
  let setting = initial;
  const listeners = new Set<() => void>();
  window.matchMedia = ((query: string) => ({
    matches: setting === "allow" ? query === motionAllowed : query === motionReduced,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return {
    change(next: "allow" | "reduce") {
      setting = next;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

/** A fresh copy of scroll-scene.tsx, so a test never sees an effects module another test loaded. */
async function importScrollScene() {
  return (await import("./scroll-scene")).ScrollScene;
}

/** Lets the stand-in load and mount if it's going to. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(() => {
  vi.resetModules();
  mockEffects();
  effects.loaded.mockClear();
  effects.mounted.mockClear();
  effects.unmounted.mockClear();
});

afterEach(() => {
  // jsdom has no matchMedia of its own: remove the stand-in.
  delete (window as Partial<Window>).matchMedia;
  vi.restoreAllMocks();
  vi.doUnmock("./scroll-scene-effects");
});

describe("ScrollScene", () => {
  test("renders its children inside one wrapper", async () => {
    const ScrollScene = await importScrollScene();
    const { container } = render(
      <ScrollScene>
        <h2>How it works</h2>
        <p>Book on WhatsApp or call.</p>
      </ScrollScene>,
    );
    expect(container.children).toHaveLength(1);
    const wrapper = container.firstElementChild!;
    expect(wrapper.hasAttribute("data-scroll-scene")).toBe(true);
    expect(wrapper.contains(screen.getByText("How it works"))).toBe(true);
    expect(wrapper.contains(screen.getByText("Book on WhatsApp or call."))).toBe(true);
  });

  test("on the server: the children, and no effects (the HTML never waits for GSAP)", async () => {
    stubMotionSetting("allow");
    const ScrollScene = await importScrollScene();
    const html = renderToString(
      <ScrollScene>
        <p>Services</p>
      </ScrollScene>,
    );
    expect(html).toContain("Services");
    expect(html).toContain("data-scroll-scene");
    await settle();
    expect(effects.loaded).not.toHaveBeenCalled();
  });

  test("without matchMedia (no way to ask about motion): the effects are never loaded", async () => {
    expect(window.matchMedia).toBeUndefined(); // jsdom, like a very old browser
    const ScrollScene = await importScrollScene();
    render(<ScrollScene>{null}</ScrollScene>);
    await settle();
    expect(effects.loaded).not.toHaveBeenCalled();
    expect(effects.mounted).not.toHaveBeenCalled();
  });

  test("with reduced motion: the effects are never loaded", async () => {
    stubMotionSetting("reduce");
    const ScrollScene = await importScrollScene();
    render(<ScrollScene>{null}</ScrollScene>);
    await settle();
    expect(effects.loaded).not.toHaveBeenCalled();
    expect(effects.mounted).not.toHaveBeenCalled();
  });

  test("with motion allowed: the effects mount once, with the wrapper as their scope", async () => {
    stubMotionSetting("allow");
    const ScrollScene = await importScrollScene();
    const { container } = render(<ScrollScene>{null}</ScrollScene>);
    await waitFor(() => expect(effects.mounted).toHaveBeenCalled());
    await settle();
    expect(effects.loaded).toHaveBeenCalledTimes(1);
    expect(effects.mounted).toHaveBeenCalledTimes(1);
    expect(effects.mounted).toHaveBeenCalledWith(container.firstElementChild);
  });

  test("waits until the page has loaded before loading the effects", async () => {
    stubMotionSetting("allow");
    let readyState: DocumentReadyState = "interactive";
    vi.spyOn(document, "readyState", "get").mockImplementation(() => readyState);
    const ScrollScene = await importScrollScene();
    render(<ScrollScene>{null}</ScrollScene>);
    await settle();
    expect(effects.loaded).not.toHaveBeenCalled();

    readyState = "complete";
    act(() => {
      window.dispatchEvent(new Event("load"));
    });
    await waitFor(() => expect(effects.mounted).toHaveBeenCalledTimes(1));
    // Loaded here, by this test: each test gets a fresh copy of the modules.
    expect(effects.loaded).toHaveBeenCalledTimes(1);
  });

  // The effects are an extra: whatever goes wrong with them, the page stays.
  // Without the guards in scroll-scene.tsx, React's error would replace the
  // whole page with Next.js's error screen.
  test("the effects file fails to load (offline, a blocker, an old file after a redeploy): the page stays", async () => {
    vi.doMock("./scroll-scene-effects", () => {
      throw new Error("Failed to load chunk");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubMotionSetting("allow");
    const ScrollScene = await importScrollScene();
    render(
      <ScrollScene>
        <h2>How it works</h2>
      </ScrollScene>,
    );
    await settle();
    expect(screen.getByText("How it works")).toBeTruthy();
  });

  test("the effects throw while setting up: the page stays", async () => {
    vi.doMock("./scroll-scene-effects", async () => {
      const { useLayoutEffect } = await import("react");
      return {
        ScrollSceneEffects: function Broken() {
          useLayoutEffect(() => {
            throw new Error("setup failed");
          }, []);
          return null;
        },
      };
    });
    // React reports the caught error on the console: expected here.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    stubMotionSetting("allow");
    const ScrollScene = await importScrollScene();
    render(
      <ScrollScene>
        <h2>How it works</h2>
      </ScrollScene>,
    );
    await settle();
    expect(screen.getByText("How it works")).toBeTruthy();
    expect(consoleError).toHaveBeenCalled();
  });

  test("follows a change to the motion setting during the visit", async () => {
    const setting = stubMotionSetting("reduce");
    const ScrollScene = await importScrollScene();
    render(<ScrollScene>{null}</ScrollScene>);
    await settle();
    expect(effects.mounted).not.toHaveBeenCalled();

    setting.change("allow");
    await waitFor(() => expect(effects.mounted).toHaveBeenCalledTimes(1));

    // Unmounting is what undoes the animations and their inline styles.
    setting.change("reduce");
    await waitFor(() => expect(effects.unmounted).toHaveBeenCalledTimes(1));
  });
});
