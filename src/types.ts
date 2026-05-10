export const SPORTS = ['basketball', 'pickleball', 'tennis', 'badminton'] as const
export type Sport = typeof SPORTS[number]

export const SPORT_EMOJI: Record<Sport, string> = {
  basketball: '🏀',
  badminton: '🏸',
  pickleball: '🏓',
  tennis: '🎾',
}

export const SPORT_LABEL: Record<Sport, string> = {
  basketball: 'Basketball',
  badminton: 'Badminton',
  pickleball: 'Pickleball',
  tennis: 'Tennis',
}

export interface Profile {
  id: string
  username: string
  created_at: string
}

export interface Game {
  id: string
  created_by: string
  title: string
  location: string
  date_time: string
  player_limit: number
  description: string | null
  sport: Sport
  status: 'open' | 'full' | 'cancelled'
  created_at: string
  profiles?: Profile
  player_count?: number
  is_joined?: boolean
}

export interface GamePlayer {
  id: string
  game_id: string
  user_id: string
  joined_at: string
  profiles?: Profile
}

export const PLAYER_TAGS = ['showed_up', 'no_show', 'good_teammate', 'too_aggressive', 'friendly_player'] as const
export const HOST_TAGS = ['reliable_host', 'good_communication', 'game_fills', 'balanced_teams'] as const
export type PlayerTag = typeof PLAYER_TAGS[number]
export type HostTag = typeof HOST_TAGS[number]
export type RatingTag = PlayerTag | HostTag

export const TAG_LABEL: Record<RatingTag, string> = {
  showed_up: 'Showed Up',
  no_show: 'No-Show',
  good_teammate: 'Good Teammate',
  too_aggressive: 'Too Aggressive',
  friendly_player: 'Friendly Player',
  reliable_host: 'Reliable Host',
  good_communication: 'Good Communication',
  game_fills: 'Game Usually Fills',
  balanced_teams: 'Balanced Teams',
}

export const TAG_EMOJI: Record<RatingTag, string> = {
  showed_up: '✅',
  no_show: '❌',
  good_teammate: '🤝',
  too_aggressive: '⚠️',
  friendly_player: '😊',
  reliable_host: '⭐',
  good_communication: '💬',
  game_fills: '🏆',
  balanced_teams: '⚖️',
}

export interface Rating {
  id: string
  game_id: string
  rater_id: string
  ratee_id: string
  tags: RatingTag[]
  created_at: string
}

export interface Comment {
  id: string
  game_id: string
  user_id: string
  body: string
  created_at: string
  profiles?: Profile
}
