export interface Announcement {
  id: string;
  title: string;
  body: string;
  course_id?: string | null;
  published_at: string;
  course?: {
    id: string;
    name: string;
  } | null;
}

// ... existing types
export interface Exam {
  id: string;
  course_id: string | null;
  title: string;
  subject: string[] | string;
  exam_type: "live" | "practice";
  duration_minutes: number;
  total_marks?: number | null;
  negative_mark_per_question?: number;
  instructions?: string | null;
  time_window_start?: string | null;
  time_window_end?: string | null;
  is_published: boolean;
  restrict_solution?: boolean;
  questions_json?: string;
  questions_csv?: string;
  course?: {
    name: string;
  } | null;
  created_at?: string;
}

export interface Course {
  id: string;
  name: string;
  short_description?: string | null;
  full_description?: string | null;
  price?: number | null;
  original_price?: number | null;
  what_you_get?: string[] | null;
  demo_content?: DemoContentItem[] | null;
  image_url?: string | null;
  bkash_number?: string | null;
  nagad_number?: string | null;
  contact_info?: string | null;
  is_active: boolean;
  is_public: boolean;
  created_at?: string;
  category?: string | null;
  sub_category?: string | null;
  priority?: number;
}

export interface Class {
  id: string;
  course_id: string;
  title: string;
  topic?: string | null;
  subject: string[] | string; // Handle legacy string or new array
  start_at: string;
  end_at: string;
  video_url?: string | null;
  notes_url?: string | null;
  class_type: "live" | "recorded";
  course?: {
    name: string;
  };
}

export interface DemoContentItem {
  title: string;
  video_url?: string;
  note_url?: string;
  is_locked: boolean;
}

export interface Resource {
  id: string;
  title: string;
  description?: string | null;
  subject?: string | null;
  url?: string | null;
  resource_type: string;
  course_id?: string | null;
  course?: {
    id: string;
    name: string;
  } | null;
  created_at?: string;
}

export interface Profile {
  id: string;
  registration_id: string;
  full_name?: string | null;
  phone?: string | null;
  school?: string | null;
  batch_year?: number | null;
  created_at?: string;
  enrollments?: Enrollment[];
}

export interface Enrollment {
  id: string;
  course_id: string;
  courses?: {
    name: string;
  };
}

export interface PaymentRequest {
  id: string;
  user_id: string;
  course_id: string;
  payment_method: string;
  trx_id: string;
  phone: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  profiles?: {
    full_name: string;
    registration_id: string;
  };
  courses?: {
    name: string;
    price: number;
  };
}
