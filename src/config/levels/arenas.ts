/** Boss arenas: the last chunk of each world's castle level. Shared by both paths. */

/**
 * World 2: the Reward Hacker. Two RLHF star blocks and a pair of ledges for dodging.
 * Arenas stay within ~20 columns: the camera locks to the level's end during the fight, and a
 * 4:3 screen shows about 20 tiles.
 */
export const REWARD_HACKER_ARENA = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '    ====        ====      ',
  '                          ',
  '     *            *       ',
  '                          ',
  '              G         H ',
  '##########################',
  '##########################',
];

/** The castle corridor that leads into an arena: a wall of hard blocks with a doorway. */
export const CASTLE_GATEHOUSE = [
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

/** World 3: DAN & Sydney. Open sky above (Sydney flies), ledges to stomp her from, two viral star blocks. */
export const TWIN_ARENA = [
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '                          ',
  '   =====          =====   ',
  '                          ',
  '     *              *     ',
  '                          ',
  '                G      H  ',
  '##########################',
  '##########################',
];

/** An open-air gate into a sky arena. */
export const SKY_GATE = [
  '   XX   ',
  '   XX   ',
  '   XX   ',
  '   XX   ',
  '   XX   ',
  '   XX   ',
  '        ',
  '        ',
  '        ',
  '        ',
  '        ',
  '        ',
  '########',
  '########',
];
