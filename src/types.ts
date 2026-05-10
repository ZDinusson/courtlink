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

export const COURT_SPORTS = ['basketball', 'tennis', 'pickleball', 'badminton', 'soccer', 'volleyball'] as const
export type CourtSport = typeof COURT_SPORTS[number]

export const COURT_SPORT_EMOJI: Record<CourtSport, string> = {
  basketball: '🏀', tennis: '🎾', pickleball: '🏓',
  badminton: '🏸', soccer: '⚽', volleyball: '🏐',
}

export const COURT_SPORT_LABEL: Record<CourtSport, string> = {
  basketball: 'Basketball', tennis: 'Tennis', pickleball: 'Pickleball',
  badminton: 'Badminton', soccer: 'Soccer', volleyball: 'Volleyball',
}

export const COURT_SPORT_COLOR: Record<CourtSport, string> = {
  basketball: '#F97316', tennis: '#22C55E', pickleball: '#EAB308',
  badminton: '#3B82F6', soccer: '#16A34A', volleyball: '#8B5CF6',
}

export const COURT_TAGS = [
  'good_lights', 'usually_crowded', 'free_parking', 'indoor',
  'needs_reservation', 'best_mornings', 'best_afternoons', 'best_evenings', 'best_weekends',
] as const
export type CourtTag = typeof COURT_TAGS[number]

export const COURT_TAG_LABEL: Record<CourtTag, string> = {
  good_lights: 'Good Lights', usually_crowded: 'Usually Crowded',
  free_parking: 'Free Parking', indoor: 'Indoor',
  needs_reservation: 'Needs Reservation', best_mornings: 'Best: Mornings',
  best_afternoons: 'Best: Afternoons', best_evenings: 'Best: Evenings',
  best_weekends: 'Best: Weekends',
}

export const COURT_TAG_EMOJI: Record<CourtTag, string> = {
  good_lights: '💡', usually_crowded: '👥', free_parking: '🅿️',
  indoor: '🏢', needs_reservation: '📅', best_mornings: '🌅',
  best_afternoons: '☀️', best_evenings: '🌆', best_weekends: '🗓️',
}

export interface Court {
  id: string
  name: string
  sport: CourtSport
  address: string
  lat: number
  lng: number
  description: string | null
  added_by: string | null
  created_at: string
  profiles?: Profile
  tag_counts?: Partial<Record<CourtTag, number>>
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
