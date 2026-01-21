export interface InstagramPost {
  id: number;
  shortcode: string;
  post_type: string;
  is_reel: number;
  taken_at: string;
  taken_at_timestamp: string;
  caption: string | null;
  like_count: number;
  comment_count: number;
  video_view_count: number | null;
  media_count: number;
  location_name: string | null;
  location_address: string | null;
  location_city: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  owner_username: string;
  owner_full_name: string;
  owner_is_verified: number;
  owner_is_private: number;
  accessibility_caption: string | null;
  is_paid_partnership: number;
  from_api: number;
  url: string;
}
