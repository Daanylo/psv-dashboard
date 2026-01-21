export interface LogoDetection {
  id?: number;
  post_id: number;
  logo_label: string;
  confidence: number;
  box_x: number;
  box_y: number;
  box_width: number;
  box_height: number;
  model_version?: string;
  confidence_threshold: number;
  detected_at?: string;
  verified?: number;
  verified_by?: string | null;
  verified_at?: string | null;
  notes?: string | null;
}
