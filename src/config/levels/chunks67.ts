/**
 * Shared map chunks for Worlds 6–7. `Q`, `V` and `Y` are token placeholders filled per level with
 * `fill()` (see `mapTools.ts`). Every chunk is bottom-aligned and passes the reachability checker
 * inside the levels that use it.
 */

/** Factory start: a power block, a few tokens, one runaway agent. */
export const FACTORY_START = [
  '                        ',
  '          ?*?           ',
  '                        ',
  '    QQQ       VV        ',
  '  S               d     ',
  '########################',
  '########################',
];

/** Conveyor belts over a short pit: the first carries you, the second pushes back. */
export const BELT_RUN = [
  '                                    ',
  '            QQQQ                    ',
  '                                    ',
  '          B?B?B           V  V      ',
  '                                    ',
  '    d            d                  ',
  '>>>>>>>>>>>>>>>>##   ##<<<<<<<<<<<##',
  '##################   ###############',
];

/**
 * Rate limits: a low hall with three crushers hanging from the ceiling. Bait one, then pass while
 * it grinds back up.
 */
export const CRUSHER_HALL = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  '     z       z       z        ',
  '                              ',
  '  Q    Q  Q    Q  Q    Q  Q   ',
  '                              ',
  '                              ',
  '##############################',
  '##############################',
];

/**
 * A two-key switch: plates `1` two tiles apart must be held at once (a fork lined up behind you,
 * or a co-op partner). The gated corridor above holds the reward. It runs out the far end onto
 * the next chunk's roof: the camera only scrolls forward, so by the time you reach the far end
 * the gate can already be behind the screen's left edge.
 */
export const FORK_ROOM = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  '                              ',
  '              XXXXXXXXXXXXXXXX',
  '              D  YYYYYYYY     ',
  '              D  YYYYYYYY     ',
  '              XXXXXXXXXXXXXXXX',
  '         =====                ',
  '                              ',
  '                              ',
  '     ====                     ',
  '                              ',
  '   1 1       Q  Q     d       ',
  '##############################',
  '##############################',
];

/** A yard of runaway agents under a row of blocks. */
export const AGENT_YARD = [
  '                                ',
  '        QQQ          QQQ        ',
  '                                ',
  '       B?M?B        B?B?B       ',
  '                                ',
  '                                ',
  '   V     d    d    d      d  V  ',
  '################################',
  '################################',
];

/** Conveyor stairs: belts on each step push you back down, so keep moving. */
export const BELT_STAIRS = [
  '                                  ',
  '                  QQ              ',
  '                                  ',
  '              <<<<<<<<            ',
  '              XXXXXXXX            ',
  '          <<<<XXXXXXXX>>>>        ',
  '          XXXXXXXXXXXXXXXX   V    ',
  '      <<<<XXXXXXXXXXXXXXXX>>>>    ',
  '  d   XXXXXXXXXXXXXXXXXXXXXXXX  d ',
  '##################################',
  '##################################',
];

/** The factory exit: a staircase, then the flag. */
export const FACTORY_END = [
  '                         X            ',
  '                        XX            ',
  '                       XXX            ',
  '                      XXXX            ',
  '        Q Q Q        XXXXX            ',
  '                    XXXXXX            ',
  '    d              XXXXXXX     F      ',
  '>>>>>>>>>>>>>>>>######################',
  '######################################',
];

/** World 6 arena: planks to jump from, two fork blocks, room for the swarm. */
export const SWARM_ARENA = [
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

/** Frontier start: towers ahead and a paperclip already loose. */
export const FRONTIER_START = [
  '                        ',
  '          ?*?           ',
  '                        ',
  '    QQQ       VV        ',
  '  S               i     ',
  '########################',
  '########################',
];

/** Stone columns over two pits, with a bridge high above. */
export const TOWER_BRIDGE = [
  '                                ',
  '          QQ   QQ               ',
  '         ========               ',
  '                                ',
  '    i        V V        i       ',
  '    XX                  XX      ',
  '    XX                  XX      ',
  '    XX                  XX  Y   ',
  '######     #####      ##########',
  '######     #####      ##########',
];

/** A staircase of columns going up and down, paperclips on top. */
export const TOWER_STAIRS = [
  '                Q                 ',
  '             i     i              ',
  '             XX   XX              ',
  '          i  XX   XX  i           ',
  '          XX XX   XX XX           ',
  '       V  XX XX XX XX XX  V       ',
  '    i  XX XX XX XX XX XX XX   i   ',
  '##################################',
  '##################################',
];

/** A row of blocks between paperclip patrols. */
export const CLIP_BLOCKS = [
  '                            ',
  '       B?B*B?B              ',
  '                            ',
  '                   QQQ      ',
  '   V        i               ',
  '            XX      XX      ',
  '  i     i   XX   i  XX   i  ',
  '############################',
  '############################',
];

/** The frontier exit: a climb to the flag. */
export const FRONTIER_END = [
  '                         X            ',
  '                        XX            ',
  '                       XXX            ',
  '                      XXXX            ',
  '        Q Q Q        XXXXX            ',
  '                    XXXXXX            ',
  '    i              XXXXXXX     F      ',
  '######################################',
  '######################################',
];

/**
 * A phased rollout: three gates in tall walls. Each opens once you have waited next to it (see
 * the `rollout` storm); the walls are too tall to jump.
 */
export const ROLLOUT_GATES = [
  '          XX          XX          XX      ',
  '          XX          XX          XX      ',
  '          XX          XX          XX      ',
  '          XX          XX          XX      ',
  '          XX          XX          XX      ',
  '          XX          XX          XX      ',
  '          XX          XX          XX      ',
  '          DD    QQ    DD    VV    DD      ',
  '          DD          DD          DD      ',
  '   Q Q    DD   ?U?    DD   ?M?    DD  Q   ',
  '          DD          DD          DD      ',
  '    i     DD     i    DD     i    DD      ',
  '##########################################',
  '##########################################',
];

/** A closed road: the gate never opens, so climb the planks and go over the wall. */
export const CLOSED_ROAD = [
  '            XX          ',
  '        ====XX          ',
  '            XX          ',
  '            XX          ',
  '    ====    DD          ',
  '            DD          ',
  '   Q        DD    Q  i  ',
  '########################',
  '########################',
];

/** A road that reopens: a gate in a wall too tall to climb. */
export const REOPENED_ROAD = [
  '           XX           ',
  '           XX           ',
  '           XX           ',
  '           XX           ',
  '           XX           ',
  '           XX           ',
  '           XX           ',
  '           XX           ',
  '           XX           ',
  '           DD           ',
  '     Q     DD     Q     ',
  '           DD      i    ',
  '########################',
  '########################',
];

/** A closed road with a longer detour: a staircase of planks over a taller wall. */
export const CLOSED_ROAD_HIGH = [
  '                  XX          ',
  '            ======XX          ',
  '                  XX          ',
  '                  XX          ',
  '        ====      XX          ',
  '                  DD          ',
  '    ====          DD          ',
  '   Q              DD    Q  i  ',
  '##############################',
  '##############################',
];

/** World 7 arena: open floor for the Maximizer's slams, and two frontier mushroom blocks. */
export const PAPERCLIP_ARENA = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '    *               *     ',
  '                          ',
  '                          ',
  '             G         H  ',
  '##########################',
  '##########################',
];
