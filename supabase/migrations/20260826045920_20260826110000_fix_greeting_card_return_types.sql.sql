/*
# Fix greeting card functions return types

PostgREST cannot auto-resolve generic "record" return types.
- create_greeting_card: change RETURNS TABLE to return concrete columns
- verify_greeting_card: change RETURNS TABLE to return concrete columns
Both already work, but the return type needs to be explicit for PostgREST.
*/

DROP FUNCTION IF EXISTS public.create_greeting_card(text, text, text, integer);

CREATE OR REPLACE FUNCTION public.create_greeting_card(
  p_sender_name text,
  p_wish text,
  p_password text,
  p_style_index integer
)
RETURNS TABLE (
  id uuid,
  token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  IF p_style_index < 1 OR p_style_index > 130 THEN
    RAISE EXCEPTION 'Kiểu hoa đăng không hợp lệ';
  END IF;

  v_token := encode(gen_random_bytes(16), 'hex');
  v_hash := crypt(p_password, gen_salt('bf'));

  INSERT INTO public.greeting_cards (token, sender_name, wish, password_hash, style_index, user_id)
  VALUES (v_token, p_sender_name, p_wish, v_hash, p_style_index, v_uid)
  RETURNING id INTO v_id;

  id := v_id;
  token := v_token;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_greeting_card FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_greeting_card TO authenticated;

-- Fix verify_greeting_card
DROP FUNCTION IF EXISTS public.verify_greeting_card(text, text);

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
    sender_name := NULL;
    wish := NULL;
    style_index := NULL;
    verified := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_card.password_hash = crypt(p_password, v_card.password_hash) THEN
    UPDATE public.greeting_cards SET viewed_at = now() WHERE id = v_card.id;
    sender_name := v_card.sender_name;
    wish := v_card.wish;
    style_index := v_card.style_index;
    verified := true;
  ELSE
    sender_name := NULL;
    wish := NULL;
    style_index := NULL;
    verified := false;
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_greeting_card FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_greeting_card TO anon, authenticated;
