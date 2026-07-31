// CodeMirror 6 editor wrapper
import { EditorState, Compartment, EditorSelection, Prec } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, indentUnit } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { githubLight, githubDark } from '@uiw/codemirror-theme-github';
import { getLanguageFn } from './languages.js';
import { getEffectiveTheme } from './theme.js';

function themeExt(t) { return t === 'dark' ? githubDark : githubLight; }

export function createEditor(host, opts = {}) {
  const {
    initialDoc = '',
    language = null,
    onSend = null,
    onChange = null,
    placeholder: ph = '',
    tabSize = 4,
    fontSize = 14,
  } = opts;

  // Compartments for dynamic reconfiguration
  const langComp = new Compartment();
  const themeComp = new Compartment();
  const listenerComp = new Compartment();
  const styleComp = new Compartment();
  const sendComp = new Compartment();

  let onSendCb = onSend;

  const tabStr = ' '.repeat(tabSize);

  // Send keymap — Ctrl+Enter (Win/Linux) OR Cmd+Enter (Mac). Mod-Enter covers both,
  // but we also bind the literal Ctrl-Enter and Cmd-Enter to be safe across browsers
  // and to defeat any default keymap that might consume Mod-Enter first.
  function buildSendKeymap() {
    if (!onSendCb) return [];
    // Use Prec.highest to ensure our send binding wins over defaultKeymap's Mod-Enter (insertBlankLine)
    return Prec.highest(keymap.of([
      { key: 'Mod-Enter', preventDefault: true, run: () => { onSendCb(); return true; } },
      { key: 'Ctrl-Enter', preventDefault: true, run: () => { onSendCb(); return true; } },
      { key: 'Cmd-Enter',  preventDefault: true, run: () => { onSendCb(); return true; } },
    ]));
  }

  // Tab keymap = 4 spaces (or indent selection)
  const tabKeymap = keymap.of([{
    key: 'Tab',
    preventDefault: true,
    run: (v) => {
      const { state, dispatch } = v;
      if (state.selection.ranges.some(r => !r.empty)) {
        return indentWithTab(v);
      }
      dispatch(state.replaceSelection(tabStr));
      return true;
    },
  }]);

  function buildStyleExt(fs) {
    return EditorView.theme({
      '&': { fontSize: fs + 'px', backgroundColor: 'transparent', height: '100%' },
      '.cm-scroller': { padding: '8px 12px' },
      '.cm-content': { caretColor: 'var(--primary)', padding: 0 },
      '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
      '&.cm-focused': { outline: 'none' },
      '.cm-placeholder': { color: 'var(--text-faint)', fontStyle: 'italic' },
    });
  }

  const baseExtensions = [
    history(),
    drawSelection(),
    dropCursor(),
    indentUnit.of(tabStr),
    EditorState.tabSize.of(tabSize),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    // Default keymaps FIRST (lower priority), then send/tab LAST (higher priority)
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...completionKeymap,
    ]),
    tabKeymap,
    sendComp.of(buildSendKeymap()),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ spellcheck: 'false' }),
    ph ? cmPlaceholder(ph) : [],
    styleComp.of(buildStyleExt(fontSize)),
    langComp.of(language ? (getLanguageFn(language) || []) : []),
    themeComp.of(themeExt(getEffectiveTheme())),
    listenerComp.of(onChange ? EditorView.updateListener.of(v => { if (v.docChanged) onChange(v.state.doc.toString()); }) : []),
  ];

  const state = EditorState.create({ doc: initialDoc, extensions: baseExtensions });
  const view = new EditorView({ state, parent: host });

  return {
    view,
    getDoc: () => view.state.doc.toString(),
    setDoc: (text) => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text || '' } });
    },
    setLanguage: (newLang) => {
      const fn = newLang ? getLanguageFn(newLang) : null;
      view.dispatch({ effects: langComp.reconfigure(fn || []) });
    },
    setTheme: (t) => {
      view.dispatch({ effects: themeComp.reconfigure(themeExt(t)) });
    },
    setFontSize: (fs) => {
      view.dispatch({ effects: styleComp.reconfigure(buildStyleExt(fs)) });
    },
    setOnChange: (cb) => {
      view.dispatch({
        effects: listenerComp.reconfigure(
          cb ? EditorView.updateListener.of(v => { if (v.docChanged) cb(v.state.doc.toString()); }) : []
        ),
      });
    },
    setOnSend: (cb) => {
      onSendCb = cb;
      view.dispatch({ effects: sendComp.reconfigure(buildSendKeymap()) });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
    insertText: (text) => {
      const { state, dispatch } = view;
      dispatch(state.changeByRange(range => ({
        changes: { from: range.from, to: range.to, insert: text },
        range: EditorSelection.range(range.from, range.from + text.length),
      })));
    },
  };
}
