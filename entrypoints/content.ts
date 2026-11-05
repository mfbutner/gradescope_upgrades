// Runs on Gradescope pages when they're opened.

// Reads the group being graded from the "You are grading Group <name>" link on
// the grading page. Needs no arguments; it looks the link up itself.
// Returns e.g. { id: '1737660370', name: 'Blank' }, or null if it isn't there.
function getCurrentGroup(): { id: string; name: string } | null {
  const link = document.querySelector<HTMLAnchorElement>(
    '.submissionGraderViewer--groupModeFrame a[href*="/answer_groups/"]'
  );
  if (!link) {
    return null;
  }

  // href looks like /courses/1427172/questions/78291463/answer_groups/1737660370
  // or, for a submission that isn't in a group yet, .../answer_groups/ungrouped?submission_id=...
  const id = link.getAttribute('href')?.match(/\/answer_groups\/(\d+|ungrouped)/)?.[1];
  if (!id) {
    return null;
  }

  // The link's spans nest like <span><i/><span> Group <span>Blank</span></span></span>,
  // so the last span in document order is the one holding just the name.
  const spans = link.querySelectorAll('span');
  const name =
    spans[spans.length - 1]?.textContent?.trim() ||
    link.textContent?.trim().replace(/^Group\s+/, '') ||
    '';

  return { id, name };
}

function addCodeOption() {
  const type_form = document.querySelector('#submission_method_ .form--radioOptions');
  // The menu isn't open yet.
  if (!type_form) {
    return;
  }

  // Don't add the same option twice.
  if (type_form.querySelector('#submission_method_code')) {
    return;
  }

  console.log('Found radio container:', type_form);

  const code_type = document.createElement('span');
  code_type.classList.add('form--choice', 'form--choice-block');

  code_type.innerHTML = `
    <input
      type="radio"
      id="submission_method_code"
      name="submission[method]"
      value="code"
    >
    <label
      class="form--label form--radioButtonLabel form--radioButtonLabel-block"
      for="submission_method_code"
    >
      Code fill-in-the-blank
    </label>
  `;

  type_form.appendChild(code_type);
}

// Reads group names out of the answer-group cards under `root`
// (the live document, or a document parsed from fetched HTML).
function parseGroupNames(root: ParentNode): string[] {
  // Cards live inside this container; fall back to the whole root if absent.
  const container = root.querySelector('.answerGroupContent.js-answersContainer') ?? root;

  // The name is the text of the card's title link, e.g. "Test".
  const titles = container.querySelectorAll(
    '.answerGroupCard.answerGroupCard-collapsed .answerGroupCard--title'
  );

  return Array.from(titles)
    .map((t) => t.textContent?.trim() ?? '')
    .filter((name) => name.length > 0);
}

type RawGroup = { id: number; title: string; internalTitle: string; hidden: boolean };

// Walks parsed JSON and collects every answer-group object. Those are the ones
// that carry both `question_id` and `internal_title` (as seen in the page data).
function collectGroups(node: unknown, out: Map<number, RawGroup>) {
  if (Array.isArray(node)) {
    node.forEach((n) => collectGroups(n, out));
    return;
  }
  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (
      typeof o.id === 'number' &&
      typeof o.title === 'string' &&
      'question_id' in o &&
      'internal_title' in o
    ) {
      out.set(o.id, {
        id: o.id,
        title: o.title,
        // null or "" on groups you made; holds the OCR text on auto-made clusters.
        internalTitle: typeof o.internal_title === 'string' ? o.internal_title : '',
        hidden: o.hidden === true,
      });
    }
    Object.values(o).forEach((v) => collectGroups(v, out));
  }
}

