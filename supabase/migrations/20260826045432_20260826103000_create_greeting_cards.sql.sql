/*
# Create greeting_cards table (thiệp tâm đăng)

1. New Tables
- `greeting_cards`: lưu thiệp tâm đăng do người chơi tạo để gửi cho người thân.
  - `id` (uuid, primary key)
  - `token` (text, unique) — mã truy cập dùng trong URL QR, sinh ngẫu nhiên
  - `sender_name` (text) — tên người thả đèn / người gửi
  - `wish` (text) — nội dung lời chúc
  - `password_hash` (text) — mật khẩu người nhận đã được băm (crypto)
  - `style_index` (integer) — kiểu hoa đăng
  - `viewed_at` (timestamptz, nullable) — lần cuối người nhận xem
  - `created_at` (timestamptz, default now())
  - `user_id` (uuid, FK auth.users) — người tạo thiệp

2. Security
- RLS enabled.
- Người tạo (authenticated) có thể SELECT thiệp của mình.
- Người nhận (anon) có thể SELECT thiệp theo token (để xem lời chúc sau khi nhập mật khẩu).
- Chỉ authenticated mới được INSERT thiệp mới.
- Không cho phép UPDATE/DELETE từ client.

3. Functions
- `create_greeting_card(p_sender_name, p_wish, p_password, p_style_index)`:
  SECURITY DEFINER, sinh token ngẫu nhiên, băm mật khẩu bằng crypt() với pgcrypto,
  lưu vào bảng, trả về token + id. Chỉ authenticated.
- `verify_greeting_card(p_token, p_password)`:
  SECURITY DEFINER, kiểm tra mật khẩu bằng crypt(), trả về wish + sender_name + style_index
  nếu đúng, cập nhật viewed_at. Anon có thể gọi (người nhận chưa đăng nhập).
*/

CREATE TABLE IF NOT EXISTS public.greeting_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  sender_name text NOT NULL CHECK (char_length(sender_name) BETWEEN 1 AND 80),
  wish text NOT NULL CHECK (char_length(wish) BETWEEN 1 AND 500),
  password_hash text NOT NULL,
  style_index integer NOT NULL CHECK (style_index BETWEEN 1 AND 130),
  viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.greeting_cards ENABLE ROW LEVEL SECURITY;

-- Owner can see their own cards
DROP POLICY IF EXISTS "select_own_greeting_cards" ON public.greeting_cards;
CREATE POLICY "select_own_greeting_cards" ON public.greeting_cards FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Owner can insert their own cards
DROP POLICY IF EXISTS "insert_own_greeting_cards" ON public.greeting_cards;
CREATE POLICY "insert_own_greeting_cards" ON public.greeting_cards FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Anon can select by token (recipient view) — token is unguessable, password verified server-side
DROP POLICY IF EXISTS "anon_select_greeting_cards_by_token" ON public.greeting_cards;
CREATE POLICY "anon_select_greeting_cards_by_token" ON public.greeting_cards FOR SELECT
  TO anon, authenticated USING (true);

-- Ensure pgcrypto extension for crypt() / gen_salt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function: create greeting card (authenticated only)
CREATE OR REPLACE FUNCTION public.create_greeting_card(
  p_sender_name text,
  p_wish text,
  p_password text,
  p_style_index integer
)
RETURNS TABLE (id uuid, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text;
  v_hash text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF char_length(p_sender_name) < 1 OR char_length(p_sender_name) > 80 THEN
    RAISE EXCEPTION 'Tên người gửi không hợp lệ';
  END IF;
  IF char_length(p_wish) < 1 OR char_length(p_wish) > 500 THEN
    RAISE EXCEPTION 'Lời chúc không hợp lệ';
  END IF;
  IF char_length(p_password) < 4 OR char_length(p_password) > 100 THEN
    RAISE EXCEPTION 'Mật khẩu phải từ 4 đến 100 ký tự';
  END IF;
  IF p_style_index < 1 OR p_style_index > 130 THEN
    RAISE EXCEPTION 'Kiểu hoa đăng không hợp lệ';
  END IF;

  v_token := encode(gen_random_bytes(16), 'hex');
  v_hash := crypt(p_password, gen_salt('bf'));

  INSERT INTO public.greeting_cards (token, sender_name, wish, password_hash, style_index, user_id)
  VALUES (v_token, p_sender_name, p_wish, v_hash, p_style_index, v_uid);

  RETURN QUERY SELECT id, token FROM public.greeting_cards WHERE token = v_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_greeting_card FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_greeting_card TO authenticated;

-- Function: verify greeting card (anon + authenticated — recipient doesn't need login)
CREATE OR REPLACE FUNCTION public.verify_greeting_card(
  p_token text,
  p_password text
)
RETURNS TABLE (
  sender_name text,
  wish text,
  style_index integer,
  verified boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.greeting_cards%ROWTYPE;
BEGIN
  SELECT * INTO v_card FROM public.greeting_cards WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::integer, false;
    RETURN;
  END IF;

  IF v_card.password_hash = crypt(p_password, v_card.password_hash) THEN
    UPDATE public.greeting_cards SET viewed_at = now() WHERE id = v_card.id;
    RETURN QUERY SELECT v_card.sender_name, v_card.wish, v_card.style_index, true;
  ELSE
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::integer, false;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_greeting_card FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_greeting_card TO anon, authenticated;
