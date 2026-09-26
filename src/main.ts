import './style.css';
import { CHARACTERS, ROSTER, type CharacterId } from './config/characters';
import { KARTS } from './config/karts';
import type { MomentId } from './config/events';
import { LEVELS } from './config/levels';
import { PATHS, type PathId } from './config/paths';
import { Campaign } from './game/Campaign';
import { unlockAudio } from './game/sfx';
import { loadSave } from './save';
import { showTitleScreen, type StartChoice } from './ui/TitleScreen';
import { lockZoom } from './ui/zoomLock';

const root = document.getElementById('app')!;
lockZoom();

function play(choice: StartChoice, startLevel?: string, flags?: string[], perks?: string[], startKart?: string): void {
  unlockAudio();
  void new Campaign(root, { save: loadSave(), choice, onExit: title, startLevel, flags, perks, startKart }).start();
}

function title(): void {
  showTitleScreen(root, loadSave(), (choice) => play(choice));
}

// Smoke tests can skip the title: ?debug&path=claude&level=claude-2-2&players=1&char=gemini&flags=shadowBooks&perks=teamFork
const params = new URLSearchParams(location.search);
if (params.has('debug')) {
  const w = window as unknown as { __smbLevelIds: () => string[]; __smbKartIds: () => string[]; __smbUnlockables: () => string[] };
  w.__smbLevelIds = () => Object.values(PATHS).flatMap((p) => p.steps.map((s) => s.level));
  w.__smbKartIds = () => KARTS.map((k) => k.id);
  w.__smbUnlockables = () => ROSTER.filter((c) => c.unlockRule).map((c) => c.id);
}
const level = params.get('level');
const kart = params.get('kart');
const gallery = params.get('gallery');
if (params.has('debug') && gallery) {
  // Every mesh of a kind side by side: ?debug&gallery=characters (or enemies, items, props)
  void import('./game/Gallery').then((m) => m.showGallery(root, gallery === 'enemies' || gallery === 'items' || gallery === 'props' ? gallery : 'characters'));
} else if (params.has('debug') && kart) {
  // A Benchmark Kart race on its own: ?debug&kart=kart-arc&char=mistral&players=2
  const char = params.get('char') as CharacterId | null;
  const lead = char && CHARACTERS[char] ? char : 'gpt';
  play({ path: 'gpt', players: params.get('players') === '2' ? 2 : 1, lead, resume: false }, undefined, [], [], kart);
} else if (params.has('debug') && level) {
  // Test-only overrides: &moments=keep4o,codeRed&zones=winterLaziness:20-60
  const spec = LEVELS[level];
  const moments = params.get('moments');
  const zones = params.get('zones');
  if (spec && moments) spec.moments = [...(spec.moments ?? []), ...(moments.split(',') as MomentId[])];
  if (spec && zones) {
    spec.zones = zones.split(',').map((z) => {
      const [moment, range] = z.split(':');
      const [from, to] = range.split('-').map(Number);
      return { moment: moment as MomentId, from, to };
    });
  }
  const path = (params.get('path') as PathId) ?? (level.startsWith('claude') ? 'claude' : 'gpt');
  const char = params.get('char') as CharacterId | null;
  play(
    {
      path,
      players: params.get('players') === '2' ? 2 : 1,
      lead: char && CHARACTERS[char] ? char : PATHS[path].hero,
      resume: false,
    },
    level,
    params.get('flags')?.split(',') ?? [],
    params.get('perks')?.split(',') ?? [],
  );
} else {
  title();
}