// The groups page ships its data as JSON inside an element attribute (the
// &quot;-escaped text). DOMParser decodes the entities when we read attributes.
function parseGroupNamesFromProps(doc: Document): string[] {
  const found = new Map<number, RawGroup>();

  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const v = attr.value;
      if (v.length < 2 || (v[0] !== '{' && v[0] !== '[')) {
        continue;
      }
      try {
        collectGroups(JSON.parse(v), found);
      } catch {
        // Not JSON; ignore.
      }
    }
  });

  // Auto-made clusters of ungrouped answers carry OCR text in `internal_title`
  // (and reuse it as their title). Groups you named have it empty or null.
  return Array.from(found.values())
    .filter((g) => !g.hidden && g.title.trim().length > 0 && g.internalTitle.trim() === '')
    .map((g) => g.title.trim());
}

// Returns the names of all answer groups for the current question.
async function getGroupNames(): Promise<string[]> {
  // Already on the overview page (/answer_groups): read the live DOM.
  if (/^\/courses\/\d+\/questions\/\d+\/answer_groups\/?$/.test(location.pathname)) {
    return parseGroupNames(document);
  }

  // Anywhere else on this question: fetch the overview page and parse it.
  const m = location.pathname.match(/^\/courses\/(\d+)\/questions\/(\d+)/);
  if (!m) {
    return [];
  }

  const res = await fetch(`/courses/${m[1]}/questions/${m[2]}/answer_groups`, {
    credentials: 'same-origin',
  });
  if (!res.ok) {
    console.warn('Could not load the answer groups page:', res.status);
    return [];
  }

  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  // The cards are rendered client-side, so read the JSON the page embeds.
  const names = parseGroupNamesFromProps(doc);
  if (names.length === 0) {
    console.warn('No groups found in the fetched page data.');
  }
  names.push('Ungrouped Submission');
  return names;
}

// Fetch the group names once and reuse them. The MutationObserver calls our
// inject functions constantly, so this must not refetch every time.
let groupNamesPromise: Promise<string[]> | null = null;
function getGroupNamesCached(): Promise<string[]> {
  groupNamesPromise ??= getGroupNames().catch((err) => {
    console.warn('Failed to load group names:', err);
    groupNamesPromise = null; // allow a retry next time
    return [];
  });
  return groupNamesPromise;
}

// True only on a single group's page, e.g.
//   /courses/1427172/questions/78291463/answer_groups/1754370636   -> true
//   /courses/1427172/questions/78291463/answer_groups              -> false
// The trailing number (the group id) is what tells them apart.
function isGroupPage(): boolean {
  return /^\/courses\/\d+\/questions\/\d+\/answer_groups\/\d+\/?$/.test(location.pathname);
}

// True only on a grading page opened in group mode, e.g.
//   /courses/1427172/questions/78291463/submissions/4252176967/grade?group_mode=true
function isGradePage(): boolean {
  const pathOk = /^\/courses\/\d+\/questions\/\d+\/submissions\/\d+\/grade\/?$/.test(
    location.pathname
  );
  // location.pathname leaves out the "?group_mode=true" part, so check it separately.
  const groupMode = new URLSearchParams(location.search).get('group_mode') === 'true';
  return pathOk && groupMode;
}

// ---------------------------------------------------------------------------
// Replace "REMOVE" on each answer in a group with "MOVE"
// ---------------------------------------------------------------------------

const MOVE_BTN_ATTR = 'data-my-move-answer';

// Moves one answer out of the current group into another.
// `region` is the .answerRegion element that holds that answer.
function moveAnswer(region: HTMLElement) {
  //implement later
}

// Relabels Gradescope's per-answer "REMOVE" buttons to "MOVE". Safe to call
// repeatedly (the observer does): it only touches what has drifted back.
function overrideRemoveButtons() {
  if (!isGroupPage()) {
    return;
  }

  // Not yet relabelled ("Toggle removal ...") or already ours (our attribute).
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    `.answerRegion--caption button[aria-label^="Toggle removal"], .answerRegion--caption button[${MOVE_BTN_ATTR}]`
  );

  buttons.forEach((btn) => {
    btn.setAttribute(MOVE_BTN_ATTR, '');

    // Edit the existing text node in place (not textContent) so React keeps a
    // valid reference to it. Attribute and text edits don't trigger the
    // observer (it only watches added/removed nodes), so this can't loop.
    const textNode = Array.from(btn.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
    if (textNode && textNode.nodeValue !== 'MOVE') {
      textNode.nodeValue = 'MOVE';
    }

    // "Toggle removal for answer region 3" -> "Move answer region 3"
    const label = btn.getAttribute('aria-label') ?? '';
    if (label.startsWith('Toggle removal for')) {
      btn.setAttribute('aria-label', label.replace('Toggle removal for', 'Move'));
    }
  });
}

