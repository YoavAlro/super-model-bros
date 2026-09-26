/**
 * Shared map chunks for Worlds 4–5. `Q`, `V` and `Y` are token placeholders filled per level
 * with `fill()` (see `mapTools.ts`). Every chunk is bottom-aligned and passes the reachability
 * checker inside the levels that use it.
 */

/** A pipe garden: three pipes of rising height, piranhas in two of them. */
export const PIPE_GARDEN = [
  '            QQQ                ',
  '                               ',
  '     p                    V    ',
  '     PP    B?B    p            ',
  '     PP           PP     PP    ',
  '  e  PP     e     PP  e  PP  e ',
  '###############################',
  '###############################',
];

/** Tall pipes over a pit, with a floating block row: take the high road or hop the pipes. */
export const PIPE_BRIDGE = [
  '                                ',
  '          QQ   QQ               ',
  '         ========               ',
  '                                ',
  '    p        V V        p       ',
  '    PP                  PP      ',
  '    PP                  PP      ',
  '    PP                  PP  Y   ',
  '######     #####      ##########',
  '######     #####      ##########',
];

/** A block row with a tool flower, over a pair of low pipes. */
export const PIPE_BLOCKS = [
  '                            ',
  '       B?B*B?B              ',
  '                            ',
  '                   QQQ      ',
  '   V        p               ',
  '            PP      PP      ',
  '  e     e   PP   j  PP   e  ',
  '############################',
  '############################',
];

/** A staircase of pipes going up and down. */
export const PIPE_STAIRS = [
  '                Q                 ',
  '             p     p              ',
  '             PP   PP              ',
  '          p  PP   PP  p           ',
  '          PP PP   PP PP           ',
  '       V  PP PP XX PP PP  V       ',
  '    e  PP PP PP XX PP PP PP   e   ',
  '##################################',
  '##################################',
];

/** The ending: a pipe, then a climb to the flag. */
export const PIPE_END = [
  '                         X            ',
  '                        XX            ',
  '                       XXX            ',
  '                      XXXX            ',
  '        Q Q Q        XXXXX            ',
  '             PP     XXXXXX            ',
  '    e        PP    XXXXXXX     F      ',
  '######################################',
  '######################################',
];

/** Ghost house: a long hall with planks, ghosts, and a hidden path for thinkers. */
export const GHOST_HALL = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  '                              ',
  '                              ',
  '         QQQQ                 ',
  '        ::::::                ',
  '                              ',
  '    ====          ====        ',
  '                        g     ',
  '          ?M?                 ',
  '                              ',
  '   V            V             ',
  '       e              e       ',
  '##############################',
  '##############################',
];

/** Ghost house: a stair of planks over a pit; a ghost patrols. */
export const GHOST_STAIRS = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  '                                ',
  '                                ',
  '                   QQ           ',
  '                 ====           ',
  '             g                  ',
  '            ====                ',
  '                        Y       ',
  '                                ',
  '       ====           ====      ',
  '   V                            ',
  '                           e    ',
  '#######                  #######',
  '#######                  #######',
];

/** Ghost house: blocks and a cape, and a corridor of ghosts. */
export const GHOST_CORRIDOR = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  '                            ',
  '                            ',
  '                            ',
  '                   QQ       ',
  '                  ::::      ',
  '                            ',
  '                            ',
  '        B*B?B               ',
  '     g          g           ',
  '   VV       Y        VV     ',
  '         e        e         ',
  '############################',
  '############################',
];

/** Ghost house exit: a raised floor and the flag. */
export const GHOST_END = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  '                                  ',
  '                                  ',
  '                                  ',
  '                                  ',
  '                                  ',
  '                                  ',
  '        Q Q Q                     ',
  '                                  ',
  '     XX        XXXX               ',
  '     XX   g    XXXX               ',
  '     XX        XXXX          F    ',
  '##################################',
  '##################################',
];

/** World 4 arena: three pipes the Injection Piranha pops out of, and two tool flower blocks. */
export const PIRANHA_ARENA = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '  *                *      ',
  '            G             ',
  '     PP     PP     PP     ',
  '     PP     PP     PP   H ',
  '##########################',
  '##########################',
];

/** World 5 arena: planks to jump from and two cape blocks, so everyone can think. */
export const KING_ARENA = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '    ====          ====    ',
  '                          ',
  '     *              *     ',
  '                          ',
  '             G         H  ',
  '##########################',
  '##########################',
];

/** A castle gate for pipe and ghost worlds. */
export const HALL_GATE = [
  'XXXXXXXX',
  '     XXX',
  '     XXX',
  '     XXX',
  '     XXX',
  '     XXX',
  '     XXX',
  '        ',
  '        ',
  '        ',
  '        ',
  '        ',
  '########',
  '########',
];
