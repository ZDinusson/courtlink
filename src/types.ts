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
