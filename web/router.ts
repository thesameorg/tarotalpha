/**
 * Two routes on the History API, no framework: `/` is the landing with the reading flow, `/r/:id` a saved reading.
 * The Worker serves index.html for any path, so a deep link mounts the same way as an in-app navigation.
 */
export interface View {
  mount(root: HTMLElement): void;
  unmount(): void;
}

export type Navigate = (path: string) => void;
export type Resolve = (url: URL, navigate: Navigate) => View;

export function startRouter(root: HTMLElement, resolve: Resolve): Navigate {
  let current: View | null = null;

  const render = (): void => {
    current?.unmount();
    root.replaceChildren();
    current = resolve(new URL(window.location.href), navigate);
    current.mount(root);
    window.scrollTo(0, 0);
  };

  const navigate: Navigate = (path) => {
    window.history.pushState(null, "", path);
    render();
  };

  window.addEventListener("popstate", render);
  render();
  return navigate;
}
