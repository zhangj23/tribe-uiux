export interface HealthResponse {
  tribe_mock_mode: boolean;
  model_loaded: boolean;
}

export type JobStatus =
  | 'created'
  | 'converting'
  | 'predicting'
  | 'mapping'
  | 'interpreting'
  | 'completed'
  | 'failed';

export interface ZScores {
  visual_processing: number;
  object_recognition: number;
  reading_language: number;
  attention_salience: number;
  cognitive_load: number;
  emotional_response: number;
}

export interface Timeseries {
  visual_processing: number[];
  object_recognition: number[];
  reading_language: number[];
  attention_salience: number[];
  cognitive_load: number[];
  emotional_response: number[];
}

export interface Job {
  job_id: string;
  status: JobStatus;
  progress: number;
  error?: string;
  friction_score?: number;
  llm_analysis?: string;
  brain_activations?: number[][];
  z_scores?: ZScores;
  timeseries?: Timeseries;
  timestamps?: number[];
}
