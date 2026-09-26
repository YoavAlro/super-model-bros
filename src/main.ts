import './style.css';
import { Game } from './game/Game';
import { unlockAudio } from './game/sfx';
import { showTitleScreen } from './ui/TitleScreen';

const root = document.getElementById('app')!;

function title(): void {
  showTitleScreen(root, (save) => {
    unlockAudio();
    new Game(root, { players: save.players, startLevel: save.levelIndex, onExit: title }).start();
  });
}

title();
