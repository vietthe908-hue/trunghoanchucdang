/*
# Require approved profile to create greeting cards

1. Problem
- create_greeting_card chỉ kiểm tra auth.uid() không null, không kiểm tra approval_status.
- Người dùng pending có thể tạo thiệp tâm đăng.

2. Fix
- Thêm kiểm tra: profile của người gọi phải có approval_status = 'approved'.
*/

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
  v_approved text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT approval_status INTO v_approved FROM public.profiles WHERE id = v_uid;
  IF v_approved IS NULL OR v_approved <> 'approved' THEN
    RAISE EXCEPTION 'Hồ sơ chưa được phê duyệt';
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