// Registered once on `document` in the capture phase, so it runs before
// Gradescope's own click handling and can stop it.
function onMoveAnswerClick(e: MouseEvent) {
  const target = e.target as Element | null;
  if (!target || !isGroupPage()) {
    return;
  }

  // 1. The MOVE button.
  const btn = target.closest<HTMLButtonElement>(`button[${MOVE_BTN_ATTR}]`);
  if (btn) {
    // Gradescope's "toggle removal" handler never sees this click.
    e.preventDefault();
    e.stopPropagation();

    const region = btn.closest<HTMLElement>('.answerRegion');
    if (region) {
      moveAnswer(region);
    }
    return;
  }

  // 2. The answer image itself. Clicking it also toggles removal, so swallow
  // the click and run the same move as the button. The zoom/preview icons in
  // its corner are left alone so they keep working.
  const onImage = target.closest<HTMLElement>(
    '.answerGroupCard--submissions .answerRegion--imageContainer'
  );
  if (onImage && !target.closest('.pageThumbnail--controls-topRight')) {
    e.preventDefault();
    e.stopPropagation();

    const region = onImage.closest<HTMLElement>('.answerRegion');
    if (region) {
      moveAnswer(region);
    }
  }
}

// Gradescope's "space" shortcut also toggles removal. Stop the key event from
// reaching its handler (on keydown, keyup and keypress, since we don't know
// which one it listens to). We don't preventDefault, so space can still scroll
// the page. Typing in text fields is left alone.
function onSpaceKey(e: KeyboardEvent) {
  if (e.code !== 'Space' && e.key !== ' ') {
    return;
  }
  if (!isGroupPage()) {
    return;
  }

  const target = e.target as Element | null;

  // Typing in a text field: leave completely alone.
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
    return;
  }

  // Always keep the key from reaching Gradescope's shortcut handler, even when
  // a button has focus (e.g. right after clicking MOVE). We don't preventDefault,
  // so a focused button still activates itself the normal way.
  e.stopImmediatePropagation();

  // A focused button or link handles space itself (a focused MOVE button fires
  // its own click, which is already handled above). Don't also call moveAnswer
  // here, or it would run twice.
  if (target?.closest('button, a')) {
    return;
  }

  // Run the same move as the button, once per key press (keydown only, and
  // not for held-down repeats), on the answer the mouse is currently over.
  // Assumes the shortcut acts on the hovered answer; if the mouse isn't over
  // one, nothing happens.
  if (e.type === 'keydown' && !e.repeat) {
    const region = document.querySelector<HTMLElement>(
      '.answerGroupCard--submissions .answerRegion:hover'
    );
    if (region) {
      moveAnswer(region);
    }
  }
}

// Lets the observer ask an existing dropdown to refresh itself (see below).
const refreshers = new WeakMap<HTMLElement, () => void>();

