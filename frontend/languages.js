// Language definitions for CodeMirror and dropdown
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { rust } from '@codemirror/lang-rust';
import { php } from '@codemirror/lang-php';
import { yaml } from '@codemirror/lang-yaml';
import { StreamLanguage } from '@codemirror/language';

// Legacy modes (StreamLanguage-based)
import { c, csharp, kotlin, scala, dart, objectiveC, objectiveCpp } from '@codemirror/legacy-modes/mode/clike';
import { go } from '@codemirror/legacy-modes/mode/go';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { perl } from '@codemirror/legacy-modes/mode/perl';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { r } from '@codemirror/legacy-modes/mode/r';
import { clojure } from '@codemirror/legacy-modes/mode/clojure';
import { haskell } from '@codemirror/legacy-modes/mode/haskell';
import { scheme } from '@codemirror/legacy-modes/mode/scheme';
import { elm } from '@codemirror/legacy-modes/mode/elm';
import { oCaml, fSharp, sml } from '@codemirror/legacy-modes/mode/mllike';
import { groovy } from '@codemirror/legacy-modes/mode/groovy';
import { julia } from '@codemirror/legacy-modes/mode/julia';
import { pascal } from '@codemirror/legacy-modes/mode/pascal';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { diff } from '@codemirror/legacy-modes/mode/diff';
import { tcl } from '@codemirror/legacy-modes/mode/tcl';
import { verilog } from '@codemirror/legacy-modes/mode/verilog';
import { vhdl } from '@codemirror/legacy-modes/mode/vhdl';
import { smalltalk } from '@codemirror/legacy-modes/mode/smalltalk';
import { forth } from '@codemirror/legacy-modes/mode/forth';
import { erlang } from '@codemirror/legacy-modes/mode/erlang';
import { fortran } from '@codemirror/legacy-modes/mode/fortran';
import { sas } from '@codemirror/legacy-modes/mode/sas';
import { wast } from '@codemirror/legacy-modes/mode/wast';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { vb } from '@codemirror/legacy-modes/mode/vb';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { cmake } from '@codemirror/legacy-modes/mode/cmake';
import { nginx } from '@codemirror/legacy-modes/mode/nginx';
import { jinja2 } from '@codemirror/legacy-modes/mode/jinja2';
import { protobuf } from '@codemirror/legacy-modes/mode/protobuf';
import { octave } from '@codemirror/legacy-modes/mode/octave';
import { mathematica } from '@codemirror/legacy-modes/mode/mathematica';
import { haxe } from '@codemirror/legacy-modes/mode/haxe';
import { d } from '@codemirror/legacy-modes/mode/d';
import { crystal } from '@codemirror/legacy-modes/mode/crystal';
import { pegjs } from '@codemirror/legacy-modes/mode/pegjs';
import { z80 } from '@codemirror/legacy-modes/mode/z80';
import { apl } from '@codemirror/legacy-modes/mode/apl';
import { brainfuck } from '@codemirror/legacy-modes/mode/brainfuck';
import { http } from '@codemirror/legacy-modes/mode/http';
import { rpmSpec } from '@codemirror/legacy-modes/mode/rpm';
import { spreadsheet } from '@codemirror/legacy-modes/mode/spreadsheet';

