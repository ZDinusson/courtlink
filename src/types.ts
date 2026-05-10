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