function addGradeMoveButton() {
  // Gradescope navigates without full reloads, so if we've left a grade page,
  // clean up anything we added earlier.
  if (!isGradePage()) {
    document.querySelectorAll('.my-grading-move').forEach((el) => el.remove());
    return;
  }

  // The group-mode frame on the grading page; our controls go inside it.
  const frames = document.querySelectorAll<HTMLElement>(
    '.submissionGraderViewer--groupModeFrame'
  );

  frames.forEach((frame) => {
    // Don't add twice. This check must come BEFORE adding anything: every
    // element we add triggers the MutationObserver, which calls this again.
    const existingWrapper = frame.querySelector<HTMLElement>('.my-grading-move');
    if (existingWrapper) {
      // Already added. Just let it refresh in case the current group changed
      // or only just appeared (it does nothing if nothing changed).
      refreshers.get(existingWrapper)?.();
      return;
    }

    // One wrapper holds the dropdown and the button, so cleanup and the
    // duplicate check only have to look for a single class.
    const wrapper = document.createElement('span');
    wrapper.classList.add('my-grading-move');

    const select = document.createElement('select');
    select.classList.add('my-grading-select');

    // (Re)builds the options, leaving out the group currently being graded.
    // Names come from a cache, so calling this repeatedly is cheap.
    // `builtFor` remembers which current group the options were last built
    // for, so repeated calls do nothing unless that has changed. (null = never
    // built, so the first call always builds.)
    let builtFor: string | null = null;

    const fillOptions = () => {
      // '' while the "You are grading ..." link hasn't rendered yet.
      const current = getCurrentGroup()?.name ?? '';
      if (current === builtFor) {
        return; // nothing changed since the last build
      }

      getGroupNamesCached().then((names) => {
        const previous = select.value; // keep the user's pick across rebuilds

        select.length = 0; // clear old options
        select.add(new Option('Move Group...', '')); // placeholder
        for (const name of names) {
          if (name === current) {
            continue; // can't move a group's answers into itself
          }
          select.add(new Option(name, name)); // (text, value)
        }

        if (Array.from(select.options).some((o) => o.value === previous)) {
          select.value = previous;
        }
        builtFor = current;
      });
    };

    fillOptions();
    select.addEventListener('focus', fillOptions);
    // The observer calls this (see the existing-wrapper check above), so the
    // list is rebuilt as soon as the current group appears or changes.
    refreshers.set(wrapper, fillOptions);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.classList.add(
      'tiiBtn',
      'tiiBtn-secondaryLink',
      'standaloneLink',
      'answerGroupCard--controlButton'
    );

    btn.innerHTML = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style="vertical-align: middle; margin-right: 4px;"
      >
        <path
          d="M12 3V21M12 3L9 6M12 3L15 6M12 21L15 18M12 21L9 18M3 12H21M3 12L6 15M3 12L6 9M21 12L18 9M21 12L18 15"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span aria-hidden="true">Move</span>
    `;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!select.value) {
        return; // nothing chosen yet
      }
      // TODO: your move logic. The chosen group name is select.value.
      console.log('Move to group:', select.value);
    });

    wrapper.append(select, btn);
    frame.appendChild(wrapper);
  });
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

type Group = { id: string; name: string; count: number };

// In memory only for now (resets on page reload). Seeded with the two groups
// from your example so there is something to look at.
const groups: Group[] = [
  { id: '1', name: 'Test', count: 4 },
  { id: '2', name: 'Blank', count: 3 },
];

const SIDEBAR_ID = 'my-grading-sidebar';

// Group names are user-typed, so escape them before putting them in innerHTML.
function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return s.replace(/[&<>"']/g, (c) => map[c]);
}

// Rebuilds the sidebar contents from `groups`. Reuses Gradescope's own class
// names so it picks up their styling.
function renderSidebar(root: HTMLElement) {
  const items = groups
    .map(
      (g) => `
        <li class="answerGroupDrawer--listItem">
          <div class="answerGroupDrawer--answerRegion">
            <div class="answerGroupDrawer--answerRegionTitleContainer">
              <span class="answerGroupDrawer--answerRegionTitle">
                <span><i class="fa fa-folder" role="img" aria-hidden="true"></i><span> ${escapeHtml(g.name)}</span></span>
                (${g.count})
              </span>
              <span class="answerGroupDrawer--editLink">
                <button
                  type="button"
                  class="tiiBtn tiiBtn-secondaryLink standaloneLink"
                  data-action="edit"
                  data-id="${escapeHtml(g.id)}"
                  aria-label="Edit group ${escapeHtml(g.name)}"
                >
                  <span><i class="fa fa-cog" role="img" aria-hidden="true"></i><span> Edit</span></span>
                </button>
              </span>
            </div>
          </div>
        </li>`
    )
    .join('');

  root.innerHTML = `
    <div class="answerGroupDrawer">
      <div class="answerGroupDrawer--header">
        <div class="answerGroupDrawer--instructions">No answers selected.</div>
        <button
          type="button"
          class="tiiBtn tiiBtn-primary answerGroupDrawer--createButton"
          data-action="create"
        >
          <span><i class="fa fa-plus" role="img" aria-hidden="true"></i><span> Create a Group</span></span>
        </button>
      </div>
      <div class="answerGroupDrawer--content">
        <ol class="answerGroupDrawer--list">${items}</ol>
      </div>
    </div>
  `;
}

const SIDEBAR_WIDTH = 300;
const SIDEBAR_STYLE_ID = 'my-grading-sidebar-style';

// Reserves room on the right so the page lays out in the remaining space
// instead of sitting underneath the fixed sidebar.
function setSidebarSpace(open: boolean) {
  const existing = document.getElementById(SIDEBAR_STYLE_ID);

  if (!open) {
    existing?.remove();
    return;
  }
  if (existing) {
    return;
  }

  const style = document.createElement('style');
  style.id = SIDEBAR_STYLE_ID;
  style.textContent = `body { margin-right: ${SIDEBAR_WIDTH}px !important; }`;
  document.head.appendChild(style);
}

function addSidebar() {
  // Only show on a single group's page (see isGroupPage).
  const existing = document.getElementById(SIDEBAR_ID);

  if (!isGroupPage()) {
    // Gradescope navigates without full reloads, so clean up when we leave.
    existing?.remove();
    setSidebarSpace(false);
    return;
  }

  // Don't add twice.
  if (existing) {
    return;
  }

  const root = document.createElement('div');
  root.id = SIDEBAR_ID;

  // Mounted on <body>, outside React's tree, so re-renders won't wipe it.
  Object.assign(root.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: `${SIDEBAR_WIDTH}px`,
    height: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    background: '#fff',
    borderLeft: '1px solid #ddd',
    boxShadow: '-2px 0 6px rgba(0, 0, 0, 0.08)',
    zIndex: '10000',
  });

  // One listener for the whole sidebar; survives re-renders of its contents.
  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) {
      return;
    }

    if (target.dataset.action === 'create') {
      const name = window.prompt('Group name?')?.trim();
      if (!name) {
        return;
      }
      groups.push({ id: String(Date.now()), name, count: 0 });
      renderSidebar(root);
    } else if (target.dataset.action === 'edit') {
      const group = groups.find((g) => g.id === target.dataset.id);
      if (!group) {
        return;
      }
      const name = window.prompt('Rename group', group.name)?.trim();
      if (!name) {
        return;
      }
      group.name = name;
      renderSidebar(root);
    }
  });

  renderSidebar(root);
  document.body.appendChild(root);
  setSidebarSpace(true);
}

export default defineContentScript({
  matches: ['https://*.gradescope.com/*'],
  main() {
    console.log('Content script loaded on', location.href);

    browser.runtime.sendMessage({ type: 'PING' }).then(console.log);

    // Intercept clicks on the relabelled MOVE buttons before Gradescope sees them.
    document.addEventListener('click', onMoveAnswerClick, true);

    // Same idea for the space shortcut. `window` + capture = first in line.
    for (const type of ['keydown', 'keyup', 'keypress'] as const) {
      window.addEventListener(type, onSpaceKey, true);
    }

    const run = () => {
      addCodeOption();
      addGradeMoveButton();
      overrideRemoveButtons();
      addSidebar();
    };

    // Gradescope is a React app: elements appear and get re-rendered after
    // load, so inject (idempotently) whenever the DOM changes.
    const observer = new MutationObserver(run);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    run();
  },
});