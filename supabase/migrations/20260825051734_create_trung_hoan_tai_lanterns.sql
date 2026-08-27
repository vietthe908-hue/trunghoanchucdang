/*
# Create Trùng Hoan Tái profiles and lanterns

1. New tables
- `profiles`: hồ sơ công khai của người chơi, gắn với tài khoản đăng nhập.
- `lanterns`: một hoa đăng duy nhất cho mỗi người chơi, gồm kiểu hoa, tên hiển thị và lời chúc.

2. Access and lifecycle
- Người chơi đăng ký sẽ có hồ sơ ở trạng thái `pending` để chờ quản trị viên duyệt.
- Chỉ hồ sơ đã được duyệt mới được tạo một hoa đăng.
- Mỗi tài khoản chỉ có một dòng trong `lanterns` nhờ khóa duy nhất trên `user_id`.

3. Security
- Bật RLS cho cả hai bảng.
- Người dùng chỉ đọc/cập nhật hồ sơ của chính mình.
- Hoa đăng đã tạo được đọc công khai để bầu trời lễ hội hiển thị được cho mọi người.
- Chỉ người dùng đã được duyệt mới được tạo và cập nhật hoa đăng của mình.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  oc_name text NOT NULL CHECK (char_length(oc_name) BETWEEN 1 AND 80),
  email text NOT NULL,
  avatar_url text,
  wish text NOT NULL DEFAULT 'Mong chúc nguyện của quý nhân sẽ đạt thành.',
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lanterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  style_index integer NOT NULL UNIQUE CHECK (style_index BETWEEN 1 AND 130),
  sender_name text NOT NULL CHECK (char_length(sender_name) BETWEEN 1 AND 80),
  wish text NOT NULL CHECK (char_length(wish) BETWEEN 1 AND 500),
  recipient_name text,
  recipient_hint text,
  released_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lanterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "lanterns_select_public" ON public.lanterns;
CREATE POLICY "lanterns_select_public" ON public.lanterns FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "lanterns_insert_approved" ON public.lanterns;
CREATE POLICY "lanterns_insert_approved" ON public.lanterns FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.approval_status = 'approved'));
DROP POLICY IF EXISTS "lanterns_update_own" ON public.lanterns;
CREATE POLICY "lanterns_update_own" ON public.lanterns FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "lanterns_delete_own" ON public.lanterns;
CREATE POLICY "lanterns_delete_own" ON public.lanterns FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS lanterns_released_at_idx ON public.lanterns (released_at DESC);
