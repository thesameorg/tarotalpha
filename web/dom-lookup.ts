/** An element the view's own markup guarantees: a miss or a wrong tag is a template bug, so it throws. */
export function required<T extends Element>(root: ParentNode, selector: string, type: new () => T): T {
  const el = root.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`missing element ${selector}`);
  return el;
}
