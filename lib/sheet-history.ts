export type SheetHistoryTarget = {
  history: Pick<History, 'state' | 'pushState' | 'back'>;
  location: Pick<Location, 'href'>;
  addEventListener: (type: 'popstate', listener: () => void) => void;
  removeEventListener: (type: 'popstate', listener: () => void) => void;
};

let sequence = 0;
const marker = '__lingualoopSheet';
type SheetEntry = { order: number; href: string; active: boolean; parent?: SheetEntry };
type SheetRegistry = {
  entries: Map<string, SheetEntry>;
  observed?: SheetEntry;
  skipPending: boolean;
};
const sheets = new WeakMap<SheetHistoryTarget, SheetRegistry>();

function containsSheet(entry: SheetEntry | undefined, ancestor: SheetEntry): boolean {
  for (let current = entry; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
}

/** One same-URL history entry per sheet, preserving Next's routing state. */
export function installSheetHistory(target: SheetHistoryTarget, onBack: () => void) {
  const id = `sheet-${Date.now()}-${++sequence}`;
  const href = target.location.href;
  const state = target.history.state;
  const registry: SheetRegistry = sheets.get(target) || {
    entries: new Map<string, SheetEntry>(),
    skipPending: false,
  };
  const { entries } = registry;
  sheets.set(target, registry);
  const parent = entries.get(state?.[marker]);
  const entry: SheetEntry = {
    order: sequence,
    href,
    active: true,
    parent: parent?.href === href ? parent : undefined,
  };
  entries.set(id, entry);
  registry.observed = entry;
  target.history.pushState({ ...state, [marker]: id }, '', href);
  const pop = () => {
    const current = entries.get(target.history.state?.[marker]);
    if (registry.observed !== current) {
      // History traversal is asynchronous. More Forward events may arrive
      // before our Back completes; wait until traversal moves backward before
      // skipping another orphan rather than queuing several extra Back calls.
      if (
        !current ||
        current.active ||
        (registry.observed && current.order < registry.observed.order)
      ) {
        registry.skipPending = false;
      }
      registry.observed = current;
    }
    if (target.location.href === href && containsSheet(current, entry)) {
      if (current && !current.active) {
        let nearestOpen = current.parent;
        while (nearestOpen && !nearestOpen.active) nearestOpen = nearestOpen.parent;
        // Forward can revisit a dismissed child. Only its nearest open parent
        // skips that orphan, so nested listeners cannot each issue another Back.
        if (nearestOpen === entry && !registry.skipPending) {
          registry.skipPending = true;
          target.history.back();
        }
      }
      return;
    }
    onBack();
  };
  target.addEventListener('popstate', pop);
  return () => {
    entry.active = false;
    target.removeEventListener('popstate', pop);
    if (![...entries.values()].some((sheet) => sheet.active)) sheets.delete(target);
    // A browser Back already consumed our entry. Navigation owns its own entry.
    if (target.location.href === href && target.history.state?.[marker] === id) {
      target.history.back();
    }
  };
}
