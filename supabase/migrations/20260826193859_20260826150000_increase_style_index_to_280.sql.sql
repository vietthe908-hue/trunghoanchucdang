/*
# Increase style_index limit from 130 to 280

1. Modified Tables
- `greeting_cards`: cập nhật CHECK constraint trên cột `style_index` từ 1-130 thành 1-280.

2. Modified Functions
- `create_greeting_card`: cập nhật kiểm tra `p_style_index` từ tối đa 130 thành tối đa 280.

3. Security
- Không thay đổi RLS.
*/

-- Remove old check constraint and add new one
ALTER TABLE public.greeting_cards DROP CONSTRAINT IF EXISTS greeting_cards_style_index_check;
ALTER TABLE public.greeting_cards ADD CONSTRAINT greeting_cards_style_index_check CHECK (style_index BETWEEN 1 AND 280);

-- Recreate create_greeting_card with updated style_index limit
DROP FUNCTION IF EXISTS public.create_greeting_card(text, text, text, text, integer);

CREATE FUNCTION public.create_greeting_card(
  p_sender_name text,
  p_recipient_name text,
  p_wish text,
  p_password text,
  p_style_index integer
)
RETURNS TABLE (
  out_id uuid,
  out_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text;
  v_hash text;
  v_id uuid;
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
  IF p_style_index < 1 OR p_style_index > 280 THEN
    RAISE EXCEPTION 'Kiểu hoa đăng không hợp lệ';
  END IF;

  v_token := encode(gen_random_bytes(16), 'hex');
  v_hash := crypt(p_password, gen_salt('bf'));

  INSERT INTO public.greeting_cards (token, sender_name, recipient_name, wish, password_hash, style_index, user_id)
  VALUES (v_token, p_sender_name, p_recipient_name, p_wish, v_hash, p_style_index, v_uid)
  RETURNING id INTO v_id;

  out_id := v_id;
  out_token := v_token;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_greeting_card(text, text, text, text, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_greeting_card(text, text, text, text, integer) TO authenticated;
