import type { DataTypeId } from './dataTypes';
import type { ThemeId } from './themes';
import type { FactCard, Mix } from './types';

export interface LevelSpec {
  id: string;
  world: number;
  name: string;
  theme: ThemeId;
  /** Name tag at the start of the level (the model you are now). */
  formBefore: string;
  /** The model you become by finishing the level. */
  toward: { name: string; paramsLabel: string };
  /** The real training mix: collecting this mix earns history stars. */
  recipe: Mix;
  /** What question blocks release. */
  blockToken: DataTypeId;
  /** Shown before the level starts. */
  intro: FactCard;
  /** Shown at the flag (or when the boss falls). */
  outro: FactCard;
  /** Legend: # ground, X hard, B brick, ? token block, M Scale block, P pipe, S spawn,
   *  e Spambot, G boss, H helper, F flag, o/w/k Books/Web/Wikipedia tokens. */
  map: string[];
}

export const LEVELS: LevelSpec[] = [
  {
    id: '1-1',
    world: 1,
    name: 'BookCorpus Plains',
    theme: 'plains',
    formBefore: 'Transformer',
    toward: { name: 'GPT-1', paramsLabel: '117M params' },
    recipe: { books: 1 },
    blockToken: 'books',
    intro: {
      title: 'World 1-1 · BookCorpus Plains',
      date: '2018 · Training toward GPT-1',
      lines: [
        'June 2017: Google researchers introduce the Transformer in "Attention Is All You Need". You are an untrained Transformer.',
        'OpenAI is about to pre-train you on BookCorpus, roughly 7,000 unpublished books. Collect the blue Books tokens.',
        'Stomp Spambots: junk text you do not want to learn from. Grab a Scale crystal to grow.',
      ],
    },
    outro: {
      title: 'You evolved into GPT-1',
      date: 'June 2018 · 117M parameters',
      lines: [
        'Trained on BookCorpus, roughly 7,000 unpublished books.',
        'The big idea is generative pre-training: learn from unlabeled text first, then fine-tune for each task.',
        'Long, continuous book text taught the model to track context across many sentences.',
      ],
    },
    map: [
    '                                                                                                                                                                                ',
    '                                                                                                                                                                                ',
    '                                                                                                                                                                                ',
    '                                                                                                                                                                                ',
    '                      ?                                                          wwwwww          M                                                 X                            ',
    '                                                                     www                                                                          XX                            ',
    '                                                oo                                                               kk                              XXX                            ',
    '                                       oo                                          ww                                                           XXXX                            ',
    '                ?   B?BMB     oo               PP               B?B             BBBBBBBB      ?  ?  ?                   BB?BB                  XXXXX                            ',
    '                                      PP       PP     ooo ooo                                                                                 XXXXXX                            ',
    '        ooooo                PP       PP       PP                           oooo                       ooooo                      oooooo     XXXXXXX  ooo                       ',
    '   S                  e      PP       PP e  e  PP         e e                       e e             e                       e  e            XXXXXXXX              F             ',
    '#####################################################################   #########################################   ############################################################',
    '#####################################################################   #########################################   ############################################################',
    ],
  },
  {
    id: '1-2',
    world: 1,
    name: 'WebText Caves',
    theme: 'caves',
    formBefore: 'GPT-1',
    toward: { name: 'GPT-2', paramsLabel: '1.5B params' },
    recipe: { web: 1 },
    blockToken: 'web',
    intro: {
      title: 'World 1-2 · WebText Caves',
      date: '2019 · Training toward GPT-2',
      lines: [
        'Books alone are not enough. OpenAI builds WebText: about 8 million web pages linked from Reddit posts with 3+ karma.',
        'Collect the green Web tokens. Reddit karma was a cheap quality filter: people had already upvoted the links.',
      ],
    },
    outro: {
      title: 'You evolved into GPT-2',
      date: 'Feb 2019 · 1.5B parameters',
      lines: [
        'Trained on WebText: about 8 million web pages (40GB).',
        'Ten times bigger than GPT-1, it wrote surprisingly coherent paragraphs.',
        'OpenAI first withheld the full model over misuse concerns, then released it in stages through Nov 2019.',
      ],
    },
    map: [
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    '                                                                                                                                                                          ',
    '                                                                                                                                                                          ',
    '                  oooooo                                                                                                                                                  ',
    '                  BBBBBB                     kk                                                            M                                                              ',
    '                                                                                                                                                  X                       ',
    '                                                         wwwwww               wwww                                                               XX                       ',
    '                                        www                                          oo                                   www                   XXX                       ',
    '              ?M?                           B?B?B          XX                       XXXX            PP    ?B?B?                                XXXX                       ',
    '                              wwwwwwPP                    XXXX                                wwwww PP                          wwwwwwww      XXXXX                       ',
    '       wwwww                        PP                   XXXXXX   wwwwww                    PP      PP          wwwwwww                      XXXXXX                       ',
    '   S                e   e e         PP            e e   XXXXXXXX      e  e                  PP  ee  PP              e e                     XXXXXXX         F             ',
    '########################################   ###################################    ########################################   #############################################',
    '########################################   ###################################    ########################################   #############################################',
    ],
  },
  {
    id: '1-3',
    world: 1,
    name: 'Common Crawl Castle',
    theme: 'castle',
    formBefore: 'GPT-2',
    toward: { name: 'GPT-3', paramsLabel: '175B params' },
    recipe: { web: 0.81, books: 0.16, wiki: 0.03 },
    blockToken: 'web',
    intro: {
      title: 'World 1-3 · Common Crawl Castle',
      date: '2020 · Training toward GPT-3',
      lines: [
        "GPT-3's mix: filtered Common Crawl (60%), WebText2 (22%), two book corpora (16%), and Wikipedia (3%). Mostly web, some books, a pinch of wiki.",
        'The raw internet is full of junk. At the end of this castle waits Garbage In, the boss of unfiltered data. Stomp it three times.',
      ],
    },
    outro: {
      title: 'You evolved into GPT-3',
      date: 'May 2020 · 175B parameters',
      lines: [
        'Garbage in, garbage out: labs filter web data for quality before training on it.',
        'Scale unlocked few-shot learning: give a few examples in the prompt and the model picks up a new task.',
        'OpenAI offered GPT-3 through an API from June 2020. Developers started building on it.',
      ],
    },
    map: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '                                                                                                    X                                                 ',
    '                                                                                                    X                                                 ',
    '                                                                                                    X                                                 ',
    '                                                                                M                   X                                                 ',
    '                                                                                                    X                                                 ',
    '                                                                       www                          X                                                 ',
    '                                     ww ww  oo  wo  ow                                              X                                                 ',
    '              ?M?                           XX  XX  XX                        ?B?B?                 X                                                 ',
    '                        wwwwwwwwPP                                                                                                                    ',
    '      wwwwoo                    PP                            wwwwkww                 wwwwwwoooo        ww    ww    ww                                ',
    '   S              e  e          PP                e     e e                               e  e                                  G                H    ',
    '#####################################    ##############################    ###########################################################################',
    '#####################################    ##############################    ###########################################################################',
    ],
  },
];

/** Shown after the last built level. */
export const TO_BE_CONTINUED: FactCard = {
  title: 'World 1 complete!',
  date: 'Next: World 2 · Alignment Hills (2021–2022)',
  lines: [
    'In 2021 a group of OpenAI researchers leave to found Anthropic. Claude, the brother, joins the story.',
    'Coming next: Codex, InstructGPT, the Reward Hacker boss, and the ChatGPT launch.',
  ],
};
