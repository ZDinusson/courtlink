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

export const SKILL_LEVELS = ['all', 'beginner', 'intermediate', 'advanced'] as const
export type SkillLevel = typeof SKILL_LEVELS[number]

export const SKILL_LABEL: Record<SkillLevel, string> = {
  all: 'All Levels',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
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
  skill_level: SkillLevel
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

export type Attendance = 'showed_up' | 'no_show'

export interface Rating {
  id: string
  game_id: string
  rater_id: string
  ratee_id: string
  attendance: Attendance | null
  attitude_rating: number | null
  host_rating: number | null
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
