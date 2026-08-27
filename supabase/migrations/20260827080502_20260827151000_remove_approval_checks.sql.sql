/*
# Remove approval requirement from lanterns and greeting cards

1. Problem
- lanterns INSERT RLS requires is_current_user_approved()
- create_greeting_card requires approval_status = 'approved'
- Now that all users are auto-approved, these checks are redundant but could break if a user somehow has non-approved status.

2. Fix
- Replace lanterns_insert_approved with a simple ownership check.
- Remove approval check from create_greeting_card.
*/

DROP POLICY IF EXISTS lanterns_insert_approved ON public.lanterns;

CREATE POLICY lanterns_insert_own ON public.lanterns
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_greeting_card(
  p_sender_name text, p_recipient_name text, p_wish text, p_password text, p_style_index integer
)
RETURNS TABLE(out_id uuid, out_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
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

GRANT EXECUTE ON FUNCTION public.create_greeting_card(text, text, text, text, integer) TO authenticated;