// Map of language id -> { label, fn }
export const LANGUAGES = [
  { id: 'plaintext',    label: 'Plain Text',     fn: null },
  { id: 'javascript',   label: 'JavaScript',     fn: () => javascript() },
  { id: 'jsx',          label: 'JSX',             fn: () => javascript({ jsx: true }) },
  { id: 'typescript',   label: 'TypeScript',      fn: () => javascript({ typescript: true }) },
  { id: 'tsx',          label: 'TSX',             fn: () => javascript({ jsx: true, typescript: true }) },
  { id: 'cpp',          label: 'C / C++',         fn: () => cpp() },
  { id: 'c',            label: 'C',               fn: () => StreamLanguage.define(c) },
  { id: 'csharp',       label: 'C#',              fn: () => StreamLanguage.define(csharp) },
  { id: 'java',         label: 'Java',            fn: () => java() },
  { id: 'kotlin',       label: 'Kotlin',          fn: () => StreamLanguage.define(kotlin) },
  { id: 'scala',        label: 'Scala',           fn: () => StreamLanguage.define(scala) },
  { id: 'swift',        label: 'Swift',           fn: () => StreamLanguage.define(swift) },
  { id: 'dart',         label: 'Dart',            fn: () => StreamLanguage.define(dart) },
  { id: 'objective-c',  label: 'Objective-C',     fn: () => StreamLanguage.define(objectiveC) },
  { id: 'objective-cpp',label: 'Objective-C++',   fn: () => StreamLanguage.define(objectiveCpp) },
  { id: 'go',           label: 'Go',              fn: () => StreamLanguage.define(go) },
  { id: 'rust',         label: 'Rust',            fn: () => rust() },
  { id: 'python',       label: 'Python',          fn: () => python() },
  { id: 'ruby',         label: 'Ruby',            fn: () => StreamLanguage.define(ruby) },
  { id: 'php',          label: 'PHP',             fn: () => php() },
  { id: 'perl',         label: 'Perl',            fn: () => StreamLanguage.define(perl) },
  { id: 'lua',          label: 'Lua',             fn: () => StreamLanguage.define(lua) },
  { id: 'r',            label: 'R',               fn: () => StreamLanguage.define(r) },
  { id: 'julia',        label: 'Julia',           fn: () => StreamLanguage.define(julia) },
  { id: 'octave',       label: 'Octave',          fn: () => StreamLanguage.define(octave) },
  { id: 'mathematica',  label: 'Mathematica',     fn: () => StreamLanguage.define(mathematica) },
  { id: 'haskell',      label: 'Haskell',         fn: () => StreamLanguage.define(haskell) },
  { id: 'elm',          label: 'Elm',             fn: () => StreamLanguage.define(elm) },
  { id: 'fsharp',       label: 'F#',              fn: () => StreamLanguage.define(fSharp) },
  { id: 'ocaml',        label: 'OCaml',           fn: () => StreamLanguage.define(oCaml) },
  { id: 'sml',          label: 'Standard ML',     fn: () => StreamLanguage.define(sml) },
  { id: 'clojure',      label: 'Clojure',         fn: () => StreamLanguage.define(clojure) },
  { id: 'scheme',       label: 'Scheme',          fn: () => StreamLanguage.define(scheme) },
  { id: 'erlang',       label: 'Erlang',          fn: () => StreamLanguage.define(erlang) },
  { id: 'groovy',       label: 'Groovy',          fn: () => StreamLanguage.define(groovy) },
  { id: 'html',         label: 'HTML',            fn: () => html() },
  { id: 'css',          label: 'CSS',             fn: () => css() },
  { id: 'scss',         label: 'SCSS',            fn: () => css() },
  { id: 'xml',          label: 'XML',             fn: () => xml() },
  { id: 'json',         label: 'JSON',            fn: () => json() },
  { id: 'yaml',         label: 'YAML',            fn: () => yaml() },
  { id: 'toml',         label: 'TOML',            fn: () => StreamLanguage.define(toml) },
  { id: 'ini',          label: 'INI / Properties',fn: () => StreamLanguage.define(properties) },
  { id: 'markdown',     label: 'Markdown',        fn: () => markdown() },
  { id: 'sql',          label: 'SQL',             fn: () => sql() },
  { id: 'shell',        label: 'Shell',           fn: () => StreamLanguage.define(shell) },
  { id: 'bash',         label: 'Bash',            fn: () => StreamLanguage.define(shell) },
  { id: 'powershell',   label: 'PowerShell',      fn: () => StreamLanguage.define(powerShell) },
  { id: 'dockerfile',   label: 'Dockerfile',      fn: () => StreamLanguage.define(dockerFile) },
  { id: 'cmake',        label: 'CMake',           fn: () => StreamLanguage.define(cmake) },
  { id: 'nginx',        label: 'Nginx',           fn: () => StreamLanguage.define(nginx) },
  { id: 'jinja2',       label: 'Jinja2',          fn: () => StreamLanguage.define(jinja2) },
  { id: 'protobuf',     label: 'Protocol Buffers',fn: () => StreamLanguage.define(protobuf) },
  { id: 'diff',         label: 'Diff',            fn: () => StreamLanguage.define(diff) },
  { id: 'verilog',      label: 'Verilog',         fn: () => StreamLanguage.define(verilog) },
  { id: 'vhdl',         label: 'VHDL',            fn: () => StreamLanguage.define(vhdl) },
  { id: 'tcl',          label: 'Tcl',             fn: () => StreamLanguage.define(tcl) },
  { id: 'smalltalk',    label: 'Smalltalk',       fn: () => StreamLanguage.define(smalltalk) },
  { id: 'forth',        label: 'Forth',           fn: () => StreamLanguage.define(forth) },
  { id: 'fortran',      label: 'Fortran',         fn: () => StreamLanguage.define(fortran) },
  { id: 'pascal',       label: 'Pascal',          fn: () => StreamLanguage.define(pascal) },
  { id: 'vbnet',        label: 'VB.NET',          fn: () => StreamLanguage.define(vb) },
  { id: 'sas',          label: 'SAS',             fn: () => StreamLanguage.define(sas) },
  { id: 'wasm',         label: 'WebAssembly',     fn: () => StreamLanguage.define(wast) },
  { id: 'haxe',         label: 'Haxe',            fn: () => StreamLanguage.define(haxe) },
  { id: 'd',            label: 'D',               fn: () => StreamLanguage.define(d) },
  { id: 'crystal',      label: 'Crystal',         fn: () => StreamLanguage.define(crystal) },
  { id: 'pegjs',        label: 'PEG.js',          fn: () => StreamLanguage.define(pegjs) },
  { id: 'z80',          label: 'Z80 Assembly',    fn: () => StreamLanguage.define(z80) },
  { id: 'apl',          label: 'APL',             fn: () => StreamLanguage.define(apl) },
  { id: 'brainfuck',    label: 'Brainfuck',       fn: () => StreamLanguage.define(brainfuck) },
  { id: 'http',         label: 'HTTP',            fn: () => StreamLanguage.define(http) },
  { id: 'rpm',          label: 'RPM Spec',        fn: () => StreamLanguage.define(rpmSpec) },
  { id: 'spreadsheet',  label: 'Spreadsheet',     fn: () => StreamLanguage.define(spreadsheet) },
];

