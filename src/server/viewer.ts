export type ViewerChromeContext = {
  projectId: string;
  documentId: string;
  revisionId: string;
  versionLabel: string;
  title: string;
  commentsApi: string;
};

export function injectViewerChrome(html: string, context: ViewerChromeContext): string {
  const payload = safeJsonForScript(context);
  const chrome = `${viewerStyles()}
<script id="marklog-viewer-context" type="application/json">${payload}</script>
<script>${viewerScript()}</script>`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${chrome}\n</body>`);
  }
  return `${html}\n${chrome}`;
}

function safeJsonForScript(value: ViewerChromeContext): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function viewerStyles(): string {
  return String.raw`<style id="marklog-viewer-styles">
  .marklog-viewer-root {
    position: fixed !important;
    inset: auto 18px 18px auto !important;
    z-index: 2147483000 !important;
    color: #1c2430 !important;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    line-height: 1.4 !important;
  }

  .marklog-comment-toggle {
    min-width: 120px !important;
    height: 38px !important;
    border: 1px solid #235ba8 !important;
    border-radius: 6px !important;
    background: #235ba8 !important;
    color: #fff !important;
    box-shadow: 0 10px 24px rgba(18, 25, 33, 0.18) !important;
    cursor: pointer !important;
    font: inherit !important;
    font-weight: 700 !important;
  }

  .marklog-comment-panel {
    position: absolute !important;
    right: 0 !important;
    bottom: 48px !important;
    display: none !important;
    width: min(380px, calc(100vw - 36px)) !important;
    max-height: min(620px, calc(100vh - 84px)) !important;
    overflow: auto !important;
    border: 1px solid #cfd6df !important;
    border-radius: 8px !important;
    background: #fff !important;
    box-shadow: 0 18px 48px rgba(18, 25, 33, 0.24) !important;
  }

  .marklog-comment-panel.open {
    display: block !important;
  }

  .marklog-comment-header,
  .marklog-comment-section {
    padding: 14px !important;
    border-bottom: 1px solid #dfe4ea !important;
  }

  .marklog-comment-header {
    display: flex !important;
    justify-content: space-between !important;
    gap: 12px !important;
    align-items: flex-start !important;
    background: #fbfcfd !important;
  }

  .marklog-comment-eyebrow {
    margin: 0 0 4px !important;
    color: #687789 !important;
    font-size: 11px !important;
    font-weight: 800 !important;
    text-transform: uppercase !important;
  }

  .marklog-comment-title {
    margin: 0 !important;
    color: #1c2430 !important;
    font-size: 15px !important;
    font-weight: 800 !important;
  }

  .marklog-comment-close,
  .marklog-comment-save,
  .marklog-comment-cancel {
    min-height: 32px !important;
    border: 1px solid #b8c1cc !important;
    border-radius: 6px !important;
    background: #fff !important;
    color: #1c2430 !important;
    padding: 0 10px !important;
    cursor: pointer !important;
    font: inherit !important;
  }

  .marklog-comment-save {
    border-color: #235ba8 !important;
    background: #235ba8 !important;
    color: #fff !important;
  }

  .marklog-comment-field {
    display: grid !important;
    gap: 5px !important;
    margin-bottom: 10px !important;
  }

  .marklog-comment-field label {
    color: #526072 !important;
    font-size: 12px !important;
    font-weight: 700 !important;
  }

  .marklog-comment-field input,
  .marklog-comment-field textarea {
    width: 100% !important;
    border: 1px solid #b8c1cc !important;
    border-radius: 6px !important;
    background: #fff !important;
    color: #1c2430 !important;
    font: inherit !important;
    font-size: 13px !important;
  }

  .marklog-comment-field input {
    height: 34px !important;
    padding: 0 9px !important;
  }

  .marklog-comment-field textarea {
    min-height: 86px !important;
    padding: 8px 9px !important;
    resize: vertical !important;
  }

  .marklog-selection-quote,
  .marklog-comment-quote {
    border-left: 3px solid #8ac2b7 !important;
    background: #f3faf8 !important;
    color: #344154 !important;
    padding: 8px 10px !important;
    font-size: 12px !important;
    overflow-wrap: anywhere !important;
  }

  .marklog-comment-actions {
    display: flex !important;
    justify-content: flex-end !important;
    gap: 8px !important;
  }

  .marklog-comment-help,
  .marklog-comment-empty,
  .marklog-comment-error,
  .marklog-comment-meta {
    color: #687789 !important;
    font-size: 12px !important;
  }

  .marklog-comment-error {
    color: #a03d20 !important;
  }

  .marklog-comment-list {
    display: grid !important;
    gap: 10px !important;
    padding: 14px !important;
  }

  .marklog-comment-item {
    display: grid !important;
    gap: 7px !important;
    border: 1px solid #dfe4ea !important;
    border-radius: 6px !important;
    background: #f8fafc !important;
    padding: 10px !important;
  }

  .marklog-comment-note {
    margin: 0 !important;
    color: #1c2430 !important;
    font-size: 13px !important;
    white-space: pre-wrap !important;
  }

  .marklog-comment-highlight {
    background: #fff3b0 !important;
    box-shadow: 0 0 0 2px rgba(168, 128, 30, 0.18) !important;
    border-radius: 3px !important;
  }

  .marklog-comment-marker {
    display: inline-grid !important;
    place-items: center !important;
    min-width: 20px !important;
    height: 20px !important;
    margin: 0 3px !important;
    border: 1px solid #a8801e !important;
    border-radius: 999px !important;
    background: #fff7d6 !important;
    color: #5c4712 !important;
    font: inherit !important;
    font-size: 11px !important;
    font-weight: 800 !important;
    line-height: 1 !important;
    vertical-align: baseline !important;
    cursor: pointer !important;
  }

  .marklog-comment-marker:hover,
  .marklog-comment-marker.active {
    border-color: #235ba8 !important;
    background: #eaf2ff !important;
    color: #173f77 !important;
  }

  .marklog-comment-popover {
    position: fixed !important;
    z-index: 2147483001 !important;
    display: none !important;
    width: min(340px, calc(100vw - 28px)) !important;
    border: 1px solid #c7d0dc !important;
    border-radius: 8px !important;
    background: #ffffff !important;
    box-shadow: 0 18px 44px rgba(18, 25, 33, 0.24) !important;
    padding: 12px !important;
    color: #1c2430 !important;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  }

  .marklog-comment-popover.open {
    display: grid !important;
    gap: 8px !important;
  }

  .marklog-comment-popover .marklog-comment-actions {
    justify-content: space-between !important;
  }

  .marklog-comment-composer[hidden] {
    display: none !important;
  }
</style>`;
}

function viewerScript(): string {
  return String.raw`(function () {
  var contextNode = document.getElementById('marklog-viewer-context');
  if (!contextNode || document.querySelector('.marklog-viewer-root')) return;

  var context = JSON.parse(contextNode.textContent || '{}');
  var state = {
    comments: [],
    selectionText: '',
    selectionAnchor: emptyAnchor()
  };

  var root = document.createElement('div');
  root.className = 'marklog-viewer-root';
  root.innerHTML =
    '<aside class="marklog-comment-panel" aria-label="Revision comments">' +
      '<div class="marklog-comment-header">' +
        '<div>' +
          '<p class="marklog-comment-eyebrow">Marklog Comments</p>' +
          '<h2 class="marklog-comment-title"></h2>' +
          '<div class="marklog-comment-meta"></div>' +
        '</div>' +
        '<button class="marklog-comment-close" type="button">Close</button>' +
      '</div>' +
      '<section class="marklog-comment-section">' +
        '<p class="marklog-comment-help">Drag over page text to write a comment on this revision.</p>' +
        '<div class="marklog-comment-field">' +
          '<label for="marklog-comment-author">Name</label>' +
          '<input id="marklog-comment-author" autocomplete="name" maxlength="80">' +
        '</div>' +
        '<form class="marklog-comment-composer" hidden>' +
          '<div class="marklog-comment-field">' +
            '<label>Selected text</label>' +
            '<div class="marklog-selection-quote"></div>' +
          '</div>' +
          '<div class="marklog-comment-field">' +
            '<label for="marklog-comment-note">Comment</label>' +
            '<textarea id="marklog-comment-note" required maxlength="4000"></textarea>' +
          '</div>' +
          '<p class="marklog-comment-error" hidden></p>' +
          '<div class="marklog-comment-actions">' +
            '<button class="marklog-comment-cancel" type="button">Cancel</button>' +
            '<button class="marklog-comment-save" type="submit">Save</button>' +
          '</div>' +
        '</form>' +
      '</section>' +
      '<div class="marklog-comment-list"></div>' +
    '</aside>' +
    '<button class="marklog-comment-toggle" type="button">Comments</button>' +
    '<div class="marklog-comment-popover" role="dialog" aria-live="polite"></div>';
  document.body.appendChild(root);

  var panel = root.querySelector('.marklog-comment-panel');
  var toggle = root.querySelector('.marklog-comment-toggle');
  var closeButton = root.querySelector('.marklog-comment-close');
  var title = root.querySelector('.marklog-comment-title');
  var meta = root.querySelector('.marklog-comment-meta');
  var author = root.querySelector('#marklog-comment-author');
  var composer = root.querySelector('.marklog-comment-composer');
  var quote = root.querySelector('.marklog-selection-quote');
  var note = root.querySelector('#marklog-comment-note');
  var error = root.querySelector('.marklog-comment-error');
  var cancel = root.querySelector('.marklog-comment-cancel');
  var list = root.querySelector('.marklog-comment-list');
  var popover = root.querySelector('.marklog-comment-popover');

  title.textContent = context.title || 'Revision';
  meta.textContent = 'Revision ' + (context.versionLabel || '');
  author.value = window.localStorage.getItem('marklog.viewer.author') || 'Viewer';

  toggle.addEventListener('click', function () {
    panel.classList.toggle('open');
  });
  closeButton.addEventListener('click', function () {
    panel.classList.remove('open');
  });
  cancel.addEventListener('click', function () {
    clearComposer();
  });
  document.addEventListener('click', function (event) {
    if (!popover.classList.contains('open')) return;
    if (popover.contains(event.target)) return;
    if (event.target && event.target.classList && event.target.classList.contains('marklog-comment-marker')) return;
    closeCommentPopover();
  });
  author.addEventListener('change', function () {
    window.localStorage.setItem('marklog.viewer.author', author.value.trim() || 'Viewer');
  });

  document.addEventListener('mouseup', function () {
    window.setTimeout(captureSelection, 0);
  });
  document.addEventListener('keyup', function () {
    window.setTimeout(captureSelection, 0);
  });

  composer.addEventListener('submit', function (event) {
    event.preventDefault();
    saveComment();
  });

  loadComments();

  function captureSelection() {
    var selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    if (selection.anchorNode && root.contains(selection.anchorNode)) return;
    if (selection.focusNode && root.contains(selection.focusNode)) return;
    var text = selection.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 2) return;
    state.selectionText = text.slice(0, 2000);
    state.selectionAnchor = buildSelectionAnchor(selection, state.selectionText);
    quote.textContent = state.selectionText;
    error.hidden = true;
    error.textContent = '';
    composer.hidden = false;
    panel.classList.add('open');
    note.focus({ preventScroll: true });
  }

  function clearComposer() {
    state.selectionText = '';
    state.selectionAnchor = emptyAnchor();
    quote.textContent = '';
    note.value = '';
    error.hidden = true;
    error.textContent = '';
    composer.hidden = true;
  }

  async function loadComments() {
    try {
      var response = await fetch(context.commentsApi, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Failed to load comments');
      state.comments = await response.json();
      renderComments();
    } catch (loadError) {
      list.textContent = 'Unable to load comments.';
    }
  }

  async function saveComment() {
    var noteText = note.value.trim();
    var authorName = author.value.trim() || 'Viewer';
    if (!state.selectionText || !noteText) return;
    window.localStorage.setItem('marklog.viewer.author', authorName);
    error.hidden = true;
    error.textContent = '';
    try {
      var response = await fetch(context.commentsApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          authorName: authorName,
          selectedText: state.selectionText,
          anchor: state.selectionAnchor,
          note: noteText
        })
      });
      if (!response.ok) throw new Error('Failed to save comment');
      var saved = await response.json();
      state.comments.push(saved);
      clearComposer();
      renderComments();
    } catch (saveError) {
      error.textContent = 'Could not save the comment.';
      error.hidden = false;
    }
  }

  function renderComments() {
    list.replaceChildren();
    toggle.textContent = 'Comments (' + state.comments.length + ')';
    renderCommentAnchors();
    if (state.comments.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'marklog-comment-empty';
      empty.textContent = 'No comments on this revision yet.';
      list.appendChild(empty);
      return;
    }
    state.comments.forEach(function (comment) {
      var item = document.createElement('article');
      item.className = 'marklog-comment-item';

      var itemMeta = document.createElement('div');
      itemMeta.className = 'marklog-comment-meta';
      itemMeta.textContent = comment.authorName + ' · ' + formatDate(comment.createdAt);

      var itemQuote = document.createElement('div');
      itemQuote.className = 'marklog-comment-quote';
      itemQuote.textContent = comment.selectedText;

      var itemNote = document.createElement('p');
      itemNote.className = 'marklog-comment-note';
      itemNote.textContent = comment.note;

      item.appendChild(itemMeta);
      item.appendChild(itemQuote);
      item.appendChild(itemNote);
      item.addEventListener('click', function () {
        focusComment(comment.id);
      });
      list.appendChild(item);
    });
  }

  function renderCommentAnchors() {
    clearCommentAnchors();
    state.comments.forEach(function (comment, index) {
      var range = findCommentRange(comment);
      if (!range) return;
      var highlight = document.createElement('mark');
      highlight.className = 'marklog-comment-highlight';
      highlight.dataset.commentId = comment.id;
      try {
        highlight.appendChild(range.extractContents());
        range.insertNode(highlight);
      } catch (error) {
        return;
      }

      var marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'marklog-comment-marker';
      marker.dataset.commentId = comment.id;
      marker.textContent = String(index + 1);
      marker.setAttribute('aria-label', 'Open comment ' + String(index + 1));
      marker.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        openCommentPopover(comment, marker);
      });
      highlight.after(marker);
    });
  }

  function clearCommentAnchors() {
    document.querySelectorAll('.marklog-comment-marker').forEach(function (marker) {
      marker.remove();
    });
    document.querySelectorAll('.marklog-comment-highlight').forEach(function (highlight) {
      var parent = highlight.parentNode;
      while (highlight.firstChild) {
        parent.insertBefore(highlight.firstChild, highlight);
      }
      highlight.remove();
      if (parent && parent.normalize) parent.normalize();
    });
  }

  function findCommentRange(comment) {
    var anchor = comment.anchor || emptyAnchor();
    var selectedText = normalizeSpaces(comment.selectedText || '');
    var selectorScope = anchor.cssSelector ? safeQuerySelector(anchor.cssSelector) : null;
    var sectionScope = anchor.sectionId ? document.getElementById(anchor.sectionId) : null;

    if (selectorScope) {
      var selectorRange = findTextRange(selectorScope, selectedText, anchor);
      if (selectorRange) return selectorRange;
    }
    if (sectionScope) {
      var sectionRange = findTextRange(sectionScope, selectedText, anchor);
      if (sectionRange) return sectionRange;
    }
    return findTextRange(document.body, selectedText, anchor);
  }

  function findTextRange(scope, selectedText, anchor) {
    if (!selectedText) return null;
    var indexed = normalizedTextIndex(scope);
    var normalized = indexed.normalized;
    var map = indexed.map;

    if (anchor && Number.isInteger(anchor.startOffset) && Number.isInteger(anchor.endOffset)) {
      var offsetRange = rangeFromNormalizedOffsets(map, anchor.startOffset, anchor.endOffset);
      if (offsetRange && normalizeSpaces(offsetRange.toString()).toLowerCase() === selectedText.toLowerCase()) {
        return offsetRange;
      }
    }

    var start = contextualTextStart(normalized, selectedText, anchor);
    if (start < 0) {
      start = normalized.indexOf(selectedText);
    }
    if (start < 0) {
      start = normalized.toLowerCase().indexOf(selectedText.toLowerCase());
    }
    if (start < 0) return null;

    return rangeFromNormalizedOffsets(map, start, start + selectedText.length);
  }

  function normalizedTextIndex(scope) {
    var nodes = textNodesIn(scope);
    var normalized = '';
    var map = [];
    var lastWasSpace = true;

    nodes.forEach(function (node) {
      var value = node.nodeValue || '';
      for (var index = 0; index < value.length; index += 1) {
        var character = value[index];
        if (/\s/.test(character)) {
          if (normalized.length > 0 && !lastWasSpace) {
            normalized += ' ';
            map.push({ node: node, offset: index });
            lastWasSpace = true;
          }
        } else {
          normalized += character;
          map.push({ node: node, offset: index });
          lastWasSpace = false;
        }
      }
    });

    if (normalized.endsWith(' ')) {
      normalized = normalized.slice(0, -1);
      map.pop();
    }

    return { normalized: normalized, map: map };
  }

  function contextualTextStart(normalized, selectedText, anchor) {
    if (!anchor) return -1;
    var before = normalizeSpaces(anchor.textBefore || '');
    var after = normalizeSpaces(anchor.textAfter || '');
    var lowerNormalized = normalized.toLowerCase();
    var lowerSelected = selectedText.toLowerCase();
    var lowerBefore = before.toLowerCase();
    var lowerAfter = after.toLowerCase();
    var start = -1;

    while (true) {
      start = lowerNormalized.indexOf(lowerSelected, start + 1);
      if (start < 0) return -1;
      var beforeOk = !before || lowerNormalized.slice(Math.max(0, start - lowerBefore.length), start) === lowerBefore;
      var afterOk =
        !after ||
        lowerNormalized.slice(start + lowerSelected.length, start + lowerSelected.length + lowerAfter.length) ===
          lowerAfter;
      if (beforeOk && afterOk) return start;
    }
  }

  function rangeFromNormalizedOffsets(map, startOffset, endOffset) {
    if (!map.length) return null;
    if (startOffset < 0 || endOffset <= startOffset || startOffset >= map.length) return null;
    var startPoint = map[startOffset];
    var endPoint = map[Math.min(endOffset - 1, map.length - 1)];
    if (!startPoint || !endPoint) return null;

    var range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset + 1);
    return range;
  }

  function textNodesIn(scope) {
    var nodes = [];
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (root.contains(parent)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('script, style, noscript, textarea, input, .marklog-comment-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        return normalizeSpaces(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var node = walker.nextNode();
    while (node) {
      nodes.push(node);
      node = walker.nextNode();
    }
    return nodes;
  }

  function openCommentPopover(comment, target) {
    closeCommentPopover();

    var metaNode = document.createElement('div');
    metaNode.className = 'marklog-comment-meta';
    metaNode.textContent = comment.authorName + ' · ' + formatDate(comment.createdAt);

    var quoteNode = document.createElement('div');
    quoteNode.className = 'marklog-comment-quote';
    quoteNode.textContent = comment.selectedText;

    var noteNode = document.createElement('p');
    noteNode.className = 'marklog-comment-note';
    noteNode.textContent = comment.note;

    var actions = document.createElement('div');
    actions.className = 'marklog-comment-actions';

    var replyButton = document.createElement('button');
    replyButton.className = 'marklog-comment-save';
    replyButton.type = 'button';
    replyButton.textContent = 'Comment here';
    replyButton.addEventListener('click', function () {
      state.selectionText = comment.selectedText;
      state.selectionAnchor = comment.anchor || emptyAnchor();
      quote.textContent = state.selectionText;
      error.hidden = true;
      error.textContent = '';
      composer.hidden = false;
      panel.classList.add('open');
      closeCommentPopover();
      note.focus({ preventScroll: true });
    });

    var close = document.createElement('button');
    close.className = 'marklog-comment-cancel';
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', closeCommentPopover);

    actions.appendChild(replyButton);
    actions.appendChild(close);
    popover.replaceChildren(metaNode, quoteNode, noteNode, actions);
    popover.classList.add('open');
    target.classList.add('active');

    var rect = target.getBoundingClientRect();
    var popoverRect = popover.getBoundingClientRect();
    var left = Math.min(Math.max(14, rect.left), window.innerWidth - popoverRect.width - 14);
    var top = Math.min(rect.bottom + 8, window.innerHeight - popoverRect.height - 14);
    popover.style.left = left + 'px';
    popover.style.top = Math.max(14, top) + 'px';
  }

  function closeCommentPopover() {
    popover.classList.remove('open');
    popover.replaceChildren();
    document.querySelectorAll('.marklog-comment-marker.active').forEach(function (marker) {
      marker.classList.remove('active');
    });
  }

  function focusComment(commentId) {
    var marker = null;
    document.querySelectorAll('.marklog-comment-marker').forEach(function (candidate) {
      if (candidate.dataset.commentId === commentId) marker = candidate;
    });
    if (!marker) return;
    var comment = state.comments.find(function (entry) { return entry.id === commentId; });
    if (!comment) return;
    marker.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    openCommentPopover(comment, marker);
  }

  function buildSelectionAnchor(selection, selectedText) {
    var range = selection.rangeCount ? selection.getRangeAt(0) : null;
    var scope = nearestSectionElement(selection) || document.body;
    var target = nearestAnchorElement(range) || scope;
    var beforeText = textBeforeRange(scope, range);
    var afterText = textAfterRange(scope, range);
    var startOffset = beforeText.length;
    return {
      sectionId: scope.id || null,
      cssSelector: cssSelectorFor(target),
      startOffset: startOffset,
      endOffset: startOffset + selectedText.length,
      textBefore: beforeText.slice(-120) || null,
      textAfter: afterText.slice(0, 120) || null
    };
  }

  function emptyAnchor() {
    return {
      sectionId: null,
      cssSelector: null,
      startOffset: null,
      endOffset: null,
      textBefore: null,
      textAfter: null
    };
  }

  function nearestSectionElement(selection) {
    var range = selection.rangeCount ? selection.getRangeAt(0) : null;
    var node = range ? range.commonAncestorContainer : selection.anchorNode;
    if (!node) return '';
    var element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    var section = element && element.closest('[data-marklog-section][id], section[id], article[id], main[id]');
    return section || null;
  }

  function nearestAnchorElement(range) {
    if (!range) return null;
    var node = range.commonAncestorContainer;
    var element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return element
      ? element.closest('p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, pre, figcaption, section, article, main')
      : null;
  }

  function textBeforeRange(scope, range) {
    if (!range) return '';
    try {
      var before = document.createRange();
      before.selectNodeContents(scope);
      before.setEnd(range.startContainer, range.startOffset);
      return normalizeSpaces(before.toString());
    } catch (error) {
      return '';
    }
  }

  function textAfterRange(scope, range) {
    if (!range) return '';
    try {
      var after = document.createRange();
      after.selectNodeContents(scope);
      after.setStart(range.endContainer, range.endOffset);
      return normalizeSpaces(after.toString());
    } catch (error) {
      return '';
    }
  }

  function cssSelectorFor(element) {
    if (!element || element === document.body) return null;
    if (element.id) return '#' + cssEscape(element.id);
    var parts = [];
    var current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      var tag = current.tagName.toLowerCase();
      var index = 1;
      var sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.tagName.toLowerCase() === tag) index += 1;
        sibling = sibling.previousElementSibling;
      }
      parts.unshift(tag + ':nth-of-type(' + index + ')');
      current = current.parentElement;
    }
    return parts.length ? parts.join(' > ') : null;
  }

  function safeQuerySelector(selector) {
    try {
      return selector ? document.querySelector(selector) : null;
    } catch (error) {
      return null;
    }
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, function (character) {
      return '\\\\' + character;
    });
  }

  function normalizeSpaces(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(value));
    } catch (error) {
      return value;
    }
  }
})();`;
}
