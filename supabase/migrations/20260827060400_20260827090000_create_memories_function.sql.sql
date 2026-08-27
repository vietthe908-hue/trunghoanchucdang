/*
# Create Memories function for user keepsake archive

1. Purpose
- Thêm chế độ "Kỷ Niệm" cho người dùng: xem lại tất cả đăng hỏa cá nhân và thiệp tâm đăng đã tạo.
- Một hàm SECURITY DEFINER trả về danh sách kỷ niệm của người dùng hiện tại, gộp từ hai bảng `lanterns` và `greeting_cards`.

2. New Function
- `get_my_memories()`: trả về danh sách kỷ niệm của người dùng hiện tại.
  - Cột `type`: 'lantern' (đăng hỏa cá nhân) hoặc 'gift' (thiệp tâm đăng gửi người thân).
  - Cột `id`, `sender_name`, `recipient_name`, `wish`, `style_index`, `created_at`, `token` (chỉ cho gift).
  - Sắp xếp theo thời gian tạo giảm dần (mới nhất trước).

3. RLS Changes
- Thêm chính sách SELECT cho `greeting_cards` để người dùng đã đăng nhập có thể đọc thiệp của chính mình (theo user_id).
- Bảng `lanterns` đã có chính sách `lanterns_select_public` (đọc công khai) nên không cần thêm.

4. Security
- Hàm `get_my_memories` chạy với quyền SECURITY DEFINER, gọi `auth.uid()` để lọc theo người dùng hiện tại.
- Chỉ trả về kỷ niệm thuộc về người dùng đó, không lộ dữ liệu của người khác.
- search_path được đặt thành 'public' để tránh Trojan-horse attacks.
*/

-- Add SELECT policy for greeting_cards so users can read their own cards
DROP POLICY IF EXISTS "select_own_greeting_cards" ON public.greeting_cards;
CREATE POLICY "select_own_greeting_cards"
  ON public.greeting_cards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create the memories function
CREATE OR REPLACE FUNCTION public.get_my_memories()
RETURNS TABLE (
  id uuid,
  type text,
  sender_name text,
  recipient_name text,
  wish text,
  style_index integer,
  created_at timestamptz,
  token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
    SELECT
      l.id,
      'lantern'::text AS type,
      l.sender_name,
      l.recipient_name,
      l.wish,
      l.style_index,
      l.released_at AS created_at,
      NULL::text AS token
    FROM public.lanterns l
    WHERE l.user_id = auth.uid()

  UNION ALL

    SELECT
      g.id,
      'gift'::text AS type,
      g.sender_name,
      g.recipient_name,
      g.wish,
      g.style_index,
      g.created_at,
      g.token
    FROM public.greeting_cards g
    WHERE g.user_id = auth.uid()
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_memories() TO authenticated;
