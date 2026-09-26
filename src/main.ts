import './style.css';
import { CHARACTERS, type CharacterId } from './config/characters';
import { PATHS, type PathId } from './config/paths';
import { Campaign } from './game/Campaign';
import { unlockAudio } from './game/sfx';
import { loadSave } from './save';
import { showTitleScreen, type StartChoice } from './ui/TitleScreen';

const root = document.getElementById('app')!;

function play(choice: StartChoice, startLevel?: string): void {
  unlockAudio();
  void new Campaign(root, { save: loadSave(), choice, onExit: title, startLevel }).start();
}

function title(): void {
  showTitleScreen(root, loadSave(), (choice) => play(choice));
}

// Smoke tests can skip the title: ?debug&path=claude&level=claude-2-2&players=1&char=gemini
const params = new URLSearchParams(location.search);
if (params.has('debug')) {
  (window as unknown as { __smbLevelIds: () => string[] }).__smbLevelIds = () =>
    Object.values(PATHS).flatMap((p) => p.steps.map((s) => s.level));
}
const level = params.get('level');
if (params.has('debug') && level) {
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
  );
} else {
  title();
}