export function getLanguageFn(id) {
  const entry = LANGUAGES.find(l => l.id === id);
  if (!entry || !entry.fn) return null;
  try { return entry.fn(); } catch (e) { console.warn('Failed to load language', id, e); return null; }
}

// Map for highlight.js (used in markdown code blocks)
export function hljsLanguage(id) {
  const map = {
    'plaintext': 'plaintext',
    'ini': 'ini',
    'shell': 'bash',
    'bash': 'bash',
    'dockerfile': 'dockerfile',
    'wasm': 'wasm',
    'vbnet': 'vbnet',
    'csharp': 'csharp',
    'fsharp': 'fsharp',
    'objective-c': 'objectivec',
    'objective-cpp': 'objectivec',
    'pegjs': 'pegjs',
    'z80': 'z80',
    'apl': 'apl',
    'brainfuck': 'brainfuck',
    'http': 'http',
    'rpm': 'rpm',
    'spreadsheet': 'excel',
    'sml': 'sml',
    'ocaml': 'ocaml',
    'mathematica': 'mathematica',
    'octave': 'octave',
    'protobuf': 'protobuf',
    'jinja2': 'django',
    'cmake': 'cmake',
    'nginx': 'nginx',
    'crystal': 'crystal',
    'haxe': 'haxe',
    'd': 'd',
    'verilog': 'verilog',
    'vhdl': 'vhdl',
    'tcl': 'tcl',
    'sas': 'sas',
  };
  return map[id] || id;
}
